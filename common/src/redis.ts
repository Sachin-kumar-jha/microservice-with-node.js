import {Redis} from "ioredis";
export const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
export async function ensureGroup(stream: string, group: string) {
  try {
    await redis.xgroup("CREATE", stream, group, "$", "MKSTREAM");
    console.log(`Created group ${group} on ${stream}`);
  } catch (err: any) {
    if (typeof err.message === "string" && err.message.includes("BUSYGROUP")) {
      // already exists
      return;
    }
    throw err;
  }
}

// helper to publish to stream
export async function publish(stream: string, data: Record<string, string>) {
  return redis.xadd(stream, "*", ...Object.entries(data).flat());
}

export async function xAutoClaim(stream:string, group:string, consumer:string, minIdle:number=60000) {
  // Using XAUTOCLAIM if available; fallback handled by redis library error if not supported
  try {
    const res:any = await redis.call("XAUTOCLAIM", stream, group, consumer, String(minIdle), "0-0", "JUSTID");
    return res;
  } catch (e) {
    return [];
  }
}
