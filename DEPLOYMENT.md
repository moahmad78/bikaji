# Production Deployment Guide (V1.0 RC1)

This guide provides instructions to deploy the Bikaji QR Smart Ordering System into commercial restaurant environments.

---

## 1. Environment Configurations Reference

Ensure all environment variables are correctly populated on your production host (Vercel settings, VM `.env` files, or Docker Compose layers):

| Variable | Description | Production Value Example |
| :--- | :--- | :--- |
| `DATABASE_URL` | Connection string for PostgreSQL database | `postgresql://user:pass@host:5432/db` |
| `NEXT_PUBLIC_APP_URL` | Domain route where the Next.js app is hosted | `https://orders.restaurant.com` |
| `SOCKET_SERVER_URL` | HTTP endpoint where Socket server is accessible | `https://sockets.restaurant.com` |
| `SOCKET_PORT` | Execution port for the standalone Socket server | `3001` |
| `REDIS_URL` | Redis cluster adapter endpoint for WebSockets | `redis://default:pass@redis-host:6379` |
| `QR_SECRET_KEY` | Hex seed key used for encrypting table tokens | *Keep secret & unique per deployment* |
| `BETTER_AUTH_SECRET` | Cryptographic secret for auth cookies | *Keep secret & unique per deployment* |
| `BETTER_AUTH_URL` | Domain route matching the Next.js public URL | `https://orders.restaurant.com` |

---

## 2. Option A: Containerized Self-Hosted Deployment (Recommended)

Perfect for physical Linux POS terminals or VM servers located inside the restaurant.

### Prerequisites
- Docker & Docker Compose installed on the host machine.
- SSL Certificate mapping via Nginx or Caddy reverse proxies.

### Boot Sequence
1. Clone the repository and configure `.env` values.
2. Build and launch services in detached mode:
   ```bash
   docker-compose up -d --build
   ```
3. Run database migrations to prepare Postgres tables:
   ```bash
   docker-compose exec app npx prisma db push
   ```

---

## 3. Option B: Cloud Deployment (Next.js on Vercel + Backend VM)

Ideal for multi-branch organizations requiring centralized cloud databases.

### Prerequisites
- Next.js frontend deployed to Vercel.
- Managed PostgreSQL database (e.g. Supabase, Neon).
- Server VM (e.g. AWS EC2, DigitalOcean Droplet) to host the standalone WebSocket server.

### Steps
1. **Frontend Deployment**:
   - Link the repository to Vercel.
   - Configure all environment variables in Vercel settings.
   - Add database and socket urls.
2. **WebSocket Server Deployment**:
   - Clone the repository on the target VM.
   - Run `npm install` followed by `node socket-server.js` (managed via PM2):
     ```bash
     npm install pm2 -g
     pm2 start socket-server.js --name "bikaji-sockets"
     pm2 save
     pm2 startup
     ```
3. **Database Migration**:
   - Execute migrations from your local workspace targeting the cloud DATABASE_URL:
     ```bash
     DATABASE_URL="postgresql://cloud-host/db" npx prisma db push
     ```

---

## 4. Production Readiness Checklist

- [ ] **SSL Certificates**: Enforce HTTPS for both App (`3000`) and Sockets (`3001`) to protect cookie values.
- [ ] **Environment Keys**: Generate random cryptographically secure keys for `QR_SECRET_KEY` and `BETTER_AUTH_SECRET`.
- [ ] **Database Backups**: Schedule automated cron backups of the Postgres data volume.
- [ ] **Reverse Proxy Configurations**: Configure Nginx/Caddy proxy pass rules to support WebSocket upgrades (`Upgrade: websocket` headers).
- [ ] **Rate Limiting**: Confirm edge rate-limiting parameters are active on Caddy or Cloudflare to prevent DDoS scans on `/scan/[token]` endpoints.
