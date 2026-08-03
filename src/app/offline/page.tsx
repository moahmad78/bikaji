"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { WifiOff, RefreshCw, Utensils, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

export default function OfflinePage() {
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      window.location.reload();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleRetry = () => {
    setIsReconnecting(true);
    if (navigator.onLine) {
      window.location.reload();
    } else {
      setTimeout(() => {
        setIsReconnecting(false);
      }, 1000);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0506] text-white flex flex-col justify-between p-6 sm:p-12 relative overflow-hidden font-sans">
      {/* Ambient background glows */}
      <div className="absolute top-[-20%] left-[-20%] w-[70%] h-[70%] rounded-full bg-[#800020]/20 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[70%] h-[70%] rounded-full bg-[#baa47f]/10 blur-[140px] pointer-events-none" />

      {/* Header */}
      <header className="w-full max-w-md mx-auto flex items-center justify-center z-10">
        <div className="flex items-center">
          <Image src="/logo.png" alt="Bikaji Logo" width={160} height={48} className="h-8 md:h-12 w-auto object-contain" />
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-md mx-auto my-auto z-10 py-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="p-8 rounded-2xl bg-zinc-900/80 border border-[#baa47f]/20 shadow-2xl backdrop-blur-xl flex flex-col items-center gap-6"
        >
          {/* Icon Badge */}
          <div className="w-20 h-20 rounded-full bg-[#800020]/20 border border-[#800020]/40 flex items-center justify-center text-amber-500 shadow-inner relative">
            <WifiOff className="w-9 h-9 text-rose-400" />
            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-rose-500 border-2 border-[#0b0506]" />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#baa47f]">
              Connection Interrupted
            </span>
            <h1 className="text-2xl font-display font-extrabold tracking-tight text-white">
              You are currently Offline
            </h1>
            <p className="text-xs text-zinc-400 leading-relaxed max-w-xs mt-1">
              We couldn't connect to Bikaji servers. Please check your mobile data or Wi-Fi connection to continue ordering.
            </p>
          </div>

          {/* Network Status Pill */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-800/90 border border-zinc-700/60 text-xs font-semibold text-zinc-300">
            <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-emerald-400 animate-pulse" : "bg-rose-500"}`} />
            <span>{isOnline ? "Network Restored! Reloading..." : "Offline Mode Active"}</span>
          </div>

          {/* Action Buttons */}
          <div className="w-full flex flex-col gap-3 mt-2">
            <button
              onClick={handleRetry}
              disabled={isReconnecting}
              className="w-full py-4 bg-[#800020] hover:bg-[#990026] text-white font-extrabold text-xs uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 border border-[#baa47f]/30 transition shadow-lg disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isReconnecting ? "animate-spin text-[#baa47f]" : ""}`} />
              {isReconnecting ? "Retrying Connection..." : "Retry Connection"}
            </button>

            <button
              onClick={() => (window.location.href = "/menu")}
              className="w-full py-3.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 border border-zinc-700 transition cursor-pointer"
            >
              <Utensils className="w-4 h-4 text-[#baa47f]" /> View Saved Menu <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="w-full text-center text-[10px] text-zinc-500 uppercase tracking-widest font-semibold z-10">
        © 2026 Bikaji Smart QR Dining • Offline Resilience Engine
      </footer>
    </div>
  );
}
