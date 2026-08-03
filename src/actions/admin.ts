"use server";

import db from "@/lib/db";
import { OrderStatus, TableStatus, PaymentStatus, PaymentMethod, Role } from "@prisma/client";
import { publishSocketEvent } from "@/lib/socket-helper";
import { encryptQRToken } from "@/lib/qr-security";

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

// 1. Get Admin Dashboard KPIs & Metrics
export async function getAdminDashboardData() {
  try {
    const firstBranch = await db.branch.findFirst();
    if (!firstBranch) return { success: false, error: "No branches configured." };
    const branchId = firstBranch.id;

    // Dates for "Today"
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // Fetch all orders today
    const todayOrders = await db.order.findMany({
      where: { branchId, createdAt: { gte: startOfToday, lte: endOfToday }, deletedAt: null },
      include: { items: true, table: true }
    });

    const activeOrdersToday = todayOrders.filter(o => o.status !== OrderStatus.CANCELLED && o.status !== OrderStatus.REFUNDED);

    // Today's Stats
    const todayRevenue = activeOrdersToday.reduce((sum, o) => sum + o.finalAmount, 0);

    const pendingOrdersCount = todayOrders.filter(o => o.status === OrderStatus.PENDING).length;
    const acceptedOrdersCount = todayOrders.filter(o => o.status === OrderStatus.ACCEPTED || o.status === OrderStatus.RECEIVED).length;
    const preparingOrdersCount = todayOrders.filter(o => o.status === OrderStatus.PREPARING).length;
    const readyOrdersCount = todayOrders.filter(o => o.status === OrderStatus.READY).length;
    const pickedUpOrdersCount = todayOrders.filter(o => (o.status as any) === "OUT_FOR_DELIVERY").length;
    const deliveredOrdersCount = todayOrders.filter(o => o.status === OrderStatus.SERVED).length;
    const completedOrdersCount = todayOrders.filter(o => o.status === OrderStatus.COMPLETED).length;
    const cancelledOrdersCount = todayOrders.filter(o => o.status === OrderStatus.CANCELLED || o.status === OrderStatus.REFUNDED).length;
    const delayedOrdersCount = todayOrders.filter((o: any) => o.isDelayed).length;

    const runningOrdersCount = pendingOrdersCount + acceptedOrdersCount + preparingOrdersCount + readyOrdersCount + pickedUpOrdersCount;
    const kitchenQueueCount = pendingOrdersCount + acceptedOrdersCount + preparingOrdersCount;
    const waiterQueueCount = readyOrdersCount + pickedUpOrdersCount;

    const averageOrderValue = activeOrdersToday.length > 0
      ? parseFloat((todayRevenue / activeOrdersToday.length).toFixed(2))
      : 0.0;

    // Table Counts & Lists
    const totalTablesCount = await db.restaurantTable.count({ where: { branchId, deletedAt: null } });
    const occupiedTablesCount = await db.restaurantTable.count({
      where: {
        branchId,
        status: { in: [TableStatus.OCCUPIED, TableStatus.PREPARING, TableStatus.READY, TableStatus.SERVED] },
        deletedAt: null
      }
    });
    const availableTablesCount = Math.max(0, totalTablesCount - occupiedTablesCount);

    const tables = await db.restaurantTable.findMany({
      where: { branchId, deletedAt: null },
      include: {
        sessions: {
          where: { isActive: true, deletedAt: null },
          take: 1
        },
        waiters: {
          include: {
            waiter: {
              include: { user: true }
            }
          }
        }
      },
      orderBy: { number: "asc" }
    });

    const totalCustomersToday = new Set(todayOrders.map(o => o.customerName || o.tableId)).size || todayOrders.length;

    // Bestsellers Today
    const dishCountMap: Record<string, { name: string, quantity: number, price: number, revenue: number }> = {};
    activeOrdersToday.forEach(o => {
      o.items.forEach(item => {
        if (dishCountMap[item.menuItemId]) {
          dishCountMap[item.menuItemId].quantity += item.quantity;
          dishCountMap[item.menuItemId].revenue += item.price * item.quantity;
        } else {
          dishCountMap[item.menuItemId] = {
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            revenue: item.price * item.quantity
          };
        }
      });
    });

    const topSellingFood = Object.values(dishCountMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    // Hourly distribution for orders today
    const hourlyOrders = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0, revenue: 0 }));
    todayOrders.forEach(o => {
      const hr = new Date(o.createdAt).getHours();
      hourlyOrders[hr].count++;
      if (o.status !== OrderStatus.CANCELLED && o.status !== OrderStatus.REFUNDED) {
        hourlyOrders[hr].revenue += o.finalAmount;
      }
    });

    // Payment methods division
    const paymentMethods = {
      UPI: activeOrdersToday.filter(o => o.paymentMethod === PaymentMethod.UPI).length,
      CASH: activeOrdersToday.filter(o => o.paymentMethod === PaymentMethod.CASH).length,
      CARD: activeOrdersToday.filter(o => o.paymentMethod === PaymentMethod.CARD).length,
      SPLIT_BILL: activeOrdersToday.filter(o => o.paymentMethod === PaymentMethod.SPLIT_BILL).length,
      PAY_LATER: activeOrdersToday.filter(o => o.paymentMethod === PaymentMethod.PAY_LATER).length,
    };

    // Coupon metrics
    const totalCouponsUsed = todayOrders.filter((o: any) => o.couponCode).length;
    const totalCouponDiscount = todayOrders.reduce((sum, o: any) => sum + (o.discountAmount || 0), 0);

    // Live Feed logs (retrieve last 8 activity logs)
    const liveActivity = await db.activityLog.findMany({
      where: { branchId },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { user: true }
    });

    // Recent orders
    const recentOrders = await db.order.findMany({
      where: { branchId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { items: true, table: true }
    });

    return {
      success: true,
      tables,
      metrics: {
        todayRevenue,
        todayOrdersCount: todayOrders.length,
        completedOrdersCount,
        runningOrdersCount,
        cancelledOrdersCount,
        pendingOrdersCount,
        acceptedOrdersCount,
        preparingOrdersCount,
        readyOrdersCount,
        pickedUpOrdersCount,
        deliveredOrdersCount,
        delayedOrdersCount,
        kitchenQueueCount,
        waiterQueueCount,
        averageOrderValue,
        occupiedTablesCount,
        availableTablesCount,
        totalCustomersToday,
        topSellingFood,
        hourlyOrders,
        paymentMethods,
        totalCouponsUsed,
        totalCouponDiscount,
        liveActivity,
        recentOrders
      }
    };
  } catch (error: any) {
    console.error("[Admin Actions] Error fetching dashboard metrics:", error);
    return { success: false, error: error.message || "Failed to load dashboard KPIs." };
  }
}

// 2. Get Admin Orders with sorting and search filters
export async function getAdminOrders(searchQuery?: string, statusFilter?: string) {
  try {
    const orders = await db.order.findMany({
      where: {
        deletedAt: null,
        status: statusFilter && statusFilter !== "ALL" ? (statusFilter as OrderStatus) : undefined,
        OR: searchQuery ? [
          { orderNumber: { contains: searchQuery, mode: "insensitive" } },
          { customerName: { contains: searchQuery, mode: "insensitive" } }
        ] : undefined
      },
      include: {
        table: true,
        items: {
          where: { deletedAt: null },
          include: { menuItem: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return { success: true, orders };
  } catch (error: any) {
    console.error("[Admin Actions] Error fetching orders list:", error);
    return { success: false, error: "Failed to load orders." };
  }
}

// 3. Update order status directly from admin panel
export async function updateAdminOrderStatus(orderId: string, status: OrderStatus, adminUserId: string) {
  try {
    const updated = await db.order.update({
      where: { id: orderId },
      data: { status, updatedAt: new Date() },
      include: { table: true }
    });

    await logActivity(adminUserId, "UPDATE_ORDER_STATUS", `Updated Ticket ${updated.orderNumber} status to ${status}`);
    await publishSocketEvent("ORDER_UPDATED", updated);

    return { success: true, order: updated };
  } catch (error: any) {
    console.error("[Admin Actions] Error updating order status:", error);
    return { success: false, error: "Failed to update order status." };
  }
}

// 4. Cancel/Refund entire order from admin panel
export async function cancelOrRefundAdminOrder(orderId: string, isRefund: boolean, adminUserId: string) {
  try {
    const targetStatus = isRefund ? OrderStatus.REFUNDED : OrderStatus.CANCELLED;
    const paymentStatus = isRefund ? PaymentStatus.REFUNDED : undefined;

    const updated = await db.order.update({
      where: { id: orderId },
      data: {
        status: targetStatus,
        paymentStatus,
        completedAt: new Date(),
        updatedAt: new Date()
      },
      include: { table: true }
    });

    // Update table status back to FREE
    await db.restaurantTable.update({
      where: { id: updated.tableId },
      data: { status: TableStatus.FREE }
    });

    await logActivity(adminUserId, isRefund ? "REFUND_ORDER" : "CANCEL_ORDER", `Processed ${isRefund ? "refund" : "cancellation"} for Ticket ${updated.orderNumber}`);
    await publishSocketEvent(isRefund ? "ORDER_UPDATED" : "ORDER_CANCELLED", updated);

    return { success: true, order: updated };
  } catch (error: any) {
    console.error("[Admin Actions] Error processing cancellation/refund:", error);
    return { success: false, error: "Failed to process order action." };
  }
}

// 5. Create restaurant table and generate its QR code
export async function createAdminTable(
  tableNumber: number,
  capacity: number,
  adminUserId: string,
  floor?: string,
  section?: string,
  layoutShape: string = "SQUARE"
) {
  try {
    const firstBranch = await db.branch.findFirst();
    if (!firstBranch) throw new Error("No branch configured.");

    const table = await db.restaurantTable.create({
      data: {
        branchId: firstBranch.id,
        number: tableNumber,
        capacity,
        status: TableStatus.FREE,
        floor: floor || "Ground Floor",
        section: section || "Main Section",
        layoutShape
      }
    });

    const hostUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const secureToken = encryptQRToken(table.id, firstBranch.id);
    const qrRoute = `${hostUrl}/scan/${secureToken}`;

    // Create QR Code record in database
    await db.qRCode.create({
      data: {
        tableId: table.id,
        codeUrl: qrRoute,
        isActive: true
      }
    });

    await logActivity(adminUserId, "CREATE_TABLE", `Created Table ${tableNumber} with capacity ${capacity} in ${floor || "Ground Floor"}`);
    await publishSocketEvent("TABLE_CLOSED", { tableId: table.id, status: TableStatus.FREE });

    return { success: true, table };
  } catch (error: any) {
    console.error("[Admin Actions] Error creating table:", error);
    return { success: false, error: error.message || "Failed to create table." };
  }
}

// 5a. Save table coordinate offsets and size modifications
export async function updateAdminTableLayout(
  tableId: string,
  layoutData: {
    layoutX: number;
    layoutY: number;
    layoutWidth: number;
    layoutHeight: number;
    layoutShape?: string;
    floor?: string;
    section?: string;
  },
  adminUserId: string
) {
  try {
    const table = await db.restaurantTable.update({
      where: { id: tableId },
      data: {
        layoutX: layoutData.layoutX,
        layoutY: layoutData.layoutY,
        layoutWidth: layoutData.layoutWidth,
        layoutHeight: layoutData.layoutHeight,
        layoutShape: layoutData.layoutShape,
        floor: layoutData.floor,
        section: layoutData.section
      }
    });

    await publishSocketEvent("ORDER_UPDATED", { tableId });
    return { success: true, table };
  } catch (error: any) {
    console.error("[Admin Actions] Error updating table layout:", error);
    return { success: false, error: "Failed to save table layout coordinates." };
  }
}

// 5b. Cryptographically regenerate QR code signed token link
export async function regenerateTableQR(tableId: string, adminUserId: string) {
  try {
    const table = await db.restaurantTable.findUnique({
      where: { id: tableId }
    });
    if (!table) throw new Error("Table not found.");

    const secureToken = encryptQRToken(table.id, table.branchId);
    const hostUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const newRoute = `${hostUrl}/scan/${secureToken}`;

    await db.qRCode.upsert({
      where: { tableId },
      create: { tableId, codeUrl: newRoute, isActive: true },
      update: { codeUrl: newRoute, isActive: true }
    });

    await logActivity(adminUserId, "REGENERATE_QR", `Regenerated secure QR code token for Table ${table.number}`);
    return { success: true, codeUrl: newRoute };
  } catch (error: any) {
    console.error("[Admin Actions] Error regenerating QR code:", error);
    return { success: false, error: "Failed to regenerate QR code." };
  }
}

// 5c. Deactivate QR code token link to block scans
export async function deactivateTableQR(tableId: string, adminUserId: string) {
  try {
    const updated = await db.qRCode.update({
      where: { tableId },
      data: { isActive: false }
    });

    await logActivity(adminUserId, "DEACTIVATE_QR", `Deactivated QR code for Table ${tableId}`);
    return { success: true, qrCode: updated };
  } catch (error: any) {
    console.error("[Admin Actions] Error deactivating QR:", error);
    return { success: false, error: "Failed to deactivate QR code." };
  }
}

// 6. Delete restaurant table
export async function deleteAdminTable(tableId: string, adminUserId: string) {
  try {
    const deleted = await db.restaurantTable.update({
      where: { id: tableId },
      data: { deletedAt: new Date() }
    });

    await logActivity(adminUserId, "DELETE_TABLE", `Deleted Table ${deleted.number}`);
    return { success: true };
  } catch (error: any) {
    console.error("[Admin Actions] Error deleting table:", error);
    return { success: false, error: "Failed to delete table." };
  }
}

// 7. Rename restaurant table number
export async function renameAdminTable(tableId: string, newNumber: number, adminUserId: string) {
  try {
    const updated = await db.restaurantTable.update({
      where: { id: tableId },
      data: { number: newNumber }
    });

    await logActivity(adminUserId, "RENAME_TABLE", `Renamed table to Table ${newNumber}`);
    return { success: true, table: updated };
  } catch (error: any) {
    console.error("[Admin Actions] Error renaming table:", error);
    return { success: false, error: "Failed to rename table." };
  }
}

// 8. Assign Waiter to Table
export async function assignWaiterToTable(tableId: string, waiterId: string, adminUserId: string) {
  try {
    // Delete any existing assignment for this table first
    await db.waiterTable.deleteMany({
      where: { tableId }
    });

    // Create new assignment
    const assignment = await db.waiterTable.create({
      data: {
        tableId,
        waiterId
      },
      include: {
        waiter: {
          include: { user: true }
        }
      }
    });

    await logActivity(adminUserId, "ASSIGN_WAITER", `Assigned waiter ${assignment.waiter.user.name} to Table`);
    return { success: true };
  } catch (error: any) {
    console.error("[Admin Actions] Error assigning waiter:", error);
    return { success: false, error: "Failed to assign waiter to table." };
  }
}

// 9. Get Menu lists for Category and Items
export async function getAdminMenuData() {
  try {
    const firstBranch = await db.branch.findFirst();
    if (!firstBranch) return { success: false, error: "No branch found." };

    const categories = await db.category.findMany({
      where: { branchId: firstBranch.id, deletedAt: null },
      orderBy: { order: "asc" },
      include: {
        items: {
          where: { deletedAt: null },
          orderBy: { name: "asc" }
        }
      }
    });

    return { success: true, categories };
  } catch (error: any) {
    console.error("[Admin Actions] Error fetching admin menu data:", error);
    return { success: false, error: "Failed to load menu list." };
  }
}

// 10. Availability toggling for menu items
export async function updateMenuItemAvailability(itemId: string, isAvailable: boolean, adminUserId: string) {
  try {
    const updated = await db.menuItem.update({
      where: { id: itemId },
      data: { isAvailable }
    });

    await logActivity(adminUserId, "TOGGLE_MENU_AVAILABILITY", `Toggled availability of ${updated.name} to ${isAvailable}`);
    return { success: true, item: updated };
  } catch (error: any) {
    console.error("[Admin Actions] Error toggling availability:", error);
    return { success: false, error: "Failed to change item availability." };
  }
}

// 11. Create / Update Menu Item
export async function upsertAdminMenuItem(data: {
  id?: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  preparationTime: number;
  isVeg: boolean;
  isBestseller: boolean;
  isSpecial: boolean;
  image?: string;
}, adminUserId: string) {
  try {
    const firstBranch = await db.branch.findFirst();
    if (!firstBranch) throw new Error("No branch configured.");

    const itemPayload = {
      branchId: firstBranch.id,
      categoryId: data.categoryId,
      name: data.name,
      description: data.description,
      price: parseFloat(data.price.toString()),
      preparationTime: parseInt(data.preparationTime.toString()),
      isVeg: data.isVeg,
      isNonVeg: !data.isVeg,
      isBestseller: data.isBestseller,
      isSpecial: data.isSpecial,
      image: data.image || "/item.png"
    };

    let item;
    if (data.id) {
      item = await db.menuItem.update({
        where: { id: data.id },
        data: itemPayload
      });
      await logActivity(adminUserId, "UPDATE_MENU_ITEM", `Updated menu item: ${data.name}`);
    } else {
      item = await db.menuItem.create({
        data: itemPayload
      });
      await logActivity(adminUserId, "CREATE_MENU_ITEM", `Created menu item: ${data.name}`);
    }

    return { success: true, item };
  } catch (error: any) {
    console.error("[Admin Actions] Error upserting menu item:", error);
    return { success: false, error: error.message || "Failed to save menu item." };
  }
}

// 12. Delete Menu Item
export async function deleteAdminMenuItem(itemId: string, adminUserId: string) {
  try {
    const deleted = await db.menuItem.update({
      where: { id: itemId },
      data: { deletedAt: new Date() }
    });

    await logActivity(adminUserId, "DELETE_MENU_ITEM", `Deleted menu item: ${deleted.name}`);
    return { success: true };
  } catch (error: any) {
    console.error("[Admin Actions] Error deleting menu item:", error);
    return { success: false, error: "Failed to delete item." };
  }
}

// 13. Get active Coupons
export async function getAdminCoupons() {
  try {
    const firstBranch = await db.branch.findFirst();
    if (!firstBranch) return { success: false, error: "No branches." };

    const coupons = await db.coupon.findMany({
      where: { branchId: firstBranch.id, deletedAt: null },
      orderBy: { createdAt: "desc" }
    });

    return { success: true, coupons };
  } catch (error: any) {
    console.error("[Admin Actions] Error fetching coupons:", error);
    return { success: false, error: "Failed to load coupons." };
  }
}

// 14. Create / Update Coupon
export async function upsertAdminCoupon(data: {
  id?: string;
  code: string;
  discountPercent: number;
  minOrderAmount: number;
  maxDiscount?: number;
  isActive: boolean;
}, adminUserId: string) {
  try {
    const firstBranch = await db.branch.findFirst();
    if (!firstBranch) throw new Error("No branch configured.");

    const couponPayload = {
      branchId: firstBranch.id,
      code: data.code.toUpperCase().trim(),
      discountPercent: parseFloat(data.discountPercent.toString()),
      discountValue: parseFloat(data.discountPercent.toString()),
      minOrderAmount: parseFloat(data.minOrderAmount.toString()),
      maxDiscount: data.maxDiscount ? parseFloat(data.maxDiscount.toString()) : null,
      isActive: data.isActive
    };

    let coupon;
    if (data.id) {
      coupon = await db.coupon.update({
        where: { id: data.id },
        data: couponPayload
      });
      await logActivity(adminUserId, "UPDATE_COUPON", `Updated coupon: ${data.code}`);
    } else {
      coupon = await db.coupon.create({
        data: couponPayload
      });
      await logActivity(adminUserId, "CREATE_COUPON", `Created coupon: ${data.code}`);
    }

    return { success: true, coupon };
  } catch (error: any) {
    console.error("[Admin Actions] Error upserting coupon:", error);
    return { success: false, error: error.message || "Failed to save coupon." };
  }
}

// 15. Delete Coupon
export async function deleteAdminCoupon(couponId: string, adminUserId: string) {
  try {
    const deleted = await db.coupon.update({
      where: { id: couponId },
      data: { deletedAt: new Date() }
    });

    await logActivity(adminUserId, "DELETE_COUPON", `Deleted coupon: ${deleted.code}`);
    return { success: true };
  } catch (error: any) {
    console.error("[Admin Actions] Error deleting coupon:", error);
    return { success: false, error: "Failed to delete coupon." };
  }
}

// 16. Get Staff User profiles with Waiter Performance metrics
export async function getAdminStaff() {
  try {
    const staff = await db.user.findMany({
      where: {
        role: { in: [Role.WAITER, Role.KITCHEN, Role.ADMIN] },
        deletedAt: null
      },
      include: {
        waiterProfile: true,
        adminProfile: true
      },
      orderBy: { name: "asc" }
    });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const staffWithPerformance = await Promise.all(
      staff.map(async (member) => {
        if (member.role !== Role.WAITER) return member;

        const deliveredToday = await db.order.findMany({
          where: {
            waiterId: member.id,
            status: { in: [OrderStatus.SERVED, OrderStatus.COMPLETED] },
            deliveredAt: { gte: startOfToday },
            deletedAt: null
          },
          select: { tableId: true, deliveryDuration: true, deliveredAt: true }
        });

        const activeCount = await db.order.count({
          where: {
            waiterId: member.id,
            status: { in: [OrderStatus.READY, OrderStatus.OUT_FOR_DELIVERY] },
            deletedAt: null
          }
        });

        const tablesServedSet = new Set(deliveredToday.map(d => d.tableId));
        const totalDuration = deliveredToday.reduce((sum, d) => sum + (d.deliveryDuration || 0), 0);
        const avgDuration = deliveredToday.length > 0 ? Math.round(totalDuration / deliveredToday.length) : 0;
        
        const sortedDeliveries = [...deliveredToday].sort((a, b) => {
          const tA = a.deliveredAt ? new Date(a.deliveredAt).getTime() : 0;
          const tB = b.deliveredAt ? new Date(b.deliveredAt).getTime() : 0;
          return tB - tA;
        });
        const lastDelivery = sortedDeliveries.length > 0 ? sortedDeliveries[0].deliveredAt : null;

        return {
          ...member,
          performance: {
            ordersDeliveredToday: deliveredToday.length,
            tablesServedToday: tablesServedSet.size,
            avgDeliveryTimeSeconds: avgDuration,
            activeDeliveriesCount: activeCount,
            lastDeliveryTime: lastDelivery ? lastDelivery.toISOString() : null
          }
        };
      })
    );

    return { success: true, staff: staffWithPerformance };
  } catch (error: any) {
    console.error("[Admin Actions] Error fetching staff:", error);
    return { success: false, error: "Failed to load staff list." };
  }
}

// 17. Promote/Demote User Role
export async function updateStaffRole(userId: string, newRole: Role, adminUserId: string) {
  try {
    const updated = await db.user.update({
      where: { id: userId },
      data: { role: newRole }
    });

    await logActivity(adminUserId, "UPDATE_STAFF_ROLE", `Changed role of user ${updated.name} to ${newRole}`);
    return { success: true, user: updated };
  } catch (error: any) {
    console.error("[Admin Actions] Error changing staff role:", error);
    return { success: false, error: "Failed to update staff role." };
  }
}

// 18. Retrieve Activity Logs
export async function getAdminLogs() {
  try {
    const logs = await db.activityLog.findMany({
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 50
    });
    return { success: true, logs };
  } catch (error: any) {
    console.error("[Admin Actions] Error fetching logs:", error);
    return { success: false, error: "Failed to fetch logs." };
  }
}

// 19. Retrieve Settings
export async function getAdminSettingsData() {
  try {
    const settings = await db.restaurantSetting.findFirst();
    const branch = await db.branch.findFirst();
    const restaurant = await db.restaurant.findFirst();

    return {
      success: true,
      settings: {
        id: settings?.id || "",
        restaurantId: restaurant?.id || "",
        name: restaurant?.name || "Bikaji Premium Dining",
        logo: restaurant?.logo || "",
        currency: settings?.currency || "INR",
        gstRate: settings?.gstRate ?? 5.0,
        serviceChargeRate: settings?.serviceChargeRate ?? 5.0,
        address: branch?.address || "",
        phone: branch?.phone || ""
      }
    };
  } catch (error: any) {
    console.error("[Admin Actions] Error retrieving settings:", error);
    return { success: false, error: "Failed to retrieve settings." };
  }
}

// 20. Update settings (GST, service charge, currency, restaurant name)
export async function updateAdminSettingsData(data: {
  id: string;
  restaurantId: string;
  name: string;
  logo: string;
  gstRate: number;
  serviceChargeRate: number;
  address: string;
  phone: string;
}, adminUserId: string) {
  try {
    await db.$transaction(async (tx) => {
      // Update restaurant info
      if (data.restaurantId) {
        await tx.restaurant.update({
          where: { id: data.restaurantId },
          data: { name: data.name, logo: data.logo }
        });
      }

      // Update settings info
      if (data.id) {
        await tx.restaurantSetting.update({
          where: { id: data.id },
          data: {
            gstRate: parseFloat(data.gstRate.toString()),
            serviceChargeRate: parseFloat(data.serviceChargeRate.toString())
          }
        });
      }

      // Update active branch address & phone
      const activeBranch = await tx.branch.findFirst();
      if (activeBranch) {
        await tx.branch.update({
          where: { id: activeBranch.id },
          data: { address: data.address, phone: data.phone }
        });
      }
    });

    await logActivity(adminUserId, "UPDATE_SETTINGS", "Updated global restaurant settings");
    return { success: true };
  } catch (error: any) {
    console.error("[Admin Actions] Error saving settings:", error);
    return { success: false, error: "Failed to save settings." };
  }
}
