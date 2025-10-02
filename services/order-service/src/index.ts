import express from "express";
import prisma from "./prismaClient"; // your prisma client
import { redis, publishOrderCreated } from "./producer";

const app = express();
app.use(express.json());

// Endpoint to create order
app.post("/orders", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    console.log(userId);
    if (!userId) return res.status(400).json({ message: "Missing userId" });

    const { items } = req.body;
    if (!items || !items.length) return res.status(400).json({ message: "No items provided" });

    const orderId = crypto.randomUUID();
    const amount = items.reduce((sum: number, i: any) => sum + i.qty * i.price, 0);

    // Save order in DB
    await prisma.order.create({
      data: {
        externalId: orderId,
        userId:Number("68de33d60b1aef57ac6a7819"),
        items,
        amount,
        status: "PENDING",
      },
    });

    // Publish to Redis stream
    await publishOrderCreated({ orderId, userId, items, amount });

    return res.json({ message: "Order created", orderId });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal error" });
  }
});

app.get("/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4003;
app.listen(PORT, () => console.log(`Order Service running on port ${PORT}`));
