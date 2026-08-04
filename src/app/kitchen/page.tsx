"use client";

import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import {
  sortKDSOrders,
  getOrderAgingInfo,
  getAgingBorderClass,
  getAgingGlowClass,
  getAgingBadgeClass,
} from "@/lib/order-priority";
import { UrgentOrdersCounter, AgingFilterType } from "@/components/UrgentOrdersCounter";
import {
  ChefHat,
  Volume2,
  VolumeX,
  Search,
  SlidersHorizontal,
  Flame,
  Clock,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  User,
  Coffee,
  XCircle,
  Plus,
  Minus,
  MessageSquare,
  FileText,
  Keyboard,
  CornerDownRight,
  HelpCircle,
  Activity,
  ArrowUpRight,
  Loader2,
  Lock,
  Mail,
  Shield
} from "lucide-react";
import Image from "next/image";
import {
  getKDSOrders,
  getKDSHistoryOrders,
  acceptKDSOrder,
  startPreparingKDSOrder,
  markKDSOrderReady,
  completeKDSOrder,
  delayKDSOrder,
  addKDSOrderNote,
  cancelKDSOrderItem,
  rejectKDSOrder
} from "@/actions/kds";
import { authClient } from "@/lib/auth-client";

// Local types to match seed structure
interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  specialNotes: string | null;
  deletedAt: Date | null;
  menuItem: {
    isVeg: boolean;
    isNonVeg: boolean;
    preparationTime: number;
    image: string;
    category?: {
      name: string;
    };
  };
  modifiers: {
    id: string;
    name: string;
    price: number;
  }[];
  addons: {
    id: string;
    name: string;
    price: number;
  }[];
}

interface Order {
  id: string;
  orderNumber: string;
  customerId: string | null;
  customerName: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  specialNotes: string | null;
  kitchenNotes: string | null;
  acceptedAt: string | null;
  preparingAt: string | null;
  readyAt: string | null;
  servedAt?: string | null;
  completedAt: string | null;
  expectedReadyAt: string | null;
  delayMinutes?: number | null;
  delayReason?: string | null;
  customerReply?: string | null;
  waiterName?: string | null;
  waiterAcceptedAt?: string | null;
  deliveredAt?: string | null;
  table: {
    number: number;
    id: string;
  };
  items: OrderItem[];
}

export default function KitchenPage() {
  const router = useRouter();

  // Auth States
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState<boolean>(false);
  
  // State
  const [orders, setOrders] = useState<Order[]>([]);
  // IDs of orders that just arrived — show glow + NEW badge for 10 seconds
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());
  // IDs of orders that just changed status — show flash for 3 seconds
  const [updatedOrderIds, setUpdatedOrderIds] = useState<Set<string>>(new Set());

  // 1. Session verification on mount
  useEffect(() => {
    async function checkSession() {
      try {
        const { data: currentSession } = await authClient.getSession();
        if (currentSession?.user) {
          const user = currentSession.user as any;
          if (user.role === "KITCHEN" || user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
            setSession(currentSession);
          } else {
            setSession(null);
          }
        }
      } catch (err) {
        console.error("Session verification error:", err);
      } finally {
        setAuthLoading(false);
      }
    }
    checkSession();
  }, []);

  // Secure Login Handler
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setLoginError("Please complete both Email and Password fields.");
      return;
    }
    setLoginError(null);
    setLoginLoading(true);

    try {
      const res = await authClient.signIn.email({
        email,
        password,
      });

      if (res && 'data' in res && res.data?.user) {
        const user = res.data.user as any;
        if (user.role === "KITCHEN" || user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
          setSession({ user });
          if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
            router.push("/admin");
          }
        } else if (user.role === "WAITER") {
          router.push("/waiter");
        } else if (user.role === "CASHIER") {
          router.push("/billing");
        } else {
          await authClient.signOut();
          setLoginError("Access Denied: Logged-in profile is not registered as Kitchen Staff.");
        }
      }
    } catch (err: any) {
      setLoginError(err.message || "Invalid email or password combination.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleQuickLogin = (roleEmail: string) => {
    setEmail(roleEmail);
    setPassword("password123");
  };
  const [loading, setLoading] = useState<boolean>(true);
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedPriority, setSelectedPriority] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [urgentFilter, setUrgentFilter] = useState<AgingFilterType>("ALL");
  
  // View Tabs: Active Queue vs Order History
  const [activeViewTab, setActiveViewTab] = useState<"live" | "history">("live");
  const [historyOrders, setHistoryOrders] = useState<Order[]>([]);
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>("ALL");
  const [historyTimeFilter, setHistoryTimeFilter] = useState<string>("24H");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [historySearchQuery, setHistorySearchQuery] = useState<string>("");
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  const loadHistoryData = async (
    status = historyStatusFilter,
    time = historyTimeFilter,
    start = customStartDate,
    end = customEndDate
  ) => {
    setLoadingHistory(true);
    const res = await getKDSHistoryOrders(status, time, start, end);
    if (res.success && res.orders) {
      const mapped = res.orders.map((o: any) => ({
        ...o,
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
        acceptedAt: o.acceptedAt ? o.acceptedAt.toISOString() : null,
        preparingAt: o.preparingAt ? o.preparingAt.toISOString() : null,
        readyAt: o.readyAt ? o.readyAt.toISOString() : null,
        waiterAcceptedAt: o.waiterAcceptedAt ? o.waiterAcceptedAt.toISOString() : null,
        deliveredAt: o.deliveredAt ? o.deliveredAt.toISOString() : null,
        servedAt: o.servedAt ? o.servedAt.toISOString() : null,
        completedAt: o.completedAt ? o.completedAt.toISOString() : null,
        expectedReadyAt: o.expectedReadyAt ? o.expectedReadyAt.toISOString() : null,
        items: o.items.map((item: any) => ({ ...item, menuItem: { ...item.menuItem } })),
      }));
      setHistoryOrders(mapped);
    }
    setLoadingHistory(false);
  };

  const filteredHistoryOrders = useMemo(() => {
    if (!historySearchQuery.trim()) return historyOrders;
    const q = historySearchQuery.toLowerCase();
    return historyOrders.filter((o) => {
      const ticketMatch = o.orderNumber.toLowerCase().includes(q);
      const tableMatch = o.table?.number?.toString() === q || `table ${o.table?.number}`.includes(q);
      const waiterMatch = o.waiterName?.toLowerCase().includes(q);
      const customerMatch = o.customerName?.toLowerCase().includes(q);
      const itemMatch = o.items?.some((i) => i.name.toLowerCase().includes(q));
      return ticketMatch || tableMatch || waiterMatch || customerMatch || itemMatch;
    });
  }, [historyOrders, historySearchQuery]);

  // Delay Modal State
  const [delayModalOrder, setDelayModalOrder] = useState<Order | null>(null);
  const [delayMinutesInput, setDelayMinutesInput] = useState<number>(10);
  const [delayReasonInput, setDelayReasonInput] = useState<string>("High kitchen load");
  const [delayNoteInput, setDelayNoteInput] = useState<string>("");

  // Interactive Modals/States
  const [acceptingOrder, setAcceptingOrder] = useState<Order | null>(null);
  const [customSlaMinutes, setCustomSlaMinutes] = useState<number>(15);
  const [noteOrder, setNoteOrder] = useState<Order | null>(null);
  const [kitchenNoteText, setKitchenNoteText] = useState<string>("");
  const [cancellingItem, setCancellingItem] = useState<{ itemId: string; itemName: string; orderId: string } | null>(null);
  const [showShortcuts, setShowShortcuts] = useState<boolean>(false);

  // Time-ticker state (triggers re-render of timers every 1s)
  const [tick, setTick] = useState<number>(0);

  // Socket reference
  const socketRef = useRef<Socket | null>(null);

  // Web Audio Synth for local chime alerts
  const playChime = (type: "new" | "warning") => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === "new") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        osc.start();
        osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.15); // A5
        gain.gain.setValueAtTime(0.06, ctx.currentTime + 0.15);
        osc.stop(ctx.currentTime + 0.35);
      } else {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(220, ctx.currentTime); // A3
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        osc.start();
        osc.frequency.setValueAtTime(147, ctx.currentTime + 0.2); // D3
        osc.stop(ctx.currentTime + 0.5);
      }
    } catch (err) {
      console.warn("Audio Context blocked or not supported:", err);
    }
  };

  // Initial Data Load
  useEffect(() => {
    if (!session?.user) return;
    async function loadOrders() {
      try {
        const res = await getKDSOrders();
        if (res.success && res.orders) {
          // Normalize orders to match expected frontend schema
          const mappedOrders = res.orders.map(o => ({
            ...o,
            createdAt: o.createdAt.toISOString(),
            updatedAt: o.updatedAt.toISOString(),
            acceptedAt: o.acceptedAt ? o.acceptedAt.toISOString() : null,
            preparingAt: o.preparingAt ? o.preparingAt.toISOString() : null,
            readyAt: o.readyAt ? o.readyAt.toISOString() : null,
            completedAt: o.completedAt ? o.completedAt.toISOString() : null,
            expectedReadyAt: o.expectedReadyAt ? o.expectedReadyAt.toISOString() : null,
            items: o.items.map(item => ({
              ...item,
              menuItem: {
                ...item.menuItem,
                // Make sure category name is readable
                category: item.menuItem.categoryId ? { name: "Dish" } : undefined
              }
            })) as any
          })) as any;
          setOrders(mappedOrders);
        }
      } catch (err) {
        console.error("Error loading KDS orders:", err);
      } finally {
        setLoading(false);
      }
    }
    loadOrders();

    // Setup 1s timer ticker
    const timer = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [session]);

  // Socket Connection Setup
  useEffect(() => {
    if (!session?.user) return;
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
    console.log("[KDS] Connecting to Socket server:", socketUrl);
    
    const socket = io(socketUrl, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      auth: {
        role: "KITCHEN",
        branchId: session?.user?.branchId || null,
      },
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[KDS] Connected to Socket server");
      setSocketConnected(true);
      socket.emit("kitchen-connected");
    });

    socket.on("disconnect", () => {
      console.log("[KDS] Disconnected from Socket server");
      setSocketConnected(false);
    });

    const handleNewOrder = (newOrder: any) => {
      if (!newOrder || !newOrder.id) return;
      console.log("[KDS] Realtime order received:", newOrder.orderNumber || newOrder.id);
      playChime("new");
      setOrders(prev => {
        const filtered = prev.filter(o => o.id !== newOrder.id);
        return [newOrder, ...filtered];
      });
      // Mark as new — auto-remove glow after 10s
      setNewOrderIds(prev => { const next = new Set(prev); next.add(newOrder.id); return next; });
      setTimeout(() => {
        setNewOrderIds(prev => { const next = new Set(prev); next.delete(newOrder.id); return next; });
      }, 10_000);
    };

    const handleUpdateOrder = (updatedOrder: any) => {
      if (!updatedOrder || !updatedOrder.id) return;
      console.log("[KDS] Realtime order update:", updatedOrder.id, updatedOrder.status);
      setOrders(prev => {
        const existing = prev.find(o => o.id === updatedOrder.id);
        const mergedOrder = existing ? { ...existing, ...updatedOrder } : updatedOrder;
        const filtered = prev.filter(o => o.id !== updatedOrder.id);
        return [mergedOrder, ...filtered];
      });
      // Mark as status-changed — flash for 3s
      setUpdatedOrderIds(prev => { const next = new Set(prev); next.add(updatedOrder.id); return next; });
      setTimeout(() => {
        setUpdatedOrderIds(prev => { const next = new Set(prev); next.delete(updatedOrder.id); return next; });
      }, 3_000);
    };

    // Subscribed Event streams
    socket.on("ORDER_CREATED", handleNewOrder);
    socket.on("ORDER_ACCEPTED", handleUpdateOrder);
    socket.on("ORDER_COOKING", handleUpdateOrder);
    socket.on("ORDER_READY", handleUpdateOrder);

    socket.on("ORDER_COMPLETED", (updatedOrder: any) => {
      if (!updatedOrder?.id) return;
      setOrders(prev => prev.filter(o => o.id !== updatedOrder.id));
    });

    socket.on("ORDER_CANCELLED", (updatedOrder: any) => {
      if (!updatedOrder?.id) return;
      setOrders(prev => prev.filter(o => o.id !== updatedOrder.id));
    });

    socket.on("ORDER_UPDATED", handleUpdateOrder);

    // Customer reply from order status page
    socket.on("CUSTOMER_REPLY", (updatedOrder: any) => {
      if (!updatedOrder?.id) return;
      playChime("warning");
      setOrders(prev => prev.map(o => o.id === updatedOrder.id ? { ...o, customerReply: updatedOrder.customerReply } : o));
    });

    // Delay events
    socket.on("order-delayed", handleUpdateOrder);
    socket.on("ORDER_DELAYED", handleUpdateOrder);

    // Waiter Acceptance events
    const handleWaiterAccepted = (data: any) => {
      const targetId = data.orderId || data.order?.id || data.id;
      if (!targetId) return;
      const waiterName = data.waiterName || data.order?.waiterName;
      const waiterAcceptedAt = data.waiterAcceptedAt || data.order?.waiterAcceptedAt || new Date().toISOString();
      setOrders(prev => prev.map(o => o.id === targetId ? { ...o, waiterName, waiterAcceptedAt } : o));
    };

    socket.on("order-accepted-by-waiter", handleWaiterAccepted);
    socket.on("WAITER_ACCEPTED", handleWaiterAccepted);

    return () => {
      socket.disconnect();
    };
  }, [soundEnabled, session]);

  // Keyboard Shortcuts (Accessability)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return; // Ignore inside input fields
      }
      
      // Escape closes modals
      if (e.key === "Escape") {
        setAcceptingOrder(null);
        setNoteOrder(null);
        setCancellingItem(null);
        setShowShortcuts(false);
        return;
      }

      // Shortcut: 'k' toggles shortcuts modal
      if (e.key === "k" || e.key === "K") {
        setShowShortcuts(prev => !prev);
        return;
      }

      // Shortcut: 'a' accepts the first PENDING ticket
      if (e.key === "a" || e.key === "A") {
        const pending = orders.find(o => o.status === "PENDING" || o.status === "RECEIVED");
        if (pending) {
          const maxPrep = pending.items.reduce((max, i) => Math.max(max, i.menuItem.preparationTime), 15);
          setCustomSlaMinutes(maxPrep);
          setAcceptingOrder(pending);
        }
        return;
      }

      // Shortcut: 's' starts preparing the first ACCEPTED ticket
      if (e.key === "s" || e.key === "S") {
        const accepted = orders.find(o => o.status === "ACCEPTED");
        if (accepted) {
          handleStartPreparing(accepted.id);
        }
        return;
      }

      // Shortcut: 'r' marks ready the first PREPARING ticket
      if (e.key === "r" || e.key === "R") {
        const preparing = orders.find(o => o.status === "PREPARING");
        if (preparing) {
          handleMarkReady(preparing.id);
        }
        return;
      }

      // Shortcut: 'd' opens dashboard
      if (e.key === "g" || e.key === "G") {
        router.push("/kitchen/dashboard");
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [orders, router]);

  // Core Actions with Optimistic UI updates
  const handleAcceptSubmit = async () => {
    if (!acceptingOrder) return;
    const orderId = acceptingOrder.id;
    const minutes = customSlaMinutes;
    setAcceptingOrder(null);

    // Optimistic state transition
    const originalOrders = [...orders];
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        const now = new Date();
        const expected = new Date(now.getTime() + minutes * 60000);
        return {
          ...o,
          status: "ACCEPTED",
          acceptedAt: now.toISOString(),
          expectedReadyAt: expected.toISOString()
        };
      }
      return o;
    }));

    const res = await acceptKDSOrder(orderId, minutes);
    if (!res.success) {
      // Revert if action failed
      setOrders(originalOrders);
      alert(res.error || "Failed to accept order");
    }
  };

  const handleStartPreparing = async (orderId: string) => {
    const originalOrders = [...orders];
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        return { ...o, status: "PREPARING", preparingAt: new Date().toISOString() };
      }
      return o;
    }));

    const res = await startPreparingKDSOrder(orderId);
    if (!res.success) {
      setOrders(originalOrders);
      alert(res.error || "Failed to start preparing");
    }
  };

  const handleMarkReady = async (orderId: string) => {
    const originalOrders = [...orders];
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        return { ...o, status: "READY", readyAt: new Date().toISOString() };
      }
      return o;
    }));

    const res = await markKDSOrderReady(orderId);
    if (!res.success) {
      setOrders(originalOrders);
      alert(res.error || "Failed to mark order ready");
    }
  };

  const handleCompleteOrder = async (orderId: string) => {
    const originalOrders = [...orders];
    setOrders(prev => prev.filter(o => o.id !== orderId));

    const res = await completeKDSOrder(orderId);
    if (!res.success) {
      setOrders(originalOrders);
      alert(res.error || "Failed to complete order");
    }
  };

  const handleDelay = async (orderId: string, minutes: number, reason?: string, note?: string) => {
    const originalOrders = [...orders];
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        const curr = o.expectedReadyAt ? new Date(o.expectedReadyAt) : new Date();
        const next = new Date(curr.getTime() + minutes * 60000);
        return {
          ...o,
          expectedReadyAt: next.toISOString(),
          delayMinutes: (o.delayMinutes || 0) + minutes,
          delayReason: reason || o.delayReason,
          kitchenNotes: note || o.kitchenNotes,
        };
      }
      return o;
    }));

    const res = await delayKDSOrder(orderId, minutes, reason, note);
    if (!res.success) {
      setOrders(originalOrders);
      alert(res.error || "Failed to delay order");
    }
  };

  const handleSaveKitchenNote = async () => {
    if (!noteOrder) return;
    const orderId = noteOrder.id;
    const text = kitchenNoteText;
    setNoteOrder(null);

    const originalOrders = [...orders];
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        return { ...o, kitchenNotes: text };
      }
      return o;
    }));

    const res = await addKDSOrderNote(orderId, text);
    if (!res.success) {
      setOrders(originalOrders);
      alert(res.error || "Failed to save kitchen note");
    }
  };

  const handleCancelItemSubmit = async () => {
    if (!cancellingItem) return;
    const { itemId, orderId } = cancellingItem;
    setCancellingItem(null);

    const originalOrders = [...orders];
    
    // Perform local state cancel
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        const remainingItems = o.items.filter(item => item.id !== itemId);
        if (remainingItems.length === 0) {
          // If no items remain, filter out the entire order
          return null;
        }
        return {
          ...o,
          items: remainingItems
        };
      }
      return o;
    }).filter(Boolean) as Order[]);

    const res = await cancelKDSOrderItem(itemId);
    if (!res.success) {
      setOrders(originalOrders);
      alert(res.error || "Failed to cancel item");
    }
  };

  const handleRejectOrder = async (orderId: string) => {
    const confirmReject = confirm("Are you sure you want to REJECT and cancel this entire order?");
    if (!confirmReject) return;

    const originalOrders = [...orders];
    setOrders(prev => prev.filter(o => o.id !== orderId));

    const res = await rejectKDSOrder(orderId);
    if (!res.success) {
      setOrders(originalOrders);
      alert(res.error || "Failed to reject order");
    }
  };

  // Helper selectors and calculations (priority triggers, SLA check)
  const getOrderSlaDetails = (order: Order) => {
    const elapsedMs = Date.now() - new Date(order.createdAt).getTime();
    const elapsedMins = Math.floor(elapsedMs / 60000);
    const elapsedSecs = Math.floor((elapsedMs % 60000) / 1000);
    const elapsedStr = `${elapsedMins}m ${elapsedSecs}s`;

    if (!order.expectedReadyAt) {
      return { elapsedStr, countdownStr: "Awaiting SLA", isLate: false, isUrgent: false, progress: 0 };
    }

    const totalDurationMs = new Date(order.expectedReadyAt).getTime() - new Date(order.createdAt).getTime();
    const remainingMs = new Date(order.expectedReadyAt).getTime() - Date.now();
    const isLate = remainingMs < 0;

    const absRemainingMs = Math.abs(remainingMs);
    const remMins = Math.floor(absRemainingMs / 60000);
    const remSecs = Math.floor((absRemainingMs % 60000) / 1000);
    const countdownStr = isLate ? `LATE ${remMins}m ${remSecs}s` : `${remMins}m ${remSecs}s`;
    
    // Play alert sound for delayed tickets once
    if (isLate && tick % 30 === 0) {
      playChime("warning");
    }

    // SLA urgent indicator (under 3 minutes remaining and not completed)
    const isUrgent = !isLate && remainingMs < 180000 && order.status !== "READY";
    
    // Progress calculation
    const progress = totalDurationMs > 0 
      ? Math.min(100, Math.round(((totalDurationMs - Math.max(0, remainingMs)) / totalDurationMs) * 100))
      : 100;

    return { elapsedStr, countdownStr, isLate, isUrgent, progress };
  };

  // Dynamic Priority system calculator
  const getOrderPriority = (order: Order) => {
    const itemQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const isVIP = order.table.number === 1 || order.table.number === 8 || order.customerName?.toLowerCase().includes("vip");
    
    const { isLate } = getOrderSlaDetails(order);

    if (isLate) return { label: "DELAYED", level: 4, style: "bg-red-500/20 text-red-300 border-red-500/30 animate-pulse" };
    if (isVIP) return { label: "VIP ORDER", level: 3, style: "bg-amber-500/20 text-accent border-accent/40" };
    if (itemQuantity >= 6) return { label: "LARGE ORDER", level: 2, style: "bg-purple-500/20 text-purple-300 border-purple-500/30" };
    
    // Urgent if pending for > 3 minutes
    const pendingTimeMs = Date.now() - new Date(order.createdAt).getTime();
    if ((order.status === "PENDING" || order.status === "RECEIVED") && pendingTimeMs > 180000) {
      return { label: "URGENT", level: 2, style: "bg-orange-500/20 text-orange-300 border-orange-500/30" };
    }

    return { label: "NORMAL", level: 1, style: "bg-[#251416] text-[#baa47f] border-[#361f22]" };
  };

  // Categorize orders based on Bikaji menu categories
  const categoriesList = useMemo(() => {
    const categories = new Set<string>();
    orders.forEach(o => {
      o.items.forEach(item => {
        const dishName = item.name.toLowerCase();
        if (dishName.includes("samosa") || dishName.includes("kachori") || dishName.includes("bhatura") || dishName.includes("thali") || dishName.includes("chaat") || dishName.includes("tikki")) {
          categories.add("SNACKS & MEALS");
        } else if (dishName.includes("rasgulla") || dishName.includes("rasmalai") || dishName.includes("rajbhog") || dishName.includes("chamcham")) {
          categories.add("BENGALI SWEETS");
        } else if (dishName.includes("katli") || dishName.includes("ladoo") || dishName.includes("burfi") || dishName.includes("halwa") || dishName.includes("peda")) {
          categories.add("SWEETS");
        } else if (dishName.includes("bhujia") || dishName.includes("namkeen") || dishName.includes("papad") || dishName.includes("cookies") || dishName.includes("mathri")) {
          categories.add("PACKED NAMKEENS");
        } else {
          categories.add("SNACKS & MEALS");
        }
      });
    });
    return ["ALL", ...Array.from(categories)];
  }, [orders]);

  // Apply filters and sorting
  const filteredOrders = useMemo(() => {
    const baseFiltered = orders.filter(o => {
      // 1. Search Query (Table No, Order No, Item Name)
      const matchesSearch = 
        o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.table.number.toString() === searchQuery ||
        o.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.items.some(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      // 2. Status Filter
      if (selectedStatus === "READY") {
        // Ready for Pickup ONLY includes orders waiting for waiter pickup
        if (o.status !== "READY" || !!o.waiterName) return false;
      } else if (selectedStatus === "OUT_FOR_DELIVERY") {
        // Picked Up filter includes orders picked up by waiter
        if (o.status !== "OUT_FOR_DELIVERY" && !o.waiterName) return false;
      } else if (selectedStatus !== "ALL" && o.status !== selectedStatus) {
        return false;
      }

      // 3. Priority Filter
      if (selectedPriority !== "ALL") {
        const priority = getOrderPriority(o).label;
        if (selectedPriority === "VIP" && priority !== "VIP ORDER") return false;
        if (selectedPriority === "LARGE" && priority !== "LARGE ORDER") return false;
        if (selectedPriority === "DELAYED" && priority !== "DELAYED") return false;
      }

      // 4. Category Filter
      if (selectedCategory !== "ALL") {
        const hasItemInCategory = o.items.some(item => {
          const dishName = item.name.toLowerCase();
          let itemCat = "SNACKS & MEALS";
          if (dishName.includes("samosa") || dishName.includes("kachori") || dishName.includes("bhatura") || dishName.includes("thali") || dishName.includes("chaat") || dishName.includes("tikki")) {
            itemCat = "SNACKS & MEALS";
          } else if (dishName.includes("rasgulla") || dishName.includes("rasmalai") || dishName.includes("rajbhog") || dishName.includes("chamcham")) {
            itemCat = "BENGALI SWEETS";
          } else if (dishName.includes("katli") || dishName.includes("ladoo") || dishName.includes("burfi") || dishName.includes("halwa") || dishName.includes("peda")) {
            itemCat = "SWEETS";
          } else if (dishName.includes("bhujia") || dishName.includes("namkeen") || dishName.includes("papad") || dishName.includes("cookies") || dishName.includes("mathri")) {
            itemCat = "PACKED NAMKEENS";
          }
          return itemCat === selectedCategory;
        });
        if (!hasItemInCategory) return false;
      }

      // 5. Urgent Counter Filter
      if (urgentFilter !== "ALL") {
        const isPending = o.status === "PENDING" || o.status === "RECEIVED";
        if (!isPending) return false;
        const ageMs = Date.now() - new Date(o.createdAt).getTime();
        if (urgentFilter === "URGENT_ALL" && ageMs < 30_000) return false;
        if (urgentFilter === "WAITING_30S" && (ageMs < 30_000 || ageMs >= 120_000)) return false;
        if (urgentFilter === "CRITICAL_2M" && ageMs < 120_000) return false;
      }

      return true;
    });
    // Use shared priority sorter: urgent pending → normal pending → accepted → cooking → ready → completed; newest first inside each group
    return sortKDSOrders(baseFiltered);
  }, [orders, searchQuery, selectedStatus, selectedPriority, selectedCategory, urgentFilter, tick]);

  // Live Statistics Header counts
  const stats = useMemo(() => {
    const pending = orders.filter(o => o.status === "PENDING" || o.status === "RECEIVED").length;
    const preparing = orders.filter(o => o.status === "PREPARING").length;
    const ready = orders.filter(o => o.status === "READY" && !o.waiterName).length;
    const pickedUp = orders.filter(o => o.status === "OUT_FOR_DELIVERY" || !!o.waiterName).length;
    const delayed = orders.filter(o => {
      if (!o.expectedReadyAt) return false;
      return new Date(o.expectedReadyAt).getTime() < Date.now();
    }).length;
    const waitingOver2m = orders.filter(o => {
      if (o.status !== "READY" || !!o.waiterName || !o.readyAt) return false;
      return (Date.now() - new Date(o.readyAt).getTime()) > 120000;
    }).length;

    return { pending, preparing, ready, pickedUp, delayed, waitingOver2m, total: orders.length };
  }, [orders, tick]);

  if (authLoading) {
    return (
      <div className="bg-[#0b0506] text-white min-h-screen font-sans flex flex-col justify-center items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#baa47f]" />
        <span className="text-xs uppercase font-bold tracking-widest text-zinc-550">Verifying session...</span>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="bg-[#0b0506] text-white min-h-screen font-display flex flex-col justify-center items-center p-6 relative overflow-hidden">
        {/* Glow overlay assets */}
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-maroon-900/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-gold-500/5 blur-[120px] pointer-events-none" />

        <div className="w-full max-w-md bg-[#160c0d] border border-[#2d191b] rounded-xl p-8 shadow-large z-10">
          <div className="flex flex-col items-center text-center gap-2 mb-8">
            <div className="flex justify-center mb-2">
              <Image src="/logo.png" alt="Bikaji Logo" width={160} height={48} className="h-8 md:h-12 w-auto object-contain" />
            </div>
            <p className="text-xs text-zinc-450 uppercase tracking-widest font-semibold font-sans">
              Enter credentials to sign in
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
            {loginError && (
              <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-300 text-xs rounded-lg flex items-start gap-2 animate-pulse">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-555 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="kitchen@bikaji.com"
                  className="w-full bg-[#14080a] border border-[#2d191b] rounded-lg pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-650 focus:outline-none focus:border-gold-500/40 transition"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-555 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#14080a] border border-[#2d191b] rounded-lg pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-650 focus:outline-none focus:border-gold-500/40 transition"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 bg-[#871b30] hover:bg-[#a6223d] text-white text-xs font-bold uppercase tracking-wider border border-[#baa47f]/20 rounded-lg transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 mt-2"
            >
              {loginLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4 text-gold-300" />}
              {loginLoading ? "Authenticating..." : "Secure Sign In"}
            </button>
          </form>

          {/* Quick Select Panel */}
          <div className="mt-8 pt-6 border-t border-[#2d191b]">
            <span className="text-[10px] text-zinc-550 font-bold uppercase tracking-wider block mb-3 text-center">
              Quick Select Logins
            </span>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleQuickLogin("kitchen@bikaji.com")}
                className="w-full py-2 bg-[#1d0f11] hover:bg-[#2c1719] border border-[#2d191b] text-zinc-300 hover:text-white rounded text-xs font-semibold transition cursor-pointer"
              >
                Profiles: Chef Kapoor (kitchen@bikaji.com)
              </button>
              <button
                onClick={() => handleQuickLogin("admin@bikaji.com")}
                className="w-full py-2 bg-[#1d0f11] hover:bg-[#2c1719] border border-[#2d191b] text-zinc-300 hover:text-white rounded text-xs font-semibold transition cursor-pointer"
              >
                Profiles: Admin Manager (admin@bikaji.com)
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0e0708] text-white min-h-screen font-sans flex flex-col antialiased">
      {/* KDS Header */}
      <header className="bg-[#1a0f11] border-b border-[#361f22] sticky top-0 z-30 px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-large">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="Bikaji Logo" width={160} height={48} className="h-8 md:h-12 w-auto object-contain" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-gold-600/20 text-gold-400 border border-gold-600/30 px-2 py-0.5 rounded font-extrabold uppercase tracking-wide">
                KDS Monitor
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs">
              <div className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${socketConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500 animate-pulse"}`} />
                <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
                  {socketConnected ? "Real-time Connected" : "Connection Lost"}
                </span>
              </div>
              <span className="text-zinc-600">|</span>
              <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
                Active Tickets: {stats.total}
              </span>
            </div>
          </div>
        </div>

        {/* Live Counters & Urgent Alerts */}
        <div className="flex flex-wrap items-center gap-2">
          <UrgentOrdersCounter
            orders={orders}
            activeFilter={urgentFilter}
            onFilterChange={setUrgentFilter}
          />
          <div className="px-4 py-2 rounded-lg bg-[#251416] border border-[#361f22] flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-xs text-zinc-300 font-bold">🟠 New Orders:</span>
            <span className="text-sm font-extrabold text-amber-500">{stats.pending}</span>
          </div>
          <div className="px-4 py-2 rounded-lg bg-[#251416] border border-[#361f22] flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span className="text-xs text-zinc-300 font-bold">👨‍🍳 In Kitchen:</span>
            <span className="text-sm font-extrabold text-blue-400">{stats.preparing}</span>
          </div>
          <div className={`px-4 py-2 rounded-lg border flex items-center gap-2 transition ${
            stats.ready > 0
              ? "bg-emerald-950/40 border-emerald-500/60 ring-1 ring-emerald-500/30"
              : "bg-[#251416] border-[#361f22]"
          }`}>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-xs text-zinc-300 font-bold">🟢 Ready for Pickup:</span>
            <span className="text-sm font-extrabold text-emerald-400">{stats.ready}</span>
          </div>
          <div className="px-4 py-2 rounded-lg bg-[#251416] border border-[#361f22] flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
            <span className="text-xs text-zinc-300 font-bold">🚶 Picked Up:</span>
            <span className="text-sm font-extrabold text-blue-400">{stats.pickedUp}</span>
          </div>
          {stats.waitingOver2m > 0 && (
            <div className="px-4 py-2 rounded-lg bg-amber-950/50 border border-amber-500/80 flex items-center gap-2 animate-pulse">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-amber-400 font-bold uppercase">Late Waiter (&gt;2m):</span>
              <span className="text-sm font-extrabold text-amber-400">{stats.waitingOver2m}</span>
            </div>
          )}
          {stats.delayed > 0 && (
            <div className="px-4 py-2 rounded-lg bg-red-950/40 border border-red-500/30 flex items-center gap-2 animate-pulse">
              <Flame className="w-4 h-4 text-red-400" />
              <span className="text-xs text-red-400 font-bold uppercase">Delayed:</span>
              <span className="text-sm font-extrabold text-red-400">{stats.delayed}</span>
            </div>
          )}
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2.5 rounded-lg border transition cursor-pointer flex items-center justify-center ${
              soundEnabled
                ? "bg-[#251416] border-[#361f22] text-[#baa47f] hover:text-white"
                : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300"
            }`}
            title={soundEnabled ? "Mute audio notification chime" : "Unmute audio notification chime"}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
          
          <button
            onClick={() => setShowShortcuts(true)}
            className="p-2.5 rounded-lg bg-[#251416] border border-[#361f22] text-[#baa47f] hover:text-white hover:border-[#baa47f]/40 transition cursor-pointer flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider"
          >
            <Keyboard className="w-4 h-4" /> Keys
          </button>

          <button
            onClick={() => router.push("/kitchen/dashboard")}
            className="px-4 py-2.5 rounded-lg bg-primary text-white text-xs font-bold uppercase tracking-wider border border-gold-500/20 hover:bg-[#871b30] transition cursor-pointer shadow-md flex items-center gap-1.5"
          >
            <Activity className="w-4 h-4" /> Performance Dashboard <ArrowUpRight className="w-4 h-4 text-gold-300" />
          </button>
        </div>
      </header>

      {/* Filter and Search Bar */}
      <section className="bg-[#13090a] px-6 py-3 border-b border-[#361f22] flex flex-col lg:flex-row items-center justify-between gap-4 z-20">
        {/* Search */}
        <div className="relative w-full lg:w-80">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Table, Order #, or Food..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#1c0f11] border border-[#361f22] rounded-lg pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-gold-500/40 transition"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Status filter with live counts */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider shrink-0">Filter:</span>
            <div className="bg-[#1c0f11] border border-[#361f22] rounded-lg p-0.5 flex gap-1 flex-wrap">
              {[
                { id: "ALL", label: `All (${stats.total})` },
                { id: "PENDING", label: `🟠 New Orders (${stats.pending})` },
                { id: "PREPARING", label: `👨‍🍳 Cooking (${stats.preparing})` },
                { id: "READY", label: `🟢 Ready for Pickup (${stats.ready})`, highlight: stats.ready > 0, warning: stats.waitingOver2m > 0 },
                { id: "OUT_FOR_DELIVERY", label: `🚶 Picked Up (${stats.pickedUp})` },
                { id: "HISTORY", label: `📜 History (${historyOrders.length > 0 ? historyOrders.length : "..."})` }
              ].map(item => (
                <button
                  key={item.id}
                  onClick={async () => {
                    if (item.id === "HISTORY") {
                      setActiveViewTab("history");
                      setLoadingHistory(true);
                      const res = await getKDSHistoryOrders("ALL");
                      if (res.success && res.orders) {
                        const mapped = res.orders.map((o: any) => ({
                          ...o,
                          createdAt: o.createdAt.toISOString(),
                          updatedAt: o.updatedAt.toISOString(),
                          acceptedAt: o.acceptedAt ? o.acceptedAt.toISOString() : null,
                          preparingAt: o.preparingAt ? o.preparingAt.toISOString() : null,
                          readyAt: o.readyAt ? o.readyAt.toISOString() : null,
                          servedAt: o.servedAt ? o.servedAt.toISOString() : null,
                          completedAt: o.completedAt ? o.completedAt.toISOString() : null,
                          expectedReadyAt: o.expectedReadyAt ? o.expectedReadyAt.toISOString() : null,
                          items: o.items.map((it: any) => ({ ...it, menuItem: { ...it.menuItem } })),
                        }));
                        setHistoryOrders(mapped);
                      }
                      setLoadingHistory(false);
                    } else {
                      setActiveViewTab("live");
                      setSelectedStatus(item.id);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-md text-[10px] font-bold tracking-wider transition cursor-pointer shrink-0 flex items-center gap-1 ${
                    activeViewTab === "live" && selectedStatus === item.id
                      ? "bg-primary text-white"
                      : activeViewTab === "history" && item.id === "HISTORY"
                      ? "bg-[#baa47f] text-black font-extrabold"
                      : item.warning
                      ? "bg-amber-950/60 text-amber-400 border border-amber-500/80 animate-pulse font-extrabold"
                      : item.highlight
                      ? "bg-emerald-950/40 text-emerald-300 border border-emerald-500/40 font-extrabold"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Priority filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Priority:</span>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="bg-[#1c0f11] border border-[#361f22] text-zinc-300 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-gold-500/40"
            >
              <option value="ALL">All Priorities</option>
              <option value="VIP">VIP Orders</option>
              <option value="LARGE">Large Orders</option>
              <option value="DELAYED">Delayed Orders</option>
            </select>
          </div>

          {/* Category filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-[#1c0f11] border border-[#361f22] text-zinc-300 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-gold-500/40"
            >
              <option value="ALL">All Categories</option>
              {categoriesList.filter(c => c !== "ALL").map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Tab Switcher: 🔥 Active Orders vs 📜 Order History */}
      <div className="px-6 pt-4 flex items-center gap-2 border-b border-[#361f22] bg-[#13090a]">
        <button
          onClick={() => setActiveViewTab("live")}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-t-lg transition cursor-pointer border-b-2 ${
            activeViewTab === "live"
              ? "text-white border-primary bg-[#1c0f11]"
              : "text-zinc-500 border-transparent hover:text-zinc-300"
          }`}
        >
          🔥 Active Orders
        </button>
        <button
          onClick={() => {
            setActiveViewTab("history");
            loadHistoryData("ALL", "24H");
          }}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-t-lg transition cursor-pointer border-b-2 ${
            activeViewTab === "history"
              ? "text-white border-[#baa47f] bg-[#1c0f11]"
              : "text-zinc-500 border-transparent hover:text-zinc-300"
          }`}
        >
          📜 Order History
        </button>
      </div>

      {/* Tickets Main Area */}
      <main className="flex-1 p-6 overflow-y-auto">
        {/* ORDER HISTORY VIEW */}
        {activeViewTab === "history" && (
          <div className="flex flex-col gap-4">
            {/* Search & Filters Header */}
            <div className="bg-[#13090a] p-4 rounded-xl border border-[#361f22] flex flex-col gap-3">
              {/* Row 1: Search Input */}
              <div className="relative w-full">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by Ticket #, Table #, Waiter, or Guest Name..."
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  className="w-full bg-[#1c0f11] border border-[#361f22] rounded-lg pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-gold-500/40 transition"
                />
              </div>

              {/* Row 2: Time Range & Status Filters */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Time Filters */}
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider shrink-0">Time:</span>
                  <div className="bg-[#1c0f11] border border-[#361f22] rounded-lg p-0.5 flex gap-1">
                    {[
                      { id: "24H", label: "Last 24 Hours (Default)" },
                      { id: "TODAY", label: "Today" },
                      { id: "YESTERDAY", label: "Yesterday" },
                      { id: "THIS_WEEK", label: "This Week" },
                      { id: "CUSTOM", label: "Custom Date" },
                    ].map((tf) => (
                      <button
                        key={tf.id}
                        onClick={() => {
                          setHistoryTimeFilter(tf.id);
                          loadHistoryData(historyStatusFilter, tf.id);
                        }}
                        className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition cursor-pointer shrink-0 ${
                          historyTimeFilter === tf.id
                            ? "bg-[#baa47f] text-black font-extrabold"
                            : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        {tf.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status Filters */}
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider shrink-0">Status:</span>
                  <div className="bg-[#1c0f11] border border-[#361f22] rounded-lg p-0.5 flex gap-1">
                    {[
                      { id: "ALL", label: "All" },
                      { id: "DELIVERED", label: "Delivered" },
                      { id: "CANCELLED", label: "Cancelled" },
                      { id: "REFUNDED", label: "Refunded" },
                    ].map((sf) => (
                      <button
                        key={sf.id}
                        onClick={() => {
                          setHistoryStatusFilter(sf.id);
                          loadHistoryData(sf.id, historyTimeFilter);
                        }}
                        className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition cursor-pointer shrink-0 ${
                          historyStatusFilter === sf.id
                            ? "bg-primary text-white"
                            : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        {sf.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Custom Date Inputs if CUSTOM selected */}
              {historyTimeFilter === "CUSTOM" && (
                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#201011]">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-400 font-bold uppercase">From:</span>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="bg-[#1c0f11] border border-[#361f22] text-xs text-white rounded px-2 py-1"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-400 font-bold uppercase">To:</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="bg-[#1c0f11] border border-[#361f22] text-xs text-white rounded px-2 py-1"
                    />
                  </div>
                  <button
                    onClick={() => loadHistoryData(historyStatusFilter, "CUSTOM", customStartDate, customEndDate)}
                    className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-extrabold uppercase tracking-wider cursor-pointer"
                  >
                    Apply Filter
                  </button>
                </div>
              )}
            </div>

            {loadingHistory ? (
              <div className="h-64 flex items-center justify-center gap-3 text-zinc-400">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-xs uppercase font-bold tracking-widest">Loading History...</span>
              </div>
            ) : filteredHistoryOrders.length === 0 ? (
              <div className="h-64 flex flex-col justify-center items-center text-zinc-500 border border-dashed border-[#361f22] rounded-2xl">
                <FileText className="w-10 h-10 text-zinc-700 mb-2" />
                <p className="text-xs font-bold uppercase">No orders found for this history filter</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#361f22]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#14080a] border-b border-[#361f22]">
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-500">Ticket & Table</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-500">Items Breakdown</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-500">Total</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-500">Status</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-500">Kitchen Ready</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-500">Waiter & Pickup</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-500">Delivered & Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistoryOrders.map((o, idx) => {
                      const statusColors: Record<string, string> = {
                        PENDING: "text-amber-400 bg-amber-500/10",
                        RECEIVED: "text-blue-400 bg-blue-500/10",
                        ACCEPTED: "text-blue-300 bg-blue-600/10",
                        PREPARING: "text-orange-300 bg-orange-500/10",
                        READY: "text-emerald-400 bg-emerald-500/10",
                        SERVED: "text-emerald-300 bg-emerald-400/10",
                        COMPLETED: "text-[#baa47f] bg-[#baa47f]/10",
                        CANCELLED: "text-red-400 bg-red-500/10",
                        REFUNDED: "text-purple-400 bg-purple-500/10",
                      };
                      const statusCol = statusColors[o.status] || "text-zinc-400 bg-zinc-800";
                      const totalAmt = (o as any).finalAmount || (o as any).totalAmount || 0;
                      const deliveryDur = (o as any).deliveryDuration;
                      const durStr = deliveryDur !== null && deliveryDur !== undefined
                        ? `${Math.floor(deliveryDur / 60)}m ${deliveryDur % 60}s`
                        : null;

                      return (
                        <tr key={o.id} className={`border-b border-[#1c0f11] hover:bg-[#1a0c0e] transition ${idx % 2 === 0 ? "bg-[#160b0c]" : "bg-[#130909]"}`}>
                          <td className="px-4 py-3">
                            <span className="font-extrabold text-white text-sm block">#{o.orderNumber}</span>
                            <span className="text-[#baa47f] font-bold text-xs">Table {o.table?.number}</span>
                            {o.customerName && <span className="text-[10px] text-zinc-400 block truncate">Guest: {o.customerName}</span>}
                          </td>
                          <td className="px-4 py-3 text-zinc-300">
                            <div className="flex flex-col gap-0.5">
                              {o.items.slice(0, 3).map(item => (
                                <span key={item.id} className="truncate max-w-[160px]">{item.quantity}x {item.name}</span>
                              ))}
                              {o.items.length > 3 && <span className="text-zinc-500">+{o.items.length - 3} more items</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-white font-bold font-mono">₹{totalAmt.toFixed(0)}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2.5 py-1 rounded-full text-[9px] font-extrabold uppercase ${statusCol}`}>
                              {o.status === "SERVED" || o.status === "COMPLETED" ? "DELIVERED" : o.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-zinc-400">
                            {o.readyAt ? (
                              <span className="text-emerald-400 font-medium">
                                {new Date(o.readyAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            ) : (
                              <span className="text-zinc-600">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {o.waiterName ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="text-blue-400 font-bold">🚶 {o.waiterName}</span>
                                {o.waiterAcceptedAt && (
                                  <span className="text-[10px] text-zinc-400">
                                    Picked: {new Date(o.waiterAcceptedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-zinc-600">N/A</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-0.5 text-xs">
                              {o.deliveredAt ? (
                                <span className="text-emerald-400 font-extrabold">
                                  Delivered: {new Date(o.deliveredAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              ) : o.completedAt ? (
                                <span className="text-[#baa47f] font-bold">
                                  Completed: {new Date(o.completedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              ) : (
                                <span className="text-zinc-600">-</span>
                              )}
                              {durStr && (
                                <span className="text-[10px] text-amber-400 font-mono font-bold">
                                  Duration: {durStr}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* LIVE QUEUE VIEW */}
        {activeViewTab === "live" && (
        <>
        {loading ? (
          <div className="h-96 flex flex-col justify-center items-center gap-3 text-zinc-400">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs uppercase font-bold tracking-widest">Loading Live KDS Queue...</span>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="h-96 flex flex-col justify-center items-center text-center text-zinc-500 border border-dashed border-[#361f22] rounded-2xl p-6">
            <ChefHat className="w-12 h-12 text-zinc-650 mb-3" />
            <h3 className="text-lg font-bold text-zinc-400 mb-1">No Active Orders</h3>
            <p className="text-xs max-w-xs leading-normal">
              Any new customer order will appear instantly in the queue. Have a sip of tea!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredOrders.map(order => {
                const priority = getOrderPriority(order);
                const sla = getOrderSlaDetails(order);
                const isPending = order.status === "PENDING" || order.status === "RECEIVED";
                const isAccepted = order.status === "ACCEPTED";
                const isPreparing = order.status === "PREPARING";
                const isReady = order.status === "READY";
                const isNew = newOrderIds.has(order.id);
                const isUpdated = updatedOrderIds.has(order.id);
                const aging = getOrderAgingInfo(order.status, order.createdAt, Date.now());

                // Build border + glow classes
                let cardBorderClass = "border-[#361f22] hover:border-[#baa47f]/25";
                let cardGlowClass = "";
                if (isNew) {
                  cardBorderClass = "border-amber-500/80";
                  cardGlowClass = "shadow-[0_0_24px_rgba(245,158,11,0.35),0_0_0_1px_rgba(245,158,11,0.15)]";
                } else if (isUpdated) {
                  cardBorderClass = "border-blue-500/60";
                  cardGlowClass = "shadow-[0_0_16px_rgba(59,130,246,0.25)]";
                } else if (sla.isLate) {
                  cardBorderClass = "border-red-600/40";
                  cardGlowClass = "shadow-red-950/20";
                } else if (sla.isUrgent) {
                  cardBorderClass = "border-orange-500/40";
                } else if (aging.level > 0) {
                  cardBorderClass = getAgingBorderClass(aging.level);
                  cardGlowClass = getAgingGlowClass(aging.level);
                }

                return (
                  <motion.div
                    key={order.id}
                    layoutId={order.id}
                    initial={{ opacity: 0, scale: 0.97, y: -12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -15 }}
                    transition={{ type: "spring", stiffness: 380, damping: 30, mass: 0.8 }}
                    className={`bg-[#1c0f11] rounded-xl border-2 flex flex-col overflow-hidden shadow-medium relative group transition-shadow duration-700 ${cardBorderClass} ${cardGlowClass}`}
                  >
                    {/* SLA Progress Bar at top */}
                    {order.expectedReadyAt && !isReady && (
                      <div className="w-full h-1 bg-[#160b0c] relative">
                        <div
                          className={`h-full transition-all duration-1000 ${
                            sla.isLate ? "bg-red-500" : sla.isUrgent ? "bg-orange-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${sla.progress}%` }}
                        />
                      </div>
                    )}

                    {/* NEW ORDER badge — top-right corner, auto-fades after 10s */}
                    <AnimatePresence>
                      {isNew && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.7, y: -4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.3 }}
                          className="absolute top-2.5 right-2.5 z-10 bg-emerald-500 text-white text-[8px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full shadow-lg"
                        >
                          🟢 NEW ORDER
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* AGING badge — visible only when level>0 AND not new AND pending */}
                    <AnimatePresence>
                      {!isNew && aging.isActive && (
                        <motion.div
                          key={`aging-${aging.level}`}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0 }}
                          className={`absolute top-2.5 right-2.5 z-10 text-[8px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getAgingBadgeClass(aging.level)}`}
                        >
                          {aging.labelEmoji} {aging.label}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Card Header */}
                    <div className="p-4 bg-[#14080a] border-b border-[#361f22] flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-extrabold text-white font-display">
                            TICKET {order.orderNumber}
                          </span>
                          <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full border ${priority.style}`}>
                            {priority.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mt-1">
                          <span className="text-gold-400 font-extrabold">Table {order.table.number}</span>
                          <span>•</span>
                          <span className="truncate max-w-[100px]" title={order.customerName || "Guest"}>
                            {order.customerName || "Guest"}
                          </span>
                        </div>
                        {/* Aging delayed display */}
                        {aging.level >= 3 && (
                          <div className="mt-1 text-[9px] font-bold text-red-400">
                            Delayed by: {aging.ageString}
                          </div>
                        )}
                      </div>

                      {/* Timers */}
                      <div className="text-right flex flex-col items-end">
                        <div className="flex items-center gap-1 text-xs font-bold text-zinc-400">
                          <Clock className="w-3.5 h-3.5 text-gold-500 shrink-0" />
                          <span>{sla.elapsedStr}</span>
                        </div>
                        {order.expectedReadyAt && (
                          <span
                            className={`text-[10px] font-extrabold uppercase mt-1 px-2 py-0.5 rounded ${
                              sla.isLate
                                ? "bg-red-600/30 text-red-300 animate-pulse border border-red-500/20"
                                : sla.isUrgent
                                ? "bg-orange-600/20 text-orange-300 border border-orange-500/20"
                                : "bg-emerald-500/10 text-emerald-400"
                            }`}
                          >
                            {sla.countdownStr}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Order Details Body */}
                    <div className="flex-1 p-4 flex flex-col gap-3.5 max-h-[350px] overflow-y-auto">
                      <div className="flex flex-col gap-2">
                        {order.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex justify-between items-start gap-4 pb-2 border-b border-[#251416] last:border-0"
                          >
                            <div className="flex items-start gap-2">
                              {/* Veg/Non-Veg icon */}
                              <span
                                className={`w-3.5 h-3.5 border flex items-center justify-center p-0.5 rounded-sm mt-0.5 shrink-0 ${
                                  item.menuItem.isVeg ? "border-emerald-600" : "border-rose-600"
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    item.menuItem.isVeg ? "bg-emerald-600" : "bg-rose-600"
                                  }`}
                                />
                              </span>
                              <div>
                                <h4 className="text-xs font-bold text-zinc-200 leading-tight">
                                  {item.name}
                                </h4>
                                
                                {/* Item Level Customizations */}
                                {((item.modifiers && item.modifiers.length > 0) ||
                                  (item.addons && item.addons.length > 0)) && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {item.modifiers.map((m) => (
                                      <span key={m.id} className="text-[8px] bg-[#221214] border border-[#3e2225] px-1 rounded text-zinc-400">
                                        {m.name}
                                      </span>
                                    ))}
                                    {item.addons.map((a) => (
                                      <span key={a.id} className="text-[8px] bg-[#221214] border border-[#3e2225] px-1 rounded text-gold-400">
                                        + {a.name}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {/* Item Notes */}
                                {item.specialNotes && (
                                  <p className="text-[9px] text-accent italic mt-1 font-medium bg-red-950/20 px-2 py-0.5 rounded border border-[#361f22] w-fit">
                                    "{item.specialNotes}"
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Quantity & Cancel Option */}
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="w-6 h-6 rounded-full bg-gold-600/10 border border-gold-600/30 text-gold-400 text-xs font-extrabold flex items-center justify-center">
                                {item.quantity}
                              </span>

                              {/* Chef option to cancel individual item if out of stock */}
                              {!isReady && (
                                <button
                                  onClick={() => setCancellingItem({ itemId: item.id, itemName: item.name, orderId: order.id })}
                                  className="w-5 h-5 rounded hover:bg-red-500/10 border border-transparent hover:border-red-500/30 text-zinc-500 hover:text-red-400 flex items-center justify-center transition cursor-pointer"
                                  title="Cancel individual item"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Overall Order Instructions */}
                      {order.specialNotes && (
                        <div className="p-2.5 bg-black/30 border border-[#361f22] rounded-lg">
                          <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest block mb-0.5">
                            Customer Instructions
                          </span>
                          <p className="text-[10px] text-zinc-300 italic font-medium">
                            "{order.specialNotes}"
                          </p>
                        </div>
                      )}

                      {/* Kitchen Note Display */}
                      {order.kitchenNotes && (
                        <div className="p-2.5 bg-gold-950/10 border border-gold-600/20 rounded-lg flex items-start gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-gold-400 shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <span className="text-[8px] font-bold text-gold-400 uppercase tracking-widest block">
                              Chef Note
                            </span>
                            <p className="text-[10px] text-gold-200">
                              {order.kitchenNotes}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Delay Banner on ticket */}
                      {order.delayMinutes && order.delayMinutes > 0 && (
                        <div className="p-2.5 bg-orange-950/20 border border-orange-500/30 rounded-lg flex items-start gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <span className="text-[8px] font-bold text-orange-400 uppercase tracking-widest block">Delayed +{order.delayMinutes}m</span>
                            <p className="text-[10px] text-orange-300">{order.delayReason}</p>
                          </div>
                        </div>
                      )}

                      {/* Customer Reply - highlighted prominently */}
                      {order.customerReply && (
                        <div className="p-2.5 bg-purple-950/20 border border-purple-500/40 rounded-lg flex items-start gap-1.5 animate-pulse-subtle">
                          <CornerDownRight className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <span className="text-[8px] font-bold text-purple-400 uppercase tracking-widest block">💬 Customer Reply</span>
                            <p className="text-[10px] text-purple-200 font-medium">"{order.customerReply}"</p>
                          </div>
                        </div>
                      )}

                      {/* Ready for Pickup / Picked Up By Waiter Display */}
                      {order.waiterName ? (
                        <div className="p-2.5 bg-blue-950/30 border border-blue-500/40 rounded-lg flex items-start gap-2">
                          <User className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <span className="text-[9px] font-extrabold text-blue-400 uppercase tracking-widest block">
                              🚶 Picked Up By: {order.waiterName}
                            </span>
                            <p className="text-[11px] text-blue-300 font-semibold">
                              Pickup Time: {order.waiterAcceptedAt ? new Date(order.waiterAcceptedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                              {order.deliveredAt && ` · Delivered: ${new Date(order.deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                            </p>
                          </div>
                        </div>
                      ) : isReady ? (() => {
                        const readyTimeMs = order.readyAt ? new Date(order.readyAt).getTime() : Date.now();
                        const elapsedMs = Math.max(0, Date.now() - readyTimeMs);
                        const isLateWaiter = elapsedMs > 120000;
                        const elapsedMins = Math.floor(elapsedMs / 60000);
                        const elapsedSecs = Math.floor((elapsedMs % 60000) / 1000);
                        const elapsedStr = `${elapsedMins}m ${elapsedSecs}s`;

                        return (
                          <div className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 transition ${
                            isLateWaiter
                              ? "bg-amber-950/60 border-amber-500 animate-pulse ring-1 ring-amber-500/60 shadow-lg"
                              : "bg-emerald-950/30 border-emerald-500/40"
                          }`}>
                            <div className="flex items-center gap-2">
                              <CheckCircle className={`w-4 h-4 shrink-0 ${isLateWaiter ? "text-amber-400 animate-bounce" : "text-emerald-400"}`} />
                              <div>
                                <span className={`text-[9px] font-extrabold uppercase tracking-widest block ${isLateWaiter ? "text-amber-400" : "text-emerald-400"}`}>
                                  {isLateWaiter ? "⚠ WAITER OVERDUE (>2m)" : "🟢 Ready for Pickup"}
                                </span>
                                <span className="text-[10px] text-emerald-300 font-medium block">
                                  Ready Since: {order.readyAt ? new Date(order.readyAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                                </span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-[8px] text-amber-400 font-extrabold uppercase block">Waiting For Waiter</span>
                              <span className="text-xs font-mono font-extrabold text-amber-400">{elapsedStr}</span>
                            </div>
                          </div>
                        );
                      })() : null}
                    </div>

                    {/* Action Bar Footer — ONLY for active stages: PENDING, ACCEPTED, PREPARING */}
                    {(isPending || isAccepted || isPreparing) && (
                      <div className="p-4 bg-[#14080a] border-t border-[#361f22] flex flex-wrap gap-2 justify-between items-center">
                        {/* Left side utilities */}
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => {
                              setKitchenNoteText(order.kitchenNotes || "");
                              setNoteOrder(order);
                            }}
                            className="px-2.5 py-1.5 rounded-lg border border-[#361f22] text-[#baa47f] hover:text-white hover:border-[#baa47f]/40 text-[10px] font-bold uppercase tracking-wider transition cursor-pointer"
                          >
                            Note
                          </button>
                          
                          {/* Delay Button - only for accepted or preparing */}
                          {(isAccepted || isPreparing) && (
                            <button
                              onClick={() => {
                                setDelayModalOrder(order);
                                setDelayMinutesInput(10);
                                setDelayReasonInput("High kitchen load");
                                setDelayNoteInput("");
                              }}
                              className="px-2.5 py-1.5 rounded-lg border border-orange-500/30 text-orange-400 hover:text-white hover:bg-orange-500/10 hover:border-orange-500/50 text-[10px] font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-1"
                            >
                              Delay
                            </button>
                          )}

                          {/* Reject/Cancel Order */}
                          {isPending && (
                            <button
                              onClick={() => handleRejectOrder(order.id)}
                              className="px-2.5 py-1.5 rounded-lg border border-red-500/20 hover:border-red-500/40 text-red-400 hover:bg-red-500/10 text-[10px] font-bold uppercase tracking-wider transition cursor-pointer"
                            >
                              Reject
                            </button>
                          )}
                        </div>

                        {/* Right side main state transition */}
                        <div>
                          {isPending && (
                            <button
                              onClick={() => {
                                const maxPrep = order.items.reduce((max, i) => Math.max(max, i.menuItem.preparationTime), 15);
                                setCustomSlaMinutes(maxPrep);
                                setAcceptingOrder(order);
                              }}
                              className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-extrabold uppercase tracking-wider transition shadow-md cursor-pointer flex items-center gap-1"
                            >
                              Accept Order <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {isAccepted && (
                            <button
                              onClick={() => handleStartPreparing(order.id)}
                              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-extrabold uppercase tracking-wider transition shadow-md cursor-pointer flex items-center gap-1"
                            >
                              Start Cooking <Flame className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {isPreparing && (
                            <button
                              onClick={() => handleMarkReady(order.id)}
                              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-extrabold uppercase tracking-wider transition shadow-md cursor-pointer flex items-center gap-1"
                            >
                              Ready For Pickup <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
        </>
        )}
      </main>

      {/* Modal: ACCEPT ORDER & Set custom SLA */}
      <AnimatePresence>
        {acceptingOrder && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1c0f11] border border-[#361f22] rounded-xl p-6 w-full max-w-sm shadow-modal flex flex-col gap-4"
            >
              <div className="flex justify-between items-center pb-2 border-b border-[#361f22]">
                <h3 className="font-display font-extrabold text-sm uppercase tracking-wider text-white">
                  Accept Ticket {acceptingOrder.orderNumber}
                </h3>
                <button
                  onClick={() => setAcceptingOrder(null)}
                  className="w-6 h-6 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                  Estimate Preparation SLA (Minutes):
                </span>
                <div className="flex items-center justify-between gap-3 bg-[#14080a] p-3 rounded-lg border border-[#361f22]">
                  <button
                    onClick={() => setCustomSlaMinutes(m => Math.max(5, m - 5))}
                    className="w-10 h-10 rounded bg-[#251416] text-[#baa47f] hover:text-white hover:bg-primary transition cursor-pointer font-extrabold text-base flex items-center justify-center"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-xl font-display font-extrabold text-white">
                    {customSlaMinutes} min
                  </span>
                  <button
                    onClick={() => setCustomSlaMinutes(m => Math.min(60, m + 5))}
                    className="w-10 h-10 rounded bg-[#251416] text-[#baa47f] hover:text-white hover:bg-primary transition cursor-pointer font-extrabold text-base flex items-center justify-center"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex gap-2.5 mt-2">
                <button
                  onClick={() => setAcceptingOrder(null)}
                  className="flex-1 py-2.5 rounded-lg border border-[#361f22] text-[#baa47f] hover:text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAcceptSubmit}
                  className="flex-1 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold uppercase tracking-wider cursor-pointer shadow-md"
                >
                  Accept Ticket
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: ADD KITCHEN NOTE */}
      <AnimatePresence>
        {noteOrder && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1c0f11] border border-[#361f22] rounded-xl p-6 w-full max-w-sm shadow-modal flex flex-col gap-4"
            >
              <div className="flex justify-between items-center pb-2 border-b border-[#361f22]">
                <h3 className="font-display font-extrabold text-sm uppercase tracking-wider text-white">
                  Kitchen Notes: Ticket {noteOrder.orderNumber}
                </h3>
                <button
                  onClick={() => setNoteOrder(null)}
                  className="w-6 h-6 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                  Instruction to Chefs / Waiters:
                </span>
                <textarea
                  value={kitchenNoteText}
                  onChange={(e) => setKitchenNoteText(e.target.value)}
                  placeholder="e.g. Extra spicy, serve appetizers first, or tandoor heating delay..."
                  rows={3}
                  className="w-full bg-[#14080a] border border-[#361f22] rounded-lg p-3 text-xs text-white placeholder-zinc-650 focus:outline-none focus:border-gold-500/40"
                />
              </div>

              <div className="flex gap-2.5 mt-2">
                <button
                  onClick={() => setNoteOrder(null)}
                  className="flex-1 py-2.5 rounded-lg border border-[#361f22] text-[#baa47f] hover:text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveKitchenNote}
                  className="flex-1 py-2.5 rounded-lg bg-primary hover:bg-[#871b30] text-white text-xs font-bold uppercase tracking-wider cursor-pointer shadow-md border border-gold-500/20"
                >
                  Save Note
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: CANCEL ITEM VERIFICATION */}
      <AnimatePresence>
        {cancellingItem && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1c0f11] border border-red-500/30 rounded-xl p-6 w-full max-w-sm shadow-modal flex flex-col gap-4"
            >
              <div className="flex justify-between items-center pb-2 border-b border-[#361f22]">
                <h3 className="font-display font-extrabold text-sm uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-red-500" /> Cancel Item
                </h3>
                <button
                  onClick={() => setCancellingItem(null)}
                  className="w-6 h-6 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-zinc-300 leading-normal">
                You are about to cancel <strong className="text-white">{cancellingItem.itemName}</strong> on this ticket.
                This will recalculate the order subtotal and taxes.
              </p>

              <div className="flex gap-2.5 mt-2">
                <button
                  onClick={() => setCancellingItem(null)}
                  className="flex-1 py-2.5 rounded-lg border border-[#361f22] text-[#baa47f] hover:text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  Back
                </button>
                <button
                  onClick={handleCancelItemSubmit}
                  className="flex-1 py-2.5 rounded-lg bg-red-650 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-wider cursor-pointer shadow-md"
                >
                  Confirm Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: KEYBOARD SHORTCUTS */}
      <AnimatePresence>
        {showShortcuts && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1c0f11] border border-[#361f22] rounded-xl p-6 w-full max-w-md shadow-modal flex flex-col gap-4"
            >
              <div className="flex justify-between items-center pb-2 border-b border-[#361f22]">
                <h3 className="font-display font-extrabold text-sm uppercase tracking-wider text-gold-400 flex items-center gap-2">
                  <Keyboard className="w-5 h-5 text-gold-500" /> KDS Hotkeys
                </h3>
                <button
                  onClick={() => setShowShortcuts(false)}
                  className="w-6 h-6 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col gap-3">
                <p className="text-xs text-zinc-400 leading-normal">
                  Chefs and staff can manage the ticket board instantly using physical keyboards or bump-bars:
                </p>
                <div className="flex flex-col gap-2 bg-[#14080a] p-3 rounded-lg border border-[#361f22]">
                  <div className="flex justify-between items-center text-xs py-1.5 border-b border-[#251416]">
                    <span className="text-zinc-400">Accept First Pending Order</span>
                    <kbd className="px-2 py-1 bg-[#251416] border border-[#baa47f]/20 rounded text-gold-400 font-extrabold font-mono shadow-sm">A</kbd>
                  </div>
                  <div className="flex justify-between items-center text-xs py-1.5 border-b border-[#251416]">
                    <span className="text-zinc-400">Start Cooking First Accepted Order</span>
                    <kbd className="px-2 py-1 bg-[#251416] border border-[#baa47f]/20 rounded text-gold-400 font-extrabold font-mono shadow-sm">S</kbd>
                  </div>
                  <div className="flex justify-between items-center text-xs py-1.5 border-b border-[#251416]">
                    <span className="text-zinc-400">Mark First Cooking Order Ready</span>
                    <kbd className="px-2 py-1 bg-[#251416] border border-[#baa47f]/20 rounded text-gold-400 font-extrabold font-mono shadow-sm">R</kbd>
                  </div>
                  <div className="flex justify-between items-center text-xs py-1.5 border-b border-[#251416]">
                    <span className="text-zinc-400">Navigate to Performance Dashboard</span>
                    <kbd className="px-2 py-1 bg-[#251416] border border-[#baa47f]/20 rounded text-gold-400 font-extrabold font-mono shadow-sm">G</kbd>
                  </div>
                  <div className="flex justify-between items-center text-xs py-1.5">
                    <span className="text-zinc-400">Close Modals / Help</span>
                    <kbd className="px-2 py-1 bg-[#251416] border border-[#baa47f]/20 rounded text-gold-400 font-extrabold font-mono shadow-sm">ESC</kbd>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowShortcuts(false)}
                className="w-full py-2.5 rounded-lg bg-primary hover:bg-[#871b30] text-white text-xs font-bold uppercase tracking-wider cursor-pointer shadow-md mt-2"
              >
                Close list
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: DELAY ORDER */}
      <AnimatePresence>
        {delayModalOrder && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1c0f11] border border-orange-500/30 rounded-xl p-6 w-full max-w-sm shadow-modal flex flex-col gap-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Delay Order</h3>
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    Ticket #{delayModalOrder.orderNumber} · Table {delayModalOrder.table.number}
                  </p>
                </div>
                <button
                  onClick={() => setDelayModalOrder(null)}
                  className="w-6 h-6 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider block mb-1.5">Delay Time</label>
                  <div className="flex gap-2">
                    {[5, 10, 15, 20].map(min => (
                      <button
                        key={min}
                        onClick={() => setDelayMinutesInput(min)}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition cursor-pointer ${
                          delayMinutesInput === min
                            ? "bg-orange-600 border-orange-500 text-white"
                            : "bg-[#14080a] border-[#361f22] text-zinc-400 hover:border-orange-500/40 hover:text-orange-300"
                        }`}
                      >
                        +{min}m
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={delayMinutesInput}
                    onChange={(e) => setDelayMinutesInput(Number(e.target.value))}
                    className="w-full mt-2 bg-[#14080a] border border-[#361f22] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500/40 text-center"
                    placeholder="Custom minutes..."
                  />
                </div>

                <div>
                  <label className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider block mb-1.5">Reason (sent to customer)</label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {["High kitchen load", "Out of stock", "Equipment issue", "Rush order"].map(reason => (
                      <button
                        key={reason}
                        onClick={() => setDelayReasonInput(reason)}
                        className={`px-2 py-1 rounded text-[9px] font-bold uppercase border transition cursor-pointer ${
                          delayReasonInput === reason
                            ? "bg-orange-600/20 border-orange-500/50 text-orange-300"
                            : "bg-[#14080a] border-[#361f22] text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={delayReasonInput}
                    onChange={(e) => setDelayReasonInput(e.target.value)}
                    className="w-full bg-[#14080a] border border-[#361f22] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500/40"
                    placeholder="Or type custom reason..."
                  />
                </div>

                <div>
                  <label className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider block mb-1.5">Kitchen Note (optional)</label>
                  <textarea
                    value={delayNoteInput}
                    onChange={(e) => setDelayNoteInput(e.target.value)}
                    rows={2}
                    className="w-full bg-[#14080a] border border-[#361f22] rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#baa47f]/30 resize-none"
                    placeholder="e.g. Preparing fresh naan..."
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setDelayModalOrder(null)}
                  className="flex-1 py-2.5 rounded-lg border border-[#361f22] text-zinc-400 hover:text-white text-xs font-bold uppercase tracking-wider cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!delayModalOrder) return;
                    await handleDelay(delayModalOrder.id, delayMinutesInput, delayReasonInput, delayNoteInput);
                    setDelayModalOrder(null);
                  }}
                  className="flex-1 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold uppercase tracking-wider cursor-pointer transition shadow-md"
                >
                  Send Delay +{delayMinutesInput}m
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
