class RoomManager {
  joinBranch(socket, branchId) {
    if (!branchId) return;
    const room = `branch:${branchId}`;
    socket.join(room);
    console.log(`[RoomManager] Socket ${socket.id} joined branch room: ${room}`);
  }

  joinTable(socket, tableId) {
    if (!tableId) return;
    const room = `table:${tableId}`;
    socket.join(room);
    console.log(`[RoomManager] Socket ${socket.id} joined table room: ${room}`);
  }

  joinOrder(socket, orderId) {
    if (!orderId) return;
    const room = `order:${orderId}`;
    socket.join(room);
    console.log(`[RoomManager] Socket ${socket.id} joined order room: ${room}`);
  }

  joinRole(socket, role) {
    if (!role) return;
    
    // Security: Verify staff privileges before letting them join administrative rooms
    const upperRole = role.toUpperCase();
    if (["ADMIN", "SUPER_ADMIN"].includes(upperRole)) {
      socket.join("role:admin");
      console.log(`[RoomManager] Socket ${socket.id} joined role:admin`);
    } else if (upperRole === "KITCHEN") {
      socket.join("role:kitchen");
      console.log(`[RoomManager] Socket ${socket.id} joined role:kitchen`);
    } else if (upperRole === "WAITER") {
      socket.join("role:waiter");
      console.log(`[RoomManager] Socket ${socket.id} joined role:waiter`);
    }
  }
}

module.exports = new RoomManager();
