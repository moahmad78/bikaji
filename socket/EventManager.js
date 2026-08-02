class EventManager {
  handlePublish(io, payload) {
    const { event, data, room } = payload;
    if (!event) {
      throw new Error("Missing 'event' parameter in broadcast payload.");
    }

    // 1. Emit to targeted room if specified
    if (room) {
      io.to(room).emit(event, data);
      console.log(`[EventManager] Published targeted event '${event}' to room '${room}'`);
    }

    // 2. Emit to branch room if branchId is present
    if (data && data.branchId) {
      const branchRoom = `branch:${data.branchId}`;
      io.to(branchRoom).emit(event, data);
      console.log(`[EventManager] Published event '${event}' to branch room '${branchRoom}'`);
    }

    // 3. Always emit to global channel so active kitchen/admin/waiter dashboards receive updates
    io.emit(event, data);
    console.log(`[EventManager] Broadcasted event '${event}' to all connected sockets.`);
  }
}

module.exports = new EventManager();
