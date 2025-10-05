import express from "express";
import prisma from "./prismaClient"; // your prisma client
import { redis, publishOrderCreated } from "./producer";
import { Request, Response, NextFunction } from "express";
import { startPaymentConsumer } from "./paymentConsumer";
const app = express();
app.use(express.json());




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

app.post("/orders/:orderId/status", async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  if (!status) return res.status(400).json({ error: "Missing status" });

  try {
    // Find the order by externalId (assuming you store orderId from payment service as externalId)
    const order = await prisma.order.findUnique({ where: { externalId: orderId } });

    if (!order) return res.status(404).json({ error: "Order not found" });

    // Update status
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { status }
    });

    console.log(`Order ${orderId} status updated to ${status}`);

    return res.status(200).json({ success: true, order: updated });
  } catch (err: any) {
    console.error("Error updating order status:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.get("/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4003;
app.listen(PORT, async () =>{
console.log(`Order Service running on port ${PORT}`);
   startPaymentConsumer().catch((err) => {
    console.error("Payment consumer failed to start", err);
    process.exit(1); // exit if consumer fails
  });
});
