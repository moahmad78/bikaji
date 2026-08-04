"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getOrderDetails, sendCustomerOrderReply } from "@/actions/order";
import { createServiceRequest } from "@/actions/serviceRequest";
import { useCart } from "@/features/cart/CartContext";
import { motion, AnimatePresence } from "framer-motion";
import { OrderStatus, PaymentStatus, PaymentMethod, RequestType } from "@prisma/client";
import {
  ChefHat,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  ArrowLeft,
  ShoppingBag,
  Bell,
  Droplet,
  FileText,
  X,
  Info,
  Calendar,
  CreditCard,
  RefreshCw,
  Gift,
  Utensils,
} from "lucide-react";

import { io } from "socket.io-client";
import CustomerBottomNav from "@/components/CustomerBottomNav";

interface OrderItemWithMenuItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  specialNotes: string | null;
  menuItem: {
    isVeg: boolean;
    image: string;
    preparationTime: number;
  };
  modifiers: {
    modifierId: string;
    name: string;
    price: number;
  }[];
  addons: {
    addonId: string;
    name: string;
    price: number;
  }[];
}

interface OrderWithTableAndItems {
  updatedAt: any;
  id: string;
  orderNumber: string;
  customerName: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  totalAmount: number;
  gstAmount: number;
  serviceCharge: number;
  discountAmount: number;
  finalAmount: number;
  specialNotes: string | null;
  kitchenNotes?: string | null;
  customerReply?: string | null;
  delayMinutes?: number | null;
  delayReason?: string | null;
  waiterName?: string | null;
  waiterAcceptedAt?: Date | string | null;
  deliveredAt?: Date | string | null;
  acceptedAt?: Date | string | null;
  preparingAt?: Date | string | null;
  readyAt?: Date | string | null;
  servedAt?: Date | string | null;
  completedAt?: Date | string | null;
  expectedReadyAt?: Date | string | null;
  createdAt: Date;
  table: {
    number: number;
    id: string;
  };
  items: OrderItemWithMenuItem[];
}

export default function OrderStatusPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;
  const { tableId, addToCart } = useCart();

  const [order, setOrder] = useState<OrderWithTableAndItems | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Table Dashboard Modal States
  const [showLiveTrackingModal, setShowLiveTrackingModal] = useState<boolean>(false);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);

  // Table Service FAB States
  const [serviceFABOpen, setServiceFABOpen] = useState<boolean>(false);
  const [serviceSubmitting, setServiceSubmitting] = useState<boolean>(false);

  // Customer Reply State
  const [customReplyText, setCustomReplyText] = useState<string>("");
  const [sendingReply, setSendingReply] = useState<boolean>(false);

  // Toast System
  const [toasts, setToasts] = useState<{ id: string; message: string; type: "success" | "error" | "info" }[]>([]);

  const addToast = (message: string, type: "success" | "error" | "info" = "success") => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const handleSendCustomerReply = async (replyText: string) => {
    if (!orderId || !replyText.trim()) return;
    setSendingReply(true);
    try {
      const res = await sendCustomerOrderReply(orderId, replyText.trim());
      if (res.success && res.order) {
        setOrder(prev => prev ? { ...prev, customerReply: replyText.trim() } : prev);
        addToast("Your message was sent to the kitchen!", "success");
        setCustomReplyText("");
      } else {
        addToast(res.error || "Failed to send message.", "error");
      }
    } catch (err) {
      addToast("Network error while sending message.", "error");
    } finally {
      setSendingReply(false);
    }
  };

  // Load and poll order status
  useEffect(() => {
    if (!orderId) return;

    async function fetchStatus() {
      try {
        const res = await getOrderDetails(orderId);
        if (res.success && res.order) {
          const orderData = {
            ...res.order,
            createdAt: new Date(res.order.createdAt),
          } as OrderWithTableAndItems;
          setOrder(orderData);
          setError(null);
        } else {
          setError(res.error || "Order details could not be found.");
        }
      } catch (err) {
        console.error("Error fetching order:", err);
        setError("Network error. Unable to fetch order details.");
      } finally {
        setLoading(false);
      }
    }

    fetchStatus();

    // Realtime Socket.IO listener for instant status updates
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
    const socket = io(socketUrl, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      auth: {
        role: "CUSTOMER",
      },
    });

    socket.on("connect", () => {
      socket.emit("subscribe-order", orderId);
    });

    const handleRealtimeUpdate = (updatedData: any) => {
      if (!updatedData || (updatedData.id !== orderId && updatedData.orderId !== orderId)) return;
      console.log("[OrderStatusPage] Realtime status update received:", updatedData.status);
      if (updatedData.status) {
        addToast(`Order status updated to ${updatedData.status}`, "info");
      }
      
      setOrder((prev) => {
        if (!prev) return prev;
        return { ...prev, ...updatedData };
      });
    };

    const events = [
      "ORDER_CREATED", "ORDER_ACCEPTED", "ORDER_COOKING", "ORDER_READY",
      "WAITER_ASSIGNED", "ORDER_PICKED_UP", "ORDER_DELIVERED",
      "ORDER_COMPLETED", "ORDER_DELAYED", "ORDER_CANCELLED", "ORDER_UPDATED",
    ];

    events.forEach(evt => socket.on(evt, handleRealtimeUpdate));

    return () => {
      events.forEach(evt => socket.off(evt, handleRealtimeUpdate));
      socket.disconnect();
    };
  }, [orderId]);

  // Handle Service Assistance
  const handleServiceRequest = async (type: RequestType, customName?: string) => {
    const targetTableId = order?.table.id || tableId;
    if (!targetTableId) {
      addToast("Table session not found. Please scan table QR.", "error");
      return;
    }
    setServiceSubmitting(true);
    setServiceFABOpen(false);
    try {
      const res = await createServiceRequest(targetTableId, type, customName);
      if (res.success) {
        let msg = "";
        if (customName) {
          msg = `${customName} request logged. Staff is on the way!`;
        } else {
          switch (type) {
            case RequestType.WATER:
              msg = "Water request logged. Crew is on their way!";
              break;
            case RequestType.TISSUE:
              msg = "Tissue request logged. Crew is on their way!";
              break;
            case RequestType.WAITER:
              msg = "Waiter called. A staff member will assist you shortly.";
              break;
            case RequestType.BILL:
              msg = "Bill request received. Generating invoice copy...";
              break;
          }
        }
        addToast(msg, "success");
      } else {
        addToast(res.error || "Failed to notify staff.", "error");
      }
    } catch (err) {
      console.error(err);
      addToast("Failed to process request due to a network error.", "error");
    } finally {
      setServiceSubmitting(false);
    }
  };

  // Repeat Last Order Action
  const handleRepeatOrder = () => {
    if (!order) return;

    order.items.forEach((item) => {
      // Loop quantity to add multiple if ordered
      for (let q = 0; q < item.quantity; q++) {
        addToCart({
          menuItemId: item.menuItemId,
          name: item.name,
          price: item.price,
          isVeg: item.menuItem.isVeg,
          image: item.menuItem.image,
          selectedModifiers: item.modifiers.map((m) => ({
            id: m.modifierId,
            name: m.name,
            price: m.price,
          })),
          selectedAddons: item.addons.map((a) => ({
            id: a.addonId,
            name: a.name,
            price: a.price,
          })),
          specialNotes: item.specialNotes || undefined,
        });
      }
    });

    addToast("Re-populated cart with items from this order!", "success");
    setTimeout(() => {
      router.push("/menu");
    }, 800);
  };

  // Status mapping utility
  const getStatusStepInfo = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.PENDING:
        return {
          step: 1,
          title: "Order Received",
          description: "Awaiting kitchen response and assignment.",
          color: "text-amber-500 bg-amber-500/10 border-amber-200",
        };
      case OrderStatus.RECEIVED:
      case OrderStatus.ACCEPTED:
        return {
          step: 2,
          title: "Order Accepted",
          description: "Chef has accepted your ticket. Preparing fresh ingredients.",
          color: "text-blue-600 bg-blue-600/10 border-blue-300",
        };
      case OrderStatus.PREPARING:
        return {
          step: 3,
          title: "Freshly Cooking",
          description: "Our culinary masters are preparing your meal.",
          color: "text-[#baa47f] bg-[#800020]/20 border-[#baa47f]/30",
        };
      case OrderStatus.READY:
        return {
          step: 4,
          title: "Ready For Pickup",
          description: "Food is ready in kitchen! Waiting for waiter assignment.",
          color: "text-[#baa47f] bg-amber-950/40 border-amber-500/40",
        };
      case (OrderStatus as any).OUT_FOR_DELIVERY || "OUT_FOR_DELIVERY":
        return {
          step: 5,
          title: "Waiter is bringing your food",
          description: order?.waiterName
            ? `${order.waiterName} picked up your food and is bringing it to Table ${order.table?.number || ""}.`
            : "Waiter is bringing your food to your table.",
          color: "text-blue-400 bg-blue-950/40 border-blue-500/40",
        };
      case OrderStatus.SERVED:
        return {
          step: 6,
          title: "Delivered To Table",
          description: "Delivered! Enjoy your meal 🎉",
          color: "text-emerald-400 bg-emerald-950/20 border-emerald-500/30",
        };
      case OrderStatus.COMPLETED:
        return {
          step: 7,
          title: "Order Completed",
          description: "Thank you for dining with Bikaji!",
          color: "text-[#baa47f] bg-[#800020]/10 border-[#baa47f]/30",
        };
      case OrderStatus.CANCELLED:
        return {
          step: 0,
          title: "Order Cancelled",
          description: "This order was cancelled. Please verify with staff.",
          color: "text-rose-500 bg-rose-950/40 border-rose-500/30",
        };
      default:
        return {
          step: 1,
          title: "Order Processing",
          description: "System is initializing your request.",
          color: "text-zinc-400 bg-zinc-900 border-zinc-800",
        };
    }
  };

  const getTimelineSteps = (currentStatus: OrderStatus) => {
    const { step } = getStatusStepInfo(currentStatus);
    if (currentStatus === OrderStatus.CANCELLED || currentStatus === OrderStatus.REFUNDED) return [];

    return [
      { num: 1, label: "Received", isCompleted: step >= 1, isActive: step === 1, time: order?.createdAt },
      { num: 2, label: "Accepted", isCompleted: step >= 2, isActive: step === 2, time: order?.acceptedAt },
      { num: 3, label: "Cooking", isCompleted: step >= 3, isActive: step === 3, time: order?.preparingAt },
      { num: 4, label: "Ready", isCompleted: step >= 4, isActive: step === 4, time: order?.readyAt },
      { num: 5, label: "Picked Up", isCompleted: step >= 5, isActive: step === 5, time: order?.waiterAcceptedAt },
      { num: 6, label: "Delivered", isCompleted: step >= 6, isActive: step >= 6, time: order?.deliveredAt || (order as any)?.servedAt },
    ];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col justify-center items-center p-6 text-center relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-maroon-900/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-gold-500/5 blur-[120px] pointer-events-none" />
        <div className="z-10 flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <h2 className="text-lg font-display font-bold text-neutral-900 uppercase tracking-wider">Syncing Order Status...</h2>
          <p className="text-xs text-neutral-600">Please wait while we retrieve live details</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col justify-center items-center p-6 text-center relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-maroon-900/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-gold-500/5 blur-[120px] pointer-events-none" />
        <div className="z-10 flex flex-col items-center">
          <div className="w-16 h-16 rounded-md bg-destructive/10 border border-destructive/20 flex items-center justify-center mb-6 text-destructive text-xl font-bold">
            !
          </div>
          <h1 className="text-2xl font-display font-extrabold mb-2 text-neutral-900">Order Inquiry Failed</h1>
          <p className="text-neutral-600 text-sm max-w-sm mb-8 leading-relaxed">
            {error || "We couldn't retrieve the status of this order. It may have been archived."}
          </p>
          <button
            onClick={() => router.push("/menu")}
            className="px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-md text-sm border border-gold-500/20 hover:bg-maroon-800 transition shadow-soft"
          >
            Back to Digital Menu
          </button>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusStepInfo(order.status);
  const timelineSteps = getTimelineSteps(order.status);
  const maxPrepTime = order.items.reduce((max, i) => Math.max(max, i.menuItem.preparationTime), 15);

  return (
    <div className="min-h-screen bg-neutral-50 relative pb-28">
      {/* Glow overlays */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-maroon-900/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-gold-500/5 blur-[120px] pointer-events-none" />

      {/* Table Dashboard Header */}
      <header className="sticky top-0 bg-white/90 backdrop-blur-md z-30 border-b border-border shadow-soft">
        <div className="max-w-xl mx-auto px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold">
              <Utensils className="w-5 h-5 text-primary" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-500 block">Welcome to Bikaji</span>
              <h1 className="text-base font-display font-extrabold text-neutral-900 leading-none">
                Table {order.table.number} Dashboard
              </h1>
            </div>
          </div>

          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active Session
          </span>
        </div>
      </header>

      {/* Main Dashboard Body */}
      <main className="max-w-xl mx-auto px-5 pt-6 flex flex-col gap-5">
        
        {/* 1. RUNNING BILL SUMMARY CARD */}
        <section className="bg-gradient-to-br from-[#1a080a] to-[#2b0f13] text-white p-5 rounded-2xl shadow-large border border-[#baa47f]/20 flex flex-col gap-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-36 h-36 bg-gold-500/10 rounded-bl-[120px] pointer-events-none" />
          
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-extrabold tracking-widest text-[#baa47f]">
              🧾 Session Running Bill
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${
              order.paymentStatus === PaymentStatus.PAID
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                : "bg-amber-500/20 text-amber-300 border-amber-500/30"
            }`}>
              {order.paymentStatus}
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-3xl font-display font-extrabold text-white">
                ₹{order.finalAmount.toFixed(2)}
              </span>
              <span className="text-xs text-zinc-400 block mt-0.5">
                Total for 1 Active Order (Taxes & Charges Included)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-white/10">
            <button
              onClick={() => setShowReceiptModal(true)}
              className="py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 border border-white/15"
            >
              <FileText className="w-4 h-4 text-[#baa47f]" /> View Bill Details
            </button>
            <button
              onClick={() => handleServiceRequest(RequestType.BILL)}
              disabled={serviceSubmitting}
              className="py-2.5 rounded-xl bg-[#baa47f] hover:bg-[#a38d67] text-black text-xs font-extrabold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
            >
              <CreditCard className="w-4 h-4" /> Request Bill
            </button>
          </div>
        </section>

        {/* 2. CURRENT ACTIVE ORDER CARD */}
        <section className="bg-white border border-neutral-200 p-5 rounded-2xl shadow-soft flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <ChefHat className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-500 block">Current Active Order</span>
                <h3 className="text-sm font-extrabold text-neutral-900 leading-none">
                  Ticket #{order.orderNumber}
                </h3>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-bold text-neutral-500 block">Estimated Time</span>
              <span className="text-xs font-mono font-extrabold text-primary flex items-center gap-1 justify-end">
                <Clock className="w-3.5 h-3.5" /> ~{maxPrepTime} mins
              </span>
            </div>
          </div>

          {/* Current Status Box */}
          <div className={`p-3.5 rounded-xl border ${statusInfo.color} flex items-center justify-between gap-3`}>
            <div className="flex items-center gap-3">
              {order.status === OrderStatus.SERVED || order.status === OrderStatus.COMPLETED ? (
                <CheckCircle2 className="w-5 h-5 animate-pulse text-emerald-600 shrink-0" />
              ) : order.status === OrderStatus.CANCELLED ? (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              ) : (
                <ChefHat className="w-5 h-5 animate-bounce text-primary shrink-0" />
              )}
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wide block leading-tight">
                  {statusInfo.title}
                </span>
                <span className="text-[11px] opacity-90 leading-tight block mt-0.5">
                  {statusInfo.description}
                </span>
              </div>
            </div>
          </div>

          {/* Action Button: View Live Tracking Modal */}
          <button
            onClick={() => setShowLiveTrackingModal(true)}
            className="w-full py-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-extrabold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-[#baa47f]" /> View Live Tracking & Order Timeline
          </button>
        </section>

        {/* 3. QUICK ACTIONS GRID */}
        <section className="flex flex-col gap-2.5">
          <span className="text-[11px] uppercase font-extrabold tracking-wider text-neutral-500 px-1">
            ⚡ Quick Actions
          </span>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
            <button
              onClick={() => router.push("/menu")}
              className="p-3 rounded-2xl bg-white border border-neutral-200 hover:border-primary/40 text-neutral-900 flex flex-col items-center justify-center gap-1.5 transition cursor-pointer shadow-sm hover:shadow-soft"
            >
              <Utensils className="w-5 h-5 text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-center">Browse Menu</span>
            </button>

            <button
              onClick={() => router.push("/menu")}
              className="p-3 rounded-2xl bg-white border border-neutral-200 hover:border-primary/40 text-neutral-900 flex flex-col items-center justify-center gap-1.5 transition cursor-pointer shadow-sm hover:shadow-soft"
            >
              <ShoppingBag className="w-5 h-5 text-emerald-600" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-center">Add More</span>
            </button>

            <button
              onClick={() => setShowReceiptModal(true)}
              className="p-3 rounded-2xl bg-white border border-neutral-200 hover:border-primary/40 text-neutral-900 flex flex-col items-center justify-center gap-1.5 transition cursor-pointer shadow-sm hover:shadow-soft"
            >
              <FileText className="w-5 h-5 text-amber-600" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-center">Running Bill</span>
            </button>

            <button
              onClick={() => handleServiceRequest(RequestType.WAITER)}
              disabled={serviceSubmitting}
              className="p-3 rounded-2xl bg-white border border-neutral-200 hover:border-primary/40 text-neutral-900 flex flex-col items-center justify-center gap-1.5 transition cursor-pointer shadow-sm hover:shadow-soft"
            >
              <Bell className="w-5 h-5 text-blue-600" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-center">Call Waiter</span>
            </button>

            <button
              onClick={() => handleServiceRequest(RequestType.BILL)}
              disabled={serviceSubmitting}
              className="p-3 rounded-2xl bg-white border border-neutral-200 hover:border-primary/40 text-neutral-900 flex flex-col items-center justify-center gap-1.5 transition cursor-pointer shadow-sm hover:shadow-soft"
            >
              <CreditCard className="w-5 h-5 text-indigo-600" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-center">Request Bill</span>
            </button>
          </div>
        </section>

        {/* 4. RECENT ORDERS SECTION */}
        <section className="flex flex-col gap-3 bg-white border border-neutral-200 p-5 rounded-2xl shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-extrabold tracking-wider text-neutral-500">
              📜 Recent Orders (Session History)
            </span>
            <span className="text-[10px] text-neutral-400 font-bold">1 Order Placed</span>
          </div>

          <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-extrabold text-neutral-900 block">Ticket #{order.orderNumber}</span>
                <span className="text-[10px] text-neutral-500 block">
                  {order.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {order.items.length} Items
                </span>
              </div>
              <div className="text-right">
                <span className="text-sm font-extrabold text-primary font-mono block">₹{order.finalAmount.toFixed(2)}</span>
                <span className="text-[9px] font-bold text-emerald-600 uppercase bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block mt-0.5">
                  {order.status === "SERVED" || order.status === "COMPLETED" ? "DELIVERED" : order.status}
                </span>
              </div>
            </div>

            <div className="flex gap-2 border-t border-neutral-200 pt-2.5">
              <button
                onClick={() => setShowReceiptModal(true)}
                className="flex-1 py-2 rounded-lg bg-white border border-neutral-200 text-neutral-800 text-[10px] font-bold uppercase tracking-wider hover:bg-neutral-100 transition cursor-pointer"
              >
                View Details
              </button>
              <button
                onClick={handleRepeatOrder}
                className="flex-1 py-2 rounded-lg bg-primary text-white text-[10px] font-extrabold uppercase tracking-wider hover:bg-primary/90 transition cursor-pointer flex items-center justify-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Repeat Order
              </button>
            </div>
          </div>
        </section>

        {/* 5. RECOMMENDED FOOD CAROUSEL */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] uppercase font-extrabold tracking-wider text-neutral-500 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-gold-555" /> Recommended Specials
            </span>
            <button onClick={() => router.push("/menu")} className="text-[10px] font-extrabold text-primary uppercase">
              Full Menu →
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-white border border-neutral-200 flex flex-col justify-between gap-3 shadow-sm hover:shadow-soft">
              <div>
                <span className="text-[9px] font-extrabold uppercase text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded w-fit block mb-1">
                  Vegetarian
                </span>
                <h4 className="text-xs font-extrabold text-neutral-900">Bikaji Special Paneer Tikka</h4>
                <p className="text-[10px] text-neutral-500 mt-0.5">Charcoal grilled cottage cheese with spices</p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                <span className="text-xs font-mono font-extrabold text-neutral-900">₹280</span>
                <button
                  onClick={() => router.push("/menu")}
                  className="px-2.5 py-1 bg-primary text-white text-[10px] font-extrabold uppercase rounded-lg hover:bg-primary/90 transition cursor-pointer"
                >
                  + Add
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-neutral-200 flex flex-col justify-between gap-3 shadow-sm hover:shadow-soft">
              <div>
                <span className="text-[9px] font-extrabold uppercase text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded w-fit block mb-1">
                  Beverage
                </span>
                <h4 className="text-xs font-extrabold text-neutral-900">Royal Masala Chai</h4>
                <p className="text-[10px] text-neutral-500 mt-0.5">Freshly brewed cardamom and ginger tea</p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                <span className="text-xs font-mono font-extrabold text-neutral-900">₹60</span>
                <button
                  onClick={() => router.push("/menu")}
                  className="px-2.5 py-1 bg-primary text-white text-[10px] font-extrabold uppercase rounded-lg hover:bg-primary/90 transition cursor-pointer"
                >
                  + Add
                </button>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* MODAL: LIVE TRACKING & TIMELINE */}
      <AnimatePresence>
        {showLiveTrackingModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLiveTrackingModal(false)}
              className="fixed inset-0 bg-black z-50"
            />
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              className="fixed inset-x-4 top-12 bottom-12 max-w-lg mx-auto bg-card border border-border rounded-2xl p-6 shadow-modal z-50 flex flex-col gap-5 overflow-y-auto"
            >
              <div className="flex justify-between items-center pb-3 border-b border-border">
                <div>
                  <span className="text-[10px] uppercase font-extrabold tracking-widest text-primary">Live Tracking</span>
                  <h3 className="font-display font-extrabold text-lg text-neutral-900">
                    Order #{order.orderNumber}
                  </h3>
                </div>
                <button
                  onClick={() => setShowLiveTrackingModal(false)}
                  className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-600 hover:text-neutral-900 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Status Box */}
              <div className={`p-4 rounded-xl border ${statusInfo.color} flex items-start gap-3.5`}>
                <div className="mt-1">
                  {order.status === OrderStatus.SERVED || order.status === OrderStatus.COMPLETED ? (
                    <CheckCircle2 className="w-6 h-6 animate-pulse" />
                  ) : order.status === OrderStatus.CANCELLED ? (
                    <AlertCircle className="w-6 h-6" />
                  ) : (
                    <ChefHat className="w-6 h-6 animate-bounce" />
                  )}
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-extrabold uppercase tracking-wide leading-none mb-1">
                    {statusInfo.title}
                  </h4>
                  <p className="text-xs opacity-90 leading-relaxed">
                    {statusInfo.description}
                  </p>
                </div>
              </div>

              {/* 6-Step Timeline Stepper */}
              {order.status !== OrderStatus.CANCELLED && timelineSteps.length > 0 && (
                <div className="py-4 px-2">
                  <div className="relative flex items-center justify-between">
                    <div className="absolute left-0 right-0 h-0.5 bg-neutral-200 z-0" />
                    <div
                      className="absolute left-0 h-0.5 bg-primary z-0 transition-all duration-500"
                      style={{
                        width: `${((statusInfo.step - 1) / 5) * 100}%`,
                      }}
                    />

                    {timelineSteps.map((step) => (
                      <div key={step.num} className="relative z-10 flex flex-col items-center gap-2">
                        <motion.div
                          animate={step.isActive ? { scale: [1, 1.12, 1] } : {}}
                          transition={{ repeat: Infinity, duration: 2 }}
                          className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                            step.isCompleted
                              ? "bg-primary border-primary text-white"
                              : "bg-card border-border text-neutral-600"
                          }`}
                        >
                          {step.isCompleted && step.num < statusInfo.step ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
                          ) : (
                            step.num
                          )}
                        </motion.div>
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wider transition ${
                            step.isCompleted ? "text-neutral-900 font-extrabold" : "text-neutral-500"
                          }`}
                        >
                          {step.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Time Estimate */}
              {order.status !== OrderStatus.SERVED && order.status !== OrderStatus.COMPLETED && order.status !== OrderStatus.CANCELLED && (
                <div className="flex items-center gap-3.5 p-4 rounded-xl bg-neutral-100 border border-border text-xs">
                  <Clock className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <span className="font-bold text-neutral-900">Estimated prep SLA: ~{maxPrepTime} mins</span>
                    <p className="text-[10px] text-neutral-600 mt-0.5">
                      Your order is prepared fresh. The chef starts as soon as accepted.
                    </p>
                  </div>
                </div>
              )}

              {/* Customer Reply Section */}
              {(order.status === OrderStatus.ACCEPTED || order.status === OrderStatus.PREPARING || order.status === OrderStatus.READY) && (
                <div className="p-4 rounded-xl bg-neutral-50 border border-border flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Send Message to Kitchen</span>
                  </div>
                  {order.customerReply && (
                    <div className="p-2.5 bg-white rounded border border-border text-xs text-neutral-600 italic">
                      <span className="font-bold text-neutral-800 not-italic block mb-0.5">Your last message:</span>
                      &quot;{order.customerReply}&quot;
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {["No problem! 👍", "Please make it less spicy 🌶", "Extra napkins please", "We're ready for it"].map(msg => (
                      <button
                        key={msg}
                        onClick={() => handleSendCustomerReply(msg)}
                        disabled={sendingReply}
                        className="px-3 py-1.5 rounded-full text-[11px] font-semibold bg-white border border-border text-neutral-700 hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition cursor-pointer disabled:opacity-50"
                      >
                        {msg}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customReplyText}
                      onChange={(e) => setCustomReplyText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && customReplyText.trim()) handleSendCustomerReply(customReplyText); }}
                      placeholder="Type a custom message to the kitchen..."
                      className="flex-1 bg-white border border-border rounded-lg px-3 py-2 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-primary/40 transition"
                    />
                    <button
                      onClick={() => handleSendCustomerReply(customReplyText)}
                      disabled={!customReplyText.trim() || sendingReply}
                      className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold uppercase tracking-wider cursor-pointer disabled:opacity-40 hover:bg-primary/90 transition"
                    >
                      {sendingReply ? "..." : "Send"}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* MODAL: RUNNING BILL & RECEIPT DETAILS */}
      <AnimatePresence>
        {showReceiptModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowReceiptModal(false)}
              className="fixed inset-0 bg-black z-50"
            />
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              className="fixed inset-x-4 top-12 bottom-12 max-w-lg mx-auto bg-card border border-border rounded-2xl p-6 shadow-modal z-50 flex flex-col gap-4 overflow-y-auto"
            >
              <div className="flex justify-between items-center pb-3 border-b border-border">
                <div>
                  <span className="text-[10px] uppercase font-extrabold tracking-widest text-primary">Receipt & Breakdown</span>
                  <h3 className="font-display font-extrabold text-lg text-neutral-900">
                    Running Bill — Table {order.table.number}
                  </h3>
                </div>
                <button
                  onClick={() => setShowReceiptModal(false)}
                  className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-600 hover:text-neutral-900 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Itemized List */}
              <div className="flex flex-col gap-3">
                {order.items.map((item) => {
                  const modsTotal = item.modifiers.reduce((s, m) => s + m.price, 0);
                  const addsTotal = item.addons.reduce((s, a) => s + a.price, 0);
                  const singlePrice = item.price + modsTotal + addsTotal;

                  return (
                    <div key={item.id} className="flex justify-between items-start gap-4 py-2 border-b border-border/40 last:border-0 text-xs">
                      <div>
                        <h4 className="font-bold text-neutral-900">
                          {item.name} × {item.quantity}
                        </h4>
                        {((item.modifiers && item.modifiers.length > 0) || (item.addons && item.addons.length > 0)) && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.modifiers.map((m) => (
                              <span key={m.modifierId} className="text-[9px] bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-600">
                                {m.name}
                              </span>
                            ))}
                            {item.addons.map((a) => (
                              <span key={a.addonId} className="text-[9px] bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-600">
                                + {a.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="font-extrabold text-neutral-900 font-mono">
                        ₹{(singlePrice * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Financial Totals */}
              <div className="border-t border-border pt-4 flex flex-col gap-2 text-xs">
                <div className="flex justify-between text-neutral-600">
                  <span>Subtotal</span>
                  <span>₹{order.totalAmount.toFixed(2)}</span>
                </div>
                {order.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Discount</span>
                    <span>-₹{order.discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-neutral-600">
                  <span>Taxes & GST (5%)</span>
                  <span>₹{order.gstAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-neutral-600">
                  <span>Service Charge (5%)</span>
                  <span>₹{order.serviceCharge.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-extrabold text-neutral-900 border-t border-border pt-3">
                  <span>Total Bill Amount</span>
                  <span className="text-primary font-display font-extrabold text-base">
                    ₹{order.finalAmount.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => {
                    setShowReceiptModal(false);
                    handleServiceRequest(RequestType.BILL);
                  }}
                  className="w-full py-3 bg-primary text-white text-xs font-extrabold uppercase tracking-wider rounded-xl hover:bg-primary/90 transition cursor-pointer"
                >
                  Request Bill From Waiter
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Floating Table Service FAB */}
      <div className="fixed bottom-20 right-5 z-40">
        <button
          onClick={() => setServiceFABOpen(true)}
          className="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center shadow-floating border border-gold-500/30 hover:scale-105 transition-all cursor-pointer"
          aria-label="Table service"
        >
          <Bell className="w-5 h-5 text-gold-300" />
        </button>
      </div>

      {/* Table Service Options Modal */}
      <AnimatePresence>
        {serviceFABOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setServiceFABOpen(false)}
              className="fixed inset-0 bg-black z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-x-6 bottom-24 max-w-sm mx-auto bg-card border border-border rounded-xl p-6 shadow-modal z-50 flex flex-col gap-4"
            >
              <div className="flex justify-between items-center pb-2 border-b border-border">
                <h3 className="font-display font-bold text-sm text-neutral-900 uppercase tracking-wider flex items-center gap-2">
                  <Bell className="w-4 h-4 text-primary animate-ring" /> Table Assistance
                </h3>
                <button
                  onClick={() => setServiceFABOpen(false)}
                  className="w-6 h-6 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-600 hover:text-neutral-900"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>

              <p className="text-xs text-neutral-600">
                Select an option. The service crew will respond immediately.
              </p>

              <div className="grid grid-cols-2 gap-3 mt-1">
                <button
                  onClick={() => handleServiceRequest(RequestType.WAITER)}
                  disabled={serviceSubmitting}
                  className="p-3.5 rounded-md bg-neutral-100 border border-border hover:border-primary/40 text-neutral-900 flex flex-col items-center gap-2 transition cursor-pointer"
                >
                  <Bell className="w-5 h-5 text-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Call Waiter</span>
                </button>
                <button
                  onClick={() => handleServiceRequest(RequestType.WATER)}
                  disabled={serviceSubmitting}
                  className="p-3.5 rounded-md bg-neutral-100 border border-border hover:border-primary/40 text-neutral-900 flex flex-col items-center gap-2 transition cursor-pointer"
                >
                  <Droplet className="w-5 h-5 text-sky-500" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Request Water</span>
                </button>
                <button
                  onClick={() => handleServiceRequest(RequestType.TISSUE)}
                  disabled={serviceSubmitting}
                  className="p-3.5 rounded-md bg-neutral-100 border border-border hover:border-primary/40 text-neutral-900 flex flex-col items-center gap-2 transition cursor-pointer"
                >
                  <FileText className="w-5 h-5 text-amber-600" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Tissues</span>
                </button>
                <button
                  onClick={() => handleServiceRequest(RequestType.WAITER, "Spoon / Cutlery")}
                  disabled={serviceSubmitting}
                  className="p-3.5 rounded-md bg-neutral-100 border border-border hover:border-primary/40 text-neutral-900 flex flex-col items-center gap-2 transition cursor-pointer"
                >
                  <Utensils className="w-5 h-5 text-indigo-500" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Need Spoon</span>
                </button>
                <button
                  onClick={() => handleServiceRequest(RequestType.WAITER, "Birthday Celebration")}
                  disabled={serviceSubmitting}
                  className="p-3.5 rounded-md bg-neutral-100 border border-border hover:border-primary/40 text-neutral-900 flex flex-col items-center gap-2 transition cursor-pointer"
                >
                  <Gift className="w-5 h-5 text-rose-500 animate-bounce" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Celebrate!</span>
                </button>
                <button
                  onClick={() => handleServiceRequest(RequestType.BILL)}
                  disabled={serviceSubmitting}
                  className="p-3.5 rounded-md bg-neutral-100 border border-border hover:border-primary/40 text-neutral-900 flex flex-col items-center gap-2 transition cursor-pointer"
                >
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Request Bill</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Customer Bottom Navigation Bar */}
      <CustomerBottomNav orderId={order.id} />

      {/* Toast Notifications */}
      <div className="fixed top-20 right-6 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              className={`p-4 rounded-md border shadow-large text-xs font-semibold flex items-center gap-2 pointer-events-auto ${
                toast.type === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : toast.type === "error"
                  ? "bg-destructive/10 border-destructive/20 text-destructive"
                  : "bg-blue-50 border-blue-200 text-blue-800"
              }`}
            >
              <Info className="w-4 h-4 shrink-0" />
              <span>{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
