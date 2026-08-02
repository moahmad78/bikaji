"use server";

import db from "@/lib/db";
import { OrderStatus, PaymentStatus, PaymentMethod, TableStatus } from "@prisma/client";
import { publishSocketEvent } from "@/lib/socket-helper";

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

    // Execute order creation in a single transaction
    const result = await db.$transaction(async (tx) => {
      // 1. Fetch table details
      const table = await tx.restaurantTable.findUnique({
        where: { id: tableId },
      });

      if (!table) {
        throw new Error("Table not found.");
      }

      // Resolve branchId (from table if not explicitly provided)
      const targetBranchId = branchId || table.branchId;

      // 2. Fetch active restaurant settings (for tax rates)
      const settings = await tx.restaurantSetting.findFirst();
      const gstRate = settings?.gstRate ?? 5.0;
      const serviceChargeRate = settings?.serviceChargeRate ?? 5.0;

      // 3. Calculate financial details (including customization prices)
      let subtotal = 0;
      for (const item of cartItems) {
        const modifiersTotal = (item.selectedModifiers || []).reduce((s, m) => s + m.price, 0);
        const addonsTotal = (item.selectedAddons || []).reduce((s, a) => s + a.price, 0);
        const priceWithCustomizations = item.price + modifiersTotal + addonsTotal;
        subtotal += priceWithCustomizations * item.quantity;
      }

      // Verify and validate coupon code on the server side
      let discount = 0;
      if (couponCode) {
        const coupon = await tx.coupon.findUnique({
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

      // 4. Generate sequential order number scoped by branch
      const orderCount = await tx.order.count({
        where: { branchId: targetBranchId },
      });
      const nextOrderNumber = `BK-${1001 + orderCount}`;

      // 5. Determine default payment status
      const paymentStatus = paymentMethod === PaymentMethod.PAY_LATER 
        ? PaymentStatus.PAY_LATER 
        : PaymentStatus.PENDING;

      // 6. Create the main Order
      const newOrder = await tx.order.create({
        data: {
          branchId: targetBranchId,
          orderNumber: nextOrderNumber,
          tableId,
          customerName: customerName || "Guest",
          status: OrderStatus.PENDING, // Changed from RECEIVED to PENDING per new schema design enums
          paymentStatus,
          paymentMethod,
          totalAmount: subtotal,
          gstAmount,
          serviceCharge: serviceChargeAmount,
          discountAmount: discount,
          finalAmount,
          specialNotes,
        },
      });

      // 7. Create OrderItems + Modifiers + Addons
      for (const item of cartItems) {
        const newOrderItem = await tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            menuItemId: item.menuItemId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            specialNotes: item.specialNotes || null,
          },
        });

        // Add selected modifiers
        if (item.selectedModifiers && item.selectedModifiers.length > 0) {
          const modPromises = item.selectedModifiers.map((mod) =>
            tx.orderItemModifier.create({
              data: {
                orderItemId: newOrderItem.id,
                modifierId: mod.id,
                name: mod.name,
                price: mod.price,
              },
            })
          );
          await Promise.all(modPromises);
        }

        // Add selected addons
        if (item.selectedAddons && item.selectedAddons.length > 0) {
          const addPromises = item.selectedAddons.map((addon) =>
            tx.orderItemAddon.create({
              data: {
                orderItemId: newOrderItem.id,
                addonId: addon.id,
                name: addon.name,
                price: addon.price,
              },
            })
          );
          await Promise.all(addPromises);
        }
      }

      // 8. Update table status to OCCUPIED if it was FREE
      if (table.status === TableStatus.FREE) {
        await tx.restaurantTable.update({
          where: { id: tableId },
          data: { status: TableStatus.OCCUPIED },
        });
      }

      return newOrder;
    });

    if (result) {
      try {
        const fullOrderRes = await getOrderDetails(result.id);
        if (fullOrderRes.success && fullOrderRes.order) {
          await publishSocketEvent("order-new", fullOrderRes.order);
          await publishSocketEvent("ORDER_CREATED", fullOrderRes.order);
        }
      } catch (err) {
        console.error("Failed to publish socket event for new order:", err);
      }
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

    await publishSocketEvent("customer-reply", updatedOrder);
    await publishSocketEvent("CUSTOMER_REPLY", updatedOrder);
    await publishSocketEvent("order-updated", updatedOrder);

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
