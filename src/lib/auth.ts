import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import db from "./db";

export const auth = betterAuth({
  trustedOrigins: [
    "https://bikaji-xi.vercel.app", 
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  ],
  advanced: {
    defaultCookieAttributes: {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    }
  },
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "CUSTOMER",
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  // Audit Hooks: Log successful logins and logouts in the ActivityLog schema
  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          try {
            const firstBranch = await db.branch.findFirst();
            await db.activityLog.create({
              data: {
                userId: session.userId,
                branchId: firstBranch?.id || null,
                action: "LOGIN_SUCCESS",
                details: `User logged in from IP: ${session.ipAddress || "Unknown IP"}, UA: ${session.userAgent || "Unknown UA"}`
              }
            });
          } catch (err) {
            console.error("[Auth Hooks] Failed to log login success:", err);
          }
        }
      },
      delete: {
        before: async (session) => {
          try {
            const firstBranch = await db.branch.findFirst();
            await db.activityLog.create({
              data: {
                userId: session.userId,
                branchId: firstBranch?.id || null,
                action: "LOGOUT",
                details: `User logged out and session revoked (IP: ${session.ipAddress || "Unknown"})`
              }
            });
          } catch (err) {
            console.error("[Auth Hooks] Failed to log logout:", err);
          }
        }
      }
    }
  }
});

export type Session = typeof auth.$Infer.Session;
