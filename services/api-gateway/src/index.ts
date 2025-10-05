// import express, { Request, Response, NextFunction } from "express";
// import { createProxyMiddleware, Options, RequestHandler } from "http-proxy-middleware";
// import jwt, { JwtPayload } from "jsonwebtoken";
// import getRawBody from "raw-body";
// import { IncomingMessage } from "http";

// const app = express();

// // ----------------------
// // AuthRequest interface
// // ----------------------
// interface AuthRequest extends Request {
//   user?: { id: string; email: string };
 
// }

// app.post("/auth/login",express.json(), (req: Request, res: Response) => {
//   const { email, password } = req.body;

//   // Validate user (dummy)
//   if (email === "test@test.com" && password === "123456") {
//     // Create JWT
//     const token = jwt.sign(
//       { id: "user123", email }, 
//       process.env.JWT_SECRET || "supersecret",
//       { expiresIn: "1h" }
//     );

//     return res.json({ token });
//   }

//   return res.status(401).json({ message: "Invalid credentials" });
// });

// const authMiddleware = async(req: AuthRequest, res: Response, next: NextFunction)=> {
//   const authHeader = req.headers.authorization;
//   if (!authHeader) {
//     console.log("[Auth] No token provided");
//     return res.status(401).json({ message: "No token provided" });
//   }

//   const [, token] = authHeader.split(" ");
//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET || "supersecret") as JwtPayload;
//     req.user = { id: decoded.id as string, email: decoded.email as string };
//      console.log(`[Auth] User authenticated: ${req.user.id}`);
//      next();
//   } catch {
//     console.log("[Auth] Invalid token");
//     return res.status(401).json({ message: "Invalid token" });
//   }
// }
// // ----------------------
// // ProxyOptions interface
// // ----------------------
// interface ProxyOptions extends Options {
//   logLevel?: "debug" | "info" | "warn" | "error" | "silent";
//   onProxyReq?: (proxyReq: any, req: AuthRequest, res: Response) => void;
//   onProxyRes?: (proxyRes: IncomingMessage, req: AuthRequest, res: Response) => void;
//   onError?:(err:any,req:AuthRequest,res:Response)=>void;
  
// }

// // // ----------------------
// // // Auth middleware
// // // ----------------------
// // const authMiddleware =async(req: AuthRequest, res: Response, next: NextFunction)=> {
// //   const authHeader = req.headers.authorization;
// //   if (!authHeader) {
// //     console.log("[Auth] No token provided");
// //     return res.status(401).json({ message: "No token provided" });
// //   }

// //   const [, token] = authHeader.split(" ");
// //   try {
// //     const decoded = jwt.verify(token, process.env.JWT_SECRET || "supersecret") as JwtPayload;
// //     req.user = { id: decoded.id as string, email: decoded.email as string };
// //      console.log(`[Auth] User authenticated: ${req.user.id}`);
// //      next();
// //   } catch {
// //     console.log("[Auth] Invalid token");
// //     return res.status(401).json({ message: "Invalid token" });
// //   }
// // }



// // ----------------------
// // Proxy helper
// // ----------------------
// // ----------------------
// // Proxy helper with logging
// // ----------------------
// function proxyWithBody(serviceName: string, target: string, pathRewrite: Record<string, string>): RequestHandler {
//   const options: ProxyOptions = {
//     target,
//     changeOrigin: true,
//     pathRewrite,
//     proxyTimeout: 20000,
//     logLevel: "debug",
//    onProxyReq: (proxyReq, req: AuthRequest, res) => {
//       console.log(`[Gateway] Forwarding ${req.method} ${req.originalUrl} → ${serviceName}`);
//       if (req.user) {
//         proxyReq.setHeader("x-user-id", req.user.id);
//         proxyReq.setHeader("x-user-email", req.user.email);
//       }
//     },

//     // Log response from downstream service
//     onProxyRes: (proxyRes, req: AuthRequest) => {
//       console.log(`[Gateway] ${req.method} ${req.originalUrl} → ${proxyRes.statusCode} from ${serviceName}`);
//     },

//     // Handle errors
//     onError: (err, req: AuthRequest, res: Response) => {
//       console.error(`[Gateway] Error forwarding ${req.method} ${req.url} → ${serviceName}:`, err.message);
//       res.writeHead(500, { "Content-Type": "application/json" });
//       res.end(JSON.stringify({ message: `Gateway error forwarding to ${serviceName}` }));
//     }
//   };

//   return createProxyMiddleware(options);
// }


// // ----------------------
// // Service URLs
// // ----------------------
// const USER_SVC = process.env.USER_SVC || "http://localhost:4001";
// const ORDER_SVC = process.env.ORDER_SVC || "http://localhost:4002";
// const INVENTORY_SVC = process.env.INVENTORY_SVC || "http://localhost:4003";
// const PAYMENT_SVC = process.env.PAYMENT_SVC || "http://localhost:4004";

// // ----------------------
// // Logging middleware
// // ----------------------
// // app.use((req: Request, _res: Response, next: NextFunction) => {
// //   console.log(`[Gateway] Incoming ${req.method} request: ${req.originalUrl}`);
// //   next();
// // });

// // ----------------------
// // Routes
// // ----------------------



// // Protected routes
// // Protected routes with logging
// app.use("/users", proxyWithBody("user-service", USER_SVC, { "^/users": "" }));


// app.use("/order", authMiddleware,proxyWithBody("order-service", ORDER_SVC, {}));
// app.use("/inventory", authMiddleware, proxyWithBody("inventory-service", INVENTORY_SVC, { "^/inventory": "" }));
// app.use("/payment", authMiddleware, proxyWithBody("payment-service", PAYMENT_SVC, { "^/payment": "" }));


// // Health check
// app.get("/", express.json(),(_req: Request, res: Response) => {
//   console.log("[Gateway] Health check requested");
//   res.json({ message: "API Gateway running 🚀" });
// });

// // ----------------------
// // Start server
// // ----------------------
// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => console.log(`[Gateway] Running on port ${PORT}`));

import express, { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import httpProxy from "http-proxy";

const app = express();

const proxy = httpProxy.createProxyServer({});

// ----------------------
// AuthRequest interface
// ----------------------
interface AuthRequest extends Request {
  user?: { id: string; email: string };
}

// ----------------------
// Auth middleware
// ----------------------
const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token =req.headers.authorization?.split(" ")[1];

 if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "supersecret") as JwtPayload;
    req.user = { id: decoded.id as string, email: decoded.email as string };
    console.log(`[Auth] User authenticated: ${req.user.id}`);
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};

// ----------------------
// Proxy helper
// ----------------------
function forwardRequest(req: AuthRequest, res: Response, target: string) {
  // Add user headers
  if (req.user) {
    req.headers["x-user-id"] = req.user.id;
    req.headers["x-user-email"] = req.user.email;
  }

  console.log(`[Gateway] Forwarding ${req.method} ${req.originalUrl} → ${target}`);

  proxy.web(req, res, { target, changeOrigin: true }, (err) => {
    console.error(`[Gateway] Proxy error:`, err.message);
    res.status(500).json({ message: "Gateway error" });
  });
}

// ----------------------
// Service URLs
// ----------------------
const USER_SVC = process.env.USER_SVC || "http://localhost:4001";
const ORDER_SVC = process.env.ORDER_SVC || "http://localhost:4003";
const INVENTORY_SVC = process.env.INVENTORY_SVC || "http://localhost:4003";
const PAYMENT_SVC = process.env.PAYMENT_SVC || "http://localhost:4004";

// ----------------------
// Routes
// ----------------------

// Protected order route
app.all("/order/*", authMiddleware, (req: AuthRequest, res: Response) => {
  req.url = req.url.replace(/^\/order/, "");
  forwardRequest(req, res, ORDER_SVC);
});

// User route (no auth for example)
app.all("/users/*", (req: AuthRequest, res: Response) => {
    req.url = req.url.replace(/^\/users/, "");
  forwardRequest(req, res, USER_SVC);
});


// Health check
app.get("/", (_req, res) => {
  res.json({ message: "API Gateway running 🚀" });
});

// ----------------------
// Start server
// ----------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`[Gateway] Running on port ${PORT}`));
