import React from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AlertCircle, Smartphone } from "lucide-react";
import db from "@/lib/db";
import { decryptQRToken } from "@/lib/qr-security";
import { publishSocketEvent } from "@/lib/socket-helper";

interface ScanPageProps {
  params: Promise<{ token: string }>;
}

export default async function ScanPage({ params }: ScanPageProps) {
  const { token } = await params;
  const decrypted = decryptQRToken(token);

  if (!decrypted) {
    return <InvalidQRScreen message="Invalid or corrupted QR code signature." />;
  }

  const { tableId, branchId } = decrypted;

  // Retrieve table status and ensure QR code is active in the database
  const table = await db.restaurantTable.findUnique({
    where: { id: tableId, deletedAt: null },
    include: {
      qrCode: true,
      sessions: {
        where: { isActive: true, deletedAt: null },
        take: 1
      }
    }
  });

  if (!table) {
    return <InvalidQRScreen message="This table does not exist or has been removed." />;
  }

  if (!table.qrCode || !table.qrCode.isActive) {
    return <InvalidQRScreen message="This QR Code has been deactivated by the administrator." />;
  }

  const cookieJar = await cookies();
  const existingToken = cookieJar.get("customer_session_token")?.value;

  // Create or retrieve active Customer Session
  let sessionToken = "";

  if (existingToken) {
    const existingSession = await db.customerSession.findUnique({
      where: { token: existingToken }
    });
    // Check if it belongs to this table, is active and not expired
    if (
      existingSession && 
      existingSession.isActive && 
      existingSession.tableId === tableId && 
      existingSession.expiresAt > new Date()
    ) {
       sessionToken = existingToken;
    }
  }

  if (!sessionToken) {
    // Generate a secure session token
    sessionToken = `session_${crypto.randomUUID().replace(/-/g, "")}`;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 4); // Expire after 4 hours of dining
    
    const shortId = sessionToken.slice(8, 14).toUpperCase();

    await db.customerSession.create({
      data: {
        tableId,
        token: sessionToken,
        customerName: `Guest #${shortId}`,
        isActive: true,
        expiresAt
      }
    });

    // Update table status to occupied if it was FREE
    if (table.status === "FREE") {
      await db.restaurantTable.update({
        where: { id: tableId },
        data: { status: "OCCUPIED" }
      });
    }
  }

  // Set secure HttpOnly cookie for session tracking
  cookieJar.set("customer_session_token", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 4 // 4 Hours
  });

  // Log scan event activity & broadcast presence updates via Socket.IO
  await publishSocketEvent("order-updated", { tableId, status: "OCCUPIED" });

  // Redirect to Customer menu catalog
  redirect("/menu");
}

function InvalidQRScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-[#0d0506] flex flex-col justify-center items-center p-4 text-center">
      <div className="bg-[#140b0c] border border-red-950 p-8 rounded-2xl max-w-sm flex flex-col items-center gap-4 shadow-modal">
        <div className="w-12 h-12 bg-red-950/40 border border-red-800 rounded-full flex items-center justify-center text-red-500">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">
          Verification Failed
        </h2>
        <p className="text-xs text-zinc-450 leading-relaxed">
          {message}
        </p>
        <div className="mt-2 text-[10px] text-zinc-550 border-t border-[#251416] pt-4 w-full flex items-center justify-center gap-1.5 uppercase font-bold tracking-wider">
          <Smartphone className="w-3.5 h-3.5" /> Scan QR to re-try
        </div>
      </div>
    </div>
  );
}
