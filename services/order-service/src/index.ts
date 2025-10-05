import express from "express";
import prisma from "./prismaClient"; // your prisma client
import { redis, publishOrderCreated } from "./producer";

const app = express();
app.use(express.json());

import { Request, Response, NextFunction } from "express";

interface AuthRequest extends Request {
  user?: { id: string; email: string };
}

app.post("/placeorder", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId= req.headers["x-user-id"] as string;
    const { items } = req.body;
   
    console.log(userId);// use optional chaining in case it's undefined
    if (!userId) {
      return res.status(400).json({ message: "Missing userId" });
    }
    if (!items || !items.length) {
      return res.status(400).json({ message: "No items provided" });
    }

    const orderId = crypto.randomUUID();
    const amount = items.reduce((sum: number, i: any) => sum + i.qty * i.price, 0);

    await prisma.order.create({
      data: {
        externalId: orderId,
        userId,
        items,
        amount,
        status: "PENDING",
      },
    });

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
