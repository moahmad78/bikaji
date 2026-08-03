import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function cleanupDemoMenu() {
  console.log("🧹 Cleaning up old demo categories and menu items...");

  // Valid main categories created from official user lists
  const validCategoryNames = ["SNACKS & MEALS", "SWEETS", "PACKED NAMKEENS", "BENGALI SWEETS"];

  // Find all categories not in the valid list
  const demoCategories = await prisma.category.findMany({
    where: {
      name: {
        notIn: validCategoryNames,
      },
    },
    include: {
      items: true,
      subCategories: true,
    },
  });

  console.log(`Found ${demoCategories.length} old demo categories to remove.`);

  for (const cat of demoCategories) {
    console.log(`Removing category: '${cat.name}' (${cat.items.length} items)...`);
    
    // Delete items in this category
    await prisma.menuItem.deleteMany({
      where: {
        categoryId: cat.id,
      },
    });

    // Delete subcategories
    await prisma.subCategory.deleteMany({
      where: {
        categoryId: cat.id,
      },
    });

    // Delete category
    await prisma.category.delete({
      where: {
        id: cat.id,
      },
    });
  }

  // Also check if any standalone items remain without category or in deleted categories
  const orphanItems = await prisma.menuItem.findMany({
    where: {
      category: {
        name: {
          notIn: validCategoryNames,
        },
      },
    },
  });

  if (orphanItems.length > 0) {
    await prisma.menuItem.deleteMany({
      where: {
        id: {
          in: orphanItems.map((i) => i.id),
        },
      },
    });
    console.log(`Removed ${orphanItems.length} orphan demo items.`);
  }

  // Get total count of remaining active items
  const remainingCount = await prisma.menuItem.count();
  const categoriesCount = await prisma.category.count();

  console.log("");
  console.log(`✅ Demo menu cleanup complete!`);
  console.log(`📊 Current Active Categories: ${categoriesCount}`);
  console.log(`📊 Current Active Menu Items: ${remainingCount}`);
}

cleanupDemoMenu()
  .catch((e) => {
    console.error("Error cleaning up demo menu:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
