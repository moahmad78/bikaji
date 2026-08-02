import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function makeBengaliMainCategory() {
  console.log("🍡 Promoting BENGALI SWEETS to a standalone Main Category...");

  // 1. Get branch
  let branch = await prisma.branch.findFirst();
  if (!branch) throw new Error("No branch found.");

  // 2. Create or find Main Category "BENGALI SWEETS"
  let mainBengaliCat = await prisma.category.findFirst({
    where: {
      branchId: branch.id,
      name: { equals: "BENGALI SWEETS", mode: "insensitive" },
    },
  });

  if (!mainBengaliCat) {
    mainBengaliCat = await prisma.category.create({
      data: {
        branchId: branch.id,
        name: "BENGALI SWEETS",
        description: "Authentic chena rasgulla, rasmalai, rajbhog, baked rasgulla & rabdi delicacies.",
        image: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80",
        order: 3,
      },
    });
  }

  // 3. Move items from subCategory "BENGALI SWEETS" to main category "BENGALI SWEETS"
  const bengaliItemNames = [
    "RASGULLA",
    "RAJBHOG",
    "RASMALAI",
    "GUR RASMALAI",
    "MALAI CHAMCHAM",
    "MALAI SANDWICH",
    "KACHA GOLA",
    "RASKADAM",
    "CHENA TOAST",
    "BAKE RASGULLA",
    "ANGURI RABDI",
    "MALAI RABDI",
    "MANGO PIE [SEASONAL]",
    "RASBHARI 250G",
    "MINI GULAB JAMUN 250G",
    "JALEBI KG",
    "MOONG DAL HALWA",
    "GULAB JAMUN PER Plt",
    "MOONG DAL HALWA Plt",
    "JALEBI PLATE",
  ];

  let movedCount = 0;
  for (const name of bengaliItemNames) {
    const res = await prisma.menuItem.updateMany({
      where: {
        branchId: branch.id,
        name: { equals: name, mode: "insensitive" },
      },
      data: {
        categoryId: mainBengaliCat.id,
        subCategoryId: null,
      },
    });
    movedCount += res.count;
  }

  // 4. Update Category order so tabs show:
  // 1. SNACKS & MEALS
  // 2. SWEETS
  // 3. BENGALI SWEETS
  // 4. PACKED NAMKEENS

  const catOrder = ["SNACKS & MEALS", "SWEETS", "BENGALI SWEETS", "PACKED NAMKEENS"];
  for (let i = 0; i < catOrder.length; i++) {
    await prisma.category.updateMany({
      where: { branchId: branch.id, name: { equals: catOrder[i], mode: "insensitive" } },
      data: { order: i + 1 },
    });
  }

  console.log(`✅ Successfully promoted BENGALI SWEETS to Main Category with ${movedCount} items!`);
}

makeBengaliMainCategory()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
