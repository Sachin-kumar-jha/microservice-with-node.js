import { Kafka } from "kafkajs";
import nodemailer from "nodemailer";
import express from "express";

const kafka = new Kafka({ brokers: [process.env.KAFKA_BROKER || "kafka:9092"] });
const consumer = kafka.consumer({ groupId: "notification-group" });

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

async function startConsumer() {
  await consumer.connect();
  await consumer.subscribe({ topic: process.env.NOTIFICATION_TOPIC || "notifications", fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      const evt = JSON.parse(message.value.toString());
      console.log("Notification event:", evt);
      // for demo: send a simple email (retrieve user's email via DB / user service in prod)
      try {
        await transporter.sendMail({
          from: process.env.FROM_EMAIL,
          to: evt.email || "user@example.com",
          subject: `Order ${evt.orderId} ${evt.type}`,
          text: `Event: ${JSON.stringify(evt)}`
        });
      } catch (err) {
        console.error("email send error", err);
      }
    }
  });
}

const app = express();
app.get("/health", (req, res) => res.json({ ok: true }));
const port = process.env.PORT || 4005;
app.listen(port, async () => { console.log("Notif svc on", port); startConsumer().catch(console.error); });
