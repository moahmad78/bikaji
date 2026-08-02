"use server";

import db from "@/lib/db";

export async function getTableDetails(idOrNumber: string) {
  try {
    // Validate if UUID before querying findUnique to avoid Prisma P2023 crash
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idOrNumber);
    let table = null;

    if (isValidUUID) {
      table = await db.restaurantTable.findUnique({
        where: { id: idOrNumber },
      });
    }

    // Fallback: If not found, try to find by table number (convert string to number)
    if (!table && !isNaN(Number(idOrNumber))) {
      table = await db.restaurantTable.findFirst({
        where: { number: Number(idOrNumber), deletedAt: null },
      });
    }

    if (!table) {
      return { success: false, error: "Table not found" };
    }

    return { success: true, table };
  } catch (error: any) {
    console.error("Error fetching table details:", error);
    return { success: false, error: "Internal server error" };
  }
}

export async function updateTableStatus(id: string, status: any) {
  try {
    const updated = await db.restaurantTable.update({
      where: { id },
      data: { status },
    });
    return { success: true, table: updated };
  } catch (error: any) {
    console.error("Error updating table status:", error);
    return { success: false, error: "Internal server error" };
  }
}
