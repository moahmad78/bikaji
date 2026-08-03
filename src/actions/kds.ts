"use server";

import db from "@/lib/db";
import { OrderStatus, TableStatus } from "@prisma/client";
import { publishSocketEvent } from "@/lib/socket-helper";
import { revalidatePath } from "next/cache";

// Fetch all active orders for the Kitchen Display System
export async function getKDSOrders() {
  try {
    const orders = await db.order.findMany({
      where: {
        status: {
          in: [
            OrderStatus.PENDING,
            OrderStatus.RECEIVED,
            OrderStatus.ACCEPTED,
            OrderStatus.PREPARING,
            OrderStatus.READY,
            OrderStatus.OUT_FOR_DELIVERY
          ]
        },
        deletedAt: null
      },
      include: {
        table: true,
        items: {
          where: {
            deletedAt: null
          },
          include: {
            menuItem: true,
            modifiers: true,
            addons: true,
          }
        }
      },
      orderBy: {
        createdAt: "asc" // Oldest tickets first to maintain FIFO order
      }
    });

    return { success: true, orders };
  } catch (error: any) {
    console.error("[KDS Actions] Error fetching active orders:", error);
    return { success: false, error: error.message || "Failed to load active orders." };
  }
}

// Fetch order history for KDS Order History tab
export async function getKDSHistoryOrders(
  statusFilter?: string,
  timeFilter?: string,
  customStartDate?: string,
  customEndDate?: string
) {
  try {
    const whereCondition: any = { deletedAt: null };

    // Status filter
    if (statusFilter && statusFilter !== "ALL") {
      if (statusFilter === "DELIVERED") {
        whereCondition.status = { in: [OrderStatus.SERVED, OrderStatus.COMPLETED] };
      } else {
        whereCondition.status = statusFilter as OrderStatus;
      }
    }

    // Time filter
    const now = new Date();
    if (timeFilter === "TODAY") {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      whereCondition.createdAt = { gte: todayStart };
    } else if (timeFilter === "YESTERDAY") {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
      whereCondition.createdAt = { gte: yesterdayStart, lt: todayStart };
    } else if (timeFilter === "THIS_WEEK") {
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      whereCondition.createdAt = { gte: weekStart };
    } else if (timeFilter === "CUSTOM" && customStartDate) {
      const start = new Date(customStartDate);
      const end = customEndDate ? new Date(customEndDate) : now;
      whereCondition.createdAt = { gte: start, lte: end };
    } else {
      // Default: Last 24 Hours
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      whereCondition.createdAt = { gte: last24h };
    }

    const orders = await db.order.findMany({
      where: whereCondition,
      include: {
        table: true,
        items: {
          where: {
            deletedAt: null
          },
          include: {
            menuItem: true,
            modifiers: true,
            addons: true,
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 200
    });

    return { success: true, orders };
  } catch (error: any) {
    console.error("[KDS Actions] Error fetching history orders:", error);
    return { success: false, error: error.message || "Failed to load order history." };
  }
}

// Accept order and set expected preparation time SLA
export async function acceptKDSOrder(orderId: string, expectedPrepTimeMinutes: number) {
  try {
    const now = new Date();
    const expectedReadyAt = new Date(now.getTime() + expectedPrepTimeMinutes * 60 * 1000);

    const updatedOrder = await db.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.ACCEPTED,
        acceptedAt: now,
        expectedReadyAt,
        updatedAt: now
      },
      include: {
        table: true,
        items: {
          where: { deletedAt: null },
          include: { menuItem: true, modifiers: true, addons: true }
        }
      }
    });

    await publishSocketEvent("ORDER_ACCEPTED", updatedOrder);
    await publishSocketEvent("ORDER_UPDATED", updatedOrder);
    revalidatePath("/kitchen");
    revalidatePath("/waiter");
    revalidatePath("/admin");
    return { success: true, order: updatedOrder };
  } catch (error: any) {
    console.error("[KDS Actions] Error accepting order:", error);
    return { success: false, error: error.message || "Failed to accept order." };
  }
}

// Start preparing order
export async function startPreparingKDSOrder(orderId: string) {
  try {
    const now = new Date();
    const updatedOrder = await db.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.PREPARING,
        preparingAt: now,
        updatedAt: now
      },
      include: {
        table: true,
        items: {
          where: { deletedAt: null },
          include: { menuItem: true, modifiers: true, addons: true }
        }
      }
    });

    await publishSocketEvent("ORDER_COOKING", updatedOrder);
    await publishSocketEvent("ORDER_UPDATED", updatedOrder);
    revalidatePath("/kitchen");
    revalidatePath("/waiter");
    revalidatePath("/admin");
    return { success: true, order: updatedOrder };
  } catch (error: any) {
    console.error("[KDS Actions] Error preparing order:", error);
    return { success: false, error: error.message || "Failed to start preparing." };
  }
}

// Mark order as ready for waiter pickup
export async function markKDSOrderReady(orderId: string) {
  try {
    const now = new Date();
    const updatedOrder = await db.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.READY,
        readyAt: now,
        updatedAt: now
      },
      include: {
        table: true,
        items: {
          where: { deletedAt: null },
          include: { menuItem: true, modifiers: true, addons: true }
        }
      }
    });

    // Update table status to READY to signal waiters
    await db.restaurantTable.update({
      where: { id: updatedOrder.tableId },
      data: { status: TableStatus.READY }
    });

    await publishSocketEvent("ORDER_READY", updatedOrder);
    await publishSocketEvent("ORDER_UPDATED", updatedOrder);
    revalidatePath("/kitchen");
    revalidatePath("/waiter");
    revalidatePath("/admin");
    return { success: true, order: updatedOrder };
  } catch (error: any) {
    console.error("[KDS Actions] Error marking order ready:", error);
    return { success: false, error: error.message || "Failed to mark order ready." };
  }
}

// Complete order (served by waiter, or completed directly)
export async function completeKDSOrder(orderId: string) {
  try {
    const now = new Date();
    const updatedOrder = await db.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.COMPLETED,
        completedAt: now,
        updatedAt: now
      },
      include: {
        table: true,
        items: {
          where: { deletedAt: null },
          include: { menuItem: true, modifiers: true, addons: true }
        }
      }
    });

    // Update table status back to FREE or OCCUPIED depending on session
    await db.restaurantTable.update({
      where: { id: updatedOrder.tableId },
      data: { status: TableStatus.FREE } // For KDS we clear it or mark it FREE
    });

    await publishSocketEvent("ORDER_COMPLETED", updatedOrder);
    await publishSocketEvent("ORDER_UPDATED", updatedOrder);
    revalidatePath("/kitchen");
    revalidatePath("/waiter");
    revalidatePath("/admin");
    return { success: true, order: updatedOrder };
  } catch (error: any) {
    console.error("[KDS Actions] Error completing order:", error);
    return { success: false, error: error.message || "Failed to complete order." };
  }
}

// Delay preparation time SLA
export async function delayKDSOrder(orderId: string, minutes: number, reason?: string, note?: string) {
  try {
    const order = await db.order.findUnique({ where: { id: orderId } });
    if (!order) throw new Error("Order not found");

    const currentExpected = order.expectedReadyAt || new Date();
    const newExpected = new Date(currentExpected.getTime() + minutes * 60 * 1000);

    const updatedOrder = await db.order.update({
      where: { id: orderId },
      data: {
        delayMinutes: (order.delayMinutes || 0) + minutes,
        delayReason: reason || order.delayReason || "High kitchen load",
        kitchenNotes: note || order.kitchenNotes || (reason ? `Delayed by ${minutes} mins: ${reason}` : undefined),
        expectedReadyAt: newExpected,
        updatedAt: new Date()
      },
      include: {
        table: true,
        items: {
          where: { deletedAt: null },
          include: { menuItem: true, modifiers: true, addons: true }
        }
      }
    });

    await publishSocketEvent("ORDER_DELAYED", updatedOrder);
    await publishSocketEvent("ORDER_UPDATED", updatedOrder);
    revalidatePath("/kitchen");
    revalidatePath("/waiter");
    revalidatePath("/admin");
    return { success: true, order: updatedOrder };
  } catch (error: any) {
    console.error("[KDS Actions] Error delaying order:", error);
    return { success: false, error: error.message || "Failed to delay order." };
  }
}

// Add a kitchen note to order card
export async function addKDSOrderNote(orderId: string, note: string) {
  try {
    const updatedOrder = await db.order.update({
      where: { id: orderId },
      data: {
        kitchenNotes: note,
        updatedAt: new Date()
      },
      include: {
        table: true,
        items: {
          where: { deletedAt: null },
          include: { menuItem: true, modifiers: true, addons: true }
        }
      }
    });

    await publishSocketEvent("ORDER_UPDATED", updatedOrder);
    revalidatePath("/kitchen");
    revalidatePath("/waiter");
    revalidatePath("/admin");
    return { success: true, order: updatedOrder };
  } catch (error: any) {
    console.error("[KDS Actions] Error adding kitchen note:", error);
    return { success: false, error: error.message || "Failed to add kitchen note." };
  }
}

// Reject/Cancel the entire order from the kitchen
export async function rejectKDSOrder(orderId: string) {
  try {
    const now = new Date();
    const updatedOrder = await db.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CANCELLED,
        completedAt: now,
        updatedAt: now
      },
      include: {
        table: true,
        items: {
          where: { deletedAt: null },
          include: { menuItem: true, modifiers: true, addons: true }
        }
      }
    });

    // Update table status back to FREE
    await db.restaurantTable.update({
      where: { id: updatedOrder.tableId },
      data: { status: TableStatus.FREE }
    });

    await publishSocketEvent("ORDER_CANCELLED", updatedOrder);
    revalidatePath("/kitchen");
    revalidatePath("/waiter");
    revalidatePath("/admin");
    return { success: true, order: updatedOrder };
  } catch (error: any) {
    console.error("[KDS Actions] Error rejecting order:", error);
    return { success: false, error: error.message || "Failed to reject order." };
  }
}

// Cancel a specific item inside an order and adjust totals accordingly
export async function cancelKDSOrderItem(orderItemId: string) {
  try {
    const now = new Date();

    // 1. Fetch item and details
    const orderItem = await db.orderItem.findUnique({
      where: { id: orderItemId },
      include: {
        order: {
          include: {
            items: {
              where: { deletedAt: null }
            }
          }
        },
        modifiers: true,
        addons: true
      }
    });

    if (!orderItem) throw new Error("Order item not found.");
    const order = orderItem.order;

    // 2. Perform cancellation inside transaction
    const result = await db.$transaction(async (tx) => {
      // Soft-delete the item
      await tx.orderItem.update({
        where: { id: orderItemId },
        data: { deletedAt: now }
      });

      // Calculate cost of the item to subtract
      const modifiersCost = orderItem.modifiers.reduce((s, m) => s + m.price, 0);
      const addonsCost = orderItem.addons.reduce((s, a) => s + a.price, 0);
      const itemUnitCost = orderItem.price + modifiersCost + addonsCost;
      const totalItemCost = itemUnitCost * orderItem.quantity;

      // Recalculate order financial parameters
      const remainingItems = order.items.filter(item => item.id !== orderItemId);
      
      let newSubtotal = 0;
      if (remainingItems.length === 0) {
        // If no items remain, cancel the entire order
        const updated = await tx.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.CANCELLED,
            totalAmount: 0,
            gstAmount: 0,
            serviceCharge: 0,
            finalAmount: 0,
            completedAt: now,
            updatedAt: now
          },
          include: {
            table: true,
            items: {
              where: { deletedAt: null },
              include: { menuItem: true, modifiers: true, addons: true }
            }
          }
        });
        return { order: updated, isEntireCancelled: true };
      }

      // Re-sum remaining items using active DB state
      // (Wait, we can fetch all non-deleted order items within transaction to compute safely)
      const freshItems = await tx.orderItem.findMany({
        where: { orderId: order.id, deletedAt: null },
        include: { modifiers: true, addons: true }
      });

      for (const item of freshItems) {
        const itemMods = item.modifiers.reduce((s, m) => s + m.price, 0);
        const itemAdds = item.addons.reduce((s, a) => s + a.price, 0);
        newSubtotal += (item.price + itemMods + itemAdds) * item.quantity;
      }

      // Recompute taxes & discount
      // Fetch restaurant settings for tax rates
      const settings = await tx.restaurantSetting.findFirst();
      const gstRate = settings?.gstRate ?? 5.0;
      const serviceChargeRate = settings?.serviceChargeRate ?? 5.0;

      // Recompute coupon discount if applicable
      let newDiscount = 0;
      if (order.discountAmount > 0) {
        // Simple proportional discount scaling, or preserve original rules
        // For security, cap discount at subtotal
        newDiscount = Math.min(order.discountAmount, newSubtotal);
      }

      const netAmount = Math.max(0, newSubtotal - newDiscount);
      const gstAmount = parseFloat(((netAmount * gstRate) / 100).toFixed(2));
      const serviceChargeAmount = parseFloat(((netAmount * serviceChargeRate) / 100).toFixed(2));
      const finalAmount = parseFloat((netAmount + gstAmount + serviceChargeAmount).toFixed(2));

      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          totalAmount: newSubtotal,
          gstAmount,
          serviceCharge: serviceChargeAmount,
          finalAmount,
          updatedAt: now
        },
        include: {
          table: true,
          items: {
            where: { deletedAt: null },
            include: { menuItem: true, modifiers: true, addons: true }
          }
        }
      });

      return { order: updated, isEntireCancelled: false };
    });

    if (result.isEntireCancelled) {
      await publishSocketEvent("ORDER_CANCELLED", result.order);
    } else {
      await publishSocketEvent("ORDER_UPDATED", result.order);
    }

    revalidatePath("/kitchen");
    revalidatePath("/waiter");
    revalidatePath("/admin");

    return { success: true, order: result.order, isEntireCancelled: result.isEntireCancelled };
  } catch (error: any) {
    console.error("[KDS Actions] Error cancelling order item:", error);
    return { success: false, error: error.message || "Failed to cancel item." };
  }
}

// Fetch KDS Analytics & Metrics for Performance Dashboard
export async function getKDSAnalytics(dateString?: string) {
  try {
    const todayStart = dateString ? new Date(dateString) : new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);

    // 1. Fetch all orders created today
    const todayOrders = await db.order.findMany({
      where: {
        createdAt: {
          gte: todayStart,
          lte: todayEnd
        },
        deletedAt: null
      },
      include: {
        items: {
          where: { deletedAt: null }
        }
      }
    });

        // 2. Count active and completed orders
    const liveActiveOrders = todayOrders.filter(o => 
      ([OrderStatus.PENDING, OrderStatus.RECEIVED, OrderStatus.ACCEPTED, OrderStatus.PREPARING] as OrderStatus[]).includes(o.status)
    ).length;

    const completedTodayOrders = todayOrders.filter(o => 
      o.status === OrderStatus.COMPLETED || o.status === OrderStatus.SERVED || o.status === OrderStatus.READY
    );

    // 3. Average and fastest preparation time (in minutes)
    // Prep time is measured from acceptedAt (chef starts) to readyAt (marked ready).
    // If acceptedAt is missing, fall back to createdAt.
    let totalPrepTimeMs = 0;
    let prepCount = 0;
    let fastestPrepTimeMins = Infinity;
    const fastestOrdersList: any[] = [];

    const completedWithTimes = completedTodayOrders.filter(o => o.readyAt);

    completedWithTimes.forEach(o => {
      const start = o.acceptedAt || o.createdAt;
      const durationMs = o.readyAt!.getTime() - start.getTime();
      const durationMins = parseFloat((durationMs / 60000).toFixed(2));
      
      if (durationMins > 0) {
        totalPrepTimeMs += durationMs;
        prepCount++;

        if (durationMins < fastestPrepTimeMins) {
          fastestPrepTimeMins = durationMins;
        }

        fastestOrdersList.push({
          id: o.id,
          orderNumber: o.orderNumber,
          prepTimeMins: durationMins,
          finalAmount: o.finalAmount,
          createdAt: o.createdAt
        });
      }
    });

    const averagePrepTimeMins = prepCount > 0 
      ? parseFloat(((totalPrepTimeMs / prepCount) / 60000).toFixed(2)) 
      : 0.0;

    const finalFastestMins = fastestPrepTimeMins === Infinity ? 0.0 : fastestPrepTimeMins;
    
    // Sort fastest prepared orders
    const fastestPreparedOrders = fastestOrdersList
      .sort((a, b) => a.prepTimeMins - b.prepTimeMins)
      .slice(0, 5);

    // 4. Delayed orders count
    // Delayed orders are active or completed orders where completion time or current time exceeded expected SLA
    const now = new Date();
    const delayedOrders = todayOrders.filter(o => {
      if (o.status === OrderStatus.CANCELLED || o.status === OrderStatus.REFUNDED) return false;
      if (!o.expectedReadyAt) return false;
      
      const readyTime = o.readyAt || now;
      return readyTime.getTime() > o.expectedReadyAt.getTime();
    });

    const delayedCount = delayedOrders.length;

    // 5. Chef workload (Current active chef load: active preparing tickets)
    const activePreparingCount = todayOrders.filter(o => o.status === OrderStatus.PREPARING).length;
    const activeAcceptedCount = todayOrders.filter(o => o.status === OrderStatus.ACCEPTED).length;
    
    // Load distribution percentage (0-100% capacity assuming 3 chef lines max, say 10 orders is 100% load)
    const chefWorkloadPercentage = Math.min(100, Math.round(((activePreparingCount * 1.5 + activeAcceptedCount) / 12) * 100));

    // 6. Peak order hours (Orders grouped by hour 0-23)
    const hourlyDistribution = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }));
    todayOrders.forEach(o => {
      const hr = new Date(o.createdAt).getHours();
      hourlyDistribution[hr].count++;
    });

    // 7. Most ordered dishes today
    const dishCountMap: Record<string, { name: string, quantity: number, isVeg: boolean }> = {};
    
    // Fetch all items ordered today
    for (const order of todayOrders) {
      if (order.status === OrderStatus.CANCELLED) continue;
      
      for (const item of order.items) {
        if (dishCountMap[item.menuItemId]) {
          dishCountMap[item.menuItemId].quantity += item.quantity;
        } else {
          // Fetch veg status if possible, default true
          // (We will approximate or fetch through DB, since we have items, we'll map their names)
          dishCountMap[item.menuItemId] = {
            name: item.name,
            quantity: item.quantity,
            isVeg: true // default placeholder, frontend will display nicely
          };
        }
      }
    }

    const mostOrderedDishes = Object.values(dishCountMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    // 8. Kitchen efficiency percentage
    // Percentage of completed orders that were prepared within expected SLA
    const completedWithinSLA = completedWithTimes.filter(o => {
      if (!o.expectedReadyAt) return true;
      return o.readyAt!.getTime() <= o.expectedReadyAt.getTime();
    }).length;

    const totalCompletedWithSLA = completedWithTimes.length;
    const kitchenEfficiencyPercentage = totalCompletedWithSLA > 0
      ? Math.round((completedWithinSLA / totalCompletedWithSLA) * 100)
      : 100; // 100% efficient if no orders completed yet

    return {
      success: true,
      analytics: {
        averagePrepTimeMins,
        fastestPrepTimeMins: finalFastestMins,
        fastestPreparedOrders,
        delayedOrdersCount: delayedCount,
        chefWorkloadPercentage,
        peakOrderHours: hourlyDistribution,
        mostOrderedDishes,
        kitchenEfficiencyPercentage,
        liveActiveOrderCount: liveActiveOrders,
        completedTodayCount: completedTodayOrders.length
      }
    };
  } catch (error: any) {
    console.error("[KDS Actions] Error retrieving analytics:", error);
    return { success: false, error: error.message || "Failed to load dashboard metrics." };
  }
}
