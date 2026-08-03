"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Utensils,
  Smartphone,
  Tag,
  Users,
  History,
  Settings,
  LogOut,
  Bell,
  Search,
  Loader2,
  Lock,
  Mail,
  Shield,
  Menu,
  X,
  AlertTriangle,
  Sparkles
} from "lucide-react";
import Image from "next/image";
import { getOrCreateWaiterProfile } from "@/actions/waiter";
import { authClient } from "@/lib/auth-client";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  // Auth States
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState<boolean>(false);

  // Responsive UI States
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState<boolean>(false);

  const socketRef = useRef<Socket | null>(null);

  // 1. Session verification on mount
  useEffect(() => {
    async function checkSession() {
      try {
        const { data: currentSession } = await authClient.getSession();
        if (currentSession?.user) {
          const user = currentSession.user as any;
          if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
            setSession(currentSession);
          } else {
            setSession(null);
            if (pathname !== "/admin") {
              router.push("/admin");
            }
          }
        }
      } catch (err) {
        console.error("Session verification error:", err);
      } finally {
        setAuthLoading(false);
      }
    }
    checkSession();
  }, [pathname]);

  // 2. Setup Socket connections for real-time admin indicators
  useEffect(() => {
    if (!session?.user) return;

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
    const socket = io(socketUrl);
    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketConnected(true);
      socket.emit("admin-connected");
    });

    socket.on("disconnect", () => {
      setSocketConnected(false);
    });

    // Alert listeners for notifications dropdown
    socket.on("customer-request", (request: any) => {
      setNotifications(prev => [
        {
          id: request.id,
          title: `Table ${request.table.number} Alert`,
          description: request.notes || `Requested assistance: ${request.type}`,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          unread: true
        },
        ...prev
      ]);
    });

    socket.on("order-new", (order: any) => {
      setNotifications(prev => [
        {
          id: order.id,
          title: "New Order Placed",
          description: `Ticket ${order.orderNumber} for Table ${order.table?.number || "QR"}`,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          unread: true
        },
        ...prev
      ]);
    });

    socket.on("payment-completed", (order: any) => {
      setNotifications(prev => [
        {
          id: order.id,
          title: "Bill Paid Successfully",
          description: `Ticket ${order.orderNumber} processed amount ₹${order.finalAmount}`,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          unread: true
        },
        ...prev
      ]);
    });

    return () => {
      socket.disconnect();
    };
  }, [session]);

  // Secure login handler
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setLoginError("Please enter both email and password.");
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
        if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
          setSession({ user });
          router.push("/admin");
        } else if (user.role === "WAITER") {
          router.push("/waiter");
        } else if (user.role === "KITCHEN") {
          router.push("/kitchen");
        } else if (user.role === "CASHIER") {
          router.push("/billing");
        } else {
          await authClient.signOut();
          setLoginError("Access Denied: Logged-in profile has no administrative access.");
        }
      }
    } catch (err: any) {
      setLoginError(err.message || "Invalid credentials combination.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogoutSubmit = async () => {
    const confirmLogout = confirm("Are you sure you want to exit Admin Panel?");
    if (!confirmLogout) return;

    try {
      await authClient.signOut();
      setSession(null);
      router.push("/admin");
    } catch (err) {
      console.error(err);
    }
  };

  const handleQuickLogin = (roleEmail: string) => {
    setEmail(roleEmail);
    setPassword("password123");
  };

  // Sidebar Links Structure
  const sidebarLinks = [
    { label: "Dashboard", path: "/admin", icon: LayoutDashboard },
    { label: "Orders", path: "/admin/orders", icon: Sparkles },
    { label: "Tables & QR", path: "/admin/tables", icon: Smartphone },
    { label: "Menu Catalog", path: "/admin/menu", icon: Utensils },
    { label: "Coupons", path: "/admin/coupons", icon: Tag },
    { label: "Staff Members", path: "/admin/staff", icon: Users },
    { label: "Audit Logs", path: "/admin/logs", icon: History },
    { label: "Settings", path: "/admin/settings", icon: Settings },
  ];

  if (authLoading) {
    return (
      <div className="bg-[#0b0506] text-white min-h-screen font-sans flex flex-col justify-center items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#baa47f]" />
        <span className="text-xs uppercase font-bold tracking-widest text-zinc-500">Checking credentials...</span>
      </div>
    );
  }

  // --- ADMIN LOGIN VIEW ---
  if (!session?.user) {
    return (
      <div className="bg-[#0b0506] text-white min-h-screen font-sans flex flex-col justify-center items-center p-6 relative overflow-hidden">
        {/* Decorative background glows */}
        <div className="absolute top-[-30%] left-[-30%] w-[70%] h-[70%] rounded-full bg-maroon-900/10 blur-[130px] pointer-events-none" />
        <div className="absolute bottom-[-30%] right-[-30%] w-[70%] h-[70%] rounded-full bg-gold-500/5 blur-[130px] pointer-events-none" />

        <div className="w-full max-w-md bg-[#160c0d] border border-[#2d191b] rounded-2xl p-8 shadow-large z-10">
          <div className="flex flex-col items-center text-center gap-2 mb-8">
            <div className="flex justify-center mb-2">
              <Image src="/logo.png" alt="Bikaji Logo" width={160} height={48} className="h-8 md:h-12 w-auto object-contain" />
            </div>
            <p className="text-[10px] text-zinc-450 uppercase tracking-widest font-bold">
              Secure Owner Access Portal
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
            {loginError && (
              <div className="p-3 bg-red-950/20 border border-red-500/20 text-red-300 text-xs rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-550 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@bikaji.com"
                  className="w-full bg-[#0d0506] border border-[#2d191b] rounded-lg pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-[#baa47f]/40 transition"
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
                  className="w-full bg-[#0d0506] border border-[#2d191b] rounded-lg pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-750 focus:outline-none focus:border-[#baa47f]/40 transition"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 bg-primary hover:bg-[#871b30] text-white text-xs font-bold uppercase tracking-wider border border-[#baa47f]/20 rounded-lg transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 mt-2"
            >
              {loginLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4 text-gold-300" />}
              {loginLoading ? "Verifying Keys..." : "Authorize Portal"}
            </button>
          </form>

          {/* Quick login button */}
          <div className="mt-8 pt-6 border-t border-[#2d191b]">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-3 text-center">
              Testing Admin Login
            </span>
            <button
              onClick={() => handleQuickLogin("admin@bikaji.com")}
              className="w-full py-2.5 bg-[#201011] hover:bg-[#2c1719] border border-[#2d191b] text-zinc-300 hover:text-white rounded-lg text-xs font-semibold transition cursor-pointer"
            >
              Autofill Admin Rajesh (admin@bikaji.com)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- FULL DUAL PANEL ADMIN DASHBOARD SUITE ---
  return (
    <div className="bg-[#0b0506] text-white min-h-screen font-sans flex overflow-hidden">
      
      {/* 1. DESKTOP SIDEBAR PANEL */}
      <aside className="hidden lg:flex flex-col w-64 bg-[#140b0c] border-r border-[#251416] shrink-0 h-screen sticky top-0 z-20">
        {/* Sidebar Header */}
        <div className="p-6 border-b border-[#251416] flex items-center">
          <Image src="/logo.png" alt="Bikaji Logo" width={160} height={48} className="h-8 md:h-12 w-auto object-contain" />
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 px-4 py-6 flex flex-col gap-1.5 overflow-y-auto">
          {sidebarLinks.map(link => {
            const isActive = pathname === link.path;
            const Icon = link.icon;

            return (
              <button
                key={link.path}
                onClick={() => router.push(link.path)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  isActive
                    ? "bg-primary border border-[#baa47f]/15 text-white"
                    : "text-zinc-400 hover:text-white hover:bg-[#201011]"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-[#baa47f]" : ""}`} />
                {link.label}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer Profile */}
        <div className="p-4 border-t border-[#251416] flex items-center justify-between gap-2 bg-[#0e0708]">
          <div className="flex items-center gap-2 truncate">
            <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 text-gold-550" />
            </div>
            <div className="truncate">
              <span className="text-xs font-extrabold text-white block truncate">
                {session.user.name}
              </span>
              <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">
                ADMIN
              </span>
            </div>
          </div>

          <button
            onClick={handleLogoutSubmit}
            className="p-2 rounded bg-zinc-950 border border-zinc-850 text-red-400 hover:bg-red-955/20 transition cursor-pointer"
            title="Log out of Admin Portal"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </aside>

      {/* 2. MAIN VIEW AREA */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        
        {/* Top bar header */}
        <header className="bg-[#140b0c] border-b border-[#251416] px-6 py-4 flex items-center justify-between shadow-soft z-30">
          <div className="flex items-center gap-3">
            {/* Mobile Sidebar Hamburger Toggle */}
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg bg-[#201011] border border-[#251416] text-zinc-300 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Path indicator */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs">
              <span className="text-zinc-500 font-medium">Bikaji Console</span>
              <span className="text-zinc-650">/</span>
              <span className="text-zinc-200 font-bold uppercase tracking-wide">
                {sidebarLinks.find(l => l.path === pathname)?.label || "Dashboard"}
              </span>
            </div>
          </div>

          {/* Sockets status, search & notifications */}
          <div className="flex items-center gap-3">
            <span className={`text-[9px] border px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider hidden sm:inline-block ${
              socketConnected ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400 animate-pulse"
            }`}>
              {socketConnected ? "Realtime Live" : "Offline Sync"}
            </span>

            {/* Notifications Trigger */}
            <div className="relative">
              <button
                onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
                className={`p-2 rounded-lg border transition relative cursor-pointer ${
                  notifications.some(n => n.unread)
                    ? "bg-[#201011] border-[#baa47f]/30 text-[#baa47f]"
                    : "bg-zinc-950 border-[#251416] text-zinc-400"
                }`}
              >
                <Bell className="w-4 h-4" />
                {notifications.some(n => n.unread) && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                )}
              </button>

              {/* Notifications Dropdown */}
              <AnimatePresence>
                {showNotificationDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2.5 w-72 bg-[#160c0d] border border-[#2d191b] rounded-xl shadow-modal overflow-hidden z-40 max-h-96 flex flex-col"
                  >
                    <div className="px-4 py-3 border-b border-[#2d191b] flex justify-between items-center bg-[#0d0506]">
                      <span className="text-xs font-bold text-white uppercase tracking-wider">Live Alerts Feed</span>
                      <button
                        onClick={() => {
                          setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
                        }}
                        className="text-[9px] text-[#baa47f] font-bold uppercase tracking-wider cursor-pointer"
                      >
                        Mark Read
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto divide-y divide-[#251416]">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-zinc-550 text-xs">
                          No pending alerts.
                        </div>
                      ) : (
                        notifications.map(n => (
                          <div key={n.id} className={`p-3 text-left hover:bg-[#201011] transition flex flex-col gap-0.5 ${n.unread ? "bg-maroon-950/10" : ""}`}>
                            <div className="flex justify-between items-start">
                              <span className="text-[11px] font-extrabold text-zinc-200">{n.title}</span>
                              <span className="text-[8px] text-zinc-550">{n.time}</span>
                            </div>
                            <span className="text-[10px] text-zinc-400 line-clamp-2 mt-0.5">{n.description}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Dynamic Inner Routes Viewport */}
        <main className="flex-1 overflow-y-auto bg-[#0b0506]">
          {children}
        </main>
      </div>

      {/* 3. MOBILE HAMBURGER SIDEBAR OVERLAY */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileSidebarOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Sidebar drawer content */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.25 }}
              className="relative w-64 bg-[#140b0c] border-r border-[#251416] flex flex-col h-full z-10"
            >
              {/* Close Button */}
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg bg-[#201011] border border-[#251416] text-zinc-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="p-6 border-b border-[#251416] flex items-center">
                <Image src="/logo.png" alt="Bikaji Logo" width={160} height={48} className="h-8 md:h-12 w-auto object-contain" />
              </div>

              <nav className="flex-1 px-4 py-6 flex flex-col gap-1.5 overflow-y-auto">
                {sidebarLinks.map(link => {
                  const isActive = pathname === link.path;
                  const Icon = link.icon;

                  return (
                    <button
                      key={link.path}
                      onClick={() => {
                        setMobileSidebarOpen(false);
                        router.push(link.path);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        isActive
                          ? "bg-primary border border-[#baa47f]/15 text-white"
                          : "text-zinc-400 hover:text-white hover:bg-[#201011]"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {link.label}
                    </button>
                  );
                })}
              </nav>

              <div className="p-4 border-t border-[#251416] flex items-center justify-between gap-2 bg-[#0e0708]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-gold-550" />
                  </div>
                  <div>
                    <span className="text-xs font-extrabold text-white block truncate max-w-[100px]">
                      {session.user.name}
                    </span>
                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">
                      ADMIN
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleLogoutSubmit}
                  className="p-2 rounded bg-zinc-950 border border-zinc-850 text-red-400 hover:bg-red-955/20 transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
