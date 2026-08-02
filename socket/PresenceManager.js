class PresenceManager {
  constructor() {
    this.onlineUsers = new Map(); // socketId -> { userId, role, branchId }
  }

  register(socketId, userData) {
    this.onlineUsers.set(socketId, userData);
    console.log(`[PresenceManager] Registered client: ${socketId} with role: ${userData.role || "GUEST"}`);
  }

  unregister(socketId) {
    const userData = this.onlineUsers.get(socketId);
    if (userData) {
      this.onlineUsers.delete(socketId);
      console.log(`[PresenceManager] Unregistered client: ${socketId}`);
      return userData;
    }
    return null;
  }

  getOnlineByRole(role) {
    const active = [];
    for (const [socketId, data] of this.onlineUsers.entries()) {
      if (data.role === role) {
        active.push({ socketId, ...data });
      }
    }
    return active;
  }

  getOnlineCount() {
    return this.onlineUsers.size;
  }
}

module.exports = new PresenceManager();
