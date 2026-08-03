"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface SelectedModifier {
  id: string;
  name: string;
  price: number;
}

export interface SelectedAddon {
  id: string;
  name: string;
  price: number;
}

export interface CartItem {
  cartItemId: string; // Unique key: menuItemId + sorted modifiers + sorted addons
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  isVeg: boolean;
  image: string;
  specialNotes?: string;
  selectedModifiers?: SelectedModifier[];
  selectedAddons?: SelectedAddon[];
}

export interface Coupon {
  code: string;
  discountPercent: number;
  maxDiscount?: number;
  minOrderAmount: number;
}

interface CartContextType {
  tableId: string | null;
  tableNumber: number | null;
  branchId: string | null;
  setTable: (id: string, number: number, branchId?: string) => void;
  cartItems: CartItem[];
  addToCart: (item: Omit<CartItem, "quantity" | "cartItemId">) => void;
  removeFromCart: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  updateSpecialNotes: (cartItemId: string, notes: string) => void;
  clearCart: () => void;
  appliedCoupon: Coupon | null;
  applyCoupon: (coupon: Coupon | null) => void;
  specialInstructions: string;
  setSpecialInstructions: (notes: string) => void;
  
  // Financial Calculations
  subtotal: number;
  discount: number;
  gstAmount: number;
  serviceChargeAmount: number;
  totalAmount: number;
  
  // Restaurant Settings
  gstRate: number;
  serviceChargeRate: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};

// Helper to generate a unique cart item identifier based on menu item and selections
export const generateCartItemId = (
  menuItemId: string,
  modifiers: SelectedModifier[] = [],
  addons: SelectedAddon[] = []
): string => {
  const sortedModIds = [...modifiers].map((m) => m.id).sort().join("-");
  const sortedAddIds = [...addons].map((a) => a.id).sort().join("-");
  return `${menuItemId}_${sortedModIds || "none"}_${sortedAddIds || "none"}`;
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tableId, setTableId] = useState<string | null>(null);
  const [tableNumber, setTableNumber] = useState<number | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [specialInstructions, setSpecialInstructions] = useState<string>("");

  // Default tax configurations (from schema settings defaults)
  const gstRate = 5.0; // 5% GST
  const serviceChargeRate = 5.0; // 5% Service Charge

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem("bikaji_cart");
    const savedTableId = localStorage.getItem("bikaji_table_id");
    const savedTableNum = localStorage.getItem("bikaji_table_number");
    const savedBranchId = localStorage.getItem("bikaji_branch_id");
    
    if (savedCart) {
      const parsedCart = JSON.parse(savedCart);
      const sanitizedCart = parsedCart.map((item: any) => ({
        ...item,
        image: item.image?.includes("unsplash.com") ? "/item.png" : item.image
      }));
      setCartItems(sanitizedCart);
    }
    if (savedTableId === "demo-table-id" || savedBranchId === "demo-branch-id") {
      localStorage.removeItem("bikaji_table_id");
      localStorage.removeItem("bikaji_table_number");
      localStorage.removeItem("bikaji_branch_id");
    } else {
      if (savedTableId) setTableId(savedTableId);
      if (savedTableNum) setTableNumber(parseInt(savedTableNum, 10));
      if (savedBranchId) setBranchId(savedBranchId);
    }
  }, []);

  // Save cart changes to localStorage
  const saveCart = (items: CartItem[]) => {
    setCartItems(items);
    localStorage.setItem("bikaji_cart", JSON.stringify(items));
  };

  const setTable = (id: string, number: number, branch?: string) => {
    setTableId(id);
    setTableNumber(number);
    localStorage.setItem("bikaji_table_id", id);
    localStorage.setItem("bikaji_table_number", number.toString());
    if (branch) {
      setBranchId(branch);
      localStorage.setItem("bikaji_branch_id", branch);
    }
  };

  const addToCart = (item: Omit<CartItem, "quantity" | "cartItemId">) => {
    const cartItemId = generateCartItemId(item.menuItemId, item.selectedModifiers, item.selectedAddons);
    const existingIndex = cartItems.findIndex((i) => i.cartItemId === cartItemId);
    
    if (existingIndex > -1) {
      const updated = [...cartItems];
      updated[existingIndex].quantity += 1;
      saveCart(updated);
    } else {
      saveCart([...cartItems, { ...item, cartItemId, quantity: 1 }]);
    }
  };

  const removeFromCart = (cartItemId: string) => {
    const updated = cartItems.filter((i) => i.cartItemId !== cartItemId);
    saveCart(updated);
  };

  const updateQuantity = (cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(cartItemId);
      return;
    }
    const updated = cartItems.map((i) => 
      i.cartItemId === cartItemId ? { ...i, quantity } : i
    );
    saveCart(updated);
  };

  const updateSpecialNotes = (cartItemId: string, notes: string) => {
    const updated = cartItems.map((i) => 
      i.cartItemId === cartItemId ? { ...i, specialNotes: notes } : i
    );
    saveCart(updated);
  };

  const clearCart = () => {
    saveCart([]);
    setAppliedCoupon(null);
    setSpecialInstructions("");
  };

  const applyCoupon = (coupon: Coupon | null) => {
    setAppliedCoupon(coupon);
  };

  // Calculations
  const subtotal = cartItems.reduce((sum, item) => {
    const modifiersTotal = (item.selectedModifiers || []).reduce((s, m) => s + m.price, 0);
    const addonsTotal = (item.selectedAddons || []).reduce((s, a) => s + a.price, 0);
    const priceWithCustomizations = item.price + modifiersTotal + addonsTotal;
    return sum + priceWithCustomizations * item.quantity;
  }, 0);
  
  let discount = 0;
  if (appliedCoupon && subtotal >= appliedCoupon.minOrderAmount) {
    discount = (subtotal * appliedCoupon.discountPercent) / 100;
    if (appliedCoupon.maxDiscount && discount > appliedCoupon.maxDiscount) {
      discount = appliedCoupon.maxDiscount;
    }
  }

  const netAmount = Math.max(0, subtotal - discount);
  const gstAmount = parseFloat(((netAmount * gstRate) / 100).toFixed(2));
  const serviceChargeAmount = parseFloat(((netAmount * serviceChargeRate) / 100).toFixed(2));
  const totalAmount = parseFloat((netAmount + gstAmount + serviceChargeAmount).toFixed(2));

  return (
    <CartContext.Provider
      value={{
        tableId,
        tableNumber,
        branchId,
        setTable,
        cartItems,
        addToCart,
        removeFromCart,
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
        gstRate,
        serviceChargeRate,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
