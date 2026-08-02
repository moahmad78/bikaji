import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function addFreshSweets() {
  console.log("🍬 Adding SWEETS category & FRESH SWEETS subcategory with 36 items...");

  // 1. Get branch
  let branch = await prisma.branch.findFirst();
  if (!branch) {
    throw new Error("No branch found.");
  }

  // 2. Create or find Category "SWEETS"
  let sweetsCategory = await prisma.category.findFirst({
    where: {
      branchId: branch.id,
      name: { equals: "SWEETS", mode: "insensitive" },
    },
  });

  if (!sweetsCategory) {
    sweetsCategory = await prisma.category.create({
      data: {
        branchId: branch.id,
        name: "SWEETS",
        description: "Premium authentic Bikaneri mithai, kaju katli, dryfruit sweets, peda & burfi.",
        image: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80",
        order: 2,
      },
    });
  }

  // 3. Create or find SubCategory "FRESH SWEETS"
  let freshSweetsSub = await prisma.subCategory.findFirst({
    where: {
      categoryId: sweetsCategory.id,
      name: { equals: "FRESH SWEETS", mode: "insensitive" },
    },
  });

  if (!freshSweetsSub) {
    freshSweetsSub = await prisma.subCategory.create({
      data: {
        categoryId: sweetsCategory.id,
        name: "FRESH SWEETS",
        description: "Freshly prepared kaju katli, dryfruit bites, pedas, burfi & traditional mithai.",
        order: 1,
      },
    });
  }

  const items = [
    { name: "KAJU KATLI", mrp: 1520.0, p500: 760.0, p250: 380.0 },
    { name: "BADAM KATLI", mrp: 1680.0, p500: 840.0, p250: 420.0 },
    { name: "GULAB KATLI", mrp: 1200.0, p500: 600.0, p250: 300.0 },
    { name: "KESAR KAJU KATLI", mrp: 1600.0, p500: 800.0, p250: 400.0 },
    { name: "KAJU LADOO", mrp: 1600.0, p500: 800.0, p250: 400.0 },
    { name: "KAJU SANGAM", mrp: 1200.0, p500: 600.0, p250: 300.0 },
    { name: "MANGO CHOCOLATE", mrp: 1280.0, p500: 640.0, p250: 320.0 },
    { name: "STRAWBERRY KATLI", mrp: 1200.0, p500: 600.0, p250: 300.0 },
    { name: "DIAMOND CAKE", mrp: 1560.0, p500: 780.0, p250: 390.0 },
    { name: "KAJU ROLL", mrp: 1600.0, p500: 800.0, p250: 400.0 },
    { name: "MANGO DRY FRUIT", mrp: 1280.0, p500: 640.0, p250: 320.0 },
    { name: "BADAM BISCOFF", mrp: 1680.0, p500: 840.0, p250: 420.0 },
    { name: "PISTA PAN", mrp: 3200.0, p500: 1600.0, p250: 800.0 },
    { name: "ANJEER CHAKAR", mrp: 1360.0, p500: 680.0, p250: 340.0 },
    { name: "CHOCO DRY FRUIT", mrp: 1600.0, p500: 800.0, p250: 400.0 },
    { name: "MEWA BITE", mrp: 1280.0, p500: 640.0, p250: 320.0 },
    { name: "CHOCO BITE", mrp: 1280.0, p500: 640.0, p250: 320.0 },
    { name: "ORANGE BITE", mrp: 1280.0, p500: 640.0, p250: 320.0 },
    { name: "MANGO BITE", mrp: 1280.0, p500: 640.0, p250: 320.0 },
    { name: "ROSE BADAM LADOO", mrp: 1600.0, p500: 800.0, p250: 400.0 },
    { name: "BUTTER SCOTCH ROLL", mrp: 1360.0, p500: 680.0, p250: 340.0 },
    { name: "ALMOND BASKET", mrp: 1680.0, p500: 840.0, p250: 420.0 },
    { name: "KAJU STRAWBERRY ROLL", mrp: 1440.0, p500: 720.0, p250: 360.0 },
    { name: "DRY FRUIT LADOO", mrp: 1480.0, p500: 740.0, p250: 370.0 },
    { name: "PINEAPPLE DRYFRUIT", mrp: 1280.0, p500: 640.0, p250: 320.0 },
    { name: "CHIDAWA PEDA", mrp: 840.0, p500: 420.0, p250: 210.0 },
    { name: "MALAI PEDA", mrp: 800.0, p500: 400.0, p250: 200.0 },
    { name: "ROSE PEDA", mrp: 880.0, p500: 440.0, p250: 220.0 },
    { name: "KESAR PEDA", mrp: 880.0, p500: 440.0, p250: 220.0 },
    { name: "MAWA PISTA BURFI", mrp: 880.0, p500: 440.0, p250: 220.0 },
    { name: "CHOCOLATE BURFI", mrp: 880.0, p500: 440.0, p250: 220.0 },
    { name: "MILK CAKE", mrp: 920.0, p500: 460.0, p250: 230.0 },
    { name: "KALAKAND", mrp: 880.0, p500: 440.0, p250: 220.0 },
    { name: "COCONUT BURFI", mrp: 880.0, p500: 440.0, p250: 220.0 },
    { name: "COCONUT PATISA", mrp: 880.0, p500: 440.0, p250: 220.0 },
    { name: "BLUEBERRY LADOO", mrp: 1600.0, p500: 800.0, p250: 400.0 },
  ];

  let addedCount = 0;

  for (const item of items) {
    const desc = `Authentic Bikaji Sweet. [250g: ₹${item.p250} | 500g: ₹${item.p500} | 1Kg: ₹${item.mrp}]`;
    const image = "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80";

    const existing = await prisma.menuItem.findFirst({
      where: {
        branchId: branch.id,
        name: item.name,
      },
    });

    if (existing) {
      await prisma.menuItem.update({
        where: { id: existing.id },
        data: {
          price: item.p250, // Base price for 250g
          description: desc,
          categoryId: sweetsCategory.id,
          subCategoryId: freshSweetsSub.id,
        },
      });
      console.log(`Updated: ${item.name} (Base 250g: ₹${item.p250} | 1Kg: ₹${item.mrp})`);
    } else {
      await prisma.menuItem.create({
        data: {
          branchId: branch.id,
          categoryId: sweetsCategory.id,
          subCategoryId: freshSweetsSub.id,
          name: item.name,
          description: desc,
          price: item.p250, // Base price for 250g
          image: image,
          isVeg: true,
          isBestseller: item.name.includes("KAJU KATLI") || item.name.includes("MILK CAKE") || item.name.includes("PISTA"),
          preparationTime: 5,
        },
      });
      console.log(`Created: ${item.name} (Base 250g: ₹${item.p250} | 1Kg: ₹${item.mrp})`);
    }
    addedCount++;
  }

  console.log(`✅ All ${addedCount} FRESH SWEETS added under SWEETS category!`);
}

addFreshSweets()
  .catch((e) => {
    console.error("Error adding fresh sweets:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
