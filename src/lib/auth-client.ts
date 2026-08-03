import { createAuthClient } from "better-auth/react";

const getClientBaseUrl = () => {
  if (typeof window !== "undefined") {
    // In browser: dynamically use the active page origin to prevent cross-origin 'Failed to fetch' errors
    return window.location.origin;
  }
  // SSR / Server: use BETTER_AUTH_URL if present, or NEXT_PUBLIC_APP_URL fallback
  return process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "https://bikaji-xi.vercel.app";
};

export const authClient = createAuthClient({
  baseURL: getClientBaseUrl(),
  fetchOptions: {
    credentials: "include",
    onError: (ctx) => {
      const status = ctx.response?.status;
      const statusText = ctx.response?.statusText;
      const url = ctx.response?.url || ctx.request?.url;

      // 401 Unauthorized is normal when a user has no active session cookie
      if (status === 401) {
        return;
      }

      let diagnostics = "Network error / CORS issue or backend server unreachable.";
      if (status === 403) diagnostics = "403 Forbidden: Insufficient role permissions.";
      else if (status === 404) diagnostics = "404 Not Found: Authentication endpoint unavailable.";
      else if (status && status >= 500) diagnostics = `${status} Internal Server Error on Auth API.`;

      console.warn(`[Better Auth Diagnostic] ${diagnostics}`, {
        url,
        status,
        statusText,
      });
    },
  },
});
