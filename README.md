# Bikaji QR Smart Ordering System (V1.0 RC1)

The Bikaji QR Smart Ordering System is a production-grade restaurant management and touchless dining application. It is designed to operate on touchscreens, tablets, mobile displays, and large kitchen TVs.

---

## System Architecture

```mermaid
graph TD
    A[Customer Table QR Scan] -->|Opaque AES URL| B[scan/token Router]
    B -->|Cookie Session| C[Customer Ordering App]
    C -->|Submit Ticket| D[Prisma/Postgres database]
    E[Chef / Kitchen Staff] -->|Update State| F[Kitchen Display System - KDS]
    G[Floor Waiters] -->|Service Requests & Settlement| H[Waiter Console]
    I[Restaurant Owner / Manager] -->|CRUD Menu, Analytics, Staff| J[Admin Stripe-style Dashboard]
    D -->|Realtime socket publish| K[Standalone Socket.IO Server]
    K -->|Granular Room Emit| C
    K -->|Granular Room Emit| F
    K -->|Granular Room Emit| H
    K -->|Granular Room Emit| J
```

---

## Directory Structure Guide

```text
├── prisma/                 # Database Schema & Seed Data Scripts
├── socket/                 # Decoupled Real-time WebSocket Module Layers
│   ├── PresenceManager.js  # Tracks active role connections
│   ├── RoomManager.js      # Places sockets in granular scoped rooms
│   ├── AuthenticationLayer.js # Middleware checks for socket handshakes
│   └── EventManager.js     # Routes server publications to targeted rooms
├── src/
│   ├── actions/            # Next.js Server Actions (CRUD, Billing, Auth, KDS)
│   ├── app/                # App Router Layout viewports
│   │   ├── admin/          # Admin Stripe-style console (KPI, menu CRUD, reports)
│   │   ├── api/            # API routing handlers
│   │   │   └── auth/       # Better Auth backend API endpoints
│   │   ├── kitchen/        # Kitchen Display System (KDS)
│   │   ├── scan/           # Cryptographic redirect scanning page
│   │   ├── table/          # Waiter checkouts & requests
│   │   └── waiter/         # Waiter console dashboard
│   ├── components/         # Reusable React components (POS printers, floor plans)
│   └── lib/                # Config files (Prisma client, Better Auth client)
├── Dockerfile              # Multi-stage production container setup
├── docker-compose.yml      # Multi-container orchestration mesh
└── socket-server.js        # Standalone real-time server process entry
```

---

## Getting Started

### Local Setup
1. **Environment Variables**: Copy `.env.example` to `.env` and fill in credentials:
   ```bash
   DATABASE_URL="postgresql://postgres:securepassword123@localhost:5432/bikaji_ordering?schema=public"
   NEXT_PUBLIC_APP_URL="http://localhost:3000"
   SOCKET_SERVER_URL="http://localhost:3001"
   QR_SECRET_KEY="c65239fb8bfa4674a27090f394621bfa4674a27090f394621bfa"
   BETTER_AUTH_SECRET="supersecretauthkey123"
   BETTER_AUTH_URL="http://localhost:3000"
   ```
2. **Database Push**:
   ```bash
   npx prisma db push
   npx prisma db seed
   ```
3. **Execute Services**:
   ```bash
   # Run standalone socket server
   node socket-server.js
   
   # Run frontend dev server
   npm run dev
   ```

### Docker Compose Quick Start
Orchestrate all services (Next.js, socket, Postgres, Redis) instantly:
```bash
docker-compose up --build
```
Access the portals:
- Customer UI & Admin: `http://localhost:3000`
- WebSockets: `http://localhost:3001`
- Metrics: `http://localhost:3001/metrics`
