import express, { Request, Response, NextFunction } from "express";
import { createProxyMiddleware, responseInterceptor } from "http-proxy-middleware";
import jwt, { JwtPayload } from "jsonwebtoken";

interface AuthRequest extends Request {
  user?: { id: string; email: string };
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const USER_SVC = process.env.USER_SVC || "http://user-service:4001";
const INVENTORY_SVC = process.env.INVENTORY_SVC || "http://inventory-service:4002";
const ORDER_SVC = process.env.ORDER_SVC || "http://order-service:4003";
const PAYMENT_SVC = process.env.PAYMENT_SVC || "http://payment-service:4004";

// Auth middleware
function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: "No token provided" });
  const [, token] = header.split(" ");
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "supersecret") as JwtPayload;
    req.user = { id: decoded.id as string, email: decoded.email as string };
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

// Proxy helper
function proxyWithBody(target: string, pathRewrite: Record<string, string>) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite,
    logLevel: "debug",
    selfHandleResponse: false, // let node handle response automatically
    onProxyReq: (proxyReq, req: AuthRequest) => {
      // Forward user info as headers
      if (req.user) {
        proxyReq.setHeader("x-user-id", req.user.id);
        proxyReq.setHeader("x-user-email", req.user.email);
      }
    proxyTimeout:20000 // 20s
}})
}


// Routes
app.use("/users", proxyWithBody(USER_SVC, { "^/users": "" }));
app.use("/inventory", authMiddleware, proxyWithBody(INVENTORY_SVC, { "^/inventory": "" }));
app.use("/orders", authMiddleware, proxyWithBody(ORDER_SVC, { "^/orders": "" }));
app.use("/payments", authMiddleware, proxyWithBody(PAYMENT_SVC, { "^/payments": "" }));

app.get("/hello", (req, res) => res.json({ message: "API Gateway running" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API Gateway running on port ${PORT}`));
