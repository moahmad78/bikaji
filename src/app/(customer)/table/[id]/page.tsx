"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useCart } from "../../../../features/cart/CartContext";
import { getTableDetails } from "../../../../actions/table";
import { Sparkles, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function TablePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { setTable } = useCart();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    async function detectTable() {
      try {
        const res = await getTableDetails(id);
        if (res.success && res.table) {
          setTable(res.table.id, res.table.number, res.table.branchId);
          // Small delay for clean premium feel
          setTimeout(() => {
            router.push("/menu");
          }, 800);
        } else {
          setError(res.error || "Invalid Table QR Code scanned. Please contact restaurant staff.");
        }
      } catch (err) {
        console.error("Error detecting table:", err);
        setError("Unable to connect to server. Please try scanning again.");
      }
    }

    detectTable();
  }, [id, router, setTable]);

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-center items-center p-6 text-center relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-maroon-900/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-gold-500/5 blur-[120px] pointer-events-none" />

        <div className="z-10 flex flex-col items-center">
          <div className="w-16 h-16 rounded-premium bg-destructive/10 border border-destructive/20 flex items-center justify-center mb-6 text-destructive text-xl font-bold">
            !
          </div>
          <h1 className="text-2xl font-display font-extrabold mb-2 text-foreground">Table Connection Failed</h1>
          <p className="text-muted-foreground text-sm max-w-sm mb-8 leading-relaxed">
            {error}
          </p>
          <button
            onClick={() => router.push("/")}
            className="px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-premium text-sm border border-gold-500/20 hover:bg-maroon-800 transition shadow-md"
          >
            Go back to Portal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-6 text-center relative overflow-hidden">
      {/* Soft background glows */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-maroon-900/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-gold-500/5 blur-[120px] pointer-events-none" />

      <div className="z-10 flex flex-col items-center gap-6">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
          className="w-16 h-16 rounded-premium bg-maroon-900/5 border border-gold-500/30 flex items-center justify-center text-primary"
        >
          <Sparkles className="w-6 h-6 text-accent" />
        </motion.div>

        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-display font-bold tracking-tight text-foreground uppercase">Detecting Table...</h1>
          <p className="text-[10px] text-accent tracking-widest uppercase font-bold">
            Bikaji Premium Smart Dining
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground px-4 py-2 rounded-full bg-secondary border border-border shadow-sm mt-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
          Synchronizing digital menu
        </div>
      </div>
    </div>
  );
}
