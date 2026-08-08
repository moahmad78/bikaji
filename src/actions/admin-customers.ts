"use server";

import db from "@/lib/db";
import { checkAuth } from "@/lib/auth-helper";
import { Role } from "@prisma/client";

export async function getAdminCustomers() {
  try {
    await checkAuth([Role.ADMIN, Role.SUPER_ADMIN]);

    // Fetch all Guest Sessions (CustomerSessions) with their orders and table info
    const sessions = await db.customerSession.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        table: true,
        orders: {
          orderBy: { createdAt: "desc" },
          include: {
            items: {
              include: {
                menuItem: true,
                modifiers: true,
                addons: true
              }
            }
          }
        }
      }
    });

    // Optionally fetch registered users if needed (for later expansion)
    const users = await db.user.findMany({
      where: { role: Role.CUSTOMER },
      orderBy: { createdAt: "desc" },
      include: {
        orders: {
          orderBy: { createdAt: "desc" },
          include: {
            table: true,
            items: {
              include: {
                menuItem: true,
                modifiers: true,
                addons: true
              }
            }
          }
        }
      }
    });

    return { success: true, sessions, users };
  } catch (error: any) {
    console.error("Failed to fetch customers:", error);
    return { success: false, error: error.message };
  }
}
