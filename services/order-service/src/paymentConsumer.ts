import Redis from "ioredis";
import prisma from "./prismaClient";
const redis = new Redis(process.env.REDIS_URL || "redis://redis:6379");

const STREAM = "stream:payments:confirmed";
const GROUP = "cg:payments:order-service";
const CONSUMER = `order-${process.pid}`;

async function ensureGroup() {
  try {
    await redis.xgroup("CREATE", STREAM, GROUP, "$", "MKSTREAM");
  } catch (e:any) {
    if (!e.message.includes("BUSYGROUP")) throw e;
  }
}

async function processMessage(id:string, fields:any[]) {
  const f:any = {};
  for (let i=0;i<fields.length;i+=2) f[fields[i]] = fields[i+1];
  const orderId = Number(f.orderId);
  const items = JSON.parse(f.items || "[]");
  const amount = Number(f.amount);

  // Idempotency
  const existing = await prisma.order.findUnique({ where: { externalId: String(orderId) }});
  if (!existing) {
    // create or update
    await prisma.order.create({
      data: {
        externalId: String(orderId),
        userId:f.userId,
        items,
        amount,
        status: "CONFIRMED"
      }
    });
  } else {
    if (existing.status === "CONFIRMED") {
      await redis.xack(STREAM, GROUP, id);
      return;
    }
    await prisma.order.update({ where: { id: existing.id }, data: { status: "CONFIRMED" }});
  }

  // produce event to orders:confirmed for inventory & notification
  await redis.xadd("stream:orders:confirmed", "*",
    "type","order.confirmed",
    "orderId", String(orderId),
    "userId", String(f.userId),
    "items", JSON.stringify(items),
    "amount", String(amount),
    "ts", String(Date.now())
  );

  await redis.xack(STREAM, GROUP, id);
}

export async function startPaymentConsumer() {
  await ensureGroup();
  console.log("Order-service payment consumer started");
  while (true) {
    try {
const res:any = await redis.call(
  "XREADGROUP",
  "GROUP", GROUP, CONSUMER,
  "BLOCK", "0",
  "COUNT", "1",
  "STREAMS", STREAM, ">"
);

      if (!res) continue;
      for (const [, messages] of res) {
        for (const [id, fields] of messages) {
          try {
            await processMessage(id, fields);
          } catch (err) {
            console.error("process error", err);
            // move to DLQ
            await redis.xadd("stream:payments:dlq", "*", "originalId", id, "error", String(err));
            await redis.xack(STREAM, GROUP, id);
          }
        }
      }
    } catch (e:any) {
      console.error("consumer loop error", e);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}
