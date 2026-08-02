"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCart } from "@/features/cart/CartContext";
import { UtensilsCrossed, PackageCheck, ShoppingCart, FileText, Armchair } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export type CustomerTab = "menu" | "orders" | "cart" | "bill" | "table";

interface CustomerBottomNavProps {
  orderId?: string;
  activeTab?: CustomerTab;
  onTabChange?: (tab: CustomerTab) => void;
  ordersCount?: number;
  hasPlacedOrder?: boolean;
  runningBillTotal?: number;
}

export default function CustomerBottomNav({
  orderId,
  activeTab,
  onTabChange,
  ordersCount = 0,
  hasPlacedOrder = false,
  runningBillTotal = 0,
}: CustomerBottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { tableId, cartItems } = useCart();
  const cartItemsCount = cartItems.reduce((acc, i) => acc + i.quantity, 0);

  // Progressive unlock state: order placed if prop is true OR orders exist OR orderId exists
  const isOrderUnlocked = hasPlacedOrder || ordersCount > 0 || !!orderId;

  // Track if "NEW" indicator should be shown on newly revealed tabs (Orders & Bill)
  const [showNewBadge, setShowNewBadge] = useState<boolean>(false);

  useEffect(() => {
    if (isOrderUnlocked) {
      setShowNewBadge(true);
      const timer = setTimeout(() => setShowNewBadge(false), 8000); // Hide after 8s
      return () => clearTimeout(timer);
    }
  }, [isOrderUnlocked]);

  // Define tab definitions
  const allTabs: {
    key: CustomerTab;
    label: string;
    icon: any;
    badgeText?: string | number;
    badgeType?: "count" | "currency";
    isUnlocked: boolean;
    isNew?: boolean;
  }[] = [
    {
      key: "menu",
      label: "Menu",
      icon: UtensilsCrossed,
      isUnlocked: true,
    },
    {
      key: "orders",
      label: "Orders",
      icon: PackageCheck,
      badgeText: ordersCount > 0 ? ordersCount : undefined,
      badgeType: "count",
      isUnlocked: isOrderUnlocked,
      isNew: showNewBadge,
    },
    {
      key: "cart",
      label: "Cart",
      icon: ShoppingCart,
      badgeText: cartItemsCount > 0 ? cartItemsCount : undefined,
      badgeType: "count",
      isUnlocked: true,
    },
    {
      key: "bill",
      label: "Bill",
      icon: FileText,
      badgeText: runningBillTotal > 0 ? `₹${Math.round(runningBillTotal)}` : undefined,
      badgeType: "currency",
      isUnlocked: isOrderUnlocked,
      isNew: showNewBadge,
    },
    {
      key: "table",
      label: "Table",
      icon: Armchair,
      isUnlocked: true,
    },
  ];

  // Filter only unlocked tabs for progressive display
  const visibleTabs = allTabs.filter((t) => t.isUnlocked);

  const handleTabClick = (tabKey: CustomerTab) => {
    if (onTabChange) {
      onTabChange(tabKey);
    } else {
      // Standalone page fallback
      if (tabKey === "menu") router.push("/menu");
      else if (tabKey === "cart") router.push("/cart");
      else if (tabKey === "orders") router.push(orderId ? `/order-status/${orderId}` : "/menu");
      else if (tabKey === "table") router.push(tableId ? `/table/${tableId}` : "/menu");
      else if (tabKey === "bill") router.push(orderId ? `/order-status/${orderId}` : "/menu");
    }
  };

  const isTabActive = (tabKey: CustomerTab) => {
    if (activeTab) return activeTab === tabKey;
    if (tabKey === "menu" && pathname === "/menu") return true;
    if (tabKey === "cart" && pathname === "/cart") return true;
    if (tabKey === "orders" && pathname.startsWith("/order-status")) return true;
    if (tabKey === "table" && pathname.startsWith("/table")) return true;
    return false;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-neutral-200 shadow-large px-3 py-2 transition-all duration-300">
      <div className="max-w-md mx-auto flex items-center justify-around">
        <AnimatePresence mode="popLayout">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const active = isTabActive(tab.key);

            return (
              <motion.button
                key={tab.key}
                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 10 }}
                transition={{ type: "spring", damping: 20, stiffness: 300 }}
                onClick={() => handleTabClick(tab.key)}
                className={`flex-1 flex flex-col items-center gap-1 py-1 px-1 rounded-xl transition cursor-pointer relative ${
                  active ? "text-primary font-extrabold" : "text-neutral-500 hover:text-neutral-800"
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />

                  {/* Smart Badges */}
                  {tab.badgeText !== undefined && (
                    <span
                      className={`absolute -top-1.5 -right-3 text-[9px] font-extrabold px-1 py-0.2 rounded-full flex items-center justify-center border border-white shadow-sm ${
                        tab.badgeType === "currency"
                          ? "bg-amber-500 text-black text-[8px] px-1.5"
                          : "bg-primary text-white w-4 h-4"
                      }`}
                    >
                      {tab.badgeText}
                    </span>
                  )}

                  {/* Pulsing NEW indicator on first appearance */}
                  {tab.isNew && tab.badgeText === undefined && (
                    <span className="absolute -top-2 -right-3 bg-emerald-500 text-white text-[7px] font-black uppercase px-1 py-0.2 rounded-full animate-bounce shadow-sm">
                      NEW
                    </span>
                  )}
                </div>

                <span className="text-[10px] uppercase font-bold tracking-wider">{tab.label}</span>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </nav>
  );
}
