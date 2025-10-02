import express from "express";
import prisma from "./prismaClient";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

app.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;
  console.log(name,email,password);
  const hashed = await bcrypt.hash(password, 10);
  try {
    const user = await prisma.user.create({ data: { name, email, password: hashed } });
    res.json({ id: user.id, email: user.email, name: user.name });
  } catch (err:any) {
    res.status(400).json({ message: err?.message || "Error" });
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email }});
  if (!user) return res.status(401).json({ message: "Invalid credentials" });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ message: "Invalid credentials" });
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token });
});

app.get("/me", async (req:any, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ message: "No token" });
  const token = auth.split(" ")[1];
  try {
    const decoded:any = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id:decoded.id}});
    res.json({ user });
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
});

app.listen(process.env.PORT || 4001, () => console.log("User service started on port", process.env.PORT || 4001));
