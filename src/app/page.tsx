"use client";

import Link from "next/link";
import { ChefHat, BellRing, Settings, User, QrCode } from "lucide-react";
import Image from "next/image";
import { motion } from "framer-motion";

export default function Home() {
  const roles = [
    {
      title: "Customer Menu",
      description: "Browse menu, apply coupons, order food, and track live preparation status.",
      href: "/table/1",
      icon: User,
      badge: "Self Ordering",
      color: "bg-maroon-900 text-gold-200 border-gold-500/20",
    },
    {
      title: "Waiter Console",
      description: "Manage table status, receive alerts, and serve incoming orders.",
      href: "/waiter",
      icon: BellRing,
      badge: "Staff Console",
      color: "bg-card border-border text-foreground hover:border-maroon-900/40",
    },
    {
      title: "Kitchen Monitor",
      description: "Real-time ticket queue, status toggle, and food priority management.",
      href: "/kitchen",
      icon: ChefHat,
      badge: "Live Queue",
      color: "bg-card border-border text-foreground hover:border-maroon-900/40",
    },
    {
      title: "Admin Dashboard",
      description: "Manage menu CRUD, tables, reports, settings, and view revenue analytics.",
      href: "/admin",
      icon: Settings,
      badge: "Management",
      color: "bg-card border-border text-foreground hover:border-maroon-900/40",
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between p-6 sm:p-12 relative overflow-hidden">
      {/* Background soft ambient gold/maroon glow */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-maroon-900/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-gold-500/5 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="w-full max-w-6xl mx-auto flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-premium overflow-hidden border border-gold-500/30 bg-white">
            <Image src="/logo.png" alt="Bikaji Logo" width={40} height={40} className="w-full h-full object-contain" />
          </div>
          <div>
            <span className="font-display font-bold text-xl tracking-tight text-primary">BIKAJI</span>
            <span className="text-[10px] block tracking-widest text-accent font-semibold uppercase">Smart QR Dining</span>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary border border-border text-xs text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          System Online
        </div>
      </header>

      {/* Hero Section */}
      <main className="w-full max-w-6xl mx-auto my-auto flex flex-col gap-12 z-10 py-12">
        <div className="text-center max-w-2xl mx-auto flex flex-col gap-4">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-maroon-900/5 border border-maroon-900/10 text-xs font-semibold text-primary mx-auto"
          >
            <QrCode className="w-3.5 h-3.5 text-accent" />
            Premium Restaurant Ordering
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-6xl font-display font-extrabold tracking-tight text-foreground"
          >
            Bikaji Smart <br className="sm:hidden" />
            <span className="text-primary bg-clip-text">Ordering Portal</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-base sm:text-lg text-muted-foreground max-w-lg mx-auto font-sans leading-relaxed"
          >
            Welcome to the digital backbone of Bikaji Premium Indian Dining. Select a portal below to access the live dashboard environment.
          </motion.p>
        </div>

        {/* Roles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {roles.map((role, idx) => {
            const Icon = role.icon;
            return (
              <motion.div
                key={role.title}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 * idx + 0.3 }}
                whileHover={{ y: -8, transition: { duration: 0.2 } }}
                className="flex"
              >
                <Link
                  href={role.href}
                  className={`flex flex-col justify-between p-8 rounded-premium border transition-all duration-300 shadow-sm relative group overflow-hidden w-full ${role.color}`}
                >
                  {/* Subtle hover overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                  <div className="flex flex-col gap-6">
                    <div className="flex justify-between items-start">
                      <div className={`p-3.5 rounded-premium ${role.href.startsWith("/table") ? "bg-white/10" : "bg-primary/5 text-primary"} border border-current/10`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className={`text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full ${
                        role.href.startsWith("/table") ? "bg-gold-500/20 text-gold-300" : "bg-muted text-muted-foreground"
                      }`}>
                        {role.badge}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-xl font-display font-bold tracking-tight mb-2 group-hover:text-accent transition-colors">
                        {role.title}
                      </h3>
                      <p className={`text-sm leading-relaxed ${role.href.startsWith("/table") ? "text-maroon-200/80" : "text-muted-foreground"}`}>
                        {role.description}
                      </p>
                    </div>
                  </div>

                  <div className="mt-8 pt-4 border-t border-current/5 flex items-center text-xs font-semibold gap-1 group-hover:gap-2 transition-all">
                    Enter Portal
                    <span className="transition-transform group-hover:translate-x-1">→</span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-6xl mx-auto text-center text-[11px] text-muted-foreground/60 tracking-wider font-semibold uppercase mt-12 z-10">
        © 2026 Bikaji Smart Ordering. All rights reserved. Designed for Premium Indian Hospitality.
      </footer>
    </div>
  );
}
