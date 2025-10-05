# 🚀 Microservices with API Gateway (Dockerized + Prisma + Proxy User Headers)

## 📌 Overview

This repository demonstrates a **microservices setup with Docker**, using an **API Gateway** to forward requests and attach user information extracted from JWT tokens.  

It includes the following services:

- **API Gateway** → Handles routing, authentication, and forwards requests to downstream services with `userId` and `email` headers.
- **User Service** → Manages user-related data and authentication.
- **Order Service** → Manages order creation and items.
- **Inventory Service** → Handles stock and product availability.
- **Payment Service** → Handles payments and publishes confirmed payments to Redis/Kafka.

⚠️ **Problem Solved**: Previously, `userId` was missing in downstream services.  
✅ Now, the API Gateway **decodes JWT, attaches `userId` and `email` to headers**, and forwards requests to the services.

> ⚠️ **Note:** Using `http-proxy` directly sometimes causes issues with consuming `req.body` in downstream services because the body stream is already read by middleware. The solution in this project ensures the body is preserved while forwarding requests.

---

## 🛠️ Project Setup (Docker + Prisma)

### 1. Clone Repository

```bash
git clone <repo-link>
cd <project-folder>
2. Install Dependencies
Go to each service folder and run:
```
```bash
npm install
```
## 3. Setup Prisma Schema

# Inside each service (user-service, order-service, inventory-service), run:
```bash
npx prisma db push
This will create or update the database schema.
```
## 4. Run Services with Docker
```bash
docker-compose up --build
```
## 5. Access Services
Service	URL
- API Gateway	http://localhost:5000
- User Service	http://localhost:4001
Order Service	http://localhost:4003
Inventory Service	http://localhost:4003
Payment Service	http://localhost:4004

## 🔍 JWT & Proxy Flow
# Client logs in via /auth/login (User Service) and receives a JWT token.

- Client sends requests to API Gateway with:
- Authorization: Bearer <token>
- API Gateway decodes JWT using middleware and attaches the following headers:

```bash
x-user-id: <decoded user id>
x-user-email: <decoded user email>
Requests are proxied to the respective service (order, inventory, payment) while keeping req.body intact.
```
# Downstream services can access user info:

```ts

const userId = req.headers['x-user-id'];
const email = req.headers['x-user-email'];

```
## 📌 API Gateway Example Routes
Route	Auth Required	Description
- /users/*      	- No	Forward to User Service
- /order/*	      - Yes	Forward to Order Service
- /inventory/*	  - Yes	Forward to Inventory Service
- /payment/*	    - Yes	Forward to Payment Service
- /	No	Health check

## ⚡ Example: Create Order
# Request to API Gateway:

```bash
POST http://localhost:5000/order
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
json
Copy code
{
  "items": [
    { "productId": "101", "qty": 2 },
    { "productId": "102", "qty": 1 }
  ]
}
```

## Forwarded to order-service:

```bash
{
  userId: "<decoded user id from JWT>",
  items: [
    { productId: "101", qty: 2 },
    { productId: "102", qty: 1 }
  ]
}
✅ userId is now available in the service!
```
## 🔧 How the Proxy Works Middleware decodes JWT token from Authorization header.

- Adds x-user-id and x-user-email headers.

- Uses http-proxy (or http-proxy-middleware) to forward requests.

- Preserves the original req.body, avoiding the common issue where middleware consumes the body stream before proxying.

- Handles errors and logs requests.

## 🧰 Tech Stack
- Node.js + Express.js

- TypeScript

- Prisma ORM

- JWT Authentication

- http-proxy / http-proxy-middleware

- Docker + Docker Compose

- redis

-kafka/kafkajs

## ✅ Benefits of This Approach
- No need to send userId manually in each request.

- Downstream services are auth-agnostic and trust headers from API Gateway.

- Easy debugging with logs in API Gateway showing forwarded requests.

- Can extend to microservices like notifications, payments, inventory, etc.

# 🔔 Notification Flow (Optional)
- Payment Service publishes confirmed payments to Redis streams and Kafka.

- Notification Service consumes Kafka events and can send emails (or just log for testing).

# Example Kafka message format:
```bash
{
  "type": "order.confirmed",
  "orderId": "abc123",
  "userId": "user123",
  "items": [...],
  "amount": 200,
  "email": "user@example.com",
  "ts": 1696512345678
}

```
## 📬 Contribution
Submit PRs if you find improvements.

Report issues for bugs or Docker setup.

Contributions are welcome! 🚀