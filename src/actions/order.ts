"use server";

import db from "@/lib/db";
import { OrderStatus, PaymentStatus, PaymentMethod, TableStatus } from "@prisma/client";
import { publishSocketEvent } from "@/lib/socket-helper";
import { revalidatePath } from "next/cache";

interface SelectedModifierInput {
  id: string;
  name: string;
  price: number;
}

interface SelectedAddonInput {
  id: string;
  name: string;
  price: number;
}

interface SubmitOrderInput {
  tableId: string;
  branchId?: string | null;
  customerName?: string;
  cartItems: {
    menuItemId: string;
    name: string;
    price: number;
    quantity: number;
    specialNotes?: string;
    selectedModifiers?: SelectedModifierInput[];
    selectedAddons?: SelectedAddonInput[];
  }[];
  specialNotes?: string;
  couponCode?: string;
  paymentMethod: PaymentMethod;
}

export async function submitOrder(input: SubmitOrderInput) {
  try {
    const { tableId, branchId, customerName, cartItems, specialNotes, couponCode, paymentMethod } = input;

    if (!tableId) {
      return { success: false, error: "Table ID is required to place an order." };
    }

    if (!cartItems || cartItems.length === 0) {
      return { success: false, error: "Your cart is empty." };
    }

    // --- PRE-FETCH & VALIDATIONS (OUTSIDE TRANSACTION) ---

    // 1. Fetch table details
    const table = await db.restaurantTable.findUnique({
      where: { id: tableId },
    });

    if (!table) {
      return { success: false, error: "Table not found." };
    }

    const targetBranchId = branchId || table.branchId;

    // 2. Fetch active restaurant settings (for tax rates)
    const settings = await db.restaurantSetting.findFirst();
    const gstRate = settings?.gstRate ?? 5.0;
    const serviceChargeRate = settings?.serviceChargeRate ?? 5.0;

    // 3. Batch-fetch and validate MenuItems, Modifiers, Addons
    const inputMenuItemIds = cartItems.map((i) => i.menuItemId);
    const dbMenuItems = await db.menuItem.findMany({
      where: { id: { in: inputMenuItemIds } },
    });
    const dbMenuItemMap = new Map(dbMenuItems.map((m) => [m.id, m]));

    const allModifierIds = cartItems.flatMap((i) => (i.selectedModifiers || []).map((m) => m.id));
    const allAddonIds = cartItems.flatMap((i) => (i.selectedAddons || []).map((a) => a.id));

    const dbModifiers = allModifierIds.length > 0
      ? await db.modifier.findMany({ where: { id: { in: allModifierIds } } })
      : [];
    const dbAddons = allAddonIds.length > 0
      ? await db.addon.findMany({ where: { id: { in: allAddonIds } } })
      : [];

    const dbModifierMap = new Map(dbModifiers.map((m) => [m.id, m]));
    const dbAddonMap = new Map(dbAddons.map((a) => [a.id, a]));

    interface PreparedItem {
      resolvedMenuItemId: string;
      name: string;
      price: number;
      quantity: number;
      specialNotes: string | null;
      validModifiers: SelectedModifierInput[];
      validAddons: SelectedAddonInput[];
    }

    const preparedItems: PreparedItem[] = [];
    for (const item of cartItems) {
      let menuItem: any = dbMenuItemMap.get(item.menuItemId) || null;
      let resolvedMenuItemId = item.menuItemId;

      // Fallback auto-heal by name if ID was from a stale cart session
      if (!menuItem && item.name) {
        menuItem = await db.menuItem.findFirst({
          where: { name: item.name, deletedAt: null },
        });
        if (menuItem) {
          resolvedMenuItemId = menuItem.id;
        }
      }

      if (!menuItem) {
        return {
          success: false,
          error: `Item "${item.name}" is no longer available. Please clear your cart and select items from the active menu.`,
        };
      }

      const validModifiers = (item.selectedModifiers || []).filter((m) => dbModifierMap.has(m.id));
      const validAddons = (item.selectedAddons || []).filter((a) => dbAddonMap.has(a.id));

      preparedItems.push({
        resolvedMenuItemId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        specialNotes: item.specialNotes || null,
        validModifiers,
        validAddons,
      });
    }

    // 4. Calculate financial details
    let subtotal = 0;
    for (const item of preparedItems) {
      const modifiersTotal = item.validModifiers.reduce((s, m) => s + m.price, 0);
      const addonsTotal = item.validAddons.reduce((s, a) => s + a.price, 0);
      const priceWithCustomizations = item.price + modifiersTotal + addonsTotal;
      subtotal += priceWithCustomizations * item.quantity;
    }

    let discount = 0;
    if (couponCode) {
      const coupon = await db.coupon.findUnique({
        where: {
          branchId_code: {
            branchId: targetBranchId,
            code: couponCode.toUpperCase().trim(),
          },
        },
      });

      if (coupon && coupon.isActive && subtotal >= coupon.minOrderAmount) {
        if (!coupon.expiresAt || coupon.expiresAt > new Date()) {
          discount = (subtotal * coupon.discountPercent) / 100;
          if (coupon.maxDiscount && discount > coupon.maxDiscount) {
            discount = coupon.maxDiscount;
          }
        }
      }
    }

    const netAmount = Math.max(0, subtotal - discount);
    const gstAmount = parseFloat(((netAmount * gstRate) / 100).toFixed(2));
    const serviceChargeAmount = parseFloat(((netAmount * serviceChargeRate) / 100).toFixed(2));
    const finalAmount = parseFloat((netAmount + gstAmount + serviceChargeAmount).toFixed(2));

    const paymentStatus = paymentMethod === PaymentMethod.PAY_LATER 
      ? PaymentStatus.PAY_LATER 
      : PaymentStatus.PENDING;

    // --- ATOMIC DATABASE TRANSACTION (FAST WRITES ONLY) ---
    const result = await db.$transaction(
      async (tx) => {
        // Generate sequential order number scoped by branch
        const orderCount = await tx.order.count({
          where: { branchId: targetBranchId },
        });
        const nextOrderNumber = `BK-${1001 + orderCount}`;

        // Create main Order + OrderItems + Modifiers + Addons in a single atomic nested query
        const newOrder = await tx.order.create({
          data: {
            branchId: targetBranchId,
            orderNumber: nextOrderNumber,
            tableId,
            customerName: customerName || "Guest",
            status: OrderStatus.PENDING,
            paymentStatus,
            paymentMethod,
            totalAmount: subtotal,
            gstAmount,
            serviceCharge: serviceChargeAmount,
            discountAmount: discount,
            finalAmount,
            specialNotes,
            items: {
              create: preparedItems.map((item: PreparedItem) => ({
                menuItemId: item.resolvedMenuItemId,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                specialNotes: item.specialNotes,
                modifiers: item.validModifiers.length > 0 ? {
                  create: item.validModifiers.map((m: SelectedModifierInput) => ({
                    modifierId: m.id,
                    name: m.name,
                    price: m.price,
                  })),
                } : undefined,
                addons: item.validAddons.length > 0 ? {
                  create: item.validAddons.map((a: SelectedAddonInput) => ({
                    addonId: a.id,
                    name: a.name,
                    price: a.price,
                  })),
                } : undefined,
              })),
            },
          },
        });

        // Update table status to OCCUPIED if it was FREE
        if (table.status === TableStatus.FREE) {
          await tx.restaurantTable.update({
            where: { id: tableId },
            data: { status: TableStatus.OCCUPIED },
          });
        }

        return newOrder;
      },
      {
        maxWait: 10000,
        timeout: 20000,
      }
    );

    // --- POST-TRANSACTION SIDE EFFECTS (OUTSIDE TRANSACTION) ---
    if (result) {
      try {
        const fullOrderRes = await getOrderDetails(result.id);
        if (fullOrderRes.success && fullOrderRes.order) {
          await publishSocketEvent("ORDER_CREATED", fullOrderRes.order);
        }
      } catch (err) {
        console.error("Failed to publish socket event for new order:", err);
      }
    }

    try {
      revalidatePath("/kitchen");
      revalidatePath("/waiter");
      revalidatePath("/admin");
    } catch (revalErr) {
      // Safely ignore revalidatePath when invoked outside Next.js HTTP server context
    }

    return { success: true, orderId: result.id, orderNumber: result.orderNumber };
  } catch (error: any) {
    console.error("Error creating order:", error);
    return { success: false, error: error.message || "Internal server error" };
  }
}

export async function getOrderDetails(orderId: string) {
  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        table: true,
        items: {
          include: {
            menuItem: true,
            modifiers: true,
            addons: true,
          },
        },
      },
    });

    if (!order) {
      return { success: false, error: "Order not found." };
    }

    return { success: true, order };
  } catch (error: any) {
    console.error("Error fetching order status:", error);
    return { success: false, error: "Internal server error" };
  }
}

export async function sendCustomerOrderReply(orderId: string, replyText: string) {
  try {
    if (!orderId || !replyText.trim()) {
      return { success: false, error: "Order ID and reply message are required." };
    }

    const updatedOrder = await db.order.update({
      where: { id: orderId },
      data: {
        customerReply: replyText.trim(),
        updatedAt: new Date(),
      },
      include: {
        table: true,
        items: {
          include: {
            menuItem: true,
            modifiers: true,
            addons: true,
          },
        },
      },
    });

    await publishSocketEvent("CUSTOMER_REPLY", updatedOrder);
    await publishSocketEvent("ORDER_UPDATED", updatedOrder);

    return { success: true, order: updatedOrder };
  } catch (error: any) {
    console.error("Error sending customer order reply:", error);
    return { success: false, error: "Failed to send message to kitchen." };
  }
}

export async function getTableSessionOrders(tableId: string) {
  try {
    if (!tableId) return { success: false, orders: [] };
    const orders = await db.order.findMany({
      where: { tableId },
      orderBy: { createdAt: "desc" },
      include: {
        table: true,
        items: {
          include: {
            menuItem: true,
            modifiers: true,
            addons: true,
          },
        },
      },
    });
    return { success: true, orders };
  } catch (error: any) {
    console.error("Error fetching table session orders:", error);
    return { success: false, orders: [] };
  }
}
