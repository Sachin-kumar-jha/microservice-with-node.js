import Redis from "ioredis";
import prisma from "./prismaClient";
import { Kafka } from "kafkajs";

const redis = new Redis(process.env.REDIS_URL || "redis://redis:6379");

const STREAM = "stream:payments:confirmed";
const GROUP = "cg:payments:order-service";
const CONSUMER = `order-${process.pid}`;
const kafka = new Kafka({ brokers: [process.env.KAFKA_BROKER || "kafka:9092"] });
const producer = kafka.producer();

async function ensureKafka() {
  await producer.connect();
  console.log("Kafka producer connected");
}

// Automatically create group if not exists
async function ensureGroup() {
  try {
    // "0" → read all existing messages for testing
    await redis.xgroup("CREATE", STREAM, GROUP, "$", "MKSTREAM");
    console.log(`Consumer group ${GROUP} created`);
  } catch (err: any) {
    if (err.message.includes("BUSYGROUP")) {
      console.log(`Consumer group ${GROUP} already exists`);
    } else {
      throw err;
    }
  }
}

async function processMessage(id: string, fields: any[]) {
  const f: any = {};
  for (let i = 0; i < fields.length; i += 2) f[fields[i]] = fields[i + 1];

  // Keep orderId as string
  const orderId = f.orderId;
  const items = JSON.parse(f.items || "[]");
  const amount = Number(f.amount);

  // Idempotency check
  const existing = await prisma.order.findUnique({ where: { externalId: orderId } });
  if (!existing) {
    await prisma.order.create({
      data: {
        externalId: orderId,
        userId: f.userId,
        items,
        amount,
        status: "CONFIRMED",
      },
    });
  } else {
    if (existing.status === "CONFIRMED") {
      await redis.xack(STREAM, GROUP, id);
      return;
    }
    await prisma.order.update({ where: { id: existing.id }, data: { status: "CONFIRMED" } });
  }

  // Produce event to orders:confirmed for inventory & notifications
  await redis.xadd(
    "stream:orders:confirmed",
    "*",
    "type", "order.confirmed",
    "orderId", orderId,
    "userId", f.userId,
    "items", JSON.stringify(items),
    "amount", String(amount),
    "ts", String(Date.now())
  );

  //Publish to Kafka for notifications
  await producer.send({
    topic: process.env.NOTIFICATION_TOPIC || "notifications",
    messages: [
      {
        key: orderId,
        value: JSON.stringify({
          type: "order.confirmed",
          orderId,
          userId:f.userId,
          items,
          amount,
          ts: Date.now(),
        }),
      },
    ],
  });
  console.log(`Published order.confirmed to Kafka for ${orderId}`);

  // Acknowledge Redis message
  await redis.xack(STREAM, GROUP, id);

}

export async function startPaymentConsumer() {
  await ensureGroup();
  await ensureKafka();
  console.log("Order-service payment consumer started");

  while (true) {
    try {
      const res: any = await redis.xreadgroup(
        "GROUP", GROUP, CONSUMER,
        "COUNT", 1,
        "BLOCK", 5000,
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
    } catch (e: any) {
      console.error("consumer loop error", e);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

// Start the consumer automatically

