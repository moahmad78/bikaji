"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Users,
  UserCheck,
  Shield,
  Loader2,
  AlertTriangle,
  Utensils,
  BookOpen,
  Mail,
  Clock,
  Briefcase
} from "lucide-react";
import { getAdminStaff, updateStaffRole } from "@/actions/admin";
import { authClient } from "@/lib/auth-client";

export default function AdminStaffPage() {
  // Data State
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [adminUserId, setAdminUserId] = useState<string>("");
  const [isProcessingRoleChange, setIsProcessingRoleChange] = useState<boolean>(false);

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

  const loadStaff = async () => {
    try {
      const res = await getAdminStaff();
      if (res.success && res.staff) {
        setStaff(res.staff);
        setError(null);
      } else {
        setError(res.error || "Failed to load staff members.");
      }
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred loading staff list.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  // Action: Promote/Demote Role
  const handleRoleChange = async (userId: string, newRole: string) => {
    const confirmChange = confirm(`Are you sure you want to change this staff member's role to ${newRole}?`);
    if (!confirmChange) return;

    if (!adminUserId) return;
    setIsProcessingRoleChange(true);

    try {
      const res = await updateStaffRole(userId, newRole as any, adminUserId);
      if (res.success) {
        alert("Role updated successfully.");
        loadStaff();
      } else {
        alert(res.error || "Failed to change role.");
      }
    } catch (err) {
      console.error(err);
      alert("Error processing role assignment.");
    } finally {
      setIsProcessingRoleChange(false);
    }
  };

  if (loading) {
    return (
      <div className="h-96 flex flex-col justify-center items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#baa47f]" />
        <span className="text-xs uppercase font-bold tracking-widest text-zinc-555">Loading staff profiles...</span>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 flex flex-col gap-6 max-w-7xl mx-auto w-full">
      {/* Page Header */}
      <div className="flex justify-between items-center pb-2 border-b border-[#251416]">
        <div>
          <h1 className="text-lg font-display font-extrabold text-white tracking-tight uppercase">
            Staff Members
          </h1>
          <p className="text-[10px] text-zinc-450 uppercase tracking-widest font-bold mt-0.5">
            Manage roles and availability details for waitstaff and kitchen crews
          </p>
        </div>
      </div>

      {error ? (
        <div className="p-8 text-center flex flex-col items-center justify-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mb-3" />
          <h2 className="text-lg font-bold">Failed to load staff list</h2>
          <p className="text-xs text-zinc-450 max-w-xs mt-1">{error}</p>
        </div>
      ) : staff.length === 0 ? (
        <div className="h-60 flex flex-col justify-center items-center border border-dashed border-[#251416] rounded-xl text-center text-zinc-550 p-6">
          <Users className="w-10 h-10 text-zinc-750 mb-2" />
          <h3 className="text-sm font-bold text-zinc-400">No staff members registered</h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {staff.map(member => {
            const isSelf = member.id === adminUserId;
            
            return (
              <div
                key={member.id}
                className="bg-[#140b0c] border border-[#251416] rounded-xl p-5 flex flex-col justify-between gap-5 shadow-soft hover:border-[#baa47f]/25 transition"
              >
                {/* Profile Header info */}
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-full bg-zinc-900 border border-zinc-850 flex items-center justify-center text-gold-550 shrink-0">
                    {member.role === "ADMIN" ? (
                      <Shield className="w-5.5 h-5.5 text-[#baa47f]" />
                    ) : member.role === "KITCHEN" ? (
                      <Utensils className="w-5.5 h-5.5 text-blue-400" />
                    ) : (
                      <Briefcase className="w-5.5 h-5.5 text-emerald-400" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-extrabold text-sm text-white truncate max-w-[120px]">
                        {member.name}
                      </h3>
                      {isSelf && (
                        <span className="text-[8px] bg-zinc-950 border border-zinc-850 text-zinc-500 px-1.5 py-0.5 rounded font-extrabold tracking-wider">
                          YOU
                        </span>
                      )}
                    </div>

                    <span className="text-[10px] text-zinc-450 flex items-center gap-1 mt-1 truncate">
                      <Mail className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                      {member.email}
                    </span>

                    <span className="text-[9px] text-zinc-550 font-bold block uppercase tracking-wider mt-1.5">
                      {member.role === "WAITER" 
                        ? `Staff ID: ${member.waiterProfile?.employeeId || "WT-101"}`
                        : member.role === "KITCHEN"
                        ? "Kitchen Chef / Cook"
                        : "Branch Administrator"
                      }
                    </span>
                  </div>
                </div>

                {/* Waiter Performance Stats Panel */}
                {member.role === "WAITER" && member.performance && (
                  <div className="bg-[#0b0506] border border-[#251416] p-3 rounded-lg flex flex-col gap-2 my-1">
                    <span className="text-[9px] font-extrabold text-[#baa47f] uppercase tracking-widest block">
                      🚀 Today's Delivery Performance
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-[#180c0e] p-2 rounded border border-[#2d181b]">
                        <span className="text-[8px] text-zinc-450 uppercase block font-bold">Delivered Today</span>
                        <span className="text-sm font-extrabold text-emerald-400">{member.performance.ordersDeliveredToday} orders</span>
                      </div>
                      <div className="bg-[#180c0e] p-2 rounded border border-[#2d181b]">
                        <span className="text-[8px] text-zinc-450 uppercase block font-bold">Tables Served</span>
                        <span className="text-sm font-extrabold text-blue-400">{member.performance.tablesServedToday} tables</span>
                      </div>
                      <div className="bg-[#180c0e] p-2 rounded border border-[#2d181b]">
                        <span className="text-[8px] text-zinc-450 uppercase block font-bold">Avg Delivery Time</span>
                        <span className="text-xs font-extrabold font-mono text-amber-400">
                          {member.performance.avgDeliveryTimeSeconds > 0
                            ? `${Math.floor(member.performance.avgDeliveryTimeSeconds / 60)}m ${member.performance.avgDeliveryTimeSeconds % 60}s`
                            : "N/A"}
                        </span>
                      </div>
                      <div className="bg-[#180c0e] p-2 rounded border border-[#2d181b]">
                        <span className="text-[8px] text-zinc-450 uppercase block font-bold">Active Deliveries</span>
                        <span className="text-xs font-extrabold text-purple-400">{member.performance.activeDeliveriesCount} in transit</span>
                      </div>
                    </div>
                    {member.performance.lastDeliveryTime && (
                      <span className="text-[9px] text-zinc-500 font-medium block">
                        Last Delivery: {new Date(member.performance.lastDeliveryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                )}

                {/* Role Switcher Controls */}
                <div className="flex justify-between items-center border-t border-[#201011] pt-3 mt-1 gap-2">
                  <span className="text-[10px] text-zinc-550 font-bold uppercase tracking-wider">
                    Assigned Role:
                  </span>
                  
                  {isSelf ? (
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      {member.role}
                    </span>
                  ) : (
                    <select
                      value={member.role}
                      disabled={isProcessingRoleChange}
                      onChange={(e) => handleRoleChange(member.id, e.target.value)}
                      className="bg-zinc-950 border border-zinc-850 text-zinc-350 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer"
                    >
                      <option value="WAITER">Waiter</option>
                      <option value="KITCHEN">Kitchen Staff</option>
                      <option value="ADMIN">Administrator</option>
                    </select>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
