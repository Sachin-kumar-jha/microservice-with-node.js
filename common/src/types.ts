export type OrderStatus = "PENDING" | "RESERVED" | "OUT_OF_STOCK" | "PAYMENT_PENDING" | "CONFIRMED" | "FAILED" | "STOCK_RESERVED";
export interface OrderEvent {
  orderId: string;
  userId: string;
  items: { productId: number; qty: number }[];
  amount: number;
  ts?: string;
}
