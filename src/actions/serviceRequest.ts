"use server";

import db from "@/lib/db";
import { RequestType, RequestStatus } from "@prisma/client";
import { publishSocketEvent } from "@/lib/socket-helper";

export async function createServiceRequest(tableId: string, type: RequestType, notes?: string) {
  try {
    if (!tableId) {
      return { success: false, error: "Table identification is missing." };
    }

    const table = await db.restaurantTable.findUnique({
      where: { id: tableId },
    });

    if (!table) {
      return { success: false, error: "Table not found." };
    }

    const request = await db.serviceRequest.create({
      data: {
        tableId,
        type,
        notes: notes || null,
        status: RequestStatus.PENDING,
      },
      include: {
        table: true
      }
    });

    // Broadcast customer request event to active waiters in real-time
    await publishSocketEvent("customer-request", request);

    return { success: true, requestId: request.id };
  } catch (error: any) {
    console.error("Error creating service request:", error);
    return { success: false, error: "Internal server error. Failed to send request." };
  }
}
