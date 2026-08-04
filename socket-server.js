const { createServer } = require("http");
const { Server } = require("socket.io");

const PresenceManager = require("./socket/PresenceManager");
const RoomManager = require("./socket/RoomManager");
const AuthenticationLayer = require("./socket/AuthenticationLayer");
const EventManager = require("./socket/EventManager");

const PORT = process.env.PORT || 3001;

// Metrics tracking indicators
let totalEventsProcessed = 0;
let connectionCountHistory = 0;

// Create HTTP server
const server = createServer((req, res) => {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // 1. HTTP GET /metrics administrative endpoint
  if (req.url === "/metrics" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      success: true,
      metrics: {
        onlineClientsCount: PresenceManager.getOnlineCount(),
        totalConnectionsSinceStart: connectionCountHistory,
        totalEventsProcessed,
        uptimeSeconds: Math.floor(process.uptime()),
        memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
      }
    }));
    return;
  }

  // 2. HTTP POST /publish broadcast endpoint from Server Actions
  if (req.url === "/publish" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body);
        
        // Let EventManager route targeted room broadcasts
        EventManager.handlePublish(io, payload);
        totalEventsProcessed++;

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        console.error("[SocketServer] Error processing publish payload:", err);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message || "Invalid JSON payload" }));
      }
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

// Setup Socket.IO Server
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingInterval: 25000,
  pingTimeout: 20000
});

// Bind Redis adapter hooks conditionally if REDIS_URL is configured
if (process.env.REDIS_URL) {
  try {
    const { createClient } = require("redis");
    const { createAdapter } = require("@socket.io/redis-adapter");
    
    const pubClient = createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();
    
    Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
      io.adapter(createAdapter(pubClient, subClient));
      console.log("[SocketServer] Successfully attached Socket.IO Redis Cluster Adapter.");
    }).catch(err => {
      console.error("[SocketServer] Failed connecting Redis client, falling back to memory adapter:", err);
    });
  } catch (err) {
    console.log("[SocketServer] Redis modules not found. Defaulting to local memory adapter.");
  }
}

// Attach Authentication Middleware Hook
io.use((socket, next) => {
  AuthenticationLayer.authenticate(socket, next);
});

// Setup socket events
io.on("connection", (socket) => {
  connectionCountHistory++;
  
  // Register in Presence tracking
  PresenceManager.register(socket.id, socket.userData);

  // Auto-subscribe user to their branch room & role room from authentication handshake details
  if (socket.userData.branchId) {
    RoomManager.joinBranch(socket, socket.userData.branchId);
  }
  if (socket.userData.role) {
    RoomManager.joinRole(socket, socket.userData.role);
  }

  // Dynamic Client-side Subscription Event Listeners
  socket.on("subscribe-branch", (branchId) => {
    RoomManager.joinBranch(socket, branchId);
  });

  socket.on("subscribe-table", (tableId) => {
    RoomManager.joinTable(socket, tableId);
  });

  socket.on("subscribe-order", (orderId) => {
    RoomManager.joinOrder(socket, orderId);
  });

  // Legacy kitchen notifications mapping
  socket.on("kitchen-connected", () => {
    RoomManager.joinRole(socket, "KITCHEN");
    io.emit("kitchen-status", { status: "connected", socketId: socket.id });
  });

  // Client Disconnect Lifecycle
  socket.on("disconnect", () => {
    const unregisteredUser = PresenceManager.unregister(socket.id);
    if (unregisteredUser && unregisteredUser.role === "KITCHEN") {
      io.emit("kitchen-status", { status: "disconnected", socketId: socket.id });
    }
  });
});

server.listen(PORT, () => {
  console.log(`[SocketServer] Enterprise Real-time Server running on http://localhost:${PORT}`);
});
