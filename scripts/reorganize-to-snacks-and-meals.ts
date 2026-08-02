import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function reorganizeToSnacksAndMeals() {
  console.log("🔄 Reorganizing all items into master category: 'SNACKS & MEALS'...");

  // 1. Get branch
  let branch = await prisma.branch.findFirst();
  if (!branch) {
    throw new Error("No branch found.");
  }

  // 2. Create or find master Category "SNACKS & MEALS"
  let mainCategory = await prisma.category.findFirst({
    where: {
      branchId: branch.id,
      name: { equals: "SNACKS & MEALS", mode: "insensitive" },
    },
  });

  if (!mainCategory) {
    mainCategory = await prisma.category.create({
      data: {
        branchId: branch.id,
        name: "SNACKS & MEALS",
        description: "Bikaji Signature Snacks, Weekend Specials, North Indian Meals, Chaat & Beverages.",
        image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=800&q=80",
        order: 1,
      },
    });
  }

  // 3. Define SubCategories under "SNACKS & MEALS"
  const subCategoryNames = [
    "SNACKS",
    "WEEKEND SPECIALS",
    "MEALS",
    "EXTRA",
    "CHAT",
    "BEVERAGES",
  ];

  const subCategoryMap: Record<string, string> = {};

  for (let i = 0; i < subCategoryNames.length; i++) {
    const subName = subCategoryNames[i];
    let sub = await prisma.subCategory.findFirst({
      where: {
        categoryId: mainCategory.id,
        name: { equals: subName, mode: "insensitive" },
      },
    });

    if (!sub) {
      sub = await prisma.subCategory.create({
        data: {
          categoryId: mainCategory.id,
          name: subName,
          description: `${subName} items at Bikaji`,
          order: i + 1,
        },
      });
    }

    subCategoryMap[subName] = sub.id;
  }

  // 4. Update all menu items to point to Category "SNACKS & MEALS" and set their subCategoryId
  const mapping: Record<string, string[]> = {
    "SNACKS": [
      "SAMOSA (PER PC)",
      "BIKANERI KACHORI (PER PC)",
      "ONION KACHORI PER PC",
      "MATAR KACHORI PER PC",
      "CHEESE SAMOSA 4PCS",
      "PLAIN DHOKLA PER KG",
      "PLAIN DHOKLA PER PLATE",
      "PANEER DHOKLA PER PLATE",
      "KHANDVI PER KG",
      "FAFDA 100G",
      "DAHI SAMOSA",
      "DAHI ONION KACHORI",
      "DAHI MATAR KACHORI",
      "DAHI BIKANERI KACHORI",
      "KHANDVI PER PLATE",
    ],
    "WEEKEND SPECIALS": [
      "MIRCHI BADA(FRI-SAT-SUN)",
      "PANEER KOFTA(FRI-SAT-SUN)",
      "PURI ALOO SABJI (SAT-SUN)",
      "SANDWICH SAMOSA(SAT-SUN)",
    ],
    "MEALS": [
      "CHOLA BHATURA",
      "CHOLA KULCHA",
      "RAJMA RICE PER",
      "CHOLA RICE",
      "ALOO TIKKI",
      "PAV BHAJI",
      "SHAHI PANEER WITH TAWA PARATHA",
      "DAL MAKHANI WITH TAWA PARATHA",
      "CHOLA WITH TAWA PARATHA",
      "SHAHI PANEER WITH RICE",
      "DAL MAKHANI WITH RICE",
      "EXECUTIVE THALI",
    ],
    "EXTRA": [
      "EXTRA BHATURA",
      "EXTRA CHOLA",
      "EXTRA KULCHA",
      "EXTRA PAV",
    ],
    "CHAT": [
      "DAHI BHALLA(DAHI VADA)",
      "BHALLA PAPADI CHAT PER PLATE",
      "DAHI PAPADI CHAT",
      "DAHI PURI",
      "SEV PURI",
      "PANI PURI (6PCS)",
      "BHEL PURI",
      "RAJ KACHORI",
    ],
    "BEVERAGES": [
      "BADAM MILK PER GLASS",
      "LASSI [ SEASONAL]",
      "MASALA CHAAS",
    ],
  };

  let movedCount = 0;

  for (const [subName, itemNames] of Object.entries(mapping)) {
    const subId = subCategoryMap[subName];
    for (const itemName of itemNames) {
      const res = await prisma.menuItem.updateMany({
        where: {
          branchId: branch.id,
          name: { equals: itemName, mode: "insensitive" },
        },
        data: {
          categoryId: mainCategory.id,
          subCategoryId: subId,
        },
      });
      movedCount += res.count;
    }
  }

  // 5. Clean up old empty standalone categories (if any)
  const oldCategories = await prisma.category.findMany({
    where: {
      branchId: branch.id,
      id: { not: mainCategory.id },
      items: { none: {} },
    },
  });

  for (const oldCat of oldCategories) {
    await prisma.category.delete({ where: { id: oldCat.id } });
  }

  console.log(`✅ Successfully assigned ${movedCount} items under category 'SNACKS & MEALS'!`);
}

reorganizeToSnacksAndMeals()
  .catch((e) => {
    console.error("Error reorganizing menu:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
