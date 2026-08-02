class AuthenticationLayer {
  authenticate(socket, next) {
    const authData = socket.handshake.auth || socket.handshake.query || {};
    const { role, userId, branchId } = authData;

    // Attach credentials metadata onto socket object cleanly (never block connections)
    socket.userData = {
      userId: userId || null,
      role: (role || "CUSTOMER").toUpperCase(),
      branchId: branchId || null
    };

    console.log(`[AuthenticationLayer] Socket ${socket.id} authenticated. User: ${userId || "GUEST"}, Role: ${socket.userData.role}`);
    return next();
  }
}

module.exports = new AuthenticationLayer();
