"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Search, Loader2, User, Clock, ChevronRight, X, Receipt } from "lucide-react";
import { getAdminCustomers } from "@/actions/admin-customers";

export default function AdminCustomersPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedGuest, setSelectedGuest] = useState<any | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const res = await getAdminCustomers();
    if (res.success) {
      setSessions(res.sessions || []);
      setUsers(res.users || []);
    } else {
      alert("Failed to load customers.");
    }
    setLoading(false);
  };

  const filteredSessions = useMemo(() => {
    return sessions.filter((s: any) => {
      const q = searchQuery.toLowerCase();
      return (
        s.customerName?.toLowerCase().includes(q) ||
        s.token?.toLowerCase().includes(q) ||
        s.table?.name?.toLowerCase().includes(q) ||
        s.orders?.some((o: any) => o.orderNumber.toLowerCase().includes(q))
      );
    });
  }, [sessions, searchQuery]);

  if (loading) {
    return (
      <div className="h-96 flex flex-col justify-center items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#baa47f]" />
        <span className="text-xs uppercase font-bold tracking-widest text-zinc-550">Loading guests...</span>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 flex flex-col gap-6 max-w-7xl mx-auto w-full h-[calc(100vh-64px)] overflow-hidden">
      <div className="flex justify-between items-center pb-2 border-b border-[#251416] flex-shrink-0">
        <div>
          <h1 className="text-lg font-display font-extrabold text-white tracking-tight uppercase">
            Customers & Guests
          </h1>
          <p className="text-[10px] text-zinc-450 uppercase tracking-widest font-bold mt-0.5">
            Manage customer sessions and order history
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-[#140b0c] p-3 border border-[#251416] rounded-xl shadow-soft flex-shrink-0">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-zinc-600 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Guest Name, Order ID, or Table..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0d0506] border border-[#2d191b] rounded-lg pl-9 pr-4 py-2.5 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-[#4d2a2f]"
          />
        </div>
      </div>

      <div className="flex gap-6 h-full overflow-hidden pb-4">
        {/* Left Side: Guest List */}
        <div className={`flex-1 flex flex-col bg-[#140b0c] border border-[#251416] rounded-xl overflow-hidden ${selectedGuest ? 'hidden lg:flex' : 'flex'}`}>
          <div className="flex-1 overflow-y-auto overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead className="bg-[#1a0f10] border-b border-[#251416] sticky top-0 z-10">
                <tr>
                  <th className="py-3 px-4 text-[10px] uppercase tracking-widest text-zinc-550 font-bold whitespace-nowrap">Guest</th>
                  <th className="py-3 px-4 text-[10px] uppercase tracking-widest text-zinc-550 font-bold whitespace-nowrap">Table</th>
                  <th className="py-3 px-4 text-[10px] uppercase tracking-widest text-zinc-550 font-bold whitespace-nowrap">Status</th>
                  <th className="py-3 px-4 text-[10px] uppercase tracking-widest text-zinc-550 font-bold whitespace-nowrap">Orders</th>
                  <th className="py-3 px-4 text-[10px] uppercase tracking-widest text-zinc-550 font-bold text-right whitespace-nowrap">Total Spent</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.map((session: any) => {
                  const totalSpent = session.orders?.reduce((acc: number, o: any) => acc + (o.finalAmount || 0), 0) || 0;
                  return (
                    <tr 
                      key={session.id}
                      onClick={() => setSelectedGuest(session)}
                      className={`border-b border-[#251416]/50 hover:bg-[#1a0f10] transition-colors cursor-pointer ${selectedGuest?.id === session.id ? 'bg-[#1a0f10]' : ''}`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#1e1113] border border-[#2d191b] flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-[#baa47f]" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white whitespace-nowrap">{session.customerName}</div>
                            <div className="text-[10px] text-zinc-500 font-mono mt-0.5 truncate max-w-[120px]">{session.token.substring(0, 16)}...</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-white whitespace-nowrap">
                        {session.table?.name || "Unknown Table"}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {session.isActive ? (
                          <span className="inline-block px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 text-[10px] font-bold tracking-wider uppercase border border-green-500/20">Active</span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[10px] font-bold tracking-wider uppercase border border-zinc-700">Ended</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-white whitespace-nowrap">
                        {session.orders?.length || 0}
                      </td>
                      <td className="py-3 px-4 text-xs font-bold text-[#baa47f] text-right whitespace-nowrap">
                        ₹{totalSpent.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <ChevronRight className="w-4 h-4 text-zinc-600 inline-block" />
                      </td>
                    </tr>
                  );
                })}
                {filteredSessions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <div className="flex flex-col justify-center items-center text-zinc-550">
                        <User className="w-10 h-10 text-zinc-750 mb-2" />
                        <h3 className="text-sm font-bold text-zinc-400">No guests found</h3>
                        <p className="text-[10px]">No sessions match the specified filters.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side: Guest Details Panel */}
        {selectedGuest && (
          <div className="w-full lg:w-[400px] xl:w-[450px] bg-[#140b0c] border border-[#251416] rounded-xl flex flex-col flex-shrink-0 h-full overflow-hidden shadow-modal">
            {/* Panel Header */}
            <div className="bg-[#1a0f10] border-b border-[#251416] p-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#1e1113] border border-[#2d191b] flex items-center justify-center">
                  <User className="w-5 h-5 text-[#baa47f]" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">{selectedGuest.customerName}</h2>
                  <div className="text-[10px] text-zinc-500 font-mono mt-0.5">{selectedGuest.token}</div>
                </div>
              </div>
              <button 
                onClick={() => setSelectedGuest(null)}
                className="w-8 h-8 rounded-full bg-[#1e1113] border border-[#2d191b] flex items-center justify-center hover:bg-[#251416] transition-colors"
              >
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

            {/* Panel Body */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-[#0d0506] border border-[#2d191b] rounded-lg p-3">
                  <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold mb-1">Table</div>
                  <div className="text-xs text-white font-medium">{selectedGuest.table?.name || "N/A"}</div>
                </div>
                <div className="bg-[#0d0506] border border-[#2d191b] rounded-lg p-3">
                  <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold mb-1">Status</div>
                  <div className="text-xs font-medium">
                    {selectedGuest.isActive ? (
                      <span className="text-green-500">Currently Active</span>
                    ) : (
                      <span className="text-zinc-500">Session Ended</span>
                    )}
                  </div>
                </div>
                <div className="bg-[#0d0506] border border-[#2d191b] rounded-lg p-3">
                  <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold mb-1">Total Orders</div>
                  <div className="text-xs text-white font-medium">{selectedGuest.orders?.length || 0}</div>
                </div>
                <div className="bg-[#0d0506] border border-[#2d191b] rounded-lg p-3">
                  <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold mb-1">Total Spent</div>
                  <div className="text-xs text-[#baa47f] font-bold">
                    ₹{(selectedGuest.orders?.reduce((acc: number, o: any) => acc + (o.finalAmount || 0), 0) || 0).toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <Receipt className="w-4 h-4 text-zinc-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-widest">Order History</h3>
              </div>

              <div className="flex flex-col gap-3">
                {selectedGuest.orders?.map((order: any) => (
                  <div key={order.id} className="bg-[#0d0506] border border-[#2d191b] rounded-xl p-4 relative overflow-hidden">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="text-xs font-bold text-white font-mono tracking-wider">{order.orderNumber}</div>
                        <div className="text-[10px] text-zinc-500 mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(order.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-[#baa47f]">₹{order.finalAmount.toFixed(2)}</div>
                        <div className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest mt-0.5">{order.status}</div>
                      </div>
                    </div>

                    <div className="border-t border-[#251416] pt-3 flex flex-col gap-2">
                      {order.items?.map((item: any) => (
                        <div key={item.id} className="flex justify-between items-start">
                          <div className="flex items-start gap-2">
                            <div className="text-[10px] font-bold text-zinc-400 bg-[#1e1113] px-1.5 py-0.5 rounded border border-[#2d191b]">
                              {item.quantity}x
                            </div>
                            <div>
                              <div className="text-[11px] text-zinc-300 font-medium">{item.name}</div>
                              {item.modifiers?.length > 0 && (
                                <div className="text-[9px] text-zinc-500 mt-0.5">
                                  + {item.modifiers.map((m: any) => m.name).join(", ")}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-[11px] text-zinc-400">
                            ₹{(item.price * item.quantity).toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                
                {(!selectedGuest.orders || selectedGuest.orders.length === 0) && (
                  <div className="text-center py-6 text-zinc-500 text-[10px] uppercase tracking-widest font-bold">
                    No orders placed yet
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
