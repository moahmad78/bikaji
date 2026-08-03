"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useCart, SelectedModifier, SelectedAddon, CartItem } from "@/features/cart/CartContext";
import { getMenuData } from "@/actions/menu";
import { validateCoupon } from "@/actions/coupon";
import { submitOrder, getTableSessionOrders, sendCustomerOrderReply } from "@/actions/order";
import { createServiceRequest } from "@/actions/serviceRequest";
import { getTableDetails } from "@/actions/table";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { PaymentMethod, RequestType, OrderStatus, PaymentStatus } from "@prisma/client";
import { io } from "socket.io-client";
import CustomerBottomNav, { CustomerTab } from "@/components/CustomerBottomNav";
import {
  Search,
  ShoppingBag,
  Sparkles,
  Plus,
  Minus,
  X,
  Utensils,
  Check,
  Loader2,
  AlertCircle,
  Clock,
  Bell,
  FileText,
  Droplet,
  ChevronRight,
  Info,
  SlidersHorizontal,
  WifiOff,
  Flame,
  ArrowUpDown,
  CheckCircle2,
  PackageCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface Category {
  id: string;
  name: string;
  description: string | null;
  image: string | null;
  order: number;
  subCategories?: { id: string; name: string; order: number }[];
  items: MenuItem[];
}

interface MenuItem {
  id: string;
  categoryId: string;
  subCategoryId?: string | null;
  name: string;
  description: string;
  price: number;
  offerPrice: number | null;
  image: string;
  isVeg: boolean;
  isNonVeg: boolean;
  isJain: boolean;
  spicyLevel: string;
  isBestseller: boolean;
  isSpecial: boolean;
  isFeatured: boolean;
  isAvailable: boolean;
  preparationTime: number;
  images: { id: string; url: string; isPrimary: boolean }[];
  modifierGroups: {
    modifierGroup: {
      id: string;
      name: string;
      description: string | null;
      minSelect: number;
      maxSelect: number;
      modifiers: {
        id: string;
        name: string;
        price: number;
      }[];
    };
  }[];
  addons: {
    addon: {
      id: string;
      name: string;
      price: number;
    };
  }[];
}

export default function MenuPage() {
  const router = useRouter();
  const {
    tableId,
    tableNumber,
    branchId,
    setTable,
    cartItems,
    addToCart,
    updateQuantity,
    updateSpecialNotes,
    clearCart,
    appliedCoupon,
    applyCoupon,
    specialInstructions,
    setSpecialInstructions,
    subtotal,
    discount,
    gstAmount,
    serviceChargeAmount,
    totalAmount,
  } = useCart();

  // Core Data & Loading States
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);

  // Search, Filter & Sort States
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>("all");
  const [vegOnly, setVegOnly] = useState<boolean>(false);
  const [jainOnly, setJainOnly] = useState<boolean>(false);
  const [selectedSpicyLevel, setSelectedSpicyLevel] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"recommended" | "price-asc" | "price-desc" | "prep-time">("recommended");
  const [isFilterModalOpen, setIsFilterModalOpen] = useState<boolean>(false);

  // Customization Inspector Modal State
  const [inspectingItem, setInspectingItem] = useState<MenuItem | null>(null);

  // Cart Drawer & Checkout State
  const [cartOpen, setCartOpen] = useState<boolean>(false);
  const [customerName, setCustomerName] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.UPI);
  const [submittingOrder, setSubmittingOrder] = useState<boolean>(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // Cart Customizations & Animation State
  const [kitchenChips, setKitchenChips] = useState<string[]>([]);
  const [expandedCustomizeItem, setExpandedCustomizeItem] = useState<string | null>(null);
  const [orderSuccessState, setOrderSuccessState] = useState<"idle" | "submitting" | "success">("idle");
  const [successOrderNumber, setSuccessOrderNumber] = useState<string>("");
  
  const KITCHEN_CHIPS_OPTIONS = [
    { label: "Less Spicy", icon: "🌶" },
    { label: "No Onion", icon: "🧅" },
    { label: "Less Oil", icon: "🥄" },
    { label: "Extra Plates", icon: "🍽" },
    { label: "Extra Glass", icon: "🥤" },
    { label: "Extra Napkins", icon: "🧻" },
    { label: "Extra Spoon", icon: "🥄" },
    { label: "Extra Cutlery", icon: "🍴" },
    { label: "Lemon Required", icon: "🍋" },
    { label: "Make it Hot", icon: "🔥" },
  ];

  // Coupon State
  const [couponCode, setCouponCode] = useState<string>("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSuccess, setCouponSuccess] = useState<string | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState<boolean>(false);

  // Table Service Call Modal State
  const [serviceFABOpen, setServiceFABOpen] = useState<boolean>(false);
  const [requestingService, setRequestingService] = useState<boolean>(false);

  // SPA Active Tab & Session Orders State
  const [activeTab, setActiveTab] = useState<CustomerTab>("menu");
  const [sessionOrders, setSessionOrders] = useState<any[]>([]);
  const [customReplyText, setCustomReplyText] = useState<string>("");
  const [sendingReply, setSendingReply] = useState<boolean>(false);
  const [selectedViewOrder, setSelectedViewOrder] = useState<any | null>(null);

  // Repeat Order Action
  const handleRepeatOrder = (ord: any) => {
    if (!ord || !ord.items || ord.items.length === 0) return;
    let addedCount = 0;
    ord.items.forEach((item: any) => {
      const qty = item.quantity || 1;
      for (let i = 0; i < qty; i++) {
        addToCart({
          menuItemId: item.menuItemId || item.id,
          name: item.name,
          price: item.price,
          isVeg: item.isVeg ?? true,
          image: item.image || item.menuItem?.image || "/logo.png",
        });
      }
      addedCount += qty;
    });
    addToast(`Re-added ${addedCount} items from Ticket #${ord.orderNumber} to your cart!`, "success");
    setActiveTab("cart");
  };

  // Notification Toasts
  const [toasts, setToasts] = useState<{ id: string; message: string; type: "success" | "error" | "info" }[]>([]);

  // Helper to load session orders
  const loadSessionOrders = async () => {
    if (!tableId) return;
    try {
      const res = await getTableSessionOrders(tableId);
      if (res.success && res.orders) {
        setSessionOrders(res.orders);
      }
    } catch (err) {
      console.error("Error loading session orders:", err);
    }
  };

  useEffect(() => {
    if (tableId) {
      loadSessionOrders();
    }
  }, [tableId]);

  // Real-time Socket Updates for Customer SPA
  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
    const socket = io(socketUrl, { autoConnect: true });

    const handleOrderUpdate = () => {
      loadSessionOrders();
    };

    socket.on("order-new", handleOrderUpdate);
    socket.on("order-accepted", handleOrderUpdate);
    socket.on("order-preparing", handleOrderUpdate);
    socket.on("order-ready", handleOrderUpdate);
    socket.on("order-accepted-by-waiter", handleOrderUpdate);
    socket.on("order-served", handleOrderUpdate);
    socket.on("order-completed", handleOrderUpdate);
    socket.on("order-updated", handleOrderUpdate);

    return () => {
      socket.off("order-new", handleOrderUpdate);
      socket.off("order-accepted", handleOrderUpdate);
      socket.off("order-preparing", handleOrderUpdate);
      socket.off("order-ready", handleOrderUpdate);
      socket.off("order-accepted-by-waiter", handleOrderUpdate);
      socket.off("order-served", handleOrderUpdate);
      socket.off("order-completed", handleOrderUpdate);
      socket.off("order-updated", handleOrderUpdate);
      socket.disconnect();
    };
  }, [tableId]);

  // Toast Notification Helper
  const addToast = (message: string, type: "success" | "error" | "info" = "success") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Monitor Online/Offline Status
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => {
      setIsOnline(true);
      addToast("Network reconnected. Back online!", "success");
    };
    const handleOffline = () => {
      setIsOnline(false);
      addToast("Connection lost. Working offline.", "error");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Sync Table Info from Query Params
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const queryTableId = urlParams.get("tableId");
      const queryTableNum = urlParams.get("table");

      if (queryTableId && queryTableId !== tableId) {
        getTableDetails(queryTableId).then((res) => {
          if (res.success && res.table) {
            setTable(res.table.id, res.table.number, res.table.branchId);
          }
        });
      } else if (queryTableNum && !tableId) {
        setTable("demo-table-id", parseInt(queryTableNum) || 1, "demo-branch-id");
      }
    }
  }, [tableId, setTable]);

  // Load Menu Data
  useEffect(() => {
    async function loadMenu() {
      try {
        setLoading(true);
        const response = await getMenuData(branchId);
        if (response.success && response.categories) {
          setCategories(response.categories as Category[]);
        } else {
          setMenuError(response.error || "Failed to load restaurant menu.");
        }
      } catch (err) {
        console.error(err);
        setMenuError("Connection error while fetching menu.");
      } finally {
        setLoading(false);
      }
    }
    loadMenu();
  }, [branchId]);

  // Flatten all items across categories
  const allItems = useMemo(() => {
    return categories.flatMap((cat) => cat.items);
  }, [categories]);

  // Chef's Recommendations / Featured Items
  const featuredItems = useMemo(() => {
    return allItems.filter((item) => item.isSpecial || item.isFeatured || item.isBestseller).slice(0, 8);
  }, [allItems]);

  // Bestselling Items
  const bestsellerItems = useMemo(() => {
    return allItems.filter((item) => item.isBestseller).slice(0, 8);
  }, [allItems]);

  // Active subcategories for selected category
  const activeSubCategories = useMemo(() => {
    if (selectedCategory === "all") return [];
    const cat = categories.find((c) => c.id === selectedCategory);
    return cat?.subCategories || [];
  }, [categories, selectedCategory]);

  // Filtered & Sorted Items
  const filteredItems = useMemo(() => {
    let result = [...allItems];

    if (selectedCategory !== "all") {
      result = result.filter((item) => item.categoryId === selectedCategory);
    }

    if (selectedSubCategory !== "all") {
      result = result.filter((item) => item.subCategoryId === selectedSubCategory);
    }

    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query)
      );
    }

    if (vegOnly) {
      result = result.filter((item) => item.isVeg);
    }
    if (jainOnly) {
      result = result.filter((item) => item.isJain);
    }

    if (selectedSpicyLevel !== "ALL") {
      result = result.filter((item) => item.spicyLevel === selectedSpicyLevel);
    }

    if (sortBy === "price-asc") {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === "price-desc") {
      result.sort((a, b) => b.price - a.price);
    } else if (sortBy === "prep-time") {
      result.sort((a, b) => a.preparationTime - b.preparationTime);
    }

    return result;
  }, [allItems, selectedCategory, selectedSubCategory, searchQuery, vegOnly, jainOnly, selectedSpicyLevel, sortBy]);

  // Active Filter Count Calculation
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCategory !== "all") count++;
    if (selectedSubCategory !== "all") count++;
    if (vegOnly) count++;
    if (jainOnly) count++;
    if (selectedSpicyLevel !== "ALL") count++;
    if (sortBy !== "recommended") count++;
    return count;
  }, [selectedCategory, selectedSubCategory, vegOnly, jainOnly, selectedSpicyLevel, sortBy]);

  // Helper to check if an item is in cart & return its quantity
  const getItemCartQuantity = (itemId: string) => {
    const cartItem = cartItems.find((ci) => ci.menuItemId === itemId);
    return cartItem ? cartItem.quantity : 0;
  };

  // Helper to get cartItemId for steppers
  const getCartItemId = (itemId: string) => {
    const cartItem = cartItems.find((ci) => ci.menuItemId === itemId);
    return cartItem ? cartItem.cartItemId : null;
  };

  // Quick Add or Open Modifier Modal
  const handleQuickAdd = (item: MenuItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    const hasRequiredModifiers = item.modifierGroups?.some(
      (mg) => mg.modifierGroup.minSelect > 0
    );

    if (hasRequiredModifiers || (item.modifierGroups && item.modifierGroups.length > 0)) {
      setInspectingItem(item);
    } else {
      addToCart({
        menuItemId: item.id,
        name: item.name,
        price: item.offerPrice || item.price,
        image: item.image,
        isVeg: item.isVeg,
        selectedModifiers: [],
        selectedAddons: [],
      });
      addToast(`Added "${item.name}" to order!`, "success");
    }
  };

  // Submit Order Action
  const handlePlaceOrder = async () => {
    if (!tableId) return;
    if (cartItems.length === 0) return;
    
    setOrderSuccessState("submitting");
    setSubmittingOrder(true);
    setOrderError(null);

    const combinedSpecialNotes = [
      kitchenChips.length > 0 ? `Tags: ${kitchenChips.join(", ")}` : "",
      specialInstructions.trim()
    ].filter(Boolean).join(" | ");

    const orderInput = {
      tableId,
      branchId: branchId || undefined,
      customerName: customerName.trim() || undefined,
      cartItems: cartItems.map((ci) => ({
        menuItemId: ci.menuItemId,
        name: ci.name,
        price: ci.price,
        quantity: ci.quantity,
        specialNotes: ci.specialNotes || undefined,
        selectedModifiers: ci.selectedModifiers || [],
        selectedAddons: ci.selectedAddons || [],
      })),
      specialNotes: combinedSpecialNotes || undefined,
      couponCode: appliedCoupon ? appliedCoupon.code : undefined,
      paymentMethod,
    };

    try {
      const res = await submitOrder(orderInput);
      if (res.success && res.orderId) {
        setSuccessOrderNumber(res.orderNumber?.toString() || res.orderId.substring(0,6));
        setOrderSuccessState("success");
        clearCart();
        setKitchenChips([]);
        loadSessionOrders();
      } else {
        setOrderError(res.error || "Something went wrong while placing your order.");
        setOrderSuccessState("idle");
      }
    } catch (err) {
      console.error(err);
      setOrderError("Unable to place order. Connection failed.");
      setOrderSuccessState("idle");
    } finally {
      setSubmittingOrder(false);
    }
  };

  // Trigger Service Request Action
  const handleServiceRequest = async (type: RequestType, customNote?: string) => {
    if (!tableId) return;
    setRequestingService(true);
    try {
      const res = await createServiceRequest(tableId, type, customNote);
      if (res.success) {
        addToast("Waiter notified! Someone will assist you shortly.", "success");
        setServiceFABOpen(false);
      } else {
        addToast(res.error || "Failed to contact waiter.", "error");
      }
    } catch (err) {
      addToast("Connection error while requesting service.", "error");
    } finally {
      setRequestingService(false);
    }
  };

  // Customer Reply to Kitchen Action
  const handleSendCustomerReply = async (orderId: string, replyText: string) => {
    if (!orderId || !replyText.trim()) return;
    setSendingReply(true);
    try {
      const res = await sendCustomerOrderReply(orderId, replyText.trim());
      if (res.success) {
        addToast("Message sent to kitchen!", "success");
        setCustomReplyText("");
        loadSessionOrders();
      } else {
        addToast(res.error || "Failed to send message.", "error");
      }
    } catch (err) {
      addToast("Network error while sending message.", "error");
    } finally {
      setSendingReply(false);
    }
  };

  // Coupon Validation Action
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setValidatingCoupon(true);
    setCouponError(null);
    setCouponSuccess(null);

    try {
      const res = await validateCoupon(couponCode.trim(), subtotal, branchId);

      if (res.success && res.coupon) {
        applyCoupon({
          code: res.coupon.code,
          discountPercent: res.coupon.discountPercent || 0,
          minOrderAmount: res.coupon.minOrderAmount || 0,
          maxDiscount: res.coupon.maxDiscount || undefined,
        });
        setCouponSuccess(`Coupon applied successfully!`);
        setCouponCode("");
      } else {
        setCouponError(res.error || "Invalid coupon code.");
      }
    } catch (err) {
      setCouponError("Unable to validate coupon code.");
    } finally {
      setValidatingCoupon(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0506] text-white flex flex-col items-center justify-center p-6 gap-6">
        <Image src="/logo.png" alt="Bikaji Logo" width={160} height={48} className="h-8 md:h-12 w-auto object-contain" />
        <div className="w-8 h-8 rounded-full border-2 border-[#baa47f]/20 border-t-[#baa47f] animate-spin" />
        <p className="font-display text-sm font-semibold text-[#baa47f] tracking-widest uppercase animate-pulse">
          Preparing Digital Menu...
        </p>
      </div>
    );
  }

  if (menuError) {
    return (
      <div className="min-h-screen bg-[#0b0506] text-white flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">Menu Loading Error</h2>
        <p className="text-xs text-zinc-400 max-w-sm mb-6">{menuError}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-[#800020] text-white text-xs font-bold uppercase tracking-wider rounded-xl border border-[#baa47f]/40"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Status mapping utility for Orders tab
  const getStatusStepInfo = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.PENDING:
        return { step: 1, title: "Order Received", color: "text-amber-400 border-amber-500/30 bg-amber-950/40" };
      case OrderStatus.RECEIVED:
      case OrderStatus.ACCEPTED:
        return { step: 2, title: "Order Accepted", color: "text-blue-400 border-blue-500/30 bg-blue-950/40" };
      case OrderStatus.PREPARING:
        return { step: 3, title: "Freshly Cooking", color: "text-amber-300 border-amber-500/30 bg-amber-950/40" };
      case OrderStatus.READY:
        return { step: 4, title: "Ready For Pickup", color: "text-emerald-400 border-emerald-500/30 bg-emerald-950/40" };
      case (OrderStatus as any).OUT_FOR_DELIVERY || "OUT_FOR_DELIVERY":
        return { step: 5, title: "Waiter Bringing Food", color: "text-sky-400 border-sky-500/30 bg-sky-950/40" };
      case OrderStatus.SERVED:
        return { step: 6, title: "Delivered To Table", color: "text-emerald-300 border-emerald-500/30 bg-emerald-950/40" };
      case OrderStatus.COMPLETED:
        return { step: 7, title: "Completed", color: "text-zinc-400 border-zinc-700 bg-zinc-900" };
      case OrderStatus.CANCELLED:
        return { step: 0, title: "Cancelled", color: "text-rose-400 border-rose-500/30 bg-rose-950/40" };
      default:
        return { step: 1, title: "Processing", color: "text-zinc-400 border-zinc-700 bg-zinc-900" };
    }
  };

  const getTimelineSteps = (status: OrderStatus) => {
    const { step } = getStatusStepInfo(status);
    if (status === OrderStatus.CANCELLED || status === OrderStatus.REFUNDED) return [];
    return [
      { num: 1, label: "Received", isCompleted: step >= 1 },
      { num: 2, label: "Accepted", isCompleted: step >= 2 },
      { num: 3, label: "Cooking", isCompleted: step >= 3 },
      { num: 4, label: "Ready", isCompleted: step >= 4 },
      { num: 5, label: "Picked Up", isCompleted: step >= 5 },
      { num: 6, label: "Delivered", isCompleted: step >= 6 },
    ];
  };

  return (
    <div className="min-h-screen bg-[#0b0506] text-white pb-32 font-sans selection:bg-[#800020] selection:text-white">
      {/* Network Offline Bar */}
      {!isOnline && (
        <div className="sticky top-0 z-50 bg-rose-600 text-white text-xs py-1.5 px-4 text-center font-bold flex items-center justify-center gap-2 shadow-md">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>Offline Mode Active - Showing Cached Menu</span>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0b0506]/95 backdrop-blur-xl border-b border-[#baa47f]/20 px-4 py-3.5 shadow-xl">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          {/* Logo & Table Badge */}
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Bikaji Logo" width={160} height={48} className="h-8 md:h-12 w-auto object-contain" />
            <div>
              {tableNumber ? (
                <p className="text-[11px] text-zinc-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Table <strong className="text-white font-bold">#{tableNumber}</strong>
                </p>
              ) : (
                <p className="text-[11px] text-zinc-400">Digital Ordering</p>
              )}
            </div>
          </div>

          {/* Action Buttons: Service Call & Cart Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setServiceFABOpen(true)}
              className="p-2.5 rounded-xl bg-zinc-900 border border-[#baa47f]/30 text-[#baa47f] hover:bg-[#800020]/30 transition relative cursor-pointer"
              title="Call Waiter"
            >
              <Bell className="w-4 h-4" />
            </button>

            <button
              onClick={() => setCartOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-[#800020] hover:bg-[#990026] text-white text-xs font-extrabold border border-[#baa47f]/40 flex items-center gap-2 transition shadow-lg relative cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4 text-[#baa47f]" />
              <span className="hidden sm:inline">Cart</span>
              {cartItems.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-amber-400 text-black text-[10px] font-black flex items-center justify-center">
                  {cartItems.reduce((acc, ci) => acc + ci.quantity, 0)}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 pt-4 flex flex-col gap-6">
        {/* 1. 🍽 MENU TAB */}
        {activeTab === "menu" && (
          <>
            {/* Prominent Search Bar & Filter Button */}
        <section className="flex items-center gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes, kachori, katli, thali..."
              className="w-full pl-11 pr-10 py-3 rounded-2xl bg-zinc-900/90 border border-[#baa47f]/30 text-white placeholder-zinc-500 text-xs sm:text-sm focus:outline-none focus:border-[#baa47f] focus:ring-1 focus:ring-[#baa47f] transition shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            onClick={() => setIsFilterModalOpen(true)}
            className={`px-4 py-3 rounded-2xl border text-xs font-extrabold flex items-center gap-2 transition cursor-pointer shrink-0 shadow-md ${
              activeFilterCount > 0
                ? "bg-[#800020] text-white border-[#baa47f]"
                : "bg-zinc-900 border-[#baa47f]/30 text-[#baa47f] hover:bg-zinc-800"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-400 text-black text-[10px] font-black flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </section>

        {/* Category Pills Navigation (Horizontal Scroll) */}
        <section className="overflow-x-auto no-scrollbar -mx-4 px-4 py-1 flex items-center gap-2">
          <button
            onClick={() => {
              setSelectedCategory("all");
              setSelectedSubCategory("all");
            }}
            className={`px-4 py-2.5 rounded-full text-xs font-extrabold tracking-wider uppercase whitespace-nowrap transition cursor-pointer border ${
              selectedCategory === "all"
                ? "bg-[#800020] text-white border-[#baa47f] shadow-lg"
                : "bg-zinc-900/80 text-zinc-400 border-zinc-800 hover:text-white"
            }`}
          >
            All Items ({allItems.length})
          </button>

          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat.id);
                setSelectedSubCategory("all");
              }}
              className={`px-4 py-2.5 rounded-full text-xs font-extrabold tracking-wider uppercase whitespace-nowrap transition cursor-pointer border flex items-center gap-1.5 ${
                selectedCategory === cat.id
                  ? "bg-[#800020] text-white border-[#baa47f] shadow-lg"
                  : "bg-zinc-900/80 text-zinc-400 border-zinc-800 hover:text-white"
              }`}
            >
              <span>{cat.name}</span>
              <span className="text-[10px] opacity-70">({cat.items.length})</span>
            </button>
          ))}
        </section>

        {/* SubCategories Sub-Bar (If active) */}
        {activeSubCategories.length > 0 && (
          <section className="overflow-x-auto no-scrollbar -mx-4 px-4 flex items-center gap-2">
            <button
              onClick={() => setSelectedSubCategory("all")}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap border transition cursor-pointer ${
                selectedSubCategory === "all"
                  ? "bg-[#baa47f]/20 text-[#baa47f] border-[#baa47f]"
                  : "bg-zinc-900/60 text-zinc-400 border-zinc-800"
              }`}
            >
              All {categories.find((c) => c.id === selectedCategory)?.name}
            </button>

            {activeSubCategories.map((sub) => (
              <button
                key={sub.id}
                onClick={() => setSelectedSubCategory(sub.id)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap border transition cursor-pointer ${
                  selectedSubCategory === sub.id
                    ? "bg-[#baa47f]/20 text-[#baa47f] border-[#baa47f]"
                    : "bg-zinc-900/60 text-zinc-400 border-zinc-800"
                }`}
              >
                {sub.name}
              </button>
            ))}
          </section>
        )}

        {/* Chef's Recommendations Carousel (Show when no specific search/filter is applied) */}
        {selectedCategory === "all" && !searchQuery && featuredItems.length > 0 && (
          <section className="flex flex-col gap-3 pt-2">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-extrabold uppercase tracking-wider text-[#baa47f] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" /> Chef's Recommendations
              </h2>
              <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest">Handcrafted Delicacies</span>
            </div>

            <div className="overflow-x-auto no-scrollbar -mx-4 px-4 flex items-center gap-4 py-1">
              {featuredItems.map((item) => {
                const qty = getItemCartQuantity(item.id);
                const cartItemId = getCartItemId(item.id);

                return (
                  <div
                    key={item.id}
                    className="w-72 shrink-0 bg-zinc-900/90 border border-[#baa47f]/30 rounded-2xl overflow-hidden shadow-xl flex flex-col justify-between group hover:border-[#baa47f] transition duration-300"
                  >
                    <div className="relative h-40 w-full overflow-hidden bg-neutral-900">
                      <Image
                        src={item.image || "/item.png"}
                        alt={item.name}
                        fill
                        className="object-cover group-hover:scale-105 transition duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent" />

                      {/* Veg / NonVeg Badge */}
                      <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded-md border border-white/10 flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${item.isVeg ? "bg-emerald-500" : "bg-rose-500"}`} />
                        <span className="text-[10px] font-bold text-white uppercase">{item.isVeg ? "Veg" : "Non-Veg"}</span>
                      </div>

                      {/* Special Tag */}
                      <div className="absolute top-3 right-3 bg-[#800020] text-amber-300 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border border-[#baa47f]/40">
                        Signature
                      </div>
                    </div>

                    <div className="p-4 flex flex-col justify-between flex-1 gap-3">
                      <div>
                        <h3 className="font-bold text-sm text-white line-clamp-1 group-hover:text-[#baa47f] transition">
                          {item.name}
                        </h3>
                        <p className="text-[11px] text-zinc-400 line-clamp-2 mt-1 leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                        <div>
                          <span className="text-base font-extrabold text-white">₹{item.price}</span>
                          {item.offerPrice && (
                            <span className="text-xs text-zinc-500 line-through ml-2">₹{item.offerPrice}</span>
                          )}
                        </div>

                        {/* Direct +Add / Stepper */}
                        {qty > 0 && cartItemId ? (
                          <div className="flex items-center gap-2 bg-[#800020] border border-[#baa47f] rounded-xl px-2 py-1 text-white shadow-md">
                            <button
                              onClick={() => updateQuantity(cartItemId, qty - 1)}
                              className="p-1 hover:bg-black/30 rounded transition cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5 text-amber-300" />
                            </button>
                            <span className="text-xs font-black w-4 text-center">{qty}</span>
                            <button
                              onClick={() => updateQuantity(cartItemId, qty + 1)}
                              className="p-1 hover:bg-black/30 rounded transition cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5 text-amber-300" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => handleQuickAdd(item, e)}
                            className="px-3.5 py-1.5 rounded-xl bg-[#800020] hover:bg-[#990026] text-white text-xs font-extrabold border border-[#baa47f]/40 flex items-center gap-1 transition cursor-pointer shadow-md"
                          >
                            <Plus className="w-3.5 h-3.5 text-[#baa47f]" /> ADD
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Bestsellers Section (Show when no specific search/filter is applied) */}
        {selectedCategory === "all" && !searchQuery && bestsellerItems.length > 0 && (
          <section className="flex flex-col gap-3 pt-2">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-extrabold uppercase tracking-wider text-[#baa47f] flex items-center gap-2">
                <Flame className="w-4 h-4 text-rose-500" /> Bestselling Delicacies
              </h2>
              <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest">Most Loved</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {bestsellerItems.map((item) => {
                const qty = getItemCartQuantity(item.id);
                const cartItemId = getCartItemId(item.id);

                return (
                  <div
                    key={item.id}
                    className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-3.5 flex gap-3.5 items-center hover:border-[#baa47f]/40 transition group shadow-lg"
                  >
                    <div className="relative w-24 h-24 rounded-xl overflow-hidden shrink-0 bg-neutral-900">
                      <Image src={item.image || "/logo.png"} alt={item.name} fill className="object-cover group-hover:scale-105 transition duration-500" />
                      <div className="absolute top-1 left-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white" />
                    </div>

                    <div className="flex flex-col justify-between flex-1 min-w-0 h-full py-0.5">
                      <div>
                        <h3 className="font-bold text-xs text-white line-clamp-1 group-hover:text-[#baa47f] transition">
                          {item.name}
                        </h3>
                        <p className="text-[11px] text-zinc-400 line-clamp-2 mt-0.5 leading-tight">
                          {item.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-1 border-t border-zinc-800/80">
                        <span className="text-sm font-extrabold text-white">₹{item.price}</span>

                        {qty > 0 && cartItemId ? (
                          <div className="flex items-center gap-2 bg-[#800020] border border-[#baa47f] rounded-lg px-2 py-1 text-white shadow-md">
                            <button
                              onClick={() => updateQuantity(cartItemId, qty - 1)}
                              className="p-0.5 hover:bg-black/30 rounded cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5 text-amber-300" />
                            </button>
                            <span className="text-xs font-black w-4 text-center">{qty}</span>
                            <button
                              onClick={() => updateQuantity(cartItemId, qty + 1)}
                              className="p-0.5 hover:bg-black/30 rounded cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5 text-amber-300" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => handleQuickAdd(item, e)}
                            className="px-3 py-1 rounded-lg bg-[#800020] hover:bg-[#990026] text-white text-[11px] font-extrabold border border-[#baa47f]/40 flex items-center gap-1 transition cursor-pointer"
                          >
                            <Plus className="w-3 h-3 text-[#baa47f]" /> ADD
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Main Dishes Catalog Grid */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <h2 className="font-display text-base font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
              <Utensils className="w-4 h-4 text-[#baa47f]" /> Menu Catalog ({filteredItems.length})
            </h2>
          </div>

          {filteredItems.length === 0 ? (
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-12 text-center flex flex-col items-center gap-3">
              <Utensils className="w-10 h-10 text-zinc-600" />
              <h3 className="text-base font-bold text-white">No dishes match your filter</h3>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("all");
                  setSelectedSubCategory("all");
                  setVegOnly(false);
                  setJainOnly(false);
                  setSelectedSpicyLevel("ALL");
                  setSortBy("recommended");
                }}
                className="px-5 py-2.5 bg-[#800020] text-white text-xs font-bold uppercase tracking-wider rounded-xl border border-[#baa47f]/40 mt-2"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((item) => {
                const qty = getItemCartQuantity(item.id);
                const cartItemId = getCartItemId(item.id);

                return (
                  <div
                    key={item.id}
                    className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl overflow-hidden hover:border-[#baa47f]/40 transition duration-300 flex flex-col justify-between group shadow-xl"
                  >
                    <div className="relative h-44 w-full bg-neutral-900 overflow-hidden">
                      <Image
                        src={item.image || "/logo.png"}
                        alt={item.name}
                        fill
                        className="object-cover group-hover:scale-105 transition duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent" />
                      <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded-md border border-white/10 flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${item.isVeg ? "bg-emerald-500" : "bg-rose-500"}`} />
                        <span className="text-[10px] font-bold text-white uppercase">{item.isVeg ? "Veg" : "Non-Veg"}</span>
                      </div>
                      {item.isBestseller && (
                        <div className="absolute top-3 right-3 bg-amber-500 text-black px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">
                          Bestseller
                        </div>
                      )}
                    </div>

                    <div className="p-4 flex flex-col justify-between flex-1 gap-3">
                      <div>
                        <h3 className="font-bold text-sm text-white line-clamp-1 group-hover:text-[#baa47f] transition">
                          {item.name}
                        </h3>
                        <p className="text-[11px] text-zinc-400 line-clamp-2 mt-1 leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                        <span className="text-base font-extrabold text-white">₹{item.price}</span>
                        {qty > 0 && cartItemId ? (
                          <div className="flex items-center gap-2.5 bg-[#800020] border border-[#baa47f] rounded-xl px-2.5 py-1 text-white shadow-md">
                            <button onClick={() => updateQuantity(cartItemId, qty - 1)}>
                              <Minus className="w-3.5 h-3.5 text-amber-300" />
                            </button>
                            <span className="text-xs font-black w-4 text-center">{qty}</span>
                            <button onClick={() => updateQuantity(cartItemId, qty + 1)}>
                              <Plus className="w-3.5 h-3.5 text-amber-300" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => handleQuickAdd(item, e)}
                            className="px-4 py-2 rounded-xl bg-[#800020] hover:bg-[#990026] text-white text-xs font-extrabold border border-[#baa47f]/40 flex items-center gap-1.5 transition cursor-pointer shadow-md"
                          >
                            <Plus className="w-3.5 h-3.5 text-[#baa47f]" /> ADD
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </>
    )}

        {/* 2. 📦 ORDERS TAB */}
        {activeTab === "orders" && (
          <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full">
            <h2 className="text-lg font-display font-extrabold text-[#baa47f]">Active Orders & Session History</h2>
            {sessionOrders.length === 0 ? (
              <div className="p-8 bg-zinc-900/60 rounded-2xl border border-zinc-800 text-center flex flex-col items-center gap-3">
                <PackageCheck className="w-12 h-12 text-zinc-600" />
                <h3 className="text-base font-bold text-white">No active orders placed yet.</h3>
                <p className="text-xs text-zinc-400">Browse our menu and place an order for your table.</p>
                <button
                  onClick={() => setActiveTab("menu")}
                  className="mt-2 px-6 py-2.5 bg-[#800020] text-white text-xs font-bold uppercase rounded-xl border border-[#baa47f]/40 cursor-pointer"
                >
                  Browse Menu
                </button>
              </div>
            ) : (
              sessionOrders.map((ord) => {
                const isDelivered = ord.status === OrderStatus.SERVED || ord.status === OrderStatus.COMPLETED;
                const statusInfo = getStatusStepInfo(ord.status);
                const timelineSteps = getTimelineSteps(ord.status);
                const maxPrepTime = ord.items?.reduce((m: number, i: any) => Math.max(m, i.menuItem?.preparationTime || 15), 15) || 15;

                if (isDelivered) {
                  return (
                    <div key={ord.id} className="p-4 bg-zinc-900/90 rounded-2xl border border-emerald-500/30 flex flex-col gap-3 text-white shadow-xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-[100px] pointer-events-none" />
                      
                      {/* Compact Header */}
                      <div className="flex items-center justify-between z-10">
                        <div>
                          <span className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-widest block">
                            Table #{tableNumber || 1} · {new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <h3 className="text-base font-display font-extrabold text-white">Ticket #{ord.orderNumber}</h3>
                        </div>
                        <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black rounded-full uppercase tracking-wider flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Delivered To Table
                        </span>
                      </div>

                      {/* Compact Summary Stats */}
                      <div className="flex items-center justify-between bg-zinc-950 p-3 rounded-xl border border-zinc-800/80 text-xs z-10">
                        <div className="flex items-center gap-2 text-zinc-300">
                          <PackageCheck className="w-4 h-4 text-emerald-400" />
                          <span><strong>{ord.items?.reduce((s: number, i: any) => s + (i.quantity || 1), 0) || 0}</strong> Items</span>
                        </div>
                        <span className="font-mono font-extrabold text-white text-sm">₹{ord.finalAmount.toFixed(2)}</span>
                      </div>

                      {/* Compact Action Buttons */}
                      <div className="grid grid-cols-3 gap-2 pt-1 z-10">
                        <button
                          onClick={() => setSelectedViewOrder(ord)}
                          className="py-2.5 px-2 bg-zinc-950 hover:bg-zinc-800 text-white text-[11px] font-bold rounded-xl border border-zinc-800 flex items-center justify-center gap-1.5 transition cursor-pointer"
                        >
                          <Info className="w-3.5 h-3.5 text-[#baa47f]" /> View Order
                        </button>

                        <button
                          onClick={() => setActiveTab("bill")}
                          className="py-2.5 px-2 bg-zinc-950 hover:bg-zinc-800 text-white text-[11px] font-bold rounded-xl border border-zinc-800 flex items-center justify-center gap-1.5 transition cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5 text-amber-400" /> View Bill
                        </button>

                        <button
                          onClick={() => handleRepeatOrder(ord)}
                          className="py-2.5 px-2 bg-[#800020] hover:bg-[#990026] text-white text-[11px] font-extrabold rounded-xl border border-[#baa47f]/40 flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Repeat
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={ord.id} className="p-5 bg-zinc-900/90 rounded-2xl border border-[#baa47f]/30 flex flex-col gap-5 text-white shadow-xl">
                    <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                      <div>
                        <span className="text-[10px] text-[#baa47f] font-extrabold uppercase tracking-widest block">Session Ticket</span>
                        <h3 className="text-lg font-display font-extrabold text-white">Ticket #{ord.orderNumber}</h3>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase border ${statusInfo.color}`}>
                        {statusInfo.title}
                      </span>
                    </div>

                    {/* Timeline Stepper */}
                    {ord.status !== OrderStatus.CANCELLED && timelineSteps.length > 0 && (
                      <div className="py-2">
                        <div className="relative flex items-center justify-between">
                          <div className="absolute left-0 right-0 h-0.5 bg-zinc-800 z-0" />
                          <div
                            className="absolute left-0 h-0.5 bg-amber-400 z-0 transition-all duration-500"
                            style={{ width: `${((statusInfo.step - 1) / 5) * 100}%` }}
                          />
                          {timelineSteps.map((step) => (
                            <div key={step.num} className="relative z-10 flex flex-col items-center gap-1.5">
                              <div className={`w-7 h-7 rounded-full border flex items-center justify-center text-[10px] font-bold ${
                                step.isCompleted ? "bg-amber-400 border-amber-400 text-black" : "bg-zinc-900 border-zinc-700 text-zinc-400"
                              }`}>
                                {step.isCompleted ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : step.num}
                              </div>
                              <span className={`text-[9px] uppercase font-bold ${step.isCompleted ? "text-amber-300" : "text-zinc-500"}`}>
                                {step.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Prep Time SLA */}
                    <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center gap-3 text-xs text-zinc-300">
                      <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Estimated Prep SLA: <strong>~{maxPrepTime} mins</strong></span>
                    </div>

                    {/* Delay Alert */}
                    {ord.delayMinutes && ord.delayMinutes > 0 && (
                      <div className="p-3.5 rounded-xl bg-orange-950/60 border border-orange-500/40 text-orange-200 text-xs">
                        <strong>Order Delayed ({ord.delayMinutes} mins)</strong>
                        {ord.delayReason && <p className="text-[11px] mt-0.5 opacity-90">{ord.delayReason}</p>}
                      </div>
                    )}

                    {/* Kitchen Note */}
                    {ord.kitchenNotes && (
                      <div className="p-3.5 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-200 text-xs">
                        <strong>Chef Note:</strong> &quot;{ord.kitchenNotes}&quot;
                      </div>
                    )}

                    {/* Waiter Status */}
                    {ord.waiterName && (
                      <div className="p-3 bg-blue-950/40 rounded-xl border border-blue-500/30 text-xs text-blue-200 flex items-center justify-between">
                        <span>Assigned Waiter: <strong>{ord.waiterName}</strong></span>
                        <span className="text-[10px] bg-blue-500/20 px-2 py-0.5 rounded border border-blue-400/30">Bringing food</span>
                      </div>
                    )}

                    {/* Customer Reply */}
                    <div className="pt-2 border-t border-zinc-800 flex flex-col gap-2">
                      <span className="text-[10px] uppercase font-bold text-zinc-400">Message to Kitchen</span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customReplyText}
                          onChange={(e) => setCustomReplyText(e.target.value)}
                          placeholder="Less spicy, extra napkins..."
                          className="flex-1 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white"
                        />
                        <button
                          onClick={() => handleSendCustomerReply(ord.id, customReplyText)}
                          disabled={sendingReply || !customReplyText.trim()}
                          className="px-4 py-2 bg-[#800020] text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-40"
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* 3. 🛒 CART TAB */}
        {activeTab === "cart" && (
          <div className="flex flex-col max-w-2xl mx-auto w-full mb-24 relative">
            <AnimatePresence mode="wait">
              {orderSuccessState === "submitting" && (
                <motion.div
                  key="submitting"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  className="bg-zinc-900/90 border border-[#baa47f]/30 p-12 rounded-3xl text-center shadow-2xl flex flex-col items-center gap-6"
                >
                  <div className="relative w-24 h-24 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border-4 border-zinc-800" />
                    <div className="absolute inset-0 rounded-full border-4 border-[#baa47f] border-t-transparent animate-spin" />
                    <Utensils className="w-8 h-8 text-amber-400 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-display text-2xl font-extrabold text-white">Sending to Kitchen</h3>
                    <p className="text-zinc-400 text-sm mt-2">Preparing your digital order ticket...</p>
                  </div>
                </motion.div>
              )}

              {orderSuccessState === "success" && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -30 }}
                  className="bg-zinc-900/90 border border-emerald-500/30 p-8 rounded-3xl text-center shadow-2xl flex flex-col items-center gap-6 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-bl-[100px]" />
                  <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/10 rounded-tr-[100px]" />
                  
                  <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center border-4 border-emerald-500/40 relative z-10">
                    <Check className="w-10 h-10 text-emerald-400 stroke-[3]" />
                  </div>
                  
                  <div className="relative z-10">
                    <h3 className="font-display text-3xl font-extrabold text-white mb-2">Order Placed!</h3>
                    <p className="text-zinc-300 text-sm">Your order has been sent to the kitchen.</p>
                    
                    <div className="mt-6 bg-zinc-950 border border-zinc-800 rounded-2xl p-4 inline-flex flex-col gap-1 items-center">
                      <span className="text-[10px] uppercase font-bold tracking-widest text-[#baa47f]">Ticket Number</span>
                      <span className="font-mono text-3xl font-black text-white">#{successOrderNumber}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setOrderSuccessState("idle");
                      setActiveTab("orders");
                    }}
                    className="mt-4 px-8 py-4 bg-[#800020] hover:bg-[#990026] text-white font-extrabold text-sm uppercase tracking-widest rounded-xl border border-[#baa47f]/40 shadow-xl transition relative z-10"
                  >
                    Track My Order
                  </button>
                </motion.div>
              )}

              {orderSuccessState === "idle" && cartItems.length === 0 && (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-zinc-900/90 p-12 rounded-3xl border border-zinc-800 text-center flex flex-col items-center gap-4 shadow-xl"
                >
                  <ShoppingBag className="w-16 h-16 text-zinc-700" />
                  <h3 className="font-display text-xl font-bold text-white">Your cart is empty</h3>
                  <p className="text-sm text-zinc-400 mb-2">Explore our menu and add some delicious items.</p>
                  <button onClick={() => setActiveTab("menu")} className="px-8 py-3 bg-[#800020] hover:bg-[#990026] text-white text-xs font-bold uppercase tracking-wider rounded-xl border border-[#baa47f]/40 transition">
                    Explore Menu
                  </button>
                </motion.div>
              )}

              {orderSuccessState === "idle" && cartItems.length > 0 && (
                <motion.div
                  key="cart"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col gap-5 pb-20"
                >
                  {/* SECTION 1: ORDER SUMMARY */}
                  <section className="bg-gradient-to-br from-[#1b080b] to-[#120507] p-5 rounded-2xl border border-[#baa47f]/30 shadow-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-[#baa47f] font-extrabold uppercase tracking-widest block">Review Order</span>
                      <h3 className="text-xl font-display font-extrabold text-white mt-1">
                        Table #{tableNumber || 1}
                      </h3>
                    </div>
                    <div className="bg-black/40 px-4 py-2 rounded-xl border border-white/10 text-center">
                      <span className="text-[10px] text-zinc-400 uppercase font-bold block">Total Items</span>
                      <span className="font-extrabold text-white text-lg">
                        {cartItems.reduce((acc, ci) => acc + ci.quantity, 0)}
                      </span>
                    </div>
                  </section>

                  {/* SECTION 2: ORDER ITEMS */}
                  <section className="bg-zinc-900/90 border border-zinc-800 rounded-2xl shadow-xl p-4 flex flex-col gap-4">
                    <h4 className="text-[11px] font-extrabold uppercase tracking-widest text-[#baa47f] border-b border-zinc-800 pb-2">
                      Order Items
                    </h4>
                    
                    <div className="flex flex-col gap-4">
                      {cartItems.map((ci) => {
                        const isExpanded = expandedCustomizeItem === ci.cartItemId;
                        return (
                          <div key={ci.cartItemId} className="flex flex-col bg-zinc-950 rounded-xl border border-zinc-800/80 overflow-hidden shadow-sm">
                            <div className="p-3 flex items-start gap-3">
                              <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-neutral-900 shrink-0">
                                <Image src={ci.image || "/logo.png"} alt={ci.name} fill className="object-cover" />
                                <div className="absolute top-1 left-1 bg-black/60 backdrop-blur-md px-1 py-0.5 rounded border border-white/10">
                                  <span className={`block w-1.5 h-1.5 rounded-full ${ci.isVeg ? "bg-emerald-500" : "bg-rose-500"}`} />
                                </div>
                              </div>
                              
                              <div className="flex-1 flex flex-col justify-between h-full">
                                <div>
                                  <h5 className="font-bold text-sm text-white leading-tight">{ci.name}</h5>
                                  <span className="text-sm font-extrabold text-[#baa47f] block mt-1">₹{ci.price}</span>
                                </div>
                              </div>

                              <div className="flex flex-col items-end gap-2 shrink-0">
                                <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1">
                                  <button onClick={() => updateQuantity(ci.cartItemId, ci.quantity - 1)} className="p-1 hover:text-white text-zinc-400 transition">
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <span className="text-xs font-bold w-4 text-center text-white">{ci.quantity}</span>
                                  <button onClick={() => updateQuantity(ci.cartItemId, ci.quantity + 1)} className="p-1 hover:text-white text-zinc-400 transition">
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <button
                                  onClick={() => setExpandedCustomizeItem(isExpanded ? null : ci.cartItemId)}
                                  className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition ${isExpanded ? "text-amber-400" : "text-zinc-500 hover:text-zinc-300"}`}
                                >
                                  Customize {isExpanded ? <ChevronRight className="w-3 h-3 rotate-90" /> : <ChevronRight className="w-3 h-3" />}
                                </button>
                              </div>
                            </div>
                            
                            {/* Expandable Customization Section for this Item */}
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="border-t border-zinc-800 bg-black/40 overflow-hidden"
                                >
                                  <div className="p-3">
                                    <span className="text-[10px] text-zinc-500 font-bold uppercase mb-1.5 block">Item Special Instructions</span>
                                    <input
                                      type="text"
                                      placeholder="e.g. Less spicy, extra cheese..."
                                      value={ci.specialNotes || ""}
                                      onChange={(e) => updateSpecialNotes(ci.cartItemId, e.target.value)}
                                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#baa47f]"
                                    />
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  {/* SECTION 3: KITCHEN INSTRUCTIONS (Global) */}
                  <section className="bg-zinc-900/90 border border-zinc-800 rounded-2xl shadow-xl p-4 flex flex-col gap-4">
                    <h4 className="text-[11px] font-extrabold uppercase tracking-widest text-[#baa47f] border-b border-zinc-800 pb-2 flex items-center gap-2">
                      <Flame className="w-4 h-4 text-amber-500" /> Kitchen Instructions
                    </h4>
                    
                    <div className="flex flex-wrap gap-2">
                      {KITCHEN_CHIPS_OPTIONS.map((chip) => {
                        const isSelected = kitchenChips.includes(chip.label);
                        return (
                          <button
                            key={chip.label}
                            onClick={() => {
                              if (isSelected) {
                                setKitchenChips(prev => prev.filter(c => c !== chip.label));
                              } else {
                                setKitchenChips(prev => [...prev, chip.label]);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-full border text-xs font-bold transition flex items-center gap-1.5 ${
                              isSelected 
                                ? "bg-[#baa47f]/20 border-[#baa47f] text-[#baa47f]" 
                                : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white"
                            }`}
                          >
                            <span>{chip.icon}</span>
                            <span>{chip.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div>
                      <span className="text-[10px] text-zinc-500 font-bold uppercase mb-1.5 flex justify-between">
                        <span>Message to Kitchen</span>
                        <span>{specialInstructions.length}/250</span>
                      </span>
                      <textarea
                        value={specialInstructions}
                        onChange={(e) => {
                          if (e.target.value.length <= 250) {
                            setSpecialInstructions(e.target.value);
                          }
                        }}
                        placeholder="Any other specific instructions for the chef?"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#baa47f] min-h-[80px] resize-none"
                      />
                    </div>
                  </section>

                  {/* SECTION 4: BILL SUMMARY */}
                  <section className="bg-zinc-900/90 border border-zinc-800 rounded-2xl shadow-xl p-5 flex flex-col gap-3">
                    <h4 className="text-[11px] font-extrabold uppercase tracking-widest text-[#baa47f] border-b border-zinc-800 pb-2">
                      Bill Summary
                    </h4>
                    
                    <div className="flex flex-col gap-2.5 text-xs text-zinc-300 pt-1">
                      <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span className="font-bold text-white">₹{subtotal.toFixed(2)}</span>
                      </div>
                      
                      {discount > 0 && (
                        <div className="flex justify-between text-emerald-400 font-bold">
                          <span>Discount Applied</span>
                          <span>-₹{discount.toFixed(2)}</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between">
                        <span>GST (5%)</span>
                        <span className="font-bold text-white">₹{gstAmount.toFixed(2)}</span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span>Service Charge (5%)</span>
                        <span className="font-bold text-white">₹{serviceChargeAmount.toFixed(2)}</span>
                      </div>
                      
                      <div className="flex justify-between text-lg font-display font-extrabold text-white pt-3 border-t border-zinc-800/80 mt-1">
                        <span>Grand Total</span>
                        <span className="text-amber-400 font-mono">₹{totalAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  </section>
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* STICKY BOTTOM ACTIONS (Only if cart has items and idle) */}
            {orderSuccessState === "idle" && cartItems.length > 0 && (
              <div className="fixed bottom-0 left-0 right-0 p-4 bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-800 z-40 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <div className="max-w-2xl mx-auto flex gap-3">
                  <button
                    onClick={() => setActiveTab("menu")}
                    className="flex-1 py-3.5 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl border border-zinc-700 transition"
                  >
                    Add Items
                  </button>
                  <button
                    onClick={handlePlaceOrder}
                    disabled={submittingOrder}
                    className="flex-[2] py-3.5 bg-[#800020] hover:bg-[#990026] text-white font-extrabold text-xs uppercase tracking-widest rounded-xl border border-[#baa47f]/40 shadow-[0_0_20px_rgba(128,0,32,0.4)] transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submittingOrder ? (
                      <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                    ) : (
                      <>Place Order • ₹{totalAmount.toFixed(2)}</>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. 🧾 RUNNING DINING BILL DASHBOARD */}
        {activeTab === "bill" && (() => {
          const foodTotal = sessionOrders.reduce((sum, ord) => sum + (ord.totalAmount || 0), 0);
          const discountTotal = sessionOrders.reduce((sum, ord) => sum + (ord.discountAmount || 0), 0);
          const gstTotal = sessionOrders.reduce((sum, ord) => sum + (ord.gstAmount || 0), 0);
          const serviceChargeTotal = sessionOrders.reduce((sum, ord) => sum + (ord.serviceCharge || 0), 0);
          const grandTotal = sessionOrders.reduce((sum, ord) => sum + (ord.finalAmount || 0), 0);
          const ordersCount = sessionOrders.length;
          const startedTime = sessionOrders.length > 0
            ? new Date(sessionOrders[sessionOrders.length - 1].createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : "N/A";
          
          const guestsSet = new Set<string>();
          sessionOrders.forEach(o => {
            if (o.customerName) guestsSet.add(o.customerName);
          });
          const guestsList = Array.from(guestsSet);

          const isAllPaid = sessionOrders.length > 0 && sessionOrders.every(o => o.paymentStatus === "PAID");

          return (
            <div className="flex flex-col gap-5 max-w-xl mx-auto w-full text-white">
              {/* Top Card: Running Total & Session Header */}
              <section className="bg-gradient-to-br from-[#1b080b] via-[#260c10] to-[#120507] p-6 rounded-3xl border border-[#baa47f]/30 shadow-2xl relative overflow-hidden flex flex-col gap-4">
                <div className="absolute top-0 right-0 w-44 h-44 bg-[#baa47f]/10 rounded-bl-[140px] pointer-events-none" />
                
                <div className="flex items-center justify-between z-10">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#baa47f]">
                      Table #{tableNumber || 1} Running Bill
                    </span>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-sm ${
                    isAllPaid
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  }`}>
                    {isAllPaid ? "Paid" : "Pending"}
                  </span>
                </div>

                <div className="flex items-baseline justify-between z-10">
                  <div>
                    <span className="text-4xl font-display font-extrabold text-white tracking-tight">
                      ₹{grandTotal.toFixed(2)}
                    </span>
                    <span className="text-xs text-zinc-400 block mt-1">
                      Live Total for {ordersCount} Order{ordersCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5 pt-4 border-t border-white/10 z-10 text-center text-xs">
                  <div className="bg-black/40 p-2.5 rounded-xl border border-white/5">
                    <span className="text-[10px] text-zinc-400 uppercase font-bold block">Orders</span>
                    <span className="font-extrabold text-white text-sm">{ordersCount}</span>
                  </div>
                  <div className="bg-black/40 p-2.5 rounded-xl border border-white/5">
                    <span className="text-[10px] text-zinc-400 uppercase font-bold block">Guests</span>
                    <span className="font-extrabold text-white text-sm">{guestsList.length || 1}</span>
                  </div>
                  <div className="bg-black/40 p-2.5 rounded-xl border border-white/5">
                    <span className="text-[10px] text-zinc-400 uppercase font-bold block">Started</span>
                    <span className="font-extrabold text-white text-xs">{startedTime}</span>
                  </div>
                </div>
              </section>

              {/* Financial Breakdown */}
              <section className="bg-zinc-900/90 border border-zinc-800 p-5 rounded-2xl shadow-xl flex flex-col gap-3 text-xs text-zinc-300">
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#baa47f]">
                  🧾 Financial Summary
                </span>
                
                <div className="flex justify-between">
                  <span>Food Subtotal</span>
                  <span className="font-bold text-white">₹{foodTotal.toFixed(2)}</span>
                </div>

                {discountTotal > 0 && (
                  <div className="flex justify-between text-emerald-400 font-bold">
                    <span>Discount Applied</span>
                    <span>-₹{discountTotal.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span>GST (5%)</span>
                  <span className="font-bold text-white">₹{gstTotal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between">
                  <span>Service Charge (5%)</span>
                  <span className="font-bold text-white">₹{serviceChargeTotal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-sm font-extrabold text-white pt-3 border-t border-zinc-800">
                  <span>Grand Total</span>
                  <span className="text-[#baa47f] font-mono text-base">₹{grandTotal.toFixed(2)}</span>
                </div>
              </section>

              {/* Guest Breakdown (If Guest Names Exist) */}
              {guestsList.length > 0 && (
                <section className="bg-zinc-900/90 border border-zinc-800 p-5 rounded-2xl shadow-xl flex flex-col gap-3">
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#baa47f]">
                    👤 Guest-Wise Breakdown
                  </span>
                  <div className="flex flex-col gap-2">
                    {guestsList.map((gName, idx) => {
                      const gOrders = sessionOrders.filter(o => o.customerName === gName);
                      const gTotal = gOrders.reduce((sum, o) => sum + (o.finalAmount || 0), 0);
                      return (
                        <div key={idx} className="p-3 bg-zinc-950 rounded-xl border border-zinc-800/80 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-[#800020] text-amber-300 font-bold flex items-center justify-center text-[10px]">
                              {gName.charAt(0).toUpperCase()}
                            </span>
                            <span className="font-bold text-white">{gName}</span>
                          </div>
                          <span className="font-mono font-extrabold text-amber-300">₹{gTotal.toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Orders Section */}
              <section className="bg-zinc-900/90 border border-zinc-800 p-5 rounded-2xl shadow-xl flex flex-col gap-4">
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#baa47f]">
                  📦 Session Order Tickets ({ordersCount})
                </span>

                {sessionOrders.length === 0 ? (
                  <p className="text-xs text-zinc-500 text-center py-4">No placed orders in this session yet.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {sessionOrders.map((ord) => (
                      <div key={ord.id} className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 flex flex-col gap-3 text-xs">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                          <div>
                            <span className="font-extrabold text-white text-sm">Ticket #{ord.orderNumber}</span>
                            <span className="text-[10px] text-zinc-400 block mt-0.5">
                              {new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              {ord.customerName && ` · Guest: ${ord.customerName}`}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-mono font-extrabold text-[#baa47f] text-sm block">₹{ord.finalAmount.toFixed(2)}</span>
                            <span className="text-[9px] font-bold uppercase text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30 inline-block mt-0.5">
                              {ord.status}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5 pt-1">
                          {ord.items?.map((it: any) => (
                            <div key={it.id} className="flex justify-between text-zinc-300 text-[11px]">
                              <span>{it.name} <strong className="text-white">× {it.quantity}</strong></span>
                              <span className="font-mono text-zinc-300">₹{(it.price * it.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Quick Actions Grid */}
              <section className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <button
                  onClick={() => setActiveTab("menu")}
                  className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-[#baa47f]/40 text-white flex flex-col items-center justify-center gap-1.5 transition cursor-pointer shadow-md"
                >
                  <Plus className="w-5 h-5 text-emerald-400" />
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">Order More</span>
                </button>

                <button
                  onClick={() => handleServiceRequest(RequestType.WAITER)}
                  className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-[#baa47f]/40 text-white flex flex-col items-center justify-center gap-1.5 transition cursor-pointer shadow-md"
                >
                  <Bell className="w-5 h-5 text-amber-400" />
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">Call Waiter</span>
                </button>

                <button
                  onClick={() => handleServiceRequest(RequestType.BILL)}
                  className="p-3.5 rounded-2xl bg-[#800020] border border-[#baa47f]/40 hover:bg-[#990026] text-white flex flex-col items-center justify-center gap-1.5 transition cursor-pointer shadow-md"
                >
                  <FileText className="w-5 h-5 text-amber-300" />
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">Request Payment</span>
                </button>

                <button
                  onClick={() => addToast("Downloading digital invoice copy...", "info")}
                  className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-[#baa47f]/40 text-white flex flex-col items-center justify-center gap-1.5 transition cursor-pointer shadow-md"
                >
                  <FileText className="w-5 h-5 text-sky-400" />
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">Download Bill</span>
                </button>
              </section>
            </div>
          );
        })()}

        {/* 5. 👤 TABLE TAB */}
        {activeTab === "table" && (
          <div className="flex flex-col gap-6 max-w-xl mx-auto w-full bg-zinc-900/90 p-6 rounded-2xl border border-[#baa47f]/30 text-white shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div>
                <span className="text-[10px] text-[#baa47f] font-extrabold uppercase tracking-widest">Table Assistance</span>
                <h3 className="text-lg font-display font-extrabold text-white">Table #{tableNumber || 1}</h3>
              </div>
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold rounded-full uppercase">
                Active Session
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleServiceRequest(RequestType.WAITER)}
                className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-amber-500/40 flex flex-col items-center gap-2 cursor-pointer transition"
              >
                <Bell className="w-6 h-6 text-amber-400" />
                <span className="text-xs font-bold uppercase">Call Waiter</span>
              </button>
              <button
                onClick={() => handleServiceRequest(RequestType.WATER)}
                className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-amber-500/40 flex flex-col items-center gap-2 cursor-pointer transition"
              >
                <Droplet className="w-6 h-6 text-sky-400" />
                <span className="text-xs font-bold uppercase">Request Water</span>
              </button>
              <button
                onClick={() => handleServiceRequest(RequestType.TISSUE)}
                className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-amber-500/40 flex flex-col items-center gap-2 cursor-pointer transition"
              >
                <FileText className="w-6 h-6 text-amber-400" />
                <span className="text-xs font-bold uppercase">Tissues</span>
              </button>
              <button
                onClick={() => handleServiceRequest(RequestType.WAITER, "Spoon / Cutlery")}
                className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-amber-500/40 flex flex-col items-center gap-2 cursor-pointer transition"
              >
                <Utensils className="w-6 h-6 text-indigo-400" />
                <span className="text-xs font-bold uppercase">Need Spoon</span>
              </button>
              <button
                onClick={() => handleServiceRequest(RequestType.WAITER, "Table Cleaning")}
                className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-amber-500/40 flex flex-col items-center gap-2 cursor-pointer transition"
              >
                <Sparkles className="w-6 h-6 text-emerald-400" />
                <span className="text-xs font-bold uppercase">Table Cleaning</span>
              </button>
              <button
                onClick={() => handleServiceRequest(RequestType.WAITER, "Speak with Manager")}
                className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-amber-500/40 flex flex-col items-center gap-2 cursor-pointer transition"
              >
                <Info className="w-6 h-6 text-purple-400" />
                <span className="text-xs font-bold uppercase">Speak with Manager</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Floating Bottom Cart Bar (Shown when in menu tab with cart items) */}
      {cartItems.length > 0 && activeTab === "menu" && (
        <div className="fixed bottom-16 left-4 right-4 max-w-xl mx-auto z-30">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            onClick={() => setActiveTab("cart")}
            className="bg-[#800020] text-white p-3.5 rounded-2xl border border-[#baa47f] shadow-2xl backdrop-blur-xl flex items-center justify-between gap-4 cursor-pointer hover:bg-[#990026] transition"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-black/40 border border-[#baa47f]/30 flex items-center justify-center shrink-0">
                <ShoppingBag className="w-4 h-4 text-amber-300" />
              </div>
              <div>
                <span className="text-xs font-extrabold text-white block">
                  {cartItems.reduce((acc, ci) => acc + ci.quantity, 0)} Items Added
                </span>
                <span className="text-[10px] text-zinc-300">Total: ₹{totalAmount.toFixed(2)}</span>
              </div>
            </div>
            <span className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center gap-1">
              View Cart →
            </span>
          </motion.div>
        </div>
      )}

      {/* PROGRESSIVE 5-TAB SPA BOTTOM NAVIGATION */}
      <CustomerBottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        ordersCount={sessionOrders.filter((o) => o.status !== "COMPLETED" && o.status !== "CANCELLED").length}
        hasPlacedOrder={sessionOrders.length > 0}
        runningBillTotal={sessionOrders.reduce((sum, ord) => sum + (ord.finalAmount || 0), 0)}
      />

      {/* DEDICATED FILTERS MODAL */}
      <AnimatePresence>
        {isFilterModalOpen && (
          <motion.div key="filter-modal-wrapper" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              key="filter-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFilterModalOpen(false)}
              className="fixed inset-0 bg-black backdrop-blur-sm"
            />

            <motion.div
              key="filter-content"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="relative w-full max-w-lg bg-[#0b0506] border border-[#baa47f]/40 rounded-t-[28px] sm:rounded-2xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto z-10 flex flex-col gap-6 text-white"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-[#baa47f]" />
                  <h3 className="font-display font-extrabold text-base uppercase tracking-wider text-white">
                    Refine Menu Filters
                  </h3>
                </div>
                <button
                  onClick={() => setIsFilterModalOpen(false)}
                  className="p-1.5 rounded-full bg-zinc-900 text-zinc-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Filter Section 1: Categories */}
              <div className="flex flex-col gap-2.5">
                <span className="text-xs font-extrabold text-[#baa47f] uppercase tracking-wider">
                  Menu Categories
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setSelectedCategory("all");
                      setSelectedSubCategory("all");
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
                      selectedCategory === "all"
                        ? "bg-[#800020] text-white border-[#baa47f]"
                        : "bg-zinc-900 text-zinc-400 border-zinc-800"
                    }`}
                  >
                    All Categories
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setSelectedCategory(cat.id);
                        setSelectedSubCategory("all");
                      }}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
                        selectedCategory === cat.id
                          ? "bg-[#800020] text-white border-[#baa47f]"
                          : "bg-zinc-900 text-zinc-400 border-zinc-800"
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filter Section 2: Dietary Preferences */}
              <div className="flex flex-col gap-2.5">
                <span className="text-xs font-extrabold text-[#baa47f] uppercase tracking-wider">
                  Dietary Preference
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setVegOnly(!vegOnly)}
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between transition ${
                      vegOnly
                        ? "bg-emerald-950/60 border-emerald-500 text-emerald-300"
                        : "bg-zinc-900 border-zinc-800 text-zinc-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span>Veg Only</span>
                    </div>
                    {vegOnly && <Check className="w-4 h-4 text-emerald-400" />}
                  </button>

                  <button
                    onClick={() => setJainOnly(!jainOnly)}
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between transition ${
                      jainOnly
                        ? "bg-amber-950/60 border-amber-500 text-amber-300"
                        : "bg-zinc-900 border-zinc-800 text-zinc-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <span>Jain Food</span>
                    </div>
                    {jainOnly && <Check className="w-4 h-4 text-amber-300" />}
                  </button>
                </div>
              </div>

              {/* Filter Section 3: Sort By */}
              <div className="flex flex-col gap-2.5">
                <span className="text-xs font-extrabold text-[#baa47f] uppercase tracking-wider flex items-center gap-1.5">
                  <ArrowUpDown className="w-3.5 h-3.5" /> Sort By
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "recommended", label: "Recommended" },
                    { id: "price-asc", label: "Price: Low to High" },
                    { id: "price-desc", label: "Price: High to Low" },
                    { id: "prep-time", label: "Fastest Prep Time" },
                  ].map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setSortBy(option.id as any)}
                      className={`p-2.5 rounded-xl border text-xs font-bold text-left transition ${
                        sortBy === option.id
                          ? "bg-[#800020] border-[#baa47f] text-white"
                          : "bg-zinc-900 border-zinc-800 text-zinc-400"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filter Actions */}
              <div className="flex items-center gap-3 pt-3 border-t border-zinc-800">
                <button
                  onClick={() => {
                    setSelectedCategory("all");
                    setSelectedSubCategory("all");
                    setVegOnly(false);
                    setJainOnly(false);
                    setSelectedSpicyLevel("ALL");
                    setSortBy("recommended");
                  }}
                  className="flex-1 py-3 bg-zinc-900 text-zinc-300 text-xs font-bold rounded-xl border border-zinc-800 hover:bg-zinc-800"
                >
                  Reset All
                </button>

                <button
                  onClick={() => setIsFilterModalOpen(false)}
                  className="flex-1 py-3 bg-[#800020] text-white text-xs font-extrabold uppercase tracking-wider rounded-xl border border-[#baa47f]/40 shadow-lg"
                >
                  Apply Filters ({filteredItems.length})
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FOOD INSPECTOR / CUSTOMIZATION MODAL */}
      <AnimatePresence>
        {inspectingItem && (
          <motion.div key="inspector-modal-wrapper" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              key="inspector-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setInspectingItem(null)}
              className="fixed inset-0 bg-black backdrop-blur-sm"
            />

            <motion.div
              key="inspector-drawer"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="relative w-full max-w-lg bg-[#0b0506] border border-[#baa47f]/40 rounded-t-[28px] sm:rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto z-10 flex flex-col justify-between gap-6 text-white"
            >
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                  <h3 className="font-display font-extrabold text-base text-[#baa47f]">
                    {inspectingItem.name}
                  </h3>
                  <button
                    onClick={() => setInspectingItem(null)}
                    className="p-1.5 rounded-full bg-zinc-900 text-zinc-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="relative h-44 w-full rounded-2xl overflow-hidden mt-4 bg-neutral-900">
                  <Image src={inspectingItem.image || "/logo.png"} alt={inspectingItem.name} fill className="object-cover" />
                </div>

                <p className="text-xs text-zinc-300 mt-3 leading-relaxed">
                  {inspectingItem.description}
                </p>

                <div className="flex items-center justify-between mt-4 p-3 bg-zinc-900/80 rounded-xl border border-zinc-800">
                  <span className="text-xs font-bold text-zinc-400">Price</span>
                  <span className="text-lg font-extrabold text-white">₹{inspectingItem.price}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-800 flex items-center gap-3">
                <button
                  onClick={() => {
                    handleQuickAdd(inspectingItem);
                    setInspectingItem(null);
                  }}
                  className="w-full py-3.5 bg-[#800020] text-white text-xs font-extrabold uppercase tracking-wider rounded-xl border border-[#baa47f]/40 shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-amber-300" /> Add to Order (₹{inspectingItem.price})
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CHECKOUT CART DRAWER */}
      <AnimatePresence>
        {cartOpen && (
          <motion.div key="cart-drawer-wrapper" className="fixed inset-0 z-50 flex justify-end">
            <motion.div
              key="cart-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setCartOpen(false)}
              className="fixed inset-0 bg-black backdrop-blur-sm"
            />

            <motion.div
              key="cart-sheet"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="relative w-full max-w-md bg-[#0b0506] border-l border-[#baa47f]/30 h-full p-6 shadow-2xl overflow-y-auto z-10 flex flex-col justify-between text-white"
            >
              <div>
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-[#baa47f]" />
                    <h3 className="font-display font-extrabold text-base text-white">Your Dining Cart</h3>
                  </div>
                  <button onClick={() => setCartOpen(false)} className="p-1.5 rounded-full bg-zinc-900 text-zinc-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Items List */}
                {cartItems.length === 0 ? (
                  <div className="py-16 text-center flex flex-col items-center gap-3">
                    <ShoppingBag className="w-12 h-12 text-zinc-700" />
                    <p className="text-sm font-bold text-zinc-400">Your cart is empty.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 py-4 border-b border-zinc-800">
                    {cartItems.map((ci) => (
                      <div key={ci.cartItemId} className="p-3 bg-zinc-900/80 rounded-xl border border-zinc-800 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-xs text-white truncate">{ci.name}</h4>
                          <p className="text-[11px] text-[#baa47f]">₹{ci.price} x {ci.quantity}</p>
                        </div>
                        <div className="flex items-center gap-2 bg-[#800020] border border-[#baa47f]/50 rounded-lg px-2 py-1 text-white">
                          <button onClick={() => updateQuantity(ci.cartItemId, ci.quantity - 1)} className="p-0.5 cursor-pointer">
                            <Minus className="w-3.5 h-3.5 text-amber-300" />
                          </button>
                          <span className="text-xs font-black w-4 text-center">{ci.quantity}</span>
                          <button onClick={() => updateQuantity(ci.cartItemId, ci.quantity + 1)} className="p-0.5 cursor-pointer">
                            <Plus className="w-3.5 h-3.5 text-amber-300" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Bill Summary */}
                {cartItems.length > 0 && (
                  <div className="py-4 flex flex-col gap-2 border-b border-zinc-800 text-xs text-zinc-300">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span className="font-bold text-white">₹{subtotal.toFixed(2)}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-emerald-400 font-bold">
                        <span>Discount</span>
                        <span>-₹{discount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>GST (5%)</span>
                      <span className="font-bold text-white">₹{gstAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Service Charge (5%)</span>
                      <span className="font-bold text-white">₹{serviceChargeAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-extrabold text-white pt-2 border-t border-zinc-800">
                      <span>Total Payable</span>
                      <span className="text-[#baa47f]">₹{totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {/* Customer Details Form */}
                {cartItems.length > 0 && (
                  <div className="py-4 flex flex-col gap-3">
                    <label className="text-xs font-bold text-zinc-300">Your Name (Optional)</label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Enter guest name"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white focus:outline-none focus:border-[#baa47f]"
                    />
                  </div>
                )}
              </div>

              {/* Submit Order CTA */}
              {cartItems.length > 0 && (
                <div className="pt-4 border-t border-zinc-800">
                  {orderError && (
                    <div className="p-2.5 mb-3 bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs rounded-xl flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{orderError}</span>
                    </div>
                  )}

                  <button
                    onClick={handlePlaceOrder}
                    disabled={submittingOrder}
                    className="w-full py-4 bg-[#800020] hover:bg-[#990026] text-white font-extrabold text-xs uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 border border-[#baa47f]/40 shadow-xl disabled:opacity-50 cursor-pointer"
                  >
                    {submittingOrder ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                        <span>Sending Order to Kitchen...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-amber-300" />
                        <span>Confirm & Place Order (₹{totalAmount.toFixed(2)})</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TABLE SERVICE CALL MODAL */}
      <AnimatePresence>
        {serviceFABOpen && (
          <motion.div key="service-modal-wrapper" className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              key="service-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setServiceFABOpen(false)}
              className="fixed inset-0 bg-black backdrop-blur-sm"
            />
            <motion.div
              key="service-card"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-[#0b0506] border border-[#baa47f]/40 rounded-2xl p-6 shadow-2xl z-10 flex flex-col gap-4 text-white"
            >
              <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
                <h3 className="font-display font-extrabold text-sm text-[#baa47f] uppercase tracking-wider flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-400" /> Call Table Assistant
                </h3>
                <button onClick={() => setServiceFABOpen(false)} className="text-zinc-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {[
                  { type: RequestType.WATER, label: "Request Water Pitcher", icon: Droplet },
                  { type: RequestType.WAITER, label: "Call Floor Waiter", icon: Bell },
                  { type: RequestType.BILL, label: "Request Final Bill", icon: FileText },
                  { type: RequestType.TISSUE, label: "Request Tissues", icon: Sparkles },
                ].map((req) => {
                  const IconComp = req.icon;
                  return (
                    <button
                      key={req.type}
                      onClick={() => handleServiceRequest(req.type)}
                      disabled={requestingService}
                      className="p-3 bg-zinc-900 hover:bg-[#800020]/40 border border-zinc-800 hover:border-[#baa47f]/50 rounded-xl text-left text-xs font-extrabold text-white flex items-center gap-3 transition cursor-pointer"
                    >
                      <IconComp className="w-4 h-4 text-[#baa47f]" />
                      <span>{req.label}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* VIEW ORDER DETAILS BOTTOM SHEET MODAL */}
      <AnimatePresence>
        {selectedViewOrder && (
          <motion.div key="view-order-wrapper" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              key="view-order-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedViewOrder(null)}
              className="fixed inset-0 bg-black backdrop-blur-sm"
            />

            <motion.div
              key="view-order-content"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="relative w-full max-w-lg bg-[#0b0506] border border-[#baa47f]/40 rounded-t-[28px] sm:rounded-2xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto z-10 flex flex-col gap-5 text-white"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div>
                  <span className="text-[10px] text-[#baa47f] font-extrabold uppercase tracking-widest block">Order Details</span>
                  <h3 className="text-base font-display font-extrabold text-white">Ticket #{selectedViewOrder.orderNumber}</h3>
                </div>
                <button
                  onClick={() => setSelectedViewOrder(null)}
                  className="p-1.5 rounded-full bg-zinc-900 text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Items List */}
              <div className="flex flex-col gap-2.5">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#baa47f]">Itemized Breakdown</span>
                {selectedViewOrder.items?.map((it: any) => (
                  <div key={it.id} className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-lg bg-[#800020] text-amber-300 font-extrabold text-xs flex items-center justify-center">
                        {it.quantity}×
                      </span>
                      <span className="font-bold text-white">{it.name}</span>
                    </div>
                    <span className="font-mono font-bold text-zinc-300">₹{(it.price * it.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Financial Calculation */}
              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 flex flex-col gap-2 text-xs text-zinc-400">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-bold text-white">₹{(selectedViewOrder.totalAmount || 0).toFixed(2)}</span>
                </div>
                {selectedViewOrder.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-400 font-bold">
                    <span>Discount</span>
                    <span>-₹{selectedViewOrder.discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>GST (5%)</span>
                  <span className="font-bold text-white">₹{(selectedViewOrder.gstAmount || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Service Charge (5%)</span>
                  <span className="font-bold text-white">₹{(selectedViewOrder.serviceCharge || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-extrabold text-white pt-2 border-t border-zinc-800">
                  <span>Grand Total</span>
                  <span className="font-mono text-[#baa47f]">₹{(selectedViewOrder.finalAmount || 0).toFixed(2)}</span>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex gap-2.5 pt-2">
                <button
                  onClick={() => {
                    handleRepeatOrder(selectedViewOrder);
                    setSelectedViewOrder(null);
                  }}
                  className="flex-1 py-3 bg-[#800020] text-white text-xs font-extrabold uppercase tracking-wider rounded-xl border border-[#baa47f]/40 cursor-pointer hover:bg-[#990026] transition flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" /> Repeat Order
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOAST NOTIFICATIONS */}
      <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              className={`p-3.5 rounded-xl border text-xs font-extrabold shadow-2xl flex items-center gap-2.5 pointer-events-auto ${
                t.type === "success"
                  ? "bg-emerald-950/90 border-emerald-500/50 text-emerald-200"
                  : t.type === "error"
                  ? "bg-rose-950/90 border-rose-500/50 text-rose-200"
                  : "bg-zinc-900/90 border-zinc-700 text-zinc-200"
              }`}
            >
              <Info className="w-4 h-4 shrink-0" />
              <span>{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
