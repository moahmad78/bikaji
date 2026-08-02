import db from "./db";
import { Role } from "@prisma/client";
import { publishSocketEvent } from "./socket-helper";

// Interfaces for structured notification payloads
export interface NotificationPayload {
  userId?: string | null;
  role?: Role | null;
  title: string;
  body: string;
  type?: string; // "IN_APP" | "ALERT" | "ORDER"
}

// Abstract/Decoupled client adapters for future third-party integrations
class FirebasePushAdapter {
  async send(payload: NotificationPayload) {
    console.log(`[FCM Push Adaptor] Dispatched push notification payload to Firebase Cloud Messaging: "${payload.title}" -> "${payload.body}"`);
    return true;
  }
}

class TwilioSMSAdapter {
  async send(payload: NotificationPayload) {
    console.log(`[Twilio SMS Adaptor] Dispatched SMS/WhatsApp message: "${payload.title}: ${payload.body}"`);
    return true;
  }
}

class EmailAdapter {
  async send(payload: NotificationPayload) {
    console.log(`[Resend Email Adaptor] Dispatched transactional email alert: "${payload.title}"`);
    return true;
  }
}

class NotificationService {
  private pushAdapter = new FirebasePushAdapter();
  private smsAdapter = new TwilioSMSAdapter();
  private emailAdapter = new EmailAdapter();

  /**
   * Dispatches and logs an event-driven system notification.
   * Persists the record in the database and broadcasts in real-time.
   */
  async dispatchNotification(payload: NotificationPayload) {
    try {
      // 1. Persist the notification log in the database
      const notification = await db.notification.create({
        data: {
          userId: payload.userId || null,
          role: payload.role || null,
          title: payload.title,
          body: payload.body,
          type: payload.type || "IN_APP",
          isRead: false
        }
      });

      // 2. Broadcast the notification in real-time via Socket.IO
      let targetRoom: string | undefined = undefined;
      if (payload.role) {
        targetRoom = `role:${payload.role.toLowerCase()}`;
      } else if (payload.userId) {
        targetRoom = `user:${payload.userId}`;
      }

      await publishSocketEvent("notification-new", {
        room: targetRoom,
        data: notification
      });

      // 3. Trigger async secondary channels (SMS, Push, Email) depending on payload severity
      if (payload.type === "ALERT" || payload.role === Role.ADMIN) {
        // Dispatches email/sms alerts for admins
        await this.emailAdapter.send(payload);
        await this.smsAdapter.send(payload);
      } else {
        // Default push notification for staff/waiters
        await this.pushAdapter.send(payload);
      }

      return { success: true, notification };
    } catch (err: any) {
      console.error("[NotificationService] Dispatch error:", err);
      return { success: false, error: err.message || "Failed to dispatch notification." };
    }
  }
}

export const notificationService = new NotificationService();
export default notificationService;
