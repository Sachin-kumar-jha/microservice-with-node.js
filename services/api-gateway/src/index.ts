import express, { Request, Response, NextFunction } from "express";
import { createProxyMiddleware, Options, RequestHandler } from "http-proxy-middleware";
import jwt, { JwtPayload } from "jsonwebtoken";
import getRawBody from "raw-body";
import { IncomingMessage } from "http";

const app = express();

// ----------------------
// AuthRequest interface
// ----------------------
interface AuthRequest extends Request {
  user?: { id: string; email: string };
  rawBody?: Buffer;
}

// ----------------------
// ProxyOptions interface
// ----------------------
interface ProxyOptions extends Options {
  logLevel?: "debug" | "info" | "warn" | "error" | "silent";
  onProxyReq?: (proxyReq: any, req: AuthRequest, res: Response) => void;
  onProxyRes?: (proxyRes: IncomingMessage, req: AuthRequest, res: Response) => void;
}

// ----------------------
// Auth middleware
// ----------------------
function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.log("[Auth] No token provided");
    return res.status(401).json({ message: "No token provided" });
  }

  const [, token] = authHeader.split(" ");
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "supersecret") as JwtPayload;
    req.user = { id: decoded.id as string, email: decoded.email as string };
    console.log(`[Auth] User authenticated: ${req.user.id}`);
    next();
  } catch {
    console.log("[Auth] Invalid token");
    return res.status(401).json({ message: "Invalid token" });
  }
}

// ----------------------
// Capture raw body middleware
// ----------------------
async function captureRawBody(req: AuthRequest, res: Response, next: NextFunction) {
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    try {
      const raw = await getRawBody(req);
      // req.rawBody = raw;
      console.log(`[Gateway] Captured raw body: ${raw.toString()}`);
    } catch (err) {
      return next(err);
    }
  }
  next();
}

// ----------------------
// Proxy helper
// ----------------------
function proxyWithBody(target: string, pathRewrite: Record<string, string>): RequestHandler {
  const options: ProxyOptions = {
    target,
    changeOrigin: true,
    pathRewrite,
    selfHandleResponse: false,
    proxyTimeout: 20000,
    logLevel: "debug",
    onProxyReq: (proxyReq, req) => {
      const authReq = req as AuthRequest;

      console.log(`[Proxy] Forwarding request to: ${target}${proxyReq.path}`);
      console.log(`[Proxy] Method: ${req.method}`);

      // Forward user headers
      if (authReq.user) {
        proxyReq.setHeader("x-user-id", authReq.user.id);
        proxyReq.setHeader("x-user-email", authReq.user.email);
        console.log(`[Proxy] Forwarding headers: x-user-id=${authReq.user.id}`);
      }

      // Forward raw body if exists
      if (authReq.rawBody && authReq.rawBody.length) {
        proxyReq.setHeader("Content-Type", "application/json");
        proxyReq.setHeader("Content-Length", authReq.rawBody.length);
        proxyReq.write(authReq.rawBody);
        proxyReq.end();
        console.log(`[Proxy] Forwarded body: ${authReq.rawBody.toString()}`);
      }
    },
    onProxyRes: (proxyRes, req, res) => {
      let body: any[] = [];
      proxyRes.on("data", (chunk: Buffer) => body.push(chunk));
      proxyRes.on("end", () => {
        const responseBody = Buffer.concat(body).toString();
        console.log(`[Proxy] Response from ${target}${req.url}:`, responseBody);
      });
    },
  };

  return createProxyMiddleware(options);
}

// ----------------------
// Service URLs
// ----------------------
const USER_SVC = process.env.USER_SVC || "http://localhost:4001";
const ORDER_SVC = process.env.ORDER_SVC || "http://localhost:4002";
const INVENTORY_SVC = process.env.INVENTORY_SVC || "http://localhost:4003";
const PAYMENT_SVC = process.env.PAYMENT_SVC || "http://localhost:4004";

// ----------------------
// Logging middleware
// ----------------------
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[Gateway] Incoming ${req.method} request: ${req.originalUrl}`);
  next();
});

// ----------------------
// Routes
// ----------------------



// Protected routes
app.use("/users", proxyWithBody(USER_SVC, { "^/users": "" }));
app.use("/orders",authMiddleware,captureRawBody, proxyWithBody(ORDER_SVC, { "^/orders": "" }));
app.use("/inventory",  authMiddleware,captureRawBody, proxyWithBody(INVENTORY_SVC, { "^/inventory": "" }));
app.use("/payment", captureRawBody, authMiddleware, proxyWithBody(PAYMENT_SVC, { "^/payment": "" }));

// Health check
app.get("/", (_req: Request, res: Response) => {
  console.log("[Gateway] Health check requested");
  res.json({ message: "API Gateway running 🚀" });
});

// ----------------------
// Start server
// ----------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`[Gateway] Running on port ${PORT}`));
