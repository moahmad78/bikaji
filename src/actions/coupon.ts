"use server";

import db from "@/lib/db";

export async function validateCoupon(code: string, subtotal: number, branchId?: string | null) {
  try {
    let activeBranchId = branchId;
    if (!activeBranchId) {
      const defaultBranch = await db.branch.findFirst();
      activeBranchId = defaultBranch?.id || null;
    }

    const coupon = await db.coupon.findFirst({
      where: {
        code: code.toUpperCase().trim(),
        branchId: activeBranchId || undefined,
        deletedAt: null,
      },
    });

    if (!coupon) {
      return { success: false, error: "Invalid coupon code." };
    }

    if (!coupon.isActive) {
      return { success: false, error: "This coupon is no longer active." };
    }

    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      return { success: false, error: "This coupon has expired." };
    }

    if (subtotal < coupon.minOrderAmount) {
      return {
        success: false,
        error: `Minimum order amount of ₹${coupon.minOrderAmount} required to use this coupon.`,
      };
    }

    return {
      success: true,
      coupon: {
        code: coupon.code,
        discountPercent: coupon.discountPercent,
        maxDiscount: coupon.maxDiscount || undefined,
        minOrderAmount: coupon.minOrderAmount,
      },
    };
  } catch (error: any) {
    console.error("Error validating coupon:", error);
    return { success: false, error: "Failed to validate coupon." };
  }
}

export async function getAvailableCoupons(branchId?: string | null) {
  try {
    let activeBranchId = branchId;
    if (!activeBranchId) {
      const defaultBranch = await db.branch.findFirst();
      activeBranchId = defaultBranch?.id || null;
    }

    const coupons = await db.coupon.findMany({
      where: {
        branchId: activeBranchId || undefined,
        isActive: true,
        deletedAt: null,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      select: {
        code: true,
        discountPercent: true,
        discountType: true,
        discountValue: true,
        maxDiscount: true,
        minOrderAmount: true,
      },
      orderBy: {
        minOrderAmount: 'asc'
      }
    });

    return { success: true, coupons };
  } catch (error: any) {
    console.error("Error fetching coupons:", error);
    return { success: false, error: "Failed to fetch available coupons." };
  }
}
