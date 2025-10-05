import Redis from "ioredis";
import prisma from "./prismaClient";
import axios from "axios";

const redis = new Redis(process.env.REDIS_URL || "redis://redis:6379");

const ORDER_SERVICE = process.env.ORDER_SVC || "http://localhost:4003";

// Streams
const STREAM_PREPAY = "stream:orders:created";        // before payment
const STREAM_CONFIRMED = "stream:orders:confirmed";  // after payment

// Consumer groups
const GROUP_PREPAY = "cg:orders:inventory-prepay";
const GROUP_CONFIRMED = "cg:orders:inventory-confirmed";

// Consumer name
const CONSUMER = `inventory-${process.pid}`;

// DLQ / retries
const MAX_RETRIES = 3;
const DLQ_STREAM = "stream:inventory:dlq";

// -------------------- Helper: create consumer group --------------------
async function ensureGroup(stream: string, group: string) {
  try {
    await redis.xgroup("CREATE", stream, group, "0", "MKSTREAM");
    console.log(`Created consumer group ${group} for ${stream}`);
  } catch (e: any) {
    if (!e.message.includes("BUSYGROUP")) throw e;
  }
}

// -------------------- Stock Check --------------------
async function checkStock(items: any[]) {
  for (const it of items) {
    const product = await prisma.product.findUnique({ where: { id: it.productId } });
    if (!product || product.stock < Number(it.qty)) return false;
  }
  return true;
}

// -------------------- Reserve Stock --------------------
async function reserveStock(orderId: string, items: any[]) {
  return prisma.$transaction(async (tx: any) => {
    // Check stock first
    for (const it of items) {
      const product = await tx.product.findUnique({ where: { id: it.productId } });
      if (!product || product.stock < Number(it.qty)) {
        throw new Error(`Product ${it.productId} out of stock`);
      }
    }

    // Deduct stock
    for (const it of items) {
      await tx.product.update({
        where: { id: it.productId },
        data: { stock: { decrement: Number(it.qty) } }
      });
    }

    // Create reservation
    await tx.reservation.create({
      data: { orderId, items: items}
    });

    return true;
  });
}

// -------------------- Process Message --------------------
async function processMessage(stream: string, group: string, id: string, fields: any[]) {
  const f: any = {};
  for (let i = 0; i < fields.length; i += 2) f[fields[i]] = fields[i + 1];

  const orderId = f.orderId;
  const items = JSON.parse(f.items || "[]");

  // -------------------- Pre-payment --------------------
  if (stream === STREAM_PREPAY) {
    const inStock = await checkStock(items);
    if (!inStock) {
      await axios.post(`${ORDER_SERVICE}/orders/${orderId}/status`, { status: "OUT_OF_STOCK" }).catch(() => {});
      console.log(`❌ Order ${orderId} out of stock`);
    }
    await redis.xack(stream, group, id);
    return;
  }

  // -------------------- Post-payment (confirmed) --------------------
  if (stream === STREAM_CONFIRMED) {
    const exists = await prisma.reservation.findFirst({ where: { orderId } });
    if (exists) { 
      await redis.xack(stream, group, id);
      return; 
    }

    try {
      await reserveStock(orderId, items);
      console.log(`✅ Stock reserved for order ${orderId}`);

      // Notify inventory reserved
      await redis.xadd("stream:inventory:reserved", "*",
        "type", "inventory.reserved",
        "orderId", orderId,
        "items", JSON.stringify(items),
        "ts", String(Date.now())
      );
    } catch (err: any) {
      console.error("Reservation error", err);

      // Send to DLQ
      await redis.xadd(DLQ_STREAM, "*",
        "orderId", orderId,
        "error", String(err),
        "ts", String(Date.now())
      );
    }
    await redis.xack(stream, group, id);
  }
}

// -------------------- Consumer Loop --------------------
async function consume(stream: string, group: string) {
  await ensureGroup(stream, group);
  console.log(`✅ Consumer started for ${stream}`);

  while (true) {
    try {
      const resp: any = await redis.xreadgroup(
        "GROUP", group, CONSUMER,
        "COUNT", 1,
        "BLOCK", 5000,
        "STREAMS", stream, ">"
      );

      if (!resp) continue;

      for (const [, messages] of resp) {
        for (const [id, fields] of messages) {
          await processMessage(stream, group, id, fields);
        }
      }
    } catch (e: any) {
      console.error("Consumer loop error", e);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

// -------------------- Start Consumers --------------------
export async function startInventoryConsumers() {
  consume(STREAM_PREPAY, GROUP_PREPAY);
  consume(STREAM_CONFIRMED, GROUP_CONFIRMED);
  console.log("✅ Inventory consumers started for prepay and confirmed orders");
}
