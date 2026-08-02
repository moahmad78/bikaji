"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import {
  CreditCard,
  Layers,
  Clock,
  Sparkles,
  Loader2,
  Lock,
  Mail,
  Shield,
  AlertTriangle,
  Utensils,
  DollarSign,
  Receipt,
  Percent,
  CheckCircle,
  LogOut,
  ChevronRight
} from "lucide-react";
import Image from "next/image";
import { getWaiterDashboardData } from "@/actions/waiter";
import { calculateOrderBill, recordOrderPayment } from "@/actions/billing";

export default function BillingPage() {
  const router = useRouter();

  // Auth States
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState<boolean>(false);

  // Dashboard billing data states
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [billingDetails, setBillingDetails] = useState<any>(null);
  const [discountType, setDiscountType] = useState<"FLAT" | "PERCENTAGE">("PERCENTAGE");
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "UPI" | "CARD">("UPI");
  const [isSettling, setIsSettling] = useState<boolean>(false);

  // 1. Session verification on mount
  useEffect(() => {
    async function checkSession() {
      try {
        const { data: currentSession } = await authClient.getSession();
        if (currentSession?.user) {
          const user = currentSession.user as any;
          if (user.role === "CASHIER" || user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
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
        if (user.role === "CASHIER" || user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
          setSession({ user });
        } else if (user.role === "WAITER") {
          router.push("/waiter");
        } else if (user.role === "KITCHEN") {
          router.push("/kitchen");
        } else {
          await authClient.signOut();
          setLoginError("Access Denied: Logged-in profile is not registered as Cashier.");
        }
      }
    } catch (err: any) {
      setLoginError(err.message || "Invalid credentials combination.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleQuickLogin = (roleEmail: string) => {
    setEmail(roleEmail);
    setPassword("password123");
  };

  // 2. Fetch occupied tables to manage settlements
  const loadBillingDashboard = async () => {
    try {
      const res = await getWaiterDashboardData();
      if (res.success && res.tables) {
        // We only care about occupied tables
        const occupied = res.tables.filter((t: any) => t.sessions && t.sessions.length > 0);
        setTables(occupied);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user) {
      loadBillingDashboard();
    }
  }, [session]);

  // 3. Load order calculations when table selection changes
  const activeOrder = useMemo(() => {
    return selectedTable?.sessions[0]?.orders.find((o: any) => o.status !== "COMPLETED" && o.status !== "CANCELLED");
  }, [selectedTable]);

  useEffect(() => {
    if (!activeOrder) {
      setBillingDetails(null);
      return;
    }
    async function loadBill() {
      const res = await calculateOrderBill(activeOrder.id, {
        type: discountType,
        value: discountValue
      });
      if (res.success && res.billingDetails) {
        setBillingDetails(res.billingDetails);
      }
    }
    loadBill();
  }, [activeOrder, discountType, discountValue]);

  // 4. Settle Invoice Settle handler
  const handleSettlePayment = async () => {
    if (!activeOrder || !billingDetails) return;
    setIsSettling(true);

    try {
      const res = await recordOrderPayment(
        activeOrder.id,
        [{ method: paymentMethod as any, amount: billingDetails.finalAmount }],
        session.user.id,
        discountValue > 0 ? { type: discountType, value: discountValue } : undefined
      );

      if (res.success) {
        alert(`Table ${selectedTable.number} bill settled successfully!`);
        setSelectedTable(null);
        setDiscountValue(0);
        loadBillingDashboard();
      } else {
        alert(res.error || "Failed to settle payment.");
      }
    } catch (err) {
      console.error(err);
      alert("An unexpected error occurred during payment processing.");
    } finally {
      setIsSettling(false);
    }
  };

  const handleLogoutSubmit = async () => {
    if (confirm("Are you sure you want to log out of Cashier Console?")) {
      await authClient.signOut();
      setSession(null);
    }
  };

  if (authLoading) {
    return (
      <div className="bg-[#0b0506] text-white min-h-screen font-sans flex flex-col justify-center items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#baa47f]" />
        <span className="text-xs uppercase font-bold tracking-widest text-zinc-500">Verifying session...</span>
      </div>
    );
  }

  // --- CASHIER LOGIN VIEW ---
  if (!session?.user) {
    return (
      <div className="bg-[#0b0506] text-white min-h-screen font-display flex flex-col justify-center items-center p-6 relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-maroon-900/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-gold-500/5 blur-[120px] pointer-events-none" />

        <div className="w-full max-w-md bg-[#160c0d] border border-[#2d191b] rounded-xl p-8 shadow-large z-10">
          <div className="flex flex-col items-center text-center gap-2 mb-8">
            <div className="w-14 h-14 rounded-premium overflow-hidden border border-gold-500/30 bg-white">
              <Image src="/logo.png" alt="Bikaji Logo" width={56} height={56} className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white mt-2">BIKAJI CASHIER PORTAL</h1>
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
                  placeholder="cashier@bikaji.com"
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
              className="w-full py-3 bg-primary hover:bg-[#871b30] text-white text-xs font-bold uppercase tracking-wider border border-gold-500/20 rounded-lg transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 mt-2"
            >
              {loginLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4 text-gold-300" />}
              {loginLoading ? "Authenticating..." : "Secure Sign In"}
            </button>
          </form>

          {/* Quick Select Panel */}
          <div className="mt-8 pt-6 border-t border-[#2d191b]">
            <span className="text-[10px] text-zinc-555 font-bold uppercase tracking-wider block mb-3 text-center">
              Quick Select Logins
            </span>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleQuickLogin("cashier@bikaji.com")}
                className="w-full py-2 bg-[#1d0f11] hover:bg-[#2c1719] border border-[#2d191b] text-zinc-300 hover:text-white rounded text-xs font-semibold transition cursor-pointer"
              >
                Profiles: Cashier Sharma (cashier@bikaji.com)
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

  // --- CASHIER DASHBOARD PORTAL ---
  return (
    <div className="bg-[#0e0708] text-white min-h-screen font-sans flex flex-col antialiased">
      {/* Header */}
      <header className="bg-[#1a0f11] border-b border-[#361f22] px-6 py-4 flex items-center justify-between shadow-large sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-premium overflow-hidden border border-gold-500/20 shadow-md bg-white">
            <Image src="/logo.png" alt="Bikaji Logo" width={40} height={40} className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-extrabold text-sm tracking-tight text-white uppercase">Cashier Billing Console</span>
              <span className="text-[8px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded font-extrabold uppercase tracking-wide">
                Terminal Active
              </span>
            </div>
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block mt-0.5">
              Operator: {session.user.name}
            </span>
          </div>
        </div>

        <button
          onClick={handleLogoutSubmit}
          className="p-2 rounded-lg bg-zinc-950 border border-[#361f22] text-red-400 hover:bg-red-950/20 transition cursor-pointer flex items-center justify-center"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      {/* Main Grid Workspace */}
      <main className="flex-1 p-4 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto w-full">
        {/* Occupied Tables List */}
        <div className="md:col-span-2 flex flex-col gap-4">
          <div className="flex justify-between items-center pb-2 border-b border-[#361f22]">
            <h2 className="text-xs font-display font-extrabold text-zinc-400 uppercase tracking-wider">
              Active Dining Sessions ({tables.length})
            </h2>
          </div>

          {loading ? (
            <div className="h-60 flex justify-center items-center">
              <Loader2 className="w-6 h-6 animate-spin text-[#baa47f]" />
            </div>
          ) : tables.length === 0 ? (
            <div className="h-60 flex flex-col justify-center items-center border border-dashed border-[#361f22] rounded-xl text-center text-zinc-500 p-6">
              <Utensils className="w-10 h-10 text-zinc-650 mb-2" />
              <h3 className="text-sm font-bold text-zinc-400">All tables free</h3>
              <p className="text-[11px] mt-1">No guest tables are currently occupied.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {tables.map(table => {
                const sessionObj = table.sessions[0];
                const active = selectedTable?.id === table.id;

                return (
                  <div
                    key={table.id}
                    onClick={() => {
                      setSelectedTable(table);
                      setDiscountValue(0);
                    }}
                    className={`bg-[#1c0f11] rounded-xl border-2 p-4 flex flex-col justify-between shadow-soft hover:border-[#baa47f]/30 transition cursor-pointer relative overflow-hidden ${
                      active ? "border-gold-500" : "border-[#361f22]"
                    }`}
                  >
                    <div>
                      <h3 className="text-base font-display font-extrabold text-white">
                        TABLE {table.number}
                      </h3>
                      <span className="text-[11px] font-bold text-zinc-400 block mt-1">
                        {sessionObj?.customerName}
                      </span>
                    </div>

                    <span className="text-[9px] text-zinc-550 block mt-3 font-semibold uppercase">
                      Pax {table.capacity} • {sessionObj?.phone || "No phone"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Invoice Summary & Checkout Form */}
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center pb-2 border-b border-[#361f22]">
            <h2 className="text-xs font-display font-extrabold text-zinc-400 uppercase tracking-wider">
              Settlement Ticket
            </h2>
          </div>

          {!selectedTable ? (
            <div className="bg-[#14080a] border border-[#251416] rounded-xl p-6 text-center text-zinc-550 h-80 flex flex-col items-center justify-center">
              <Receipt className="w-12 h-12 text-zinc-750 mb-2" />
              <span className="text-xs font-bold uppercase tracking-wider">Select an active table to compute settlement</span>
            </div>
          ) : !billingDetails ? (
            <div className="bg-[#14080a] border border-[#251416] rounded-xl p-6 text-center text-zinc-550 h-80 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-[#baa47f] mb-2" />
              <span className="text-xs font-bold uppercase tracking-wider">Computing order totals...</span>
            </div>
          ) : (
            <div className="bg-[#1c0f11] border border-[#361f22] rounded-xl p-5 flex flex-col gap-4 shadow-soft">
              {/* Table Info Header */}
              <div className="pb-3 border-b border-[#251416] flex justify-between items-start">
                <div>
                  <h3 className="text-sm font-extrabold text-white uppercase tracking-tight">Table {selectedTable.number} Settlement</h3>
                  <span className="text-[10px] text-zinc-450 uppercase font-semibold">Guest: {selectedTable.sessions[0]?.customerName}</span>
                </div>
                <span className="text-[10px] text-gold-400 font-mono font-bold bg-[#251416] px-2 py-0.5 rounded">
                  {activeOrder?.orderNumber || "TICKET"}
                </span>
              </div>

              {/* Items Summary list */}
              <div className="flex flex-col gap-2 max-h-36 overflow-y-auto divide-y divide-[#201011] pr-1">
                {activeOrder?.items.map((item: any) => (
                  <div key={item.id} className="pt-2 first:pt-0 flex justify-between text-xs">
                    <span className="text-zinc-300 font-medium">{item.name} <span className="text-zinc-500 font-mono font-bold">x{item.quantity}</span></span>
                    <span className="text-zinc-400 font-mono">₹{(item.price * item.quantity).toFixed(0)}</span>
                  </div>
                ))}
              </div>

              {/* Discounts Config Section */}
              <div className="pt-3 border-t border-[#251416] flex flex-col gap-2">
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Discounts & Offers</span>
                <div className="flex gap-2">
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as any)}
                    className="bg-[#14080a] border border-[#2d191b] text-zinc-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none"
                  >
                    <option value="PERCENTAGE">% Percent</option>
                    <option value="FLAT">Flat (₹)</option>
                  </select>
                  <input
                    type="number"
                    value={discountValue || ""}
                    onChange={(e) => setDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="Value..."
                    className="flex-1 bg-[#14080a] border border-[#2d191b] rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-700 focus:outline-none"
                  />
                </div>
              </div>

              {/* Billing Summary splits */}
              <div className="bg-[#14080a] p-3 rounded-lg border border-[#251416] flex flex-col gap-2 text-xs font-sans">
                <div className="flex justify-between text-zinc-450">
                  <span>Subtotal:</span>
                  <span className="font-mono">₹{billingDetails.subtotal.toFixed(2)}</span>
                </div>
                {billingDetails.discountAmount > 0 && (
                  <div className="flex justify-between text-red-400">
                    <span>Discount:</span>
                    <span className="font-mono">-₹{billingDetails.discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-zinc-450">
                  <span>GST ({billingDetails.gstRate}%):</span>
                  <span className="font-mono">₹{billingDetails.gstAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-zinc-450">
                  <span>Service Fee ({billingDetails.serviceChargeRate}%):</span>
                  <span className="font-mono">₹{billingDetails.serviceCharge.toFixed(2)}</span>
                </div>
                <div className="pt-2 border-t border-[#201011] flex justify-between font-extrabold text-sm text-white">
                  <span>Grand Total:</span>
                  <span className="font-mono text-gold-400">₹{billingDetails.finalAmount}</span>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="flex flex-col gap-2 pt-1">
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Payment Method</span>
                <div className="grid grid-cols-3 gap-2">
                  {["UPI", "CASH", "CARD"].map((m: any) => {
                    const selected = paymentMethod === m;
                    return (
                      <button
                        key={m}
                        onClick={() => setPaymentMethod(m)}
                        className={`py-2 rounded-lg text-xs font-bold border transition cursor-pointer ${
                          selected
                            ? "bg-gold-500/10 border-gold-500 text-gold-300"
                            : "bg-[#14080a] border-[#2d191b] text-zinc-400 hover:text-white"
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Settle Checkout button */}
              <button
                onClick={handleSettlePayment}
                disabled={isSettling}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-1.5 transition cursor-pointer mt-2"
              >
                {isSettling ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                Settle & Print Receipt
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
