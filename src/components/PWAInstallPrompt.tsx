"use client";

import React, { useEffect, useState } from "react";
import { Download, X, Sparkles, Smartphone } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "development") {
        // In development, unregister any stale active service workers to prevent Turbopack HMR caching conflicts
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister();
            console.log("[PWA] Development mode: Unregistered legacy service worker.");
          }
        });
      } else {
        // In production, register the Service Worker cleanly
        window.addEventListener("load", () => {
          navigator.serviceWorker
            .register("/sw.js")
            .then((registration) => {
              console.log("[PWA] Production Service Worker registered with scope:", registration.scope);
            })
            .catch((err) => {
              console.error("[PWA] Service Worker registration failed:", err);
            });
        });
      }
    }

    // Capture Chrome / Android PWA beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);

      const isDismissed = sessionStorage.getItem("bikaji_pwa_install_dismissed");
      if (!isDismissed) {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA] Install prompt outcome: ${outcome}`);

    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  const handleDismiss = () => {
    setShowInstallBanner(false);
    sessionStorage.setItem("bikaji_pwa_install_dismissed", "true");
  };

  if (!showInstallBanner) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.95 }}
        className="fixed bottom-4 left-4 right-4 max-w-md mx-auto z-50 bg-[#0b0506] text-white p-4 rounded-2xl border border-[#baa47f]/40 shadow-2xl backdrop-blur-xl flex items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#800020]/40 border border-[#baa47f]/30 flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5 text-[#baa47f]" />
          </div>
          <div>
            <div className="flex items-center gap-1">
              <span className="text-xs font-extrabold text-white">Install Bikaji App</span>
              <Sparkles className="w-3 h-3 text-amber-400" />
            </div>
            <p className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5">
              Add to Home Screen for fast ordering & offline access
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleInstallClick}
            className="px-3.5 py-2 bg-[#800020] hover:bg-[#990026] text-white text-[11px] font-extrabold rounded-lg uppercase tracking-wider transition shadow-md border border-[#baa47f]/30 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-[#baa47f]" /> Install
          </button>

          <button
            onClick={handleDismiss}
            className="w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
