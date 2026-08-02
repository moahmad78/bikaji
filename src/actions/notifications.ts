"use server";

import db from "@/lib/db";
import { Role } from "@prisma/client";

// Chronological grouping helper
function groupNotificationsChronologically(notifications: any[]) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const startOfThisWeek = startOfToday - 7 * 24 * 60 * 60 * 1000;

  const today: any[] = [];
  const yesterday: any[] = [];
  const thisWeek: any[] = [];
  const older: any[] = [];

  notifications.forEach(n => {
    const time = new Date(n.createdAt).getTime();
    if (time >= startOfToday) {
      today.push(n);
    } else if (time >= startOfYesterday) {
      yesterday.push(n);
    } else if (time >= startOfThisWeek) {
      thisWeek.push(n);
    } else {
      older.push(n);
    }
  });

  return { today, yesterday, thisWeek, older };
}

// 1. Fetch, sort and group all active notifications for a specific user or role
export async function fetchNotificationsAction(userId?: string, role?: Role) {
  try {
    const notifications = await db.notification.findMany({
      where: {
        OR: [
          userId ? { userId } : {},
          role ? { role } : {}
        ],
        deletedAt: null
      },
      orderBy: { createdAt: "desc" }
    });

    const grouped = groupNotificationsChronologically(notifications);
    return { success: true, grouped };
  } catch (error: any) {
    console.error("[Notification Actions] Fetch error:", error);
    return { success: false, error: "Failed to retrieve notifications catalog." };
  }
}

// 2. Mark notification status read
export async function markNotificationAsReadAction(notificationId: string) {
  try {
    const updated = await db.notification.update({
      where: { id: notificationId },
      data: { isRead: true }
    });
    return { success: true, notification: updated };
  } catch (error: any) {
    console.error("[Notification Actions] Read update error:", error);
    return { success: false, error: "Failed to update read status." };
  }
}

// 3. Soft delete / archive notifications
export async function archiveNotificationAction(notificationId: string) {
  try {
    const updated = await db.notification.update({
      where: { id: notificationId },
      data: { deletedAt: new Date() }
    });
    return { success: true, notification: updated };
  } catch (error: any) {
    console.error("[Notification Actions] Archive error:", error);
    return { success: false, error: "Failed to archive notification record." };
  }
}
