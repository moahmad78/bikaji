"use server";

import db from "@/lib/db";
import { OrderStatus, TableStatus, PaymentStatus, PaymentMethod, RequestStatus, Role } from "@prisma/client";
import { publishSocketEvent } from "@/lib/socket-helper";
import { revalidatePath } from "next/cache";

// Fetch Waiter Dashboard data
export async function getWaiterDashboardData(branchId?: string, waiterUserId?: string) {
  try {
    // Resolve branchId (use first active branch if not specified)
    let targetBranchId = branchId;
    if (!targetBranchId) {
      const firstBranch = await db.branch.findFirst({ where: { deletedAt: null } });
      if (!firstBranch) {
        return { success: false, error: "No branch found in system." };
      }
      targetBranchId = firstBranch.id;
    }

    // 1. Fetch all tables in branch with their active sessions and orders
    const tables = await db.restaurantTable.findMany({
      where: { branchId: targetBranchId, deletedAt: null },
      include: {
        sessions: {
          where: { isActive: true, deletedAt: null },
          take: 1
        },
        orders: {
          where: {
            status: {
              in: [
                OrderStatus.PENDING,
                OrderStatus.RECEIVED,
                OrderStatus.ACCEPTED,
                OrderStatus.PREPARING,
                OrderStatus.READY,
                OrderStatus.SERVED
              ]
            },
            deletedAt: null
          },
          include: {
            items: {
              where: { deletedAt: null },
              include: { menuItem: true }
            }
          }
        },
        serviceRequests: {
          where: { status: RequestStatus.PENDING, deletedAt: null }
        }
      },
      orderBy: { number: "asc" }
    });

    // 2. Fetch all pending service requests in this branch (across all tables)
    const pendingRequests = await db.serviceRequest.findMany({
      where: {
        status: RequestStatus.PENDING,
        table: { branchId: targetBranchId },
        deletedAt: null
      },
      include: {
        table: true
      },
      orderBy: { createdAt: "asc" } // FIFO order
    });

    // 3. Fetch all orders marked READY by the kitchen
    const readyOrders = await db.order.findMany({
      where: {
        branchId: targetBranchId,
        status: OrderStatus.READY,
        waiterId: null, // Not yet accepted by any waiter
        deletedAt: null
      },
      include: {
        table: true,
        items: {
          where: { deletedAt: null },
          include: { menuItem: true }
        }
      },
      orderBy: { readyAt: "asc" }
    });

    // 4. Fetch all active deliveries (orders accepted by waiters in transit)
    const activeDeliveries = await db.order.findMany({
      where: {
        branchId: targetBranchId,
        status: { in: [OrderStatus.READY, OrderStatus.OUT_FOR_DELIVERY] },
        waiterId: waiterUserId ? waiterUserId : { not: null },
        deletedAt: null
      },
      include: {
        table: true,
        items: {
          where: { deletedAt: null },
          include: { menuItem: true }
        }
      },
      orderBy: { waiterAcceptedAt: "desc" }
    });

    // 5. Fetch Delivery History
    const deliveryHistory = await db.order.findMany({
      where: {
        branchId: targetBranchId,
        waiterId: waiterUserId ? waiterUserId : undefined,
        status: { in: [OrderStatus.SERVED, OrderStatus.COMPLETED] },
        deletedAt: null
      },
      include: {
        table: true,
        items: {
          where: { deletedAt: null },
          include: { menuItem: true }
        }
      },
      orderBy: { deliveredAt: "desc" },
      take: 150
    });

    // Calculate Waiter Performance Metrics for Today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todayDelivered = deliveryHistory.filter(o => o.deliveredAt && new Date(o.deliveredAt) >= startOfToday);
    const tablesServedSet = new Set(todayDelivered.map(o => o.tableId));

    const durations = todayDelivered.map(o => o.deliveryDuration || 0).filter(d => d > 0);
    const avgDeliveryTimeSeconds = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
    const fastestDeliverySeconds = durations.length > 0 ? Math.min(...durations) : 0;
    const longestDeliverySeconds = durations.length > 0 ? Math.max(...durations) : 0;

    const tableCounts: Record<string, number> = {};
    todayDelivered.forEach(o => {
      if (o.tableId) tableCounts[o.tableId] = (tableCounts[o.tableId] || 0) + 1;
    });
    const repeatVisitsToSameTable = Object.values(tableCounts).filter(c => c > 1).reduce((sum, c) => sum + (c - 1), 0);

    const performance = {
      ordersDeliveredToday: todayDelivered.length,
      tablesServedToday: tablesServedSet.size,
      avgDeliveryTimeSeconds,
      fastestDeliverySeconds,
      longestDeliverySeconds,
      repeatVisitsToSameTable
    };

    // Fetch Pending Cash Requests
    const pendingCashRequests = await db.order.findMany({
      where: {
        branchId: targetBranchId,
        paymentMethod: PaymentMethod.CASH,
        paymentStatus: PaymentStatus.PENDING,
        deletedAt: null
      },
      include: {
        table: true
      },
      orderBy: { createdAt: "asc" }
    });

    return {
      success: true,
      tables,
      pendingRequests,
      readyOrders,
      activeDeliveries,
      deliveryHistory,
      pendingCashRequests,
      performance
    };
  } catch (error: any) {
    console.error("[Waiter Actions] Error fetching dashboard data:", error);
    return { success: false, error: error.message || "Failed to load waiter console metrics." };
  }
}

// Resolve a customer service request
export async function resolveServiceRequest(requestId: string) {
  try {
    const request = await db.serviceRequest.update({
      where: { id: requestId },
      data: {
        status: RequestStatus.RESOLVED,
        updatedAt: new Date()
      },
      include: {
        table: true
      }
    });

    await publishSocketEvent("REQUEST_RESOLVED", request);
    revalidatePath("/waiter");
    revalidatePath("/kitchen");
    revalidatePath("/admin");
    return { success: true, request };
  } catch (error: any) {
    console.error("[Waiter Actions] Error resolving request:", error);
    return { success: false, error: error.message || "Failed to resolve request." };
  }
}

// Accept a delivery task (Waiter accepts a ready order for delivery)
export async function acceptDelivery(orderId: string, waiterId: string, waiterName: string) {
  try {
    const now = new Date();
    const updatedOrder = await db.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.OUT_FOR_DELIVERY,
        waiterId,
        waiterName,
        waiterAcceptedAt: now,
        updatedAt: now
      },
      include: {
        table: true,
        items: {
          where: { deletedAt: null },
          include: { menuItem: true }
        }
      }
    });

    // Broadcast realtime event to Kitchen, Admin, Waiter, and Customer
    const payload = {
      orderId,
      order: updatedOrder,
      waiterId,
      waiterName,
      waiterAcceptedAt: now.toISOString(),
      orderNumber: updatedOrder.orderNumber,
      tableNumber: updatedOrder.table.number
    };

    await publishSocketEvent("ORDER_PICKED_UP", payload);
    await publishSocketEvent("ORDER_UPDATED", updatedOrder);

    revalidatePath("/waiter");
    revalidatePath("/kitchen");
    revalidatePath("/admin");

    return { success: true, order: updatedOrder };
  } catch (error: any) {
    console.error("[Waiter Actions] Error accepting delivery:", error);
    return { success: false, error: error.message || "Failed to accept delivery." };
  }
}

// Complete delivery and mark order as served (Delivered To Table)
export async function deliverOrder(orderId: string, waiterId?: string, waiterName?: string) {
  try {
    const order = await db.order.findUnique({ where: { id: orderId } });
    if (!order) throw new Error("Order not found");

    const now = new Date();
    // Calculate delivery duration in seconds from waiterAcceptedAt (or readyAt fallback)
    const startTime = order.waiterAcceptedAt || order.readyAt || order.createdAt;
    const durationSeconds = Math.round((now.getTime() - new Date(startTime).getTime()) / 1000);

    const newStatus = order.paymentStatus === PaymentStatus.PAID 
      ? OrderStatus.COMPLETED 
      : OrderStatus.SERVED;

    const updatedOrder = await db.order.update({
      where: { id: orderId },
      data: {
        status: newStatus,
        servedAt: now,
        deliveredAt: now,
        deliveryDuration: durationSeconds,
        waiterId: waiterId || order.waiterId,
        waiterName: waiterName || order.waiterName,
        completedAt: newStatus === OrderStatus.COMPLETED ? now : order.completedAt,
        updatedAt: now
      },
      include: {
        table: true,
        items: {
          where: { deletedAt: null },
          include: { menuItem: true }
        }
      }
    });

    // Update table status to SERVED
    await db.restaurantTable.update({
      where: { id: updatedOrder.tableId },
      data: { status: TableStatus.SERVED }
    });

    const payload = {
      orderId,
      order: updatedOrder,
      status: newStatus,
      deliveredAt: now.toISOString(),
      deliveryDuration: durationSeconds,
      waiterName: updatedOrder.waiterName
    };

    await publishSocketEvent("ORDER_DELIVERED", updatedOrder);
    await publishSocketEvent("ORDER_UPDATED", updatedOrder);
    revalidatePath("/waiter");
    revalidatePath("/kitchen");
    revalidatePath("/admin");
    return { success: true, order: updatedOrder };
  } catch (error: any) {
    console.error("[Waiter Actions] Error serving order:", error);
    return { success: false, error: error.message || "Failed to mark order as delivered." };
  }
}

// Backward compatibility alias for serveOrder
export async function serveOrder(orderId: string) {
  return deliverOrder(orderId);
}

// Record a payment and mark order paid
export async function processPayment(orderId: string, paymentMethod: PaymentMethod, amountPaid: number) {
  try {
    const result = await db.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId }
      });
      if (!order) throw new Error("Order not found");

      // 1. Create Payment record
      const payment = await tx.payment.create({
        data: {
          orderId,
          amount: amountPaid,
          method: paymentMethod,
          status: PaymentStatus.PAID
        }
      });

      // 2. Determine target status
      // If the food was already served or ready, set status to COMPLETED, else keep status (e.g. PREPARING/ACCEPTED)
      let targetOrderStatus = order.status;
      let completedAt = order.completedAt;

      if (([OrderStatus.READY, OrderStatus.SERVED] as OrderStatus[]).includes(order.status)) {
        targetOrderStatus = OrderStatus.COMPLETED;
        completedAt = new Date();
      }

      // 3. Update Order
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: PaymentStatus.PAID,
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

      return { payment, order: updatedOrder };
    });

    await publishSocketEvent("PAYMENT_COMPLETED", result.order);
    revalidatePath("/waiter");
    revalidatePath("/kitchen");
    revalidatePath("/admin");
    return { success: true, order: result.order };
  } catch (error: any) {
    console.error("[Waiter Actions] Error processing payment:", error);
    return { success: false, error: error.message || "Failed to record payment." };
  }
}

// Close table session (check out and release table)
export async function closeTable(tableId: string) {
  try {
    const result = await db.$transaction(async (tx) => {
      // Find active session
      const session = await tx.customerSession.findFirst({
        where: { tableId, isActive: true, deletedAt: null }
      });

      if (session) {
        // Deactivate customer session
        await tx.customerSession.update({
          where: { id: session.id },
          data: { isActive: false, updatedAt: new Date() }
        });
      }

      // Update table status back to FREE (Available)
      const table = await tx.restaurantTable.update({
        where: { id: tableId },
        data: { status: TableStatus.FREE }
      });

      return { table, session };
    });

    await publishSocketEvent("TABLE_CLOSED", { tableId, status: TableStatus.FREE });
    revalidatePath("/waiter");
    revalidatePath("/kitchen");
    revalidatePath("/admin");
    return { success: true, table: result.table };
  } catch (error: any) {
    console.error("[Waiter Actions] Error closing table:", error);
    return { success: false, error: error.message || "Failed to close table session." };
  }
}

// Resolves or creates a waiter profile on user login
export async function getOrCreateWaiterProfile(userId: string, branchId?: string) {
  try {
    let waiter = await db.waiter.findUnique({
      where: { userId }
    });

    if (!waiter) {
      // Find first branch if not specified
      let targetBranchId = branchId;
      if (!targetBranchId) {
        const firstBranch = await db.branch.findFirst({ where: { deletedAt: null } });
        if (!firstBranch) throw new Error("No branches configured.");
        targetBranchId = firstBranch.id;
      }

      // Create waiter record
      const employeeId = `WT-${101 + (await db.waiter.count())}`;
      waiter = await db.waiter.create({
        data: {
          userId,
          branchId: targetBranchId,
          employeeId,
          isAvailable: true
        }
      });
    }

    return { success: true, waiter };
  } catch (error: any) {
    console.error("[Waiter Actions] Error managing waiter profile:", error);
    return { success: false, error: error.message || "Failed to manage waiter profile." };
  }
}
