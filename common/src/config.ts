import dotenv from "dotenv";

dotenv.config(); // loads the service-specific .env file

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`❌ Missing environment variable: ${name}`);
  return value;
}

export const config = {
  env: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "4000", 10),

  redisUrl: required("REDIS_URL"),

  dbUrl: required("DATABASE_URL"),

  jwtSecret: process.env.JWT_SECRET || "default_jwt_secret",

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || "",
    keySecret: process.env.RAZORPAY_KEY_SECRET || "",
  },
};
