"use server";

import db from "@/lib/db";

export async function getMenuData(branchId?: string | null) {
  try {
    // Resolve active branch if not explicitly provided
    let activeBranchId = branchId;
    if (!activeBranchId) {
      const defaultBranch = await db.branch.findFirst();
      if (!defaultBranch) {
        return { success: false, error: "No branches configured in the system." };
      }
      activeBranchId = defaultBranch.id;
    }

    const categories = await db.category.findMany({
      where: {
        branchId: activeBranchId!,
        isActive: true,
        deletedAt: null,
      },
      orderBy: {
        order: "asc",
      },
      include: {
        subCategories: {
          where: {
            isActive: true,
            deletedAt: null,
          },
          orderBy: {
            order: "asc",
          },
        },
        items: {
          where: {
            isAvailable: true,
            deletedAt: null,
          },
          orderBy: {
            name: "asc",
          },
          include: {
            images: {
              where: {
                deletedAt: null,
              },
            },
            modifierGroups: {
              include: {
                modifierGroup: {
                  include: {
                    modifiers: {
                      where: {
                        deletedAt: null,
                      },
                      orderBy: {
                        price: "asc",
                      },
                    },
                  },
                },
              },
            },
            addons: {
              include: {
                addon: true,
              },
            },
          },
        },
      },
    });

    return { success: true, categories };
  } catch (error: any) {
    console.error("Error fetching menu data:", error);
    return { success: false, error: "Failed to fetch menu items." };
  }
}
