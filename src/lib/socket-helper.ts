/**
 * Helper utility to publish real-time events to the standalone Socket.io server.
 * This runs on the server side (Server Actions or API Routes).
 */
export async function publishSocketEvent(event: string, data: any): Promise<boolean> {
  try {
    const socketServerUrl = process.env.SOCKET_SERVER_URL || "http://localhost:3001";
    
    // We send a local HTTP POST request to the socket server, which will broadcast it to all connected sockets
    const response = await fetch(`${socketServerUrl}/publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ event, data }),
    });

    if (!response.ok) {
      console.error(`[SocketHelper] Failed to publish event '${event}': ${response.statusText}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`[SocketHelper] Error publishing event '${event}':`, error);
    return false;
  }
}
