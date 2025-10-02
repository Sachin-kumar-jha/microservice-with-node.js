import express from "express";
import { startConsumer } from "./consumer";
const app = express();
app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true }));

const port = process.env.PORT || 4002;
app.listen(port, async () => {
  console.log("Inventory service running on", port);
  startConsumer().catch(e => console.error(e));
});
