import { headers } from "next/headers";
import { Role } from "@prisma/client";
import { auth } from "./auth";

/**
 * Server-side authorization check helper for Server Actions and Router endpoints.
 * Enforces authentication and checks if user role matches criteria.
 * 
 * @param requiredRoles Array of authorized Roles. If empty/undefined, any logged-in user is accepted.
 * @returns The active session object.
 * @throws Error indicating 'Unauthorized' or 'Forbidden' status.
 */
export async function checkAuth(requiredRoles?: Role[]) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({
    headers: reqHeaders
  });

  if (!session?.user) {
    throw new Error("Unauthorized: Session is missing, expired, or invalid.");
  }

  const user = session.user as any;

  if (requiredRoles && requiredRoles.length > 0) {
    if (!requiredRoles.includes(user.role)) {
      throw new Error(`Forbidden: Insufficient privileges. Role '${user.role}' is not authorized.`);
    }
  }

  return session;
}
