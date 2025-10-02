# 🚀 Microservices with API Gateway (Dockerized + Prisma)

## 📌 Overview

This repository demonstrates a **microservices setup with Docker**.
It includes the following services:

* **API Gateway** → Routes requests and handles authentication/forwarding
* **User Service** → Manages user-related data and authentication
* **Order Service** → Manages order creation and items
* **Inventory Service** → Handles stock and product availability

⚠️ **Current Issue**: `userId` is **not being received inside `order-service`**.
Even though the API Gateway is supposed to attach `userId` (from JWT / headers), inside the `order-service` it comes as `undefined`.

---

## 🛠️ Project Setup (Docker + Prisma)

### 1. Clone Repository

```bash
git clone <repo-link>
cd <project-folder>
```

### 2. Install Dependencies

Go to each service folder and install:

```bash
npm install
```

### 3. Setup Prisma Schema

Inside each service (`user-service`, `order-service`, `inventory-service`), run:

```bash
npx prisma db push
```

This will create/update the database schema for each service.

### 4. Run Services with Docker

```bash
docker-compose up --build
```

### 5. Access Services

* **API Gateway** → `http://localhost:3000`
* **User Service** → `http://localhost:4000`
* **Order Service** → `http://localhost:5000`
* **Inventory Service** → `http://localhost:6000`

---

## 🐞 Current Issue (Order Service)

* Creating an order via API Gateway:

  ```bash
  POST http://localhost:3000/orders
  Content-Type: application/json

  {
    "items": [
      { "productId": "101", "quantity": 2 },
      { "productId": "102", "quantity": 1 }
    ]
  }
  ```

* ✅ **Expected in order-service**:

  ```ts
  {
    userId: "decoded-from-token",
    items: [...]
  }
  ```

* ❌ **Actual in order-service**:

  ```ts
  {
    items: [...]
    // userId missing
  }
  ```

* Logs:

  ```ts
  console.log(req.body.userId); // undefined
  ```

This breaks the flow since orders can’t be linked to a user.

---

## 🔍 How to Reproduce

1. Run `npx prisma db push` in each service.
2. Start services using Docker.
3. Send a POST request with `items` only (no `userId` in body).
4. Check logs in **order-service** → `userId` is missing.

---

## 💡 Expected Flow

* API Gateway should decode JWT / read headers → extract `userId`.
* API Gateway should attach `userId` to the request body before proxying it to **order-service**.
* Order Service should receive both:

  ```ts
  {
    userId: "...",
    items: [...]
  }
  ```

---

## 🤝 Contribution

If you know the fix:

* Check **API Gateway → Orders route**
* Suggest improvements
* Or directly submit a **Pull Request** 🙏

---

## 🧰 Tech Stack

* Node.js + Express.js
* TypeScript
* Prisma ORM
* JWT Authentication
* http-proxy-middleware
* Docker + Docker Compose

---

## 📬 Contact

Open an issue or create a PR if you have insights.
Your contributions are welcome 🚀
