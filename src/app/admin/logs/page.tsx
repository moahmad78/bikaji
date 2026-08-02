"use client";

import React, { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  History,
  Search,
  Loader2,
  AlertTriangle,
  Clock,
  User,
  Shield,
  Activity,
  ArrowRight,
  Database
} from "lucide-react";
import { getAdminLogs } from "@/actions/admin";

export default function AdminLogsPage() {
  // Data State
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter State
  const [searchQuery, setSearchQuery] = useState<string>("");

  const loadLogs = async () => {
    try {
      const res = await getAdminLogs();
      if (res.success && res.logs) {
        setLogs(res.logs);
        setError(null);
      } else {
        setError(res.error || "Failed to load audit logs.");
      }
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred loading logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const query = searchQuery.toLowerCase();
      const matchesAction = log.action.toLowerCase().includes(query);
      const matchesDetails = log.details?.toLowerCase().includes(query) || false;
      const matchesUser = log.user?.name?.toLowerCase().includes(query) || false;
      return matchesAction || matchesDetails || matchesUser;
    });
  }, [logs, searchQuery]);

  if (loading) {
    return (
      <div className="h-96 flex flex-col justify-center items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#baa47f]" />
        <span className="text-xs uppercase font-bold tracking-widest text-zinc-555">Loading audit trail...</span>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 flex flex-col gap-6 max-w-7xl mx-auto w-full">
      {/* Page Header */}
      <div className="flex justify-between items-center pb-2 border-b border-[#251416]">
        <div>
          <h1 className="text-lg font-display font-extrabold text-white tracking-tight uppercase">
            Audit Logs
          </h1>
          <p className="text-[10px] text-zinc-450 uppercase tracking-widest font-bold mt-0.5">
            Compliance and activity history tracker for restaurant management operations
          </p>
        </div>
      </div>

      {/* Filter and Search Box */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-[#140b0c] p-3 border border-[#251416] rounded-xl shadow-soft">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-zinc-650 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by action, details, or employee name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0d0506] border border-[#2d191b] rounded-lg pl-9 pr-4 py-2.5 text-xs text-white placeholder-zinc-750 focus:outline-none"
          />
        </div>

        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider hidden md:inline-block">
          Tracking: Last 50 Events
        </span>
      </div>

      {error ? (
        <div className="p-8 text-center flex flex-col items-center justify-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mb-3" />
          <h2 className="text-lg font-bold">Failed to load logs</h2>
          <p className="text-xs text-zinc-455 mt-1">{error}</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="h-60 flex flex-col justify-center items-center border border-dashed border-[#251416] rounded-xl text-center text-zinc-550 p-6">
          <History className="w-10 h-10 text-zinc-750 mb-2" />
          <h3 className="text-sm font-bold text-zinc-400">No logs registered</h3>
          <p className="text-[10px]">Administrative actions will log entries here automatically.</p>
        </div>
      ) : (
        <div className="bg-[#140b0c] border border-[#251416] rounded-xl overflow-hidden shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#201011] border-b border-[#251416] text-[10px] text-zinc-450 uppercase tracking-widest font-extrabold">
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Action Type</th>
                  <th className="px-6 py-4">Description details</th>
                  <th className="px-6 py-4">IP Address</th>
                  <th className="px-6 py-4 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#201011] text-zinc-300">
                {filteredLogs.map(log => {
                  const isSystem = !log.user;
                  const isRoleUpdate = log.action.includes("ROLE");

                  return (
                    <tr key={log.id} className="hover:bg-[#1c0e10]/40 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-zinc-950 border border-zinc-850 flex items-center justify-center shrink-0">
                            {isSystem ? (
                              <Database className="w-3 h-3 text-gold-550" />
                            ) : (
                              <User className="w-3 h-3 text-zinc-400" />
                            )}
                          </div>
                          <span className="font-extrabold text-white truncate max-w-[120px]">
                            {log.user?.name || "System Cron"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[8px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                          isRoleUpdate
                            ? "bg-purple-500/10 border-purple-500/30 text-purple-400"
                            : log.action.includes("CREATE")
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                            : log.action.includes("DELETE") || log.action.includes("VOID") || log.action.includes("CANCEL")
                            ? "bg-red-500/10 border-red-500/30 text-red-400 animate-pulse"
                            : "bg-zinc-800 border-zinc-700 text-zinc-400"
                        }`}>
                          {log.action.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-zinc-300 leading-normal max-w-xs truncate">
                        {log.details || "Activity logged successfully."}
                      </td>
                      <td className="px-6 py-4 font-mono text-[10px] text-zinc-550">
                        {log.ipAddress || "127.0.0.1"}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-zinc-500 text-[10px]">
                        {new Date(log.createdAt).toLocaleString([], { hour12: false })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
