import Redis from "ioredis";
import prisma from "./prismaClient";
import axios from "axios";

// -------------------- Redis + Constants --------------------
const redis = new Redis(process.env.REDIS_URL || "redis://redis:6379");

const STREAM = "stream:orders:created";
const GROUP = "cg:orders:inventory";
const CONSUMER = `inventory-${process.pid}`;
const ORDER_SERVICE = process.env.ORDER_SERVICE_URL || "http://localhost:4003";

// Retry / DLQ settings
const MAX_RETRIES = 3;
const DLQ_STREAM = "stream:inventory:dlq";

// -------------------- Helper --------------------
async function ensureGroup() {
  try {
    await redis.xgroup("CREATE", STREAM, GROUP, "$", "MKSTREAM");
    console.log(`Created consumer group ${GROUP}`);
  } catch (e: any) {
    if (!e.message.includes("BUSYGROUP")) throw e;
  }
}

// -------------------- Stock Reservation --------------------
async function tryReserve(orderId: string, items: any[]) {
  return prisma.$transaction(async (tx: any) => {
    // Check stock
    for (const it of items) {
      const p = await tx.product.findUnique({
        where: { id: it.productId }
      });
      if (!p || p.stock < Number(it.qty)) {
        return { ok: false, reason: "OUT_OF_STOCK" };
      }
    }

    // Deduct stock
    for (const it of items) {
      console.log(it.productId);
      await tx.product.update({
        where: { id: it.productId},
        data: { stock: { decrement: Number(it.qty) } }
      });
    }

    // Create reservation record
    await tx.reservation.create({
      data: { orderId, items }
    });

    return { ok: true };
  });
}


// -------------------- Message Processor --------------------
async function processMessage(id: string, fields: any[]) {
  const f: any = {};
  for (let i = 0; i < fields.length; i += 2) f[fields[i]] = fields[i + 1];

  const orderId = f.orderId;
  const items = JSON.parse(f.items || "[]");

  // idempotency check
  const exists = await prisma.reservation.findUnique({ where: { orderId } });
  if (exists) {
    await redis.xack(STREAM, GROUP, id);
    return;
  }

  try {
    const res = await tryReserve(orderId, items);
    if (res.ok) {
      // notify success
      await redis.xadd("stream:inventory:reserved", "*",
        "type", "inventory.reserved",
        "orderId", orderId,
        "items", JSON.stringify(items),
        "ts", String(Date.now())
      );
    } else {
      // notify out of stock
      await redis.xadd("stream:inventory:out_of_stock", "*",
        "type", "inventory.out_of_stock",
        "orderId", orderId,
        "reason", res.reason || "OUT_OF_STOCK",
        "ts", String(Date.now())
      );

      // update order service
      await axios.post(`${ORDER_SERVICE}/orders/${orderId}/status`, { status: "OUT_OF_STOCK" }).catch(() => {});
    }

    await redis.xack(STREAM, GROUP, id);
  } catch (err: any) {
    console.error("Reservation error", err);

    // retry handling
    const retryCount = Number(f.retry || "0");
    if (retryCount < MAX_RETRIES) {
      await redis.xadd(STREAM, "*",
        "orderId", orderId,
        "items", JSON.stringify(items),
        "retry", String(retryCount + 1),
        "ts", String(Date.now())
      );
    } else {
      // send to dead-letter queue
      await redis.xadd(DLQ_STREAM, "*",
        "orderId", orderId,
        "error", String(err),
        "ts", String(Date.now())
      );
    }

    await redis.xack(STREAM, GROUP, id);
  }
}

// -------------------- Consumer Loop --------------------
export async function startConsumer() {
  await ensureGroup();
  console.log("✅ Inventory consumer started");

  while (true) {
    try {
      const resp: any = await redis.xreadgroup(
        "GROUP", GROUP, CONSUMER,
        "COUNT", 1,
        "BLOCK",5000,
        "STREAMS", STREAM, ">"
      );

      if (!resp) continue;

      for (const [, messages] of resp) {
        for (const [id, fields] of messages) {
          await processMessage(id, fields);
        }
      }
    } catch (e: any) {
      console.error("❌ Consumer loop error", e);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}
