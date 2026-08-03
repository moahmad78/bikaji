"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  BellRing,
  Coffee,
  Clock,
  Search,
  CheckCircle,
  HelpCircle,
  AlertTriangle,
  User,
  LogOut,
  SlidersHorizontal,
  ChevronRight,
  Loader2,
  Lock,
  Mail,
  Shield,
  MapPin,
  Utensils,
  CreditCard,
  Droplet,
  FileText,
  Volume2,
  VolumeX,
  Plus
} from "lucide-react";
import Image from "next/image";
import { getWaiterDashboardData, resolveServiceRequest, serveOrder, acceptDelivery, deliverOrder, getOrCreateWaiterProfile } from "@/actions/waiter";
import { authClient } from "@/lib/auth-client";

// Local Interfaces
interface TableSession {
  id: string;
  customerName: string;
  phone: string | null;
  createdAt: string;
}

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  finalAmount: number;
  customerName?: string | null;
  kitchenNotes?: string | null;
  delayReason?: string | null;
  customerReply?: string | null;
  createdAt: string;
  acceptedAt?: string | null;
  preparingAt?: string | null;
  readyAt?: string | null;
  waiterAcceptedAt?: string | null;
  deliveredAt?: string | null;
  completedAt?: string | null;
  deliveryDuration?: number | null;
  waiterId?: string | null;
  waiterName?: string | null;
  tableId: string;
  table: {
    number: number;
    id: string;
  };
  items: OrderItem[];
}

interface ServiceRequest {
  id: string;
  tableId: string;
  type: string;
  notes: string | null;
  status: string;
  createdAt: string;
  table: {
    number: number;
  };
}

interface RestaurantTable {
  id: string;
  number: number;
  capacity: number;
  status: string;
  sessions: TableSession[];
  orders: Order[];
  serviceRequests: ServiceRequest[];
}

export default function WaiterDashboard() {
  const router = useRouter();

  // Authentication State
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState<boolean>(false);

  // Operational State
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [pendingRequests, setPendingRequests] = useState<ServiceRequest[]>([]);
  const [readyOrders, setReadyOrders] = useState<Order[]>([]);
  const [myDeliveries, setMyDeliveries] = useState<Order[]>([]);
  const [deliveryHistory, setDeliveryHistory] = useState<Order[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<any>({
    ordersDeliveredToday: 0,
    tablesServedToday: 0,
    avgDeliveryTimeSeconds: 0,
    fastestDeliverySeconds: 0,
    longestDeliverySeconds: 0,
    repeatVisitsToSameTable: 0
  });
  const [waiterProfile, setWaiterProfile] = useState<any>(null);
  
  // Controls
  const [activeTab, setActiveTab] = useState<"alerts" | "my-deliveries" | "history" | "requests" | "tables" | "account">("alerts");
  const [historyDateFilter, setHistoryDateFilter] = useState<"ALL" | "TODAY" | "YESTERDAY" | "THIS_WEEK">("TODAY");
  const [historySearchQuery, setHistorySearchQuery] = useState<string>("");
  const [selectedHistoryOrder, setSelectedHistoryOrder] = useState<Order | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [floorFilter, setFloorFilter] = useState<string>("ALL");
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  const [isAvailable, setIsAvailable] = useState<boolean>(true);

  // Time Ticker
  const [tick, setTick] = useState<number>(0);

  const socketRef = useRef<Socket | null>(null);

  // Synthesized sound alert for mobile notification
  const playAlertSound = (type: "new-request" | "order-ready") => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === "new-request") {
        // High double-tone notification
        osc.type = "sine";
        osc.frequency.setValueAtTime(880.00, ctx.currentTime); // A5
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        osc.start();
        osc.frequency.setValueAtTime(1318.51, ctx.currentTime + 0.12); // E6
        gain.gain.setValueAtTime(0.06, ctx.currentTime + 0.12);
        osc.stop(ctx.currentTime + 0.35);
      } else {
        // Playful double chime for ready order
        osc.type = "triangle";
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start();
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
        osc.stop(ctx.currentTime + 0.45);
      }
    } catch (err) {
      console.warn("Audio Context blocked or not supported:", err);
    }
  };

  // 1. Session verification on mount
  useEffect(() => {
    async function checkSession() {
      try {
        const { data: currentSession } = await authClient.getSession();
        if (currentSession?.user) {
          const user = currentSession.user as any;
          if (user.role === "WAITER" || user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
            setSession(currentSession);
            const profileRes = await getOrCreateWaiterProfile(user.id);
            if (profileRes.success && profileRes.waiter) {
              setWaiterProfile(profileRes.waiter);
              setIsAvailable(profileRes.waiter.isAvailable);
            }
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

  // 2. Fetch Waiter Console metrics once authenticated
  const loadDashboard = async () => {
    if (!session?.user) return;
    try {
      const res = await getWaiterDashboardData(undefined, session.user.id);
      if (res.success && res.tables) {
        setTables(res.tables as any);
        setPendingRequests(res.pendingRequests as any);
        setReadyOrders(res.readyOrders as any);
        if ((res as any).activeDeliveries) {
          setMyDeliveries((res as any).activeDeliveries as any);
        }
        if ((res as any).deliveryHistory) {
          setDeliveryHistory((res as any).deliveryHistory as any);
        }
        if ((res as any).performance) {
          setPerformanceMetrics((res as any).performance);
        }
      }
    } catch (err) {
      console.error("Error loading waiter metrics:", err);
    }
  };

  useEffect(() => {
    if (session?.user) {
      loadDashboard();
    }
  }, [session]);

  // Delivery Handlers
  const handleAcceptDelivery = async (orderId: string) => {
    if (!session?.user) return;
    const waiterName = session.user.name || waiterProfile?.employeeId || "Waiter";
    const orderToAccept = readyOrders.find(o => o.id === orderId);
    
    if (orderToAccept) {
      setReadyOrders(prev => prev.filter(o => o.id !== orderId));
      setMyDeliveries(prev => [
        {
          ...orderToAccept,
          waiterId: session.user.id,
          waiterName,
          waiterAcceptedAt: new Date().toISOString()
        },
        ...prev
      ]);
      setActiveTab("my-deliveries");
    }

    const res = await acceptDelivery(orderId, session.user.id, waiterName);
    if (!res.success) {
      alert(res.error || "Failed to accept delivery task.");
      loadDashboard();
    }
  };

  const handleDeliveredToTable = async (orderId: string) => {
    if (!session?.user) return;
    const waiterName = session.user.name || waiterProfile?.employeeId || "Waiter";
    
    setMyDeliveries(prev => prev.filter(o => o.id !== orderId));

    const res = await deliverOrder(orderId, session.user.id, waiterName);
    if (!res.success) {
      alert(res.error || "Failed to mark order as delivered.");
      loadDashboard();
    }
  };

  // 3. Setup Socket connection
  useEffect(() => {
    if (!session?.user) return;

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
    console.log("[Waiter Console] Socket connecting:", socketUrl);
    
    const socket = io(socketUrl);
    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketConnected(true);
      socket.emit("waiter-connected");
    });

    socket.on("disconnect", () => {
      setSocketConnected(false);
    });

    // Event listeners
    socket.on("customer-request", (request: any) => {
      playAlertSound("new-request");
      setPendingRequests(prev => {
        if (prev.some(r => r.id === request.id)) return prev;
        return [...prev, request];
      });
      // Increment active requests inside tables array
      setTables(prev => prev.map(t => {
        if (t.id === request.tableId) {
          return {
            ...t,
            serviceRequests: [...t.serviceRequests, request]
          };
        }
        return t;
      }));
    });

    socket.on("request-resolved", (request: any) => {
      setPendingRequests(prev => prev.filter(r => r.id !== request.id));
      setTables(prev => prev.map(t => {
        if (t.id === request.tableId) {
          return {
            ...t,
            serviceRequests: t.serviceRequests.filter(r => r.id !== request.id)
          };
        }
        return t;
      }));
    });

    const handleReadyOrder = (readyOrder: any) => {
      if (!readyOrder || !readyOrder.id) return;
      playAlertSound("order-ready");
      setReadyOrders(prev => {
        if (prev.some(o => o.id === readyOrder.id)) return prev;
        return [readyOrder, ...prev];
      });
      setTables(prev => prev.map(t => {
        if (t.id === readyOrder.tableId) {
          return {
            ...t,
            orders: t.orders.map(o => o.id === readyOrder.id ? readyOrder : o)
          };
        }
        return t;
      }));
    };

    socket.on("order-ready", handleReadyOrder);
    socket.on("ORDER_READY", handleReadyOrder);

    const handleWaiterAccepted = (data: any) => {
      const targetId = data.orderId || data.order?.id || data.id;
      if (!targetId) return;
      setReadyOrders(prev => prev.filter(o => o.id !== targetId));
      loadDashboard();
    };

    socket.on("order-accepted-by-waiter", handleWaiterAccepted);
    socket.on("WAITER_ACCEPTED", handleWaiterAccepted);

    socket.on("order-new", (newOrder: any) => {
      loadDashboard();
    });

    socket.on("order-accepted", (updatedOrder: any) => {
      loadDashboard();
    });

    socket.on("order-preparing", (updatedOrder: any) => {
      loadDashboard();
    });

    const handleServedOrder = (updatedOrder: any) => {
      if (!updatedOrder || !updatedOrder.id) return;
      setReadyOrders(prev => prev.filter(o => o.id !== updatedOrder.id));
      setMyDeliveries(prev => prev.filter(o => o.id !== updatedOrder.id));
      loadDashboard();
    };

    socket.on("order-served", handleServedOrder);
    socket.on("ORDER_SERVED", handleServedOrder);

    socket.on("order-completed", handleServedOrder);
    socket.on("ORDER_COMPLETED", handleServedOrder);

    socket.on("payment-completed", (updatedOrder: any) => {
      loadDashboard();
    });

    socket.on("table-closed", (tableData: any) => {
      loadDashboard();
    });

    return () => {
      socket.disconnect();
    };
  }, [session, soundEnabled]);

  // Setup time ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(timer);
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
        // Validate user role
        if (user.role === "WAITER" || user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
          setSession({ user });
          const profileRes = await getOrCreateWaiterProfile(user.id);
          if (profileRes.success && profileRes.waiter) {
            setWaiterProfile(profileRes.waiter);
            setIsAvailable(profileRes.waiter.isAvailable);
          }
          if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
            router.push("/admin");
          }
        } else if (user.role === "KITCHEN") {
          router.push("/kitchen");
        } else if (user.role === "CASHIER") {
          router.push("/billing");
        } else {
          await authClient.signOut();
          setLoginError("Access Denied: Logged-in profile is not registered as Waiter.");
        }
      }
    } catch (err: any) {
      setLoginError(err.message || "Invalid email or password combination.");
    } finally {
      setLoginLoading(false);
    }
  };

  // Quick Login profiles for fast validation
  const handleQuickLogin = (roleEmail: string) => {
    setEmail(roleEmail);
    setPassword("password123"); // Default local seed password
  };

  const handleLogoutSubmit = async () => {
    const confirmLogout = confirm("Are you sure you want to log out of Waiter Console?");
    if (!confirmLogout) return;

    try {
      await authClient.signOut();
      setSession(null);
      setWaiterProfile(null);
      setTables([]);
      setPendingRequests([]);
      setReadyOrders([]);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // Core actions
  const handleResolveAlert = async (requestId: string) => {
    // Optimistic UI updates
    setPendingRequests(prev => prev.filter(r => r.id !== requestId));
    const res = await resolveServiceRequest(requestId);
    if (!res.success) {
      loadDashboard();
      alert(res.error || "Failed to resolve request");
    }
  };

  const handleServeOrder = async (orderId: string) => {
    // Optimistic UI updates
    setReadyOrders(prev => prev.filter(o => o.id !== orderId));
    const res = await serveOrder(orderId);
    if (!res.success) {
      loadDashboard();
      alert(res.error || "Failed to mark served");
    }
  };

  // Status mapping utility for table cards
  const getTableStatusDetails = (table: RestaurantTable) => {
    const hasPendingBill = table.serviceRequests.some(r => r.type === "BILL");
    const activeOrder = table.orders[0];

    // Priority 1: Check if bill is requested
    if (hasPendingBill) {
      return {
        label: "Bill Requested",
        style: "bg-red-500/20 text-red-300 border-red-500/40 animate-pulse",
        needsAttention: true
      };
    }

    // Priority 2: Check if there are other pending requests
    if (table.serviceRequests.length > 0) {
      return {
        label: `${table.serviceRequests.length} Alert(s)`,
        style: "bg-orange-500/20 text-orange-300 border-orange-500/40 animate-bounce",
        needsAttention: true
      };
    }

    // Priority 3: Free table
    if (!table.sessions[0]) {
      return {
        label: table.status === "CLEANING" ? "Cleaning" : table.status === "RESERVED" ? "Reserved" : "Available",
        style: table.status === "CLEANING" ? "bg-purple-950/40 text-purple-300 border-purple-500/20" : table.status === "RESERVED" ? "bg-amber-950/40 text-accent border-accent/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        needsAttention: false
      };
    }

    // Priority 4: Occupied table order statuses
    if (!activeOrder) {
      return {
        label: "Waiting For Order",
        style: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
        needsAttention: false
      };
    }

    switch (activeOrder.status) {
      case "PENDING":
      case "RECEIVED":
        return {
          label: "Waiting For Order",
          style: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
          needsAttention: false
        };
      case "ACCEPTED":
      case "PREPARING":
        return {
          label: "Preparing",
          style: "bg-blue-600/10 text-blue-400 border-blue-600/20",
          needsAttention: false
        };
      case "READY":
        return {
          label: "Ready To Serve",
          style: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse",
          needsAttention: true
        };
      case "SERVED":
        if (activeOrder.paymentStatus === "PAID") {
          return {
            label: "Served",
            style: "bg-neutral-800 text-zinc-400 border-zinc-800",
            needsAttention: false
          };
        }
        return {
          label: "Payment Pending",
          style: "bg-orange-500/15 text-orange-400 border-orange-500/30",
          needsAttention: false
        };
      default:
        return {
          label: "Occupied",
          style: "bg-[#251416] text-[#baa47f] border-[#361f22]",
          needsAttention: false
        };
    }
  };

  // Helper calculation for table session duration
  const getSessionDuration = (session: TableSession) => {
    const elapsedMs = Date.now() - new Date(session.createdAt).getTime();
    const elapsedMins = Math.floor(elapsedMs / 60000);
    return `${elapsedMins}m active`;
  };

  // Get running bill total for active tables
  const getRunningBillAmount = (table: RestaurantTable) => {
    return table.orders.reduce((sum, o) => sum + o.finalAmount, 0);
  };

  // Get service requests priority levels
  const getRequestPriority = (req: ServiceRequest) => {
    if (req.type === "BILL") return { label: "CRITICAL", style: "bg-red-500/20 text-red-300 border-red-500/40" };
    if (req.notes?.toLowerCase().includes("birthday") || req.notes?.toLowerCase().includes("celebrate")) {
      return { label: "HIGH", style: "bg-purple-500/20 text-purple-300 border-purple-500/40" };
    }
    return { label: "MEDIUM", style: "bg-zinc-800 text-zinc-300 border-zinc-700" };
  };

  // Filters application
  const filteredTables = useMemo(() => {
    return tables.filter(t => {
      // Search table number or customer name
      const matchesSearch = 
        t.number.toString() === searchQuery ||
        t.sessions[0]?.customerName.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      // Status filters
      if (statusFilter !== "ALL") {
        const details = getTableStatusDetails(t);
        if (statusFilter === "ATTENTION" && !details.needsAttention) return false;
        if (statusFilter === "FREE" && t.sessions[0]) return false;
        if (statusFilter === "OCCUPIED" && !t.sessions[0]) return false;
        if (statusFilter === "READY" && details.label !== "Ready To Serve") return false;
        if (statusFilter === "BILL" && details.label !== "Bill Requested") return false;
      }

      // Floors filters (mock mapping: tables 1-4 ground floor, 5-8 patio)
      if (floorFilter !== "ALL") {
        const isGround = t.number <= 4;
        if (floorFilter === "GROUND" && !isGround) return false;
        if (floorFilter === "PATIO" && isGround) return false;
      }

      return true;
    });
  }, [tables, searchQuery, statusFilter, floorFilter, tick]);

  // Loading view
  if (authLoading) {
    return (
      <div className="bg-[#0e0708] text-white min-h-screen font-sans flex flex-col justify-center items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-xs uppercase font-bold tracking-widest text-zinc-400">Verifying session...</span>
      </div>
    );
  }

  // --- LOGIN PAGE VIEW ---
  if (!session?.user) {
    return (
      <div className="bg-[#0e0708] text-white min-h-screen font-display flex flex-col justify-center items-center p-6 relative overflow-hidden">
        {/* Glow overlay assets */}
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-maroon-900/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-gold-500/5 blur-[120px] pointer-events-none" />

        <div className="w-full max-w-md bg-[#1c0f11] border border-[#361f22] rounded-xl p-8 shadow-large z-10">
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
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="waiter@bikaji.com"
                  className="w-full bg-[#14080a] border border-[#361f22] rounded-lg pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-gold-500/40 transition"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#14080a] border border-[#361f22] rounded-lg pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-650 focus:outline-none focus:border-gold-500/40 transition"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 bg-primary hover:bg-[#871b30] text-white text-xs font-bold uppercase tracking-wider border border-gold-500/20 rounded-lg transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 mt-2"
            >
              {loginLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4 text-gold-300" />}
              {loginLoading ? "Authenticating..." : "Secure Sign In"}
            </button>
          </form>

          {/* Quick Select Panel for testing */}
          <div className="mt-8 pt-6 border-t border-[#361f22]">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-3 text-center">
              Quick Select Logins
            </span>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleQuickLogin("waiter@bikaji.com")}
                className="w-full py-2 bg-[#251416] hover:bg-[#341b1e] border border-[#361f22] text-zinc-300 hover:text-white rounded text-xs font-semibold transition cursor-pointer"
              >
                Profiles: Waiter Rajesh (waiter@bikaji.com)
              </button>
              <button
                onClick={() => handleQuickLogin("admin@bikaji.com")}
                className="w-full py-2 bg-[#251416] hover:bg-[#341b1e] border border-[#361f22] text-zinc-300 hover:text-white rounded text-xs font-semibold transition cursor-pointer"
              >
                Profiles: Admin Manager (admin@bikaji.com)
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- ACTIVE CONSOLE DASHBOARD VIEW ---
  return (
    <div className="bg-[#0e0708] text-white min-h-screen font-sans flex flex-col antialiased pb-20">
      {/* Console Header */}
      <header className="bg-[#1a0f11] border-b border-[#361f22] px-4 sm:px-6 py-3.5 shadow-large sticky top-0 z-30">
        <div className="max-w-6xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Bikaji Logo" width={160} height={48} className="h-8 md:h-12 w-auto object-contain" />
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[8px] border px-2 py-0.5 rounded font-extrabold uppercase tracking-wide ${
                  socketConnected ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-red-500/10 border-red-500/30 text-red-400 animate-pulse"
                }`}>
                  {socketConnected ? "Online" : "Offline"}
                </span>
              </div>
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block mt-0.5 truncate max-w-[150px]">
                {session.user.name} ({waiterProfile?.employeeId || "WT-Staff"})
              </span>
            </div>
          </div>

          {/* Status indicator and sounds toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-lg border transition cursor-pointer flex items-center justify-center ${
                soundEnabled
                  ? "bg-[#251416] border-[#361f22] text-[#baa47f]"
                  : "bg-zinc-900 border-zinc-800 text-zinc-650"
              }`}
              title="Mute alert chimes"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              onClick={handleLogoutSubmit}
              className="p-2 rounded-lg bg-zinc-950 border border-[#361f22] text-red-400 hover:bg-red-950/20 transition cursor-pointer flex items-center justify-center"
              title="Sign out of Waiter Console"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* PERFORMANCE SUMMARY BAR */}
      <div className="bg-[#14080a] border-b border-[#361f22] px-4 py-3">
        <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <div className="bg-[#1c0f11] p-2.5 rounded-xl border border-[#361f22]">
            <span className="text-[9px] text-zinc-400 font-extrabold uppercase block truncate">Today's Deliveries</span>
            <span className="text-xs font-black text-emerald-400 mt-0.5 block">{performanceMetrics.ordersDeliveredToday} orders</span>
          </div>
          <div className="bg-[#1c0f11] p-2.5 rounded-xl border border-[#361f22]">
            <span className="text-[9px] text-zinc-400 font-extrabold uppercase block truncate">Tables Served</span>
            <span className="text-xs font-black text-blue-400 mt-0.5 block">{performanceMetrics.tablesServedToday} tables</span>
          </div>
          <div className="bg-[#1c0f11] p-2.5 rounded-xl border border-[#361f22]">
            <span className="text-[9px] text-zinc-400 font-extrabold uppercase block truncate">Avg Delivery Time</span>
            <span className="text-xs font-black font-mono text-amber-400 mt-0.5 block">
              {performanceMetrics.avgDeliveryTimeSeconds > 0
                ? `${Math.floor(performanceMetrics.avgDeliveryTimeSeconds / 60)}m ${performanceMetrics.avgDeliveryTimeSeconds % 60}s`
                : "0s"}
            </span>
          </div>
          <div className="bg-[#1c0f11] p-2.5 rounded-xl border border-[#361f22]">
            <span className="text-[9px] text-zinc-400 font-extrabold uppercase block truncate">Fastest Delivery</span>
            <span className="text-xs font-black font-mono text-emerald-300 mt-0.5 block">
              {performanceMetrics.fastestDeliverySeconds > 0
                ? `${Math.floor(performanceMetrics.fastestDeliverySeconds / 60)}m ${performanceMetrics.fastestDeliverySeconds % 60}s`
                : "0s"}
            </span>
          </div>
          <div className="bg-[#1c0f11] p-2.5 rounded-xl border border-[#361f22]">
            <span className="text-[9px] text-zinc-400 font-extrabold uppercase block truncate">Pending Alerts</span>
            <span className="text-xs font-black text-amber-500 mt-0.5 block">{readyOrders.length}</span>
          </div>
          <div className="bg-[#1c0f11] p-2.5 rounded-xl border border-[#361f22]">
            <span className="text-[9px] text-zinc-400 font-extrabold uppercase block truncate">Active Deliveries</span>
            <span className="text-xs font-black text-purple-400 mt-0.5 block">{myDeliveries.length}</span>
          </div>
        </div>
      </div>

      {/* Main Views Panel */}
      <main className="flex-1 p-4 sm:p-6 overflow-y-auto max-w-6xl mx-auto w-full">
        {/* --- VIEW TAB 1: TABLES GRID --- */}
        {activeTab === "tables" && (
          <div className="flex flex-col gap-4">
            {/* Filter and Search Bar */}
            <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-[#13090a] p-3 border border-[#251416] rounded-xl">
              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 text-zinc-555 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by Table or Guest Name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#1c0f11] border border-[#361f22] rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 w-full md:w-auto">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-[#1c0f11] border border-[#361f22] text-zinc-350 text-xs rounded-lg px-2 py-2 flex-1 md:flex-initial"
                >
                  <option value="ALL">All Tables</option>
                  <option value="ATTENTION">Needs Attention</option>
                  <option value="FREE">Free Only</option>
                  <option value="OCCUPIED">Occupied Only</option>
                  <option value="READY">Ready to Serve</option>
                  <option value="BILL">Bill Requests</option>
                </select>

                <select
                  value={floorFilter}
                  onChange={(e) => setFloorFilter(e.target.value)}
                  className="bg-[#1c0f11] border border-[#361f22] text-zinc-350 text-xs rounded-lg px-2 py-2 flex-1 md:flex-initial"
                >
                  <option value="ALL">All Floors</option>
                  <option value="GROUND">Ground Floor</option>
                  <option value="PATIO">Outdoor Patio</option>
                </select>
              </div>
            </div>

            {/* Tables Cards Grid */}
            {filteredTables.length === 0 ? (
              <div className="h-60 flex flex-col justify-center items-center border border-dashed border-[#361f22] rounded-xl text-center text-zinc-500 p-6">
                <SlidersHorizontal className="w-10 h-10 text-zinc-650 mb-2" />
                <h3 className="text-sm font-bold text-zinc-400">No matching tables</h3>
                <p className="text-[11px]">Adjust your search query or status filter.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {filteredTables.map(table => {
                  const details = getTableStatusDetails(table);
                  const activeSession = table.sessions[0];
                  const billAmt = getRunningBillAmount(table);

                  return (
                    <motion.div
                      key={table.id}
                      onClick={() => router.push(`/waiter/table/${table.id}`)}
                      whileTap={{ scale: 0.98 }}
                      className={`bg-[#1c0f11] rounded-xl border-2 p-4 flex flex-col gap-3 justify-between shadow-soft hover:border-[#baa47f]/30 transition cursor-pointer relative overflow-hidden ${
                        details.needsAttention ? "border-red-500/30 ring-1 ring-red-500/20 shadow-red-950/20" : "border-[#361f22]"
                      }`}
                    >
                      {/* Flashing Alert Beacon for high-priority attention */}
                      {details.needsAttention && (
                        <div className="absolute top-2 right-2 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        </div>
                      )}

                      {/* Header details */}
                      <div>
                        <div className="flex justify-between items-start">
                          <h3 className="text-lg font-display font-extrabold text-white">
                            TABLE {table.number}
                          </h3>
                          <span className="text-[9px] text-zinc-550 font-bold uppercase tracking-wider">
                            Cap: {table.capacity}
                          </span>
                        </div>

                        {/* Session Details */}
                        {activeSession ? (
                          <div className="mt-1.5 flex flex-col gap-0.5">
                            <span className="text-[11px] font-bold text-zinc-300 truncate max-w-[120px]">
                              {activeSession.customerName}
                            </span>
                            <span className="text-[9px] text-zinc-500 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-gold-500 shrink-0" />
                              {getSessionDuration(activeSession)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-zinc-600 block mt-2 font-medium italic">
                            Empty Session
                          </span>
                        )}
                      </div>

                      {/* Footer Details: Status Badge and Bill amount */}
                      <div className="pt-2 border-t border-[#251416] flex items-center justify-between gap-1">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${details.style}`}>
                          {details.label}
                        </span>
                        {billAmt > 0 && (
                          <span className="text-xs font-mono font-extrabold text-gold-400 shrink-0">
                            ₹{billAmt.toFixed(0)}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* --- VIEW TAB 2: LIVE CUSTOMER REQUESTS --- */}
        {activeTab === "requests" && (
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center pb-2 border-b border-[#361f22]">
              <h2 className="text-sm font-display font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-gold-500" /> Pending Guest Service Calls ({pendingRequests.length})
              </h2>
            </div>

            {pendingRequests.length === 0 ? (
              <div className="max-w-md mx-auto w-full py-16 px-6 border border-dashed border-[#361f22] rounded-2xl text-center flex flex-col items-center justify-center gap-3 bg-[#13090a] my-6">
                <CheckCircle className="w-10 h-10 text-zinc-650" />
                <h3 className="text-sm font-bold text-zinc-300">All requests resolved!</h3>
                <p className="text-xs text-zinc-500 max-w-xs">Outstanding notifications will populate here in real-time.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence mode="popLayout">
                  {pendingRequests.map(req => {
                    const priority = getRequestPriority(req);
                    const ageMs = Date.now() - new Date(req.createdAt).getTime();
                    const ageMins = Math.floor(ageMs / 60000);
                    const ageSecs = Math.floor((ageMs % 60000) / 1000);
                    const ageStr = ageMins > 0 ? `${ageMins}m ${ageSecs}s ago` : `${ageSecs}s ago`;

                    return (
                      <motion.div
                        key={req.id}
                        layoutId={req.id}
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, x: 50 }}
                        className="bg-[#1c0f11] rounded-xl border border-[#361f22] p-4 flex flex-col justify-between gap-4 shadow-soft"
                      >
                        <div className="flex items-center gap-3">
                          {/* Dynamic request icons */}
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-sm shrink-0 border ${
                            req.type === "BILL"
                              ? "bg-red-500/10 border-red-500/30 text-red-400"
                              : req.type === "WATER"
                              ? "bg-sky-500/10 border-sky-500/30 text-sky-400"
                              : req.type === "TISSUE"
                              ? "bg-amber-600/10 border-amber-655/30 text-amber-500"
                              : "bg-[#251416] border-[#361f22] text-[#baa47f]"
                          }`}>
                            {req.type === "BILL" ? (
                              <CreditCard className="w-5 h-5" />
                            ) : req.type === "WATER" ? (
                              <Droplet className="w-5 h-5" />
                            ) : req.type === "TISSUE" ? (
                              <FileText className="w-5 h-5" />
                            ) : (
                              <Utensils className="w-5 h-5" />
                            )}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-extrabold text-white">
                                TABLE {req.table.number}
                              </span>
                              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase ${priority.style}`}>
                                {priority.label}
                              </span>
                            </div>
                            <span className="text-xs text-zinc-300 block mt-1 font-bold">
                              {req.type === "BILL" ? "Bill Request / Check Out" : req.notes || "Call Waiter Assistance"}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-medium block mt-0.5">
                              Elapsed: {ageStr}
                            </span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2 pt-2 border-t border-[#251416]">
                          <button
                            onClick={() => router.push(`/waiter/table/${req.tableId}`)}
                            className="flex-1 py-1.5 rounded-lg border border-[#361f22] text-[#baa47f] hover:text-white hover:border-[#baa47f]/45 text-[10px] font-bold uppercase tracking-wider cursor-pointer text-center"
                          >
                            Table View
                          </button>
                          <button
                            onClick={() => handleResolveAlert(req.id)}
                            className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-extrabold uppercase tracking-wider transition shadow-md cursor-pointer text-center"
                          >
                            Resolve
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {/* --- VIEW TAB: INCOMING KITCHEN ALERTS (READY FOR PICKUP) --- */}
        {activeTab === "alerts" && (
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center pb-2 border-b border-[#361f22]">
              <h2 className="text-sm font-display font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                <BellRing className="w-4 h-4 text-[#baa47f] animate-bounce" /> 🔔 New Delivery Alerts ({readyOrders.length})
              </h2>
              <span className="text-[10px] text-zinc-400 font-bold uppercase">
                Tap Accept Delivery to assign to yourself
              </span>
            </div>

            {readyOrders.length === 0 ? (
              <div className="max-w-md mx-auto w-full py-16 px-6 border border-dashed border-[#361f22] rounded-2xl text-center flex flex-col items-center justify-center gap-3 bg-[#13090a] my-6">
                <Coffee className="w-10 h-10 text-zinc-650" />
                <h3 className="text-sm font-bold text-zinc-300">No pending kitchen alerts</h3>
                <p className="text-xs text-zinc-500 max-w-xs">When the kitchen marks food Ready For Pickup, alert cards populate here in real-time.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence mode="popLayout">
                  {readyOrders.map(order => {
                    const readyTimeMs = order.readyAt ? new Date(order.readyAt).getTime() : new Date(order.createdAt).getTime();
                    const elapsedMs = Math.max(0, Date.now() - readyTimeMs);
                    const elapsedMins = Math.floor(elapsedMs / 60000);
                    const elapsedSecs = Math.floor((elapsedMs % 60000) / 1000);
                    const elapsedStr = elapsedMins > 0 ? `${elapsedMins}m ${elapsedSecs}s` : `${elapsedSecs}s`;
                    const isUrgent = elapsedMins >= 5;
                    const itemsCount = order.items.reduce((sum, i) => sum + i.quantity, 0);

                    return (
                      <motion.div
                        key={order.id}
                        layoutId={order.id}
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: -10 }}
                        className={`bg-[#1c0f11] rounded-xl border-2 p-4 flex flex-col justify-between gap-3 shadow-modal ${
                          isUrgent ? "border-red-500/40 ring-1 ring-red-500/20" : "border-[#baa47f]/40"
                        }`}
                      >
                        <div className="flex justify-between items-start pb-2 border-b border-[#251416]">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-extrabold text-white font-display">
                                TABLE {order.table.number}
                              </h3>
                              <span className={`text-[9px] px-2 py-0.5 rounded font-extrabold uppercase ${
                                isUrgent ? "bg-red-500/20 text-red-300 border border-red-500/40" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                              }`}>
                                {isUrgent ? "HOT / PRIORITY" : "READY FOR PICKUP"}
                              </span>
                            </div>
                            <span className="text-xs text-zinc-400 font-semibold block mt-0.5">
                              Ticket #{order.orderNumber} · {itemsCount} items
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="text-xs font-mono font-bold text-amber-400 flex items-center gap-1 justify-end">
                              <Clock className="w-3.5 h-3.5 text-amber-400" /> {elapsedStr}
                            </span>
                            <span className="text-[9px] text-zinc-500 block mt-0.5">
                              Ready at {order.readyAt ? new Date(order.readyAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Just now"}
                            </span>
                          </div>
                        </div>

                        {/* Items List Summary */}
                        <div className="flex flex-col gap-1 bg-[#14080a] p-2.5 rounded-lg border border-[#251416]">
                          {order.items.map(item => (
                            <div key={item.id} className="flex justify-between items-center text-xs">
                              <span className="text-zinc-200 font-medium truncate max-w-[200px]">{item.name}</span>
                              <span className="px-2 py-0.5 rounded bg-[#251416] border border-[#361f22] text-[#baa47f] text-[10px] font-extrabold">
                                ×{item.quantity}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Accept Action Footer */}
                        <div className="pt-2 border-t border-[#251416] flex justify-between items-center">
                          <button
                            onClick={() => router.push(`/waiter/table/${order.tableId}`)}
                            className="px-3 py-2 rounded-lg border border-[#361f22] text-zinc-400 hover:text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
                          >
                            Table Info
                          </button>
                          <button
                            onClick={() => handleAcceptDelivery(order.id)}
                            className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold uppercase tracking-wider transition shadow-md cursor-pointer flex items-center gap-1.5"
                          >
                            Accept Delivery <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {/* --- VIEW TAB: MY ACTIVE DELIVERIES --- */}
        {activeTab === "my-deliveries" && (
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center pb-2 border-b border-[#361f22]">
              <h2 className="text-sm font-display font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                <Utensils className="w-4 h-4 text-emerald-400" /> 🚶 My Active Deliveries ({myDeliveries.length})
              </h2>
            </div>

            {myDeliveries.length === 0 ? (
              <div className="max-w-md mx-auto w-full py-16 px-6 border border-dashed border-[#361f22] rounded-2xl text-center flex flex-col items-center justify-center gap-3 bg-[#13090a] my-6">
                <CheckCircle className="w-10 h-10 text-zinc-650" />
                <h3 className="text-sm font-bold text-zinc-300">No active deliveries</h3>
                <p className="text-xs text-zinc-500 max-w-xs">Accept ready alerts to move orders into your active delivery queue.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence mode="popLayout">
                  {myDeliveries.map(order => {
                    const acceptedMs = order.waiterAcceptedAt ? new Date(order.waiterAcceptedAt).getTime() : Date.now();
                    const elapsedMs = Math.max(0, Date.now() - acceptedMs);
                    const elapsedMins = Math.floor(elapsedMs / 60000);
                    const elapsedSecs = Math.floor((elapsedMs % 60000) / 1000);
                    const elapsedStr = elapsedMins > 0 ? `${elapsedMins}m ${elapsedSecs}s` : `${elapsedSecs}s`;

                    return (
                      <motion.div
                        key={order.id}
                        layoutId={order.id}
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: -10 }}
                        className="bg-[#1c0f11] rounded-xl border border-emerald-500/30 p-4 flex flex-col justify-between gap-3 shadow-soft"
                      >
                        <div className="flex justify-between items-start pb-2 border-b border-[#251416]">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-extrabold text-white font-display">
                                TABLE {order.table.number}
                              </h3>
                              <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold uppercase">
                                IN TRANSIT
                              </span>
                            </div>
                            <span className="text-xs text-zinc-400 font-semibold block mt-0.5">
                              Ticket #{order.orderNumber}
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1 justify-end">
                              <Clock className="w-3.5 h-3.5 text-emerald-400" /> {elapsedStr}
                            </span>
                            <span className="text-[9px] text-zinc-500 block mt-0.5">
                              Accepted at {order.waiterAcceptedAt ? new Date(order.waiterAcceptedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Just now"}
                            </span>
                          </div>
                        </div>

                        {/* Items List */}
                        <div className="flex flex-col gap-1 bg-[#14080a] p-2.5 rounded-lg border border-[#251416]">
                          {order.items.map(item => (
                            <div key={item.id} className="flex justify-between items-center text-xs">
                              <span className="text-zinc-200 font-medium truncate max-w-[200px]">{item.name}</span>
                              <span className="px-2 py-0.5 rounded bg-[#251416] border border-[#361f22] text-[#baa47f] text-[10px] font-extrabold">
                                ×{item.quantity}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Delivered Action Footer */}
                        <div className="pt-2 border-t border-[#251416] flex justify-end gap-2">
                          <button
                            onClick={() => handleDeliveredToTable(order.id)}
                            className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold uppercase tracking-wider transition shadow-md cursor-pointer flex items-center justify-center gap-2"
                          >
                            <CheckCircle className="w-4 h-4" /> Delivered To Table
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {/* --- VIEW TAB: DELIVERY HISTORY --- */}
        {activeTab === "history" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-3 pb-2 border-b border-[#361f22]">
              <div>
                <h2 className="text-sm font-display font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gold-400" /> 📜 Delivery History ({deliveryHistory.length})
                </h2>
                <span className="text-[10px] text-zinc-400 font-bold uppercase">
                  Complete history of orders delivered by you
                </span>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-48">
                  <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search Table, Order #, Guest..."
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    className="w-full bg-[#1c0f11] border border-[#361f22] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none"
                  />
                </div>

                <div className="flex bg-[#1c0f11] border border-[#361f22] rounded-lg p-0.5">
                  {[
                    { id: "TODAY", label: "Today" },
                    { id: "YESTERDAY", label: "Yesterday" },
                    { id: "THIS_WEEK", label: "This Week" },
                    { id: "ALL", label: "All Time" }
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setHistoryDateFilter(f.id as any)}
                      className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition cursor-pointer ${
                        historyDateFilter === f.id ? "bg-primary text-white" : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {deliveryHistory.length === 0 ? (
              <div className="h-60 flex flex-col justify-center items-center border border-dashed border-[#361f22] rounded-xl text-center text-zinc-500 p-6">
                <FileText className="w-10 h-10 text-zinc-650 mb-2" />
                <h3 className="text-sm font-bold text-zinc-400">No delivery history records found</h3>
                <p className="text-[11px]">Completed deliveries for your shift will be preserved here permanently.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {deliveryHistory.map(order => {
                  const itemsCount = order.items.reduce((sum, i) => sum + i.quantity, 0);
                  const durationSecs = order.deliveryDuration || 0;
                  const durationStr = durationSecs > 0 ? `${Math.floor(durationSecs / 60)}m ${durationSecs % 60}s` : "Fast";

                  return (
                    <motion.div
                      key={order.id}
                      onClick={() => setSelectedHistoryOrder(order)}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className="bg-[#1c0f11] rounded-xl border border-[#361f22] p-4 flex flex-col justify-between gap-3 shadow-soft hover:border-gold-500/40 transition cursor-pointer"
                    >
                      <div className="flex justify-between items-start pb-2 border-b border-[#251416]">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-extrabold text-white font-display">
                              TABLE {order.table.number}
                            </h3>
                            <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold uppercase">
                              {order.status}
                            </span>
                          </div>
                          <span className="text-xs text-zinc-400 font-semibold block mt-0.5">
                            Ticket #{order.orderNumber} · Guest: {order.customerName || "Dine-in Guest"}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-mono font-extrabold text-gold-400 block">
                            ₹{order.finalAmount.toFixed(0)}
                          </span>
                          <span className="text-[9px] text-zinc-500 block mt-0.5">
                            {itemsCount} Items
                          </span>
                        </div>
                      </div>

                      {/* Timeline stamps preview */}
                      <div className="grid grid-cols-3 gap-1 bg-[#14080a] p-2 rounded-lg border border-[#251416] text-[9px]">
                        <div>
                          <span className="text-zinc-500 uppercase block font-bold">Kitchen Ready</span>
                          <span className="text-zinc-300 font-semibold">
                            {order.readyAt ? new Date(order.readyAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}
                          </span>
                        </div>
                        <div>
                          <span className="text-zinc-500 uppercase block font-bold">Accepted</span>
                          <span className="text-zinc-300 font-semibold">
                            {order.waiterAcceptedAt ? new Date(order.waiterAcceptedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}
                          </span>
                        </div>
                        <div>
                          <span className="text-zinc-500 uppercase block font-bold">Delivered</span>
                          <span className="text-emerald-400 font-bold">
                            {order.deliveredAt ? new Date(order.deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}
                          </span>
                        </div>
                      </div>

                      {/* Duration & Details Footer */}
                      <div className="pt-2 border-t border-[#251416] flex justify-between items-center text-xs">
                        <span className="text-[10px] text-zinc-400 flex items-center gap-1 font-bold">
                          <Clock className="w-3 h-3 text-amber-400" /> Delivery Time: <span className="text-amber-400 font-mono">{durationStr}</span>
                        </span>
                        <span className="text-[10px] text-gold-400 font-bold uppercase flex items-center gap-1">
                          View Full Timeline <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* --- VIEW TAB 4: ACCOUNT / SETTINGS --- */}
        {activeTab === "account" && (
          <div className="bg-[#1c0f11] rounded-xl border border-[#361f22] p-6 shadow-soft flex flex-col gap-6">
            <div className="flex items-center gap-4 pb-4 border-b border-[#251416]">
              <div className="w-14 h-14 rounded-full bg-maroon-900 flex items-center justify-center border-2 border-gold-500/30 text-gold-400">
                <User className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-lg font-display font-extrabold text-white">{session.user.name}</h2>
                <span className="text-xs text-zinc-450 uppercase tracking-widest font-semibold block mt-0.5">
                  Shift Staff ID: {waiterProfile?.employeeId || "WT-101"}
                </span>
              </div>
            </div>

            {/* Waiter availability toggle */}
            <div className="flex justify-between items-center p-4 bg-[#14080a] border border-[#251416] rounded-xl">
              <div>
                <span className="text-xs font-bold text-white uppercase tracking-wide block">Console Availability</span>
                <span className="text-[10px] text-zinc-550 block mt-0.5">
                  Set offline to stop receiving push service request alert chimes
                </span>
              </div>
              <button
                onClick={() => setIsAvailable(!isAvailable)}
                className={`px-4 py-2 rounded-lg text-xs font-extrabold uppercase tracking-wider border cursor-pointer transition ${
                  isAvailable
                    ? "bg-emerald-600/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                    : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:bg-zinc-900"
                }`}
              >
                {isAvailable ? "Available / Active" : "Offline / Mute"}
              </button>
            </div>

            {/* Shifts & Floor Zone Settings */}
            <div className="flex flex-col gap-4">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Operational Floor Assignment</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-[#14080a] border border-[#251416] flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-550 font-bold uppercase tracking-wider">Restaurant Zone</span>
                  <span className="text-sm font-extrabold text-white flex items-center gap-1.5 mt-0.5">
                    <MapPin className="w-4 h-4 text-gold-500 shrink-0" /> Ground Floor (T1-T4)
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-[#14080a] border border-[#251416] flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-550 font-bold uppercase tracking-wider">Assigned Shift</span>
                  <span className="text-sm font-extrabold text-white flex items-center gap-1.5 mt-0.5">
                    <Clock className="w-4 h-4 text-gold-500 shrink-0" /> Dinner Session (18:00 - 23:00)
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={handleLogoutSubmit}
              className="w-full py-3 bg-zinc-950 hover:bg-red-950/20 border border-[#361f22] text-red-400 text-xs font-bold uppercase tracking-wider rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 mt-2"
            >
              <LogOut className="w-4 h-4" /> Sign Out of Waiter Session
            </button>
          </div>
        )}
      </main>

      {/* TABLE HISTORY MODAL */}
      <AnimatePresence>
        {selectedHistoryOrder && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#1c0f11] border border-[#361f22] rounded-2xl max-w-lg w-full p-6 max-h-[85vh] overflow-y-auto flex flex-col gap-4 shadow-modal text-white"
            >
              <div className="flex justify-between items-start pb-3 border-b border-[#251416]">
                <div>
                  <h3 className="text-lg font-extrabold font-display">
                    Order #{selectedHistoryOrder.orderNumber} Audit
                  </h3>
                  <span className="text-xs text-[#baa47f] font-bold">
                    Table {selectedHistoryOrder.table.number} · Guest: {selectedHistoryOrder.customerName || "Dine-in Guest"}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedHistoryOrder(null)}
                  className="p-1 rounded-lg hover:bg-[#251416] text-zinc-400 hover:text-white transition cursor-pointer"
                >
                  <LogOut className="w-5 h-5 rotate-180" />
                </button>
              </div>

              {/* TIMELINE STEPS */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-extrabold text-gold-400 uppercase tracking-widest block">
                  📜 Complete Order Timeline
                </span>
                <div className="bg-[#14080a] p-3 rounded-xl border border-[#251416] flex flex-col gap-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 font-medium">1. Order Placed:</span>
                    <span className="font-mono text-zinc-200 font-bold">
                      {new Date(selectedHistoryOrder.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 font-medium">2. Kitchen Accepted:</span>
                    <span className="font-mono text-zinc-200 font-bold">
                      {selectedHistoryOrder.acceptedAt ? new Date(selectedHistoryOrder.acceptedAt).toLocaleTimeString() : "Skipped"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 font-medium">3. Start Cooking:</span>
                    <span className="font-mono text-zinc-200 font-bold">
                      {selectedHistoryOrder.preparingAt ? new Date(selectedHistoryOrder.preparingAt).toLocaleTimeString() : "Skipped"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 font-medium">4. Ready For Pickup:</span>
                    <span className="font-mono text-amber-400 font-bold">
                      {selectedHistoryOrder.readyAt ? new Date(selectedHistoryOrder.readyAt).toLocaleTimeString() : "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 font-medium">5. Waiter Accepted (Picked Up):</span>
                    <span className="font-mono text-blue-400 font-bold">
                      {selectedHistoryOrder.waiterAcceptedAt ? new Date(selectedHistoryOrder.waiterAcceptedAt).toLocaleTimeString() : "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 font-medium">6. Delivered To Table:</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {selectedHistoryOrder.deliveredAt ? new Date(selectedHistoryOrder.deliveredAt).toLocaleTimeString() : "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-[#251416] pt-1">
                    <span className="text-emerald-400 font-bold">Total Delivery Duration:</span>
                    <span className="font-mono text-emerald-400 font-extrabold">
                      {selectedHistoryOrder.deliveryDuration ? `${Math.floor(selectedHistoryOrder.deliveryDuration / 60)}m ${selectedHistoryOrder.deliveryDuration % 60}s` : "Fast"}
                    </span>
                  </div>
                </div>
              </div>

              {/* ITEMS SUMMARY */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-extrabold text-gold-400 uppercase tracking-widest block">
                  🍽 Ordered Dishes
                </span>
                <div className="bg-[#14080a] p-3 rounded-xl border border-[#251416] flex flex-col gap-1.5 text-xs">
                  {selectedHistoryOrder.items.map(item => (
                    <div key={item.id} className="flex justify-between items-center">
                      <span className="text-zinc-200">{item.quantity}x {item.name}</span>
                    </div>
                  ))}
                  <div className="border-t border-[#251416] pt-1.5 flex justify-between items-center text-sm font-extrabold text-gold-400">
                    <span>Invoice Total:</span>
                    <span>₹{selectedHistoryOrder.finalAmount.toFixed(0)}</span>
                  </div>
                </div>
              </div>

              {/* NOTES / REPLIES */}
              {selectedHistoryOrder.kitchenNotes && (
                <div className="p-2.5 bg-gold-950/20 border border-gold-600/30 rounded-xl text-xs">
                  <span className="text-[9px] font-extrabold text-gold-400 uppercase block">Chef Note</span>
                  <p className="text-gold-200">{selectedHistoryOrder.kitchenNotes}</p>
                </div>
              )}

              {selectedHistoryOrder.customerReply && (
                <div className="p-2.5 bg-purple-950/20 border border-purple-500/30 rounded-xl text-xs">
                  <span className="text-[9px] font-extrabold text-purple-400 uppercase block">Customer Reply</span>
                  <p className="text-purple-200">"{selectedHistoryOrder.customerReply}"</p>
                </div>
              )}

              <button
                onClick={() => setSelectedHistoryOrder(null)}
                className="w-full py-2.5 bg-[#251416] border border-[#361f22] text-zinc-300 hover:text-white rounded-xl text-xs font-extrabold uppercase tracking-wider transition cursor-pointer mt-2"
              >
                Close Audit Window
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile-first sticky bottom navigation bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#160b0c] border-t border-[#361f22] py-2 px-4 z-40 shadow-floating">
        <div className="max-w-xl mx-auto flex justify-around items-center">
          <button
            onClick={() => setActiveTab("alerts")}
            className={`flex flex-col items-center gap-1 transition cursor-pointer relative ${
              activeTab === "alerts" ? "text-gold-500 scale-105" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <BellRing className="w-5 h-5 shrink-0" />
            <span className="text-[9px] font-extrabold uppercase tracking-wide">Alerts</span>
            {readyOrders.length > 0 && (
              <span className="absolute -top-1.5 -right-2 px-1.5 py-0.5 rounded-full bg-amber-600 text-white text-[8px] font-extrabold border border-[#361f22]">
                {readyOrders.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("my-deliveries")}
            className={`flex flex-col items-center gap-1 transition cursor-pointer relative ${
              activeTab === "my-deliveries" ? "text-gold-500 scale-105" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Utensils className="w-5 h-5 shrink-0" />
            <span className="text-[9px] font-extrabold uppercase tracking-wide">My Deliveries</span>
            {myDeliveries.length > 0 && (
              <span className="absolute -top-1.5 -right-2 px-1.5 py-0.5 rounded-full bg-emerald-600 text-white text-[8px] font-extrabold border border-[#361f22]">
                {myDeliveries.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`flex flex-col items-center gap-1 transition cursor-pointer relative ${
              activeTab === "history" ? "text-gold-500 scale-105" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <FileText className="w-5 h-5 shrink-0" />
            <span className="text-[9px] font-extrabold uppercase tracking-wide">History</span>
          </button>

          <button
            onClick={() => setActiveTab("requests")}
            className={`flex flex-col items-center gap-1 transition cursor-pointer relative ${
              activeTab === "requests" ? "text-gold-500 scale-105" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Bell className="w-5 h-5 shrink-0" />
            <span className="text-[9px] font-extrabold uppercase tracking-wide">Calls</span>
            {pendingRequests.length > 0 && (
              <span className="absolute -top-1.5 -right-2 px-1.5 py-0.5 rounded-full bg-red-650 text-white text-[8px] font-extrabold animate-pulse border border-[#361f22]">
                {pendingRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("tables")}
            className={`flex flex-col items-center gap-1 transition cursor-pointer ${
              activeTab === "tables" ? "text-gold-500 scale-105" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <SlidersHorizontal className="w-5 h-5 shrink-0" />
            <span className="text-[9px] font-extrabold uppercase tracking-wide">Tables Grid</span>
          </button>

          <button
            onClick={() => setActiveTab("account")}
            className={`flex flex-col items-center gap-1 transition cursor-pointer ${
              activeTab === "account" ? "text-gold-500 scale-105" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <User className="w-5 h-5 shrink-0" />
            <span className="text-[9px] font-extrabold uppercase tracking-wide">Account</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
