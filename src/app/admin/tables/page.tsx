"use client";

import React, { useEffect, useState, useMemo } from "react";
import { io } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Smartphone,
  Plus,
  Trash2,
  Edit3,
  Loader2,
  AlertTriangle,
  Printer,
  Download,
  CheckCircle,
  XCircle,
  User,
  Coffee,
  X,
  CreditCard,
  Maximize2
} from "lucide-react";
import {
  getAdminDashboardData,
  createAdminTable,
  deleteAdminTable,
  renameAdminTable,
  getAdminStaff,
  assignWaiterToTable
} from "@/actions/admin";
import { authClient } from "@/lib/auth-client";

export default function AdminTablesPage() {
  // Data State
  const [tables, setTables] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [adminUserId, setAdminUserId] = useState<string>("");

  // Create Table Form States
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newTableNumber, setNewTableNumber] = useState<string>("");
  const [newTableCapacity, setNewTableCapacity] = useState<string>("4");
  const [isSubmittingTable, setIsSubmittingTable] = useState<boolean>(false);

  // Inspect QR / Detail Modal States
  const [selectedTableForQR, setSelectedTableForQR] = useState<any | null>(null);
  const [showQRModal, setShowQRModal] = useState<boolean>(false);

  // Rename Table States
  const [renamingTableId, setRenamingTableId] = useState<string | null>(null);
  const [renameNumberValue, setRenameNumberValue] = useState<string>("");

  // Assign Waiter States
  const [assigningTableId, setAssigningTableId] = useState<string | null>(null);
  const [selectedWaiterId, setSelectedWaiterId] = useState<string>("");

  // Fetch Session User ID
  useEffect(() => {
    async function loadUser() {
      const { data } = await authClient.getSession();
      if (data?.user) {
        setAdminUserId(data.user.id);
      }
    }
    loadUser();
  }, []);

  const loadData = async () => {
    try {
      const res = await getAdminDashboardData();
      const staffRes = await getAdminStaff();

      const dataRes = res as any;
      if (dataRes.success && dataRes.tables) {
        setTables(dataRes.tables);
        setError(null);
      } else {
        setError(dataRes.error || "Failed to load restaurant tables.");
      }

      if (staffRes.success && staffRes.staff) {
        setStaff(staffRes.staff);
      }
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred loading tables list.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Socket syncing for table status
  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
    const socket = io(socketUrl, { reconnectionAttempts: 3, timeout: 2000 });

    socket.on("connect", () => {
      socket.emit("admin-connected");
    });

    const handleEventTrigger = () => {
      loadData();
    };

    socket.on("table-closed", handleEventTrigger);
    socket.on("order-new", handleEventTrigger);
    socket.on("order-served", handleEventTrigger);
    socket.on("payment-completed", handleEventTrigger);

    return () => {
      socket.disconnect();
    };
  }, []);

  // Actions
  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableNumber || !newTableCapacity || !adminUserId) return;
    setIsSubmittingTable(true);

    try {
      const res = await createAdminTable(
        parseInt(newTableNumber),
        parseInt(newTableCapacity),
        adminUserId
      );

      if (res.success) {
        setShowCreateModal(false);
        setNewTableNumber("");
        loadData();
      } else {
        alert(res.error || "Failed to create table.");
      }
    } catch (err) {
      console.error(err);
      alert("Error adding table.");
    } finally {
      setIsSubmittingTable(false);
    }
  };

  const handleDeleteTable = async (tableId: string) => {
    const confirmDelete = confirm("Are you sure you want to delete this table? Guests will no longer be able to scan its QR code.");
    if (!confirmDelete) return;

    if (!adminUserId) return;
    try {
      const res = await deleteAdminTable(tableId, adminUserId);
      if (res.success) {
        loadData();
      } else {
        alert(res.error || "Failed to delete table.");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting table.");
    }
  };

  const handleRenameSubmit = async (tableId: string) => {
    if (!renameNumberValue || !adminUserId) return;
    try {
      const res = await renameAdminTable(tableId, parseInt(renameNumberValue), adminUserId);
      if (res.success) {
        setRenamingTableId(null);
        setRenameNumberValue("");
        loadData();
      } else {
        alert(res.error || "Failed to rename table.");
      }
    } catch (err) {
      console.error(err);
      alert("Error renaming table.");
    }
  };

  const handleAssignWaiterSubmit = async (tableId: string) => {
    if (!selectedWaiterId || !adminUserId) return;
    try {
      const res = await assignWaiterToTable(tableId, selectedWaiterId, adminUserId);
      if (res.success) {
        setAssigningTableId(null);
        setSelectedWaiterId("");
        loadData();
      } else {
        alert(res.error || "Failed to assign waiter.");
      }
    } catch (err) {
      console.error(err);
      alert("Error assigning waiter.");
    }
  };

  const getQRImageUrl = (tableId: string) => {
    const hostUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const targetUrl = `${hostUrl}/table/${tableId}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(targetUrl)}`;
  };

  const handlePrintQR = (table: any) => {
    const imgUrl = getQRImageUrl(table.id);
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Print QR - Table ${table.number}</title>
          <style>
            body {
              font-family: sans-serif;
              text-align: center;
              padding: 40px;
            }
            .card {
              border: 3px solid #1a0f11;
              border-radius: 20px;
              padding: 30px;
              display: inline-block;
              max-width: 350px;
            }
            h1 {
              margin: 0 0 10px 0;
              color: #871b30;
              font-size: 28px;
            }
            p {
              margin: 0 0 25px 0;
              color: #666;
              font-size: 14px;
              letter-spacing: 1px;
              text-transform: uppercase;
            }
            img {
              width: 250px;
              height: 250px;
            }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div class="card">
            <h1>BIKAJI RESTAURANT</h1>
            <p>Scan to Order • Table ${table.number}</p>
            <img src="${imgUrl}" alt="QR code" />
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Waiters list filter
  const waiters = useMemo(() => {
    return staff.filter(s => s.role === "WAITER");
  }, [staff]);

  if (loading) {
    return (
      <div className="h-96 flex flex-col justify-center items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#baa47f]" />
        <span className="text-xs uppercase font-bold tracking-widest text-zinc-550">Loading floor plan...</span>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 flex flex-col gap-6 max-w-7xl mx-auto w-full">
      {/* Page Header */}
      <div className="flex justify-between items-center pb-2 border-b border-[#251416]">
        <div>
          <h1 className="text-lg font-display font-extrabold text-white tracking-tight uppercase">
            Tables & QR Codes
          </h1>
          <p className="text-[10px] text-zinc-450 uppercase tracking-widest font-bold mt-0.5">
            Configure restaurant dining tables and generate printable layout QR codes
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-primary hover:bg-[#871b30] border border-[#baa47f]/20 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer shadow-md"
        >
          <Plus className="w-4 h-4" /> Add Table
        </button>
      </div>

      {/* Tables Grid Layout */}
      {tables.length === 0 ? (
        <div className="h-60 flex flex-col justify-center items-center border border-dashed border-[#251416] rounded-xl text-center text-zinc-550 p-6">
          <Smartphone className="w-10 h-10 text-zinc-750 mb-2" />
          <h3 className="text-sm font-bold text-zinc-400">No tables active</h3>
          <p className="text-[10px]">Add your first restaurant table using the button above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {tables.map(table => {
            const hasActiveSession = table.sessions[0];
            const qrImageUrl = getQRImageUrl(table.id);

            return (
              <div
                key={table.id}
                className="bg-[#140b0c] border border-[#251416] rounded-xl p-4 flex flex-col gap-4 justify-between shadow-soft hover:border-[#baa47f]/25 transition"
              >
                <div>
                  <div className="flex justify-between items-start">
                    {renamingTableId === table.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={renameNumberValue}
                          onChange={(e) => setRenameNumberValue(e.target.value)}
                          placeholder={table.number.toString()}
                          className="w-16 bg-[#0d0506] border border-[#baa47f]/30 rounded px-2 py-1 text-xs text-white"
                        />
                        <button
                          onClick={() => handleRenameSubmit(table.id)}
                          className="px-2 py-1 bg-emerald-600 rounded text-[10px] font-bold"
                        >
                          OK
                        </button>
                        <button
                          onClick={() => setRenamingTableId(null)}
                          className="px-2 py-1 bg-zinc-800 rounded text-[10px] font-bold text-zinc-450"
                        >
                          X
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-base font-display font-extrabold text-white">
                          Table {table.number}
                        </h3>
                        <button
                          onClick={() => {
                            setRenamingTableId(table.id);
                            setRenameNumberValue(table.number.toString());
                          }}
                          className="p-1 text-zinc-500 hover:text-[#baa47f]"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    <span className="text-[9px] bg-zinc-950 border border-zinc-850 text-zinc-500 px-2 py-0.5 rounded-full font-bold">
                      Seats: {table.capacity}
                    </span>
                  </div>

                  {/* QR Image View block */}
                  <div className="mt-4 flex items-center justify-center p-3 bg-white rounded-lg border border-[#251416] w-full aspect-square relative group overflow-hidden">
                    <img
                      src={qrImageUrl}
                      alt={`Table ${table.number} QR`}
                      className="w-full h-full object-contain"
                    />
                    
                    {/* Hover enlarge button */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <button
                        onClick={() => {
                          setSelectedTableForQR(table);
                          setShowQRModal(true);
                        }}
                        className="p-2 bg-[#1c0f11] border border-[#baa47f]/30 text-[#baa47f] hover:text-white rounded-lg flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                      >
                        <Maximize2 className="w-4.5 h-4.5" /> Preview Code
                      </button>
                    </div>
                  </div>
                </div>

                {/* Waiter assignment / Operational Status indicator */}
                <div className="flex flex-col gap-2 pt-3 border-t border-[#201011]">
                  <div className="flex justify-between items-center text-xs text-zinc-400">
                    <span className="text-[10px] text-zinc-550 uppercase font-bold tracking-wider">Waiter:</span>
                    {assigningTableId === table.id ? (
                      <div className="flex items-center gap-1 w-full max-w-[150px]">
                        <select
                          value={selectedWaiterId}
                          onChange={(e) => setSelectedWaiterId(e.target.value)}
                          className="bg-[#0d0506] border border-[#baa47f]/20 rounded text-[9px] px-1 py-1 text-zinc-350 w-full"
                        >
                          <option value="">Select...</option>
                          {waiters.map(w => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleAssignWaiterSubmit(table.id)}
                          className="px-1.5 py-1 bg-emerald-600 rounded text-[9px] font-bold text-white"
                        >
                          ✓
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAssigningTableId(table.id)}
                        className="text-[#baa47f] font-semibold hover:underline text-[11px]"
                      >
                        {table.waiters?.[0]?.waiter?.user?.name || "Assign Waiter"}
                      </button>
                    )}
                  </div>

                  <div className="flex gap-2.5 mt-1 justify-between">
                    <button
                      onClick={() => handlePrintQR(table)}
                      className="flex-1 py-2 bg-[#201011] hover:bg-[#2c1719] border border-[#2d191b] rounded text-[10px] font-bold text-zinc-300 transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" /> Print
                    </button>
                    <button
                      onClick={() => handleDeleteTable(table.id)}
                      className="p-2 bg-red-950/20 border border-red-500/20 hover:bg-red-900/10 text-red-400 rounded transition cursor-pointer"
                      title="Delete Table"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DIALOG 1: CREATE TABLE MODAL */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#140b0c] border border-[#2d191b] rounded-xl p-6 w-full max-w-sm shadow-modal flex flex-col gap-4"
            >
              <div className="flex justify-between items-center pb-2 border-b border-[#2d191b]">
                <h3 className="font-display font-extrabold text-sm uppercase tracking-wider text-white">
                  Add Table details
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="w-6 h-6 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateTable} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-zinc-450 font-bold uppercase tracking-wider">Table Number</label>
                  <input
                    type="number"
                    value={newTableNumber}
                    onChange={(e) => setNewTableNumber(e.target.value)}
                    placeholder="e.g. 9"
                    className="w-full bg-[#0d0506] border border-[#2d191b] rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-700 focus:outline-none"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-zinc-450 font-bold uppercase tracking-wider">Seating Capacity</label>
                  <input
                    type="number"
                    value={newTableCapacity}
                    onChange={(e) => setNewTableCapacity(e.target.value)}
                    placeholder="e.g. 4"
                    className="w-full bg-[#0d0506] border border-[#2d191b] rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-700 focus:outline-none"
                    required
                  />
                </div>

                <div className="flex gap-2.5 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-2.5 rounded-lg border border-[#2d191b] text-[#baa47f] hover:text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingTable}
                    className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold uppercase tracking-wider cursor-pointer shadow-md flex items-center justify-center gap-1"
                  >
                    {isSubmittingTable ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Create Table
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DIALOG 2: QR PREVIEW MODAL */}
      <AnimatePresence>
        {showQRModal && selectedTableForQR && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#140b0c] border border-[#2d191b] rounded-xl p-6 w-full max-w-sm shadow-modal flex flex-col gap-4 text-center items-center"
            >
              <div className="flex justify-between items-center w-full pb-2 border-b border-[#2d191b]">
                <h3 className="font-display font-extrabold text-sm uppercase tracking-wider text-white">
                  Table {selectedTableForQR.number} QR Code
                </h3>
                <button
                  onClick={() => setShowQRModal(false)}
                  className="w-6 h-6 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* QR Image Box */}
              <div className="p-4 bg-white rounded-xl border border-zinc-250 mt-2">
                <img
                  src={getQRImageUrl(selectedTableForQR.id)}
                  alt="Printable QR Code"
                  className="w-60 h-60 object-contain"
                />
              </div>

              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mt-1">
                Scan to place order instantly
              </span>

              <div className="flex gap-2.5 w-full mt-4">
                <button
                  onClick={() => handlePrintQR(selectedTableForQR)}
                  className="flex-1 py-2.5 bg-[#201011] hover:bg-[#2c1719] border border-[#2d191b] rounded-lg text-xs font-bold text-zinc-200 transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> Print QR
                </button>
                <a
                  href={getQRImageUrl(selectedTableForQR.id)}
                  download={`table-${selectedTableForQR.number}-qr.png`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-extrabold uppercase tracking-wider transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Download className="w-4 h-4" /> Download
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
