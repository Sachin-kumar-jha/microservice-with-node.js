// import express from "express";
// import Razorpay from "razorpay";
// import bodyParser from "body-parser";
// import crypto from "crypto";
// import { publishPaymentConfirmed } from "./producer";

// const app = express();
// app.use(express.json());

// // create payment order (called by frontend or order-service after stock reserved)
// app.post("/create-order", async (req, res) => {
//   const { orderId, amount, currency = "INR" } = req.body;
//   // const razor = new Razorpay({
//   //   key_id: process.env.RAZORPAY_KEY_ID!,
//   //   key_secret: process.env.RAZORPAY_KEY_SECRET!
//   // });

//   try {
//     // const rOrder = await razor.orders.create({
//     //   amount: Math.round(amount * 100),
//     //   currency,
//     //   receipt: `rcpt_${orderId}`,
//     //   notes: { ourOrderId: orderId }
//     // });
//     res.json({ success: true, orderId,amount });
//   } catch (err:any) {
//     res.status(500).json({ success: false, error: err?.message || err });
//   }
// });

// // Webhook endpoint - Razorpay will send raw body; verify signature
// app.post("/webhook", bodyParser.raw({ type: "application/json" }), async (req:any, res:any) => {
//   const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
//   const signature = req.headers["x-razorpay-signature"] as string;
//   const body = req.body as Buffer;

//   const expected = crypto.createHmac("sha256", webhookSecret).update(body).digest("hex");
//   if (expected !== signature) {
//     return res.status(400).send("Invalid signature");
//   }

//   const payload = JSON.parse(body.toString());
//   // handle payment.captured
//   if (payload.event === "payment.captured") {
//     const paymentEntity = payload.payload.payment.entity;
//     const ourOrderId = paymentEntity.notes?.ourOrderId || paymentEntity.order_id;
//     // publish to Redis stream
//     await publishPaymentConfirmed({
//       orderId: ourOrderId,
//       userId: paymentEntity.email || paymentEntity.contact || "unknown",
//       amount: paymentEntity.amount / 100,
//       items: JSON.parse(paymentEntity.notes?.items || "[]")
//     });

//     return res.status(200).send("ok");
//   }

//   res.status(200).send("ignored");
// });

// app.get("/health", (req, res) => res.json({ ok: true }));
// app.listen(process.env.PORT || 4004, () => console.log("Payment service running on", process.env.PORT || 4004));

import express from "express";
import { publishPaymentConfirmed } from "./producer";

const app = express();
app.use(express.json());

// Fake create order (just returns success)
app.post("/create-order", async (req, res) => {
  const { orderId, amount, currency = "INR" } = req.body;
  // No real Razorpay logic, just simulate
  res.json({ success: true, orderId, amount, currency });
});

// Fake webhook endpoint (simulate Razorpay sending success)
app.post("/webhook", async (req, res) => {
  try {
    const { orderId, userId = "test-user", amount = 200, items = [] } = req.body;

    
    // Directly publish to Redis as if payment was captured
    await publishPaymentConfirmed({
      orderId,
      userId,
      amount,
      items
    });

    return res.status(200).send("ok (test webhook)");
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Healthcheck
app.get("/health", (req, res) => res.json({ ok: true }));

app.listen(process.env.PORT || 4004, () =>
  console.log("Payment service running (TEST MODE) on", process.env.PORT || 4004)
);
