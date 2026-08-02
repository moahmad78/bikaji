"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tag,
  Plus,
  Trash2,
  Edit,
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  X,
  Percent,
  ToggleLeft,
  ToggleRight
} from "lucide-react";
import { getAdminCoupons, upsertAdminCoupon, deleteAdminCoupon } from "@/actions/admin";
import { authClient } from "@/lib/auth-client";

export default function AdminCouponsPage() {
  // Data State
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [adminUserId, setAdminUserId] = useState<string>("");

  // Create / Edit Coupon Modal States
  const [showUpsertModal, setShowUpsertModal] = useState<boolean>(false);
  const [isSubmittingCoupon, setIsSubmittingCoupon] = useState<boolean>(false);
  const [selectedCouponForEdit, setSelectedCouponForEdit] = useState<any | null>(null);

  // Form Field States
  const [couponCode, setCouponCode] = useState<string>("");
  const [couponDiscount, setCouponDiscount] = useState<string>("");
  const [couponMinOrder, setCouponMinOrder] = useState<string>("0");
  const [couponMaxDiscount, setCouponMaxDiscount] = useState<string>("");
  const [couponIsActive, setCouponIsActive] = useState<boolean>(true);

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

  const loadCoupons = async () => {
    try {
      const res = await getAdminCoupons();
      if (res.success && res.coupons) {
        setCoupons(res.coupons);
        setError(null);
      } else {
        setError(res.error || "Failed to load coupons.");
      }
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred loading coupon list.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCoupons();
  }, []);

  // Form triggers
  const openUpsertModal = (coupon?: any) => {
    if (coupon) {
      setSelectedCouponForEdit(coupon);
      setCouponCode(coupon.code);
      setCouponDiscount(coupon.discountPercent.toString());
      setCouponMinOrder(coupon.minOrderAmount.toString());
      setCouponMaxDiscount(coupon.maxDiscount ? coupon.maxDiscount.toString() : "");
      setCouponIsActive(coupon.isActive);
    } else {
      setSelectedCouponForEdit(null);
      setCouponCode("");
      setCouponDiscount("");
      setCouponMinOrder("0");
      setCouponMaxDiscount("");
      setCouponIsActive(true);
    }
    setShowUpsertModal(true);
  };

  // Actions
  const handleToggleActive = async (coupon: any) => {
    if (!adminUserId) return;
    
    // Optimistic UI update
    setCoupons(prev => prev.map(c => 
      c.id === coupon.id ? { ...c, isActive: !coupon.isActive } : c
    ));

    try {
      const res = await upsertAdminCoupon({
        id: coupon.id,
        code: coupon.code,
        discountPercent: coupon.discountPercent,
        minOrderAmount: coupon.minOrderAmount,
        maxDiscount: coupon.maxDiscount || undefined,
        isActive: !coupon.isActive
      }, adminUserId);

      if (!res.success) {
        loadCoupons();
        alert(res.error || "Failed to toggle coupon status.");
      }
    } catch (err) {
      console.error(err);
      loadCoupons();
      alert("Error saving coupon updates.");
    }
  };

  const handleUpsertCouponSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode || !couponDiscount || !adminUserId) return;
    setIsSubmittingCoupon(true);

    try {
      const res = await upsertAdminCoupon({
        id: selectedCouponForEdit?.id,
        code: couponCode,
        discountPercent: parseFloat(couponDiscount),
        minOrderAmount: parseFloat(couponMinOrder),
        maxDiscount: couponMaxDiscount ? parseFloat(couponMaxDiscount) : undefined,
        isActive: couponIsActive
      }, adminUserId);

      if (res.success) {
        setShowUpsertModal(false);
        loadCoupons();
      } else {
        alert(res.error || "Failed to save coupon.");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving coupon.");
    } finally {
      setIsSubmittingCoupon(false);
    }
  };

  const handleDeleteCoupon = async (couponId: string) => {
    const confirmDelete = confirm("Are you sure you want to delete this coupon? Existing active carts using it will fail to checkout.");
    if (!confirmDelete) return;

    if (!adminUserId) return;
    try {
      const res = await deleteAdminCoupon(couponId, adminUserId);
      if (res.success) {
        loadCoupons();
      } else {
        alert(res.error || "Failed to delete coupon.");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting coupon.");
    }
  };

  if (loading) {
    return (
      <div className="h-96 flex flex-col justify-center items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#baa47f]" />
        <span className="text-xs uppercase font-bold tracking-widest text-zinc-550">Loading offers...</span>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 flex flex-col gap-6 max-w-7xl mx-auto w-full">
      {/* Page Header */}
      <div className="flex justify-between items-center pb-2 border-b border-[#251416]">
        <div>
          <h1 className="text-lg font-display font-extrabold text-white tracking-tight uppercase">
            Coupon Codes
          </h1>
          <p className="text-[10px] text-zinc-450 uppercase tracking-widest font-bold mt-0.5">
            Configure discount codes and minimum cart billing limits
          </p>
        </div>

        <button
          onClick={() => openUpsertModal()}
          className="px-4 py-2 bg-primary hover:bg-[#871b30] border border-[#baa47f]/20 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer shadow-md"
        >
          <Plus className="w-4 h-4" /> Add Coupon
        </button>
      </div>

      {/* Coupons Display List */}
      {coupons.length === 0 ? (
        <div className="h-60 flex flex-col justify-center items-center border border-dashed border-[#251416] rounded-xl text-center text-zinc-550 p-6">
          <Tag className="w-10 h-10 text-zinc-750 mb-2" />
          <h3 className="text-sm font-bold text-zinc-400">No active promotions</h3>
          <p className="text-[10px]">Create your first coupon discount using the button above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {coupons.map(coupon => (
            <div
              key={coupon.id}
              className={`bg-[#140b0c] border rounded-xl p-5 flex flex-col justify-between gap-4 shadow-soft hover:border-[#baa47f]/20 transition relative ${
                !coupon.isActive ? "opacity-60 border-zinc-850" : "border-[#251416]"
              }`}
            >
              {/* Card Header info */}
              <div>
                <div className="flex justify-between items-start">
                  <span className="font-mono text-base font-extrabold text-white bg-zinc-950 border border-[#2d191b] px-3 py-1 rounded tracking-widest uppercase">
                    {coupon.code}
                  </span>
                  
                  {/* Status Indicator */}
                  <span className={`text-[8px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                    coupon.isActive 
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : "bg-zinc-900 border-zinc-850 text-zinc-500"
                  }`}>
                    {coupon.isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-4">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 border border-[#baa47f]/20 flex items-center justify-center text-[#baa47f]">
                    <Percent className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <span className="text-xl font-mono font-extrabold text-[#baa47f]">
                      {coupon.discountPercent}% OFF
                    </span>
                    <span className="text-[9px] text-zinc-450 uppercase font-bold block mt-0.5">
                      Min Bill: ₹{coupon.minOrderAmount}
                    </span>
                  </div>
                </div>

                {coupon.maxDiscount && (
                  <span className="text-[10px] text-zinc-500 block mt-2 font-medium">
                    Max Discount Cap: ₹{coupon.maxDiscount}
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between border-t border-[#201011] pt-3 mt-1 gap-2">
                <button
                  onClick={() => handleToggleActive(coupon)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-zinc-400 hover:text-white cursor-pointer"
                >
                  {coupon.isActive ? (
                    <span className="text-emerald-400 flex items-center gap-1">Active <ToggleRight className="w-5 h-5 text-emerald-400" /></span>
                  ) : (
                    <span className="text-zinc-500 flex items-center gap-1">Disabled <ToggleLeft className="w-5 h-5 text-zinc-650" /></span>
                  )}
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={() => openUpsertModal(coupon)}
                    className="p-2 bg-[#201011] hover:bg-[#2c1719] border border-[#2d191b] rounded text-zinc-350 hover:text-white cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteCoupon(coupon.id)}
                    className="p-2 bg-red-950/20 hover:bg-red-900/10 border border-red-500/20 text-red-400 rounded cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* DIALOG: CREATE / EDIT COUPON DIALOG */}
      <AnimatePresence>
        {showUpsertModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#140b0c] border border-[#2d191b] rounded-xl p-6 w-full max-w-sm shadow-modal flex flex-col gap-4"
            >
              <div className="flex justify-between items-center pb-2 border-b border-[#2d191b]">
                <h3 className="font-display font-extrabold text-sm uppercase tracking-wider text-white">
                  {selectedCouponForEdit ? "Edit Coupon details" : "Create Coupon Promo"}
                </h3>
                <button
                  onClick={() => setShowUpsertModal(false)}
                  className="w-6 h-6 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleUpsertCouponSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-zinc-450 font-bold uppercase tracking-wider">Promo Code</label>
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="e.g. BIKAJI50"
                    className="w-full bg-[#0d0506] border border-[#2d191b] rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-700 focus:outline-none uppercase"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-zinc-450 font-bold uppercase tracking-wider">Discount Rate (%)</label>
                  <input
                    type="number"
                    value={couponDiscount}
                    onChange={(e) => setCouponDiscount(e.target.value)}
                    placeholder="e.g. 15"
                    className="w-full bg-[#0d0506] border border-[#2d191b] rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-700 focus:outline-none"
                    min="1"
                    max="100"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-zinc-455 font-bold uppercase tracking-wider">Min Order (INR)</label>
                    <input
                      type="number"
                      value={couponMinOrder}
                      onChange={(e) => setCouponMinOrder(e.target.value)}
                      placeholder="e.g. 500"
                      className="w-full bg-[#0d0506] border border-[#2d191b] rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-700 focus:outline-none"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-zinc-455 font-bold uppercase tracking-wider">Max Cap Limit (INR)</label>
                    <input
                      type="number"
                      value={couponMaxDiscount}
                      onChange={(e) => setCouponMaxDiscount(e.target.value)}
                      placeholder="e.g. 150 (Optional)"
                      className="w-full bg-[#0d0506] border border-[#2d191b] rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-700 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Active check */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={couponIsActive}
                    onChange={(e) => setCouponIsActive(e.target.checked)}
                    className="w-4 h-4 accent-primary"
                  />
                  <label htmlFor="isActive" className="text-xs text-zinc-300 font-medium">Activate immediately for users</label>
                </div>

                <div className="flex gap-2.5 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowUpsertModal(false)}
                    className="flex-1 py-2.5 rounded-lg border border-[#2d191b] text-[#baa47f] hover:text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingCoupon}
                    className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold uppercase tracking-wider cursor-pointer shadow-md flex items-center justify-center gap-1"
                  >
                    {isSubmittingCoupon ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    Save Coupon
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
