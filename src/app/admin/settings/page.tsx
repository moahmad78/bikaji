"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Settings,
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileText,
  Percent,
  Image as ImageIcon,
  Phone,
  MapPin,
  Save
} from "lucide-react";
import { getAdminSettingsData, updateAdminSettingsData } from "@/actions/admin";
import { authClient } from "@/lib/auth-client";

export default function AdminSettingsPage() {
  // Data State
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [adminUserId, setAdminUserId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showSuccessToast, setShowSuccessToast] = useState<boolean>(false);

  // Form States
  const [name, setName] = useState<string>("");
  const [logo, setLogo] = useState<string>("");
  const [gstRate, setGstRate] = useState<string>("5.0");
  const [serviceChargeRate, setServiceChargeRate] = useState<string>("5.0");
  const [address, setAddress] = useState<string>("");
  const [phone, setPhone] = useState<string>("");

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

  const loadSettings = async () => {
    try {
      const res = await getAdminSettingsData();
      if (res.success && res.settings) {
        setSettings(res.settings);
        setName(res.settings.name);
        setLogo(res.settings.logo || "");
        setGstRate(res.settings.gstRate.toString());
        setServiceChargeRate(res.settings.serviceChargeRate.toString());
        setAddress(res.settings.address || "");
        setPhone(res.settings.phone || "");
        setError(null);
      } else {
        setError(res.error || "Failed to load settings.");
      }
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred loading settings data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  // Action: Save Form Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !gstRate || !serviceChargeRate || !adminUserId || !settings) return;
    setIsSubmitting(true);
    setShowSuccessToast(false);

    try {
      const res = await updateAdminSettingsData({
        id: settings.id,
        restaurantId: settings.restaurantId,
        name,
        logo,
        gstRate: parseFloat(gstRate),
        serviceChargeRate: parseFloat(serviceChargeRate),
        address,
        phone
      }, adminUserId);

      if (res.success) {
        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 3000);
        loadSettings();
      } else {
        alert(res.error || "Failed to update restaurant settings.");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving settings.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-96 flex flex-col justify-center items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#baa47f]" />
        <span className="text-xs uppercase font-bold tracking-widest text-zinc-555">Loading settings panel...</span>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 flex flex-col gap-6 max-w-2xl mx-auto w-full">
      {/* Page Header */}
      <div className="flex justify-between items-center pb-2 border-b border-[#251416]">
        <div>
          <h1 className="text-lg font-display font-extrabold text-white tracking-tight uppercase">
            Restaurant Settings
          </h1>
          <p className="text-[10px] text-zinc-455 uppercase tracking-widest font-bold mt-0.5">
            Configure restaurant information, taxes, and service charge rates
          </p>
        </div>
      </div>

      {showSuccessToast && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-center gap-2 animate-pulse">
          <CheckCircle className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
          <span>Restaurant settings updated successfully!</span>
        </div>
      )}

      {error ? (
        <div className="p-8 text-center flex flex-col items-center justify-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mb-3" />
          <h2 className="text-lg font-bold">Settings loading error</h2>
          <p className="text-xs text-zinc-450 max-w-xs mt-1">{error}</p>
        </div>
      ) : (
        <form onSubmit={handleSaveSettings} className="bg-[#140b0c] border border-[#251416] rounded-xl p-6 shadow-soft flex flex-col gap-5">
          {/* General settings */}
          <div className="flex flex-col gap-4">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-[#201011] pb-1.5 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-gold-550" /> Brand Identity
            </h3>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-450 font-bold uppercase tracking-wider">Restaurant Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Bikaji Premium Dining"
                className="w-full bg-[#0d0506] border border-[#2d191b] rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-700 focus:outline-none"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-450 font-bold uppercase tracking-wider">Logo URL</label>
              <div className="relative">
                <ImageIcon className="w-4 h-4 text-zinc-550 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={logo}
                  onChange={(e) => setLogo(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="w-full bg-[#0d0506] border border-[#2d191b] rounded-lg pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-700 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Contact settings */}
          <div className="flex flex-col gap-4 pt-2">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-[#201011] pb-1.5 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-blue-400" /> Branch Location details
            </h3>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-450 font-bold uppercase tracking-wider">Branch Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Sector-5, Saltlake, Kolkata"
                className="w-full bg-[#0d0506] border border-[#2d191b] rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-700 focus:outline-none"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-450 font-bold uppercase tracking-wider">Contact Phone</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-zinc-555 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  className="w-full bg-[#0d0506] border border-[#2d191b] rounded-lg pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-700 focus:outline-none"
                  required
                />
              </div>
            </div>
          </div>

          {/* Taxation & Charges */}
          <div className="flex flex-col gap-4 pt-2">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-[#201011] pb-1.5 flex items-center gap-1.5">
              <Percent className="w-4 h-4 text-purple-400" /> Taxation & Service Fees
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-zinc-450 font-bold uppercase tracking-wider">GST Rate (%)</label>
                <input
                  type="number"
                  value={gstRate}
                  onChange={(e) => setGstRate(e.target.value)}
                  placeholder="5.0"
                  step="0.1"
                  className="w-full bg-[#0d0506] border border-[#2d191b] rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-700 focus:outline-none"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-zinc-450 font-bold uppercase tracking-wider">Service Charge (%)</label>
                <input
                  type="number"
                  value={serviceChargeRate}
                  onChange={(e) => setServiceChargeRate(e.target.value)}
                  placeholder="5.0"
                  step="0.1"
                  className="w-full bg-[#0d0506] border border-[#2d191b] rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-700 focus:outline-none"
                  required
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="pt-4 border-t border-[#201011] flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-3 bg-primary hover:bg-[#871b30] text-white border border-[#baa47f]/20 text-xs font-extrabold uppercase tracking-wider rounded-lg transition shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 text-gold-300" />}
              Save Restaurant Configurations
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
