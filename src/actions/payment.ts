"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { PaymentStatus, PaymentMethod } from "@prisma/client";
import { publishSocketEvent } from "@/lib/socket-helper";
import { getOrderDetails } from "./order";

export async function confirmPayment(orderId: string, expectedMethod: string) {
  try {
    // 1. Authorize Waiter or Admin
    const reqHeaders = await headers();
    const session = await auth.api.getSession({ headers: reqHeaders });
    
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    if (session.user.role !== "ADMIN" && session.user.role !== "WAITER") {
      return { success: false, error: "Only Admin or Waiter can confirm payments." };
    }

    // 2. Idempotency Check
    const existingOrder = await db.order.findUnique({
      where: { id: orderId }
    });

    if (!existingOrder) {
      return { success: false, error: "Order not found" };
    }

    if (existingOrder.paymentStatus === PaymentStatus.PAID) {
      // Already paid, return success (Idempotent)
      return { success: true, message: "Already paid" };
    }

    // 3. Update Order
    const updatedOrder = await db.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: PaymentStatus.PAID,
        paidAt: new Date(),
        paidBy: session.user.id
      }
    });

    // 4. Publish Event
    const fullOrderRes = await getOrderDetails(orderId);
    if (fullOrderRes.success && fullOrderRes.order) {
      await publishSocketEvent("PAYMENT_COMPLETED", fullOrderRes.order);
      await publishSocketEvent("ORDER_UPDATED", fullOrderRes.order);
    }

    return { success: true, order: updatedOrder };

  } catch (error: any) {
    console.error("Error confirming payment:", error);
    return { success: false, error: error.message || "Failed to confirm payment" };
  }
}
