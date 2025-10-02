import Redis from "ioredis";
export const redis = new Redis(process.env.REDIS_URL || "redis://redis:6379");

export async function publishPaymentConfirmed(payload:any) {
  return redis.xadd("stream:payments:confirmed", "*",
    "type","payment.confirmed",
    "orderId", String(payload.orderId),
    "userId", String(payload.userId),
    "amount", String(payload.amount),
    "items", JSON.stringify(payload.items || []),
    "ts", String(Date.now())
  );
}
