"use server";

import db from "@/lib/db";
import { OrderStatus, TableStatus, PaymentStatus, PaymentMethod, Role } from "@prisma/client";
import { publishSocketEvent } from "@/lib/socket-helper";

// Helper to record administrative activity logs
async function logActivity(userId: string, action: string, details: string) {
  try {
    const firstBranch = await db.branch.findFirst();
    await db.activityLog.create({
      data: {
        userId,
        branchId: firstBranch?.id || null,
        action,
        details
      }
    });
  } catch (err) {
    console.error("Activity logging failed:", err);
  }
}

// 1. Calculate Order Bill fields dynamically from Settings and Coupons
export async function calculateOrderBill(
  orderId: string,
  customDiscount?: { type: "FLAT" | "PERCENTAGE"; value: number }
) {
  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        items: { where: { deletedAt: null } }
      }
    });

    if (!order) {
      return { success: false, error: "Order not found." };
    }

    // Retrieve active restaurant configurations
    const settings = await db.restaurantSetting.findFirst();
    const gstRate = settings?.gstRate ?? 5.0;
    const serviceChargeRate = settings?.serviceChargeRate ?? 5.0;

    // Calculate subtotal
    const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // Apply Coupon discount if present on the order
    const couponDiscount = order.discountAmount || 0;

    // Apply Manual custom discount if specified
    let manualDiscount = 0;
    if (customDiscount && customDiscount.value > 0) {
      if (customDiscount.type === "PERCENTAGE") {
        manualDiscount = subtotal * (customDiscount.value / 100);
      } else {
        manualDiscount = Math.min(customDiscount.value, subtotal);
      }
    }

    const totalDiscount = Math.min(subtotal, couponDiscount + manualDiscount);
    const taxableAmount = Math.max(0, subtotal - totalDiscount);

    // GST splits (inclusive or exclusive; defaults to exclusive for standard Indian restaurant dining)
    const gstAmount = taxableAmount * (gstRate / 100);
    const serviceCharge = taxableAmount * (serviceChargeRate / 100);

    const rawTotal = taxableAmount + gstAmount + serviceCharge;
    const finalAmount = Math.round(rawTotal);
    const roundOff = parseFloat((finalAmount - rawTotal).toFixed(2));

    return {
      success: true,
      billingDetails: {
        subtotal,
        discountAmount: totalDiscount,
        couponDiscount,
        manualDiscount,
        taxableAmount,
        gstRate,
        cgstRate: gstRate / 2,
        sgstRate: gstRate / 2,
        gstAmount,
        cgstAmount: gstAmount / 2,
        sgstAmount: gstAmount / 2,
        serviceChargeRate,
        serviceCharge,
        roundOff,
        finalAmount
      }
    };
  } catch (error: any) {
    console.error("[Billing Actions] Error calculating bill:", error);
    return { success: false, error: "Failed to calculate bill calculations." };
  }
}

// 2. Process payments (supports split check), registers payments, creates invoices, and logs compliance audits
export async function recordOrderPayment(
  orderId: string,
  payments: { method: PaymentMethod; amount: number; transactionId?: string }[],
  adminUserId: string,
  customDiscount?: { type: "FLAT" | "PERCENTAGE"; value: number }
) {
  try {
    const result = await db.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId }
      });

      if (!order) throw new Error("Order not found");

      // Calculate bill details
      const billResult = await calculateOrderBill(orderId, customDiscount);
      if (!billResult.success || !billResult.billingDetails) {
        throw new Error(billResult.error || "Billing calculations failed.");
      }
      const bDetails = billResult.billingDetails;

      // 1. Log payment records
      let totalAmountPaid = 0;
      for (const p of payments) {
        if (p.amount <= 0) continue;
        await tx.payment.create({
          data: {
            orderId,
            amount: p.amount,
            method: p.method,
            status: PaymentStatus.PAID,
            transactionId: p.transactionId || null
          }
        });
        totalAmountPaid += p.amount;
      }

      // Check cumulative paid status
      const existingPayments = await tx.payment.findMany({
        where: { orderId, status: PaymentStatus.PAID }
      });
      const totalCumulativePaid = existingPayments.reduce((sum, p) => sum + p.amount, 0) + totalAmountPaid;

      let paymentStatus: PaymentStatus = PaymentStatus.PENDING;
      if (totalCumulativePaid >= bDetails.finalAmount) {
        paymentStatus = PaymentStatus.PAID;
      }

      // 2. Determine target status
      // If the food was already served or ready, set status to COMPLETED, else keep status (e.g. PREPARING/ACCEPTED)
      let targetOrderStatus = order.status;
      let completedAt = order.completedAt;

      if (([OrderStatus.READY, OrderStatus.SERVED] as OrderStatus[]).includes(order.status) && paymentStatus === PaymentStatus.PAID) {
        targetOrderStatus = OrderStatus.COMPLETED;
        completedAt = new Date();
      }

      // 3. Update Order
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          discountAmount: bDetails.discountAmount,
          gstAmount: bDetails.gstAmount,
          serviceCharge: bDetails.serviceCharge,
          finalAmount: bDetails.finalAmount,
          paymentStatus,
          status: targetOrderStatus,
          completedAt,
          updatedAt: new Date()
        },
        include: {
          table: true,
          items: {
            where: { deletedAt: null },
            include: { menuItem: true }
          }
        }
      });

      // 4. Create Invoice Record
      const invoiceNumber = `INV-${Date.now()}-${order.orderNumber}`;
      await tx.invoice.create({
        data: {
          orderId,
          invoiceNumber,
          taxDetails: JSON.stringify(bDetails)
        }
      });

      return { order: updatedOrder, invoiceNumber };
    });

    await logActivity(adminUserId, "RECORD_PAYMENT", `Processed payments total ₹${payments.reduce((sum, p) => sum + p.amount, 0)} for Ticket ${result.order.orderNumber}`);
    await publishSocketEvent("payment-completed", result.order);

    return { success: true, order: result.order, invoiceNumber: result.invoiceNumber };
  } catch (error: any) {
    console.error("[Billing Actions] Error recording payment transaction:", error);
    return { success: false, error: error.message || "Failed to log payment transaction." };
  }
}

// 3. Record full or partial refunds with audit log logs
export async function recordRefund(
  orderId: string,
  refundAmount: number,
  reason: string,
  adminUserId: string
) {
  try {
    const result = await db.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId }
      });

      if (!order) throw new Error("Order not found");

      // Verify refund limit
      if (refundAmount > order.finalAmount) {
        throw new Error("Refund amount exceeds order final bill amount.");
      }

      // Update payment records
      await tx.payment.create({
        data: {
          orderId,
          amount: -refundAmount,
          method: PaymentMethod.CASH,
          status: PaymentStatus.REFUNDED
        }
      });

      // Update order status
      const targetPaymentStatus: PaymentStatus = refundAmount === order.finalAmount
        ? PaymentStatus.REFUNDED
        : PaymentStatus.PENDING;

      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: targetPaymentStatus,
          status: refundAmount === order.finalAmount ? OrderStatus.REFUNDED : order.status,
          updatedAt: new Date()
        },
        include: { table: true }
      });

      // Free table if fully refunded
      if (refundAmount === order.finalAmount) {
        await tx.restaurantTable.update({
          where: { id: order.tableId },
          data: { status: TableStatus.FREE }
        });
      }

      return updated;
    });

    await logActivity(adminUserId, "REFUND_ORDER", `Processed refund of ₹${refundAmount} on Ticket ${result.orderNumber}. Reason: "${reason}"`);
    await publishSocketEvent("order-updated", result);

    return { success: true, order: result };
  } catch (error: any) {
    console.error("[Billing Actions] Error processing refund:", error);
    return { success: false, error: error.message || "Failed to process refund." };
  }
}

// 4. Get Financial Report Collections details
export async function getFinancialReport(startDate?: Date, endDate?: Date) {
  try {
    const start = startDate ? new Date(startDate) : new Date();
    if (!startDate) start.setHours(0, 0, 0, 0);

    const end = endDate ? new Date(endDate) : new Date();
    if (!endDate) end.setHours(23, 59, 59, 999);

    const payments = await db.payment.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        deletedAt: null
      },
      include: {
        order: true
      }
    });

    // Summarize payments by status
    const cashCollection = payments
      .filter(p => p.method === PaymentMethod.CASH && p.status === PaymentStatus.PAID)
      .reduce((sum, p) => sum + p.amount, 0);

    const upiCollection = payments
      .filter(p => p.method === PaymentMethod.UPI && p.status === PaymentStatus.PAID)
      .reduce((sum, p) => sum + p.amount, 0);

    const cardCollection = payments
      .filter(p => p.method === PaymentMethod.CARD && p.status === PaymentStatus.PAID)
      .reduce((sum, p) => sum + p.amount, 0);

    const totalRefunded = payments
      .filter(p => p.status === PaymentStatus.REFUNDED)
      .reduce((sum, p) => sum + Math.abs(p.amount), 0);

    const netCollection = cashCollection + upiCollection + cardCollection - totalRefunded;

    return {
      success: true,
      report: {
        cashCollection,
        upiCollection,
        cardCollection,
        totalRefunded,
        netCollection,
        transactionCount: payments.length
      }
    };
  } catch (error: any) {
    console.error("[Billing Actions] Error generating financial report:", error);
    return { success: false, error: "Failed to generate report." };
  }
}
