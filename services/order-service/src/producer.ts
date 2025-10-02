import Redis from "ioredis";
export const redis = new Redis(process.env.REDIS_URL || "redis://redis:6379");

export async function publishOrderCreated(order: any) {
  // order: { orderId, userId, items (JSON), amount }
  const id = await redis.xadd("stream:orders:created", "*",
    "type", "order.created",
    "orderId", String(order.orderId),
    "userId", String(order.userId),
    "items", JSON.stringify(order.items),
    "amount", String(order.amount),
    "ts", String(Date.now())
  );
  return id;
}
