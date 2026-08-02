import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function addBengaliAndDesserts() {
  console.log("🍮 Adding BENGALI SWEETS & DESSERTS under SWEETS category...");

  // 1. Get branch
  let branch = await prisma.branch.findFirst();
  if (!branch) {
    throw new Error("No branch found.");
  }

  // 2. Get or create Category "SWEETS"
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
        description: "Premium authentic Bikaneri mithai, Bengali chena sweets, peda, rabdi & desserts.",
        image: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80",
        order: 2,
      },
    });
  }

  // Helper function to find or create subcategory
  async function getSubCategory(name: string, order: number) {
    let sub = await prisma.subCategory.findFirst({
      where: {
        categoryId: sweetsCategory!.id,
        name: { equals: name, mode: "insensitive" },
      },
    });
    if (!sub) {
      sub = await prisma.subCategory.create({
        data: {
          categoryId: sweetsCategory!.id,
          name,
          description: `${name} items at Bikaji`,
          order,
        },
      });
    }
    return sub;
  }

  const bengaliSub = await getSubCategory("BENGALI SWEETS", 6);
  const dessertSub = await getSubCategory("DESSERT", 7);

  const defaultImg = "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80";

  // 1. BENGALI SWEETS ITEMS
  const bengaliItems = [
    { name: "RASGULLA", price: 30.0, desc: "Classic spongy chena ball soaked in light sugar syrup." },
    { name: "RAJBHOG", price: 50.0, desc: "Large saffron-infused royal rasgulla stuffed with dry fruits." },
    { name: "RASMALAI", price: 60.0, desc: "Soft chena disc soaked in cardamom & pistachio flavoured rabdi." },
    { name: "GUR RASMALAI", price: 70.0, desc: "Authentic Bengali jaggery (Nolen Gur) flavoured rasmalai." },
    { name: "MALAI CHAMCHAM", price: 50.0, desc: "Traditional Bengali cylindrical sweet garnished with cream & pistachio." },
    { name: "MALAI SANDWICH", price: 50.0, desc: "Layered chena sweet filled with saffron mawa rabdi cream." },
    { name: "KACHA GOLA", price: 50.0, desc: "Soft fresh chena delicacy flavoured with cardamom & rose." },
    { name: "RASKADAM", price: 40.0, desc: "Rasgulla encased in a layer of soft khoya and poppy seeds." },
    { name: "CHENA TOAST", price: 50.0, desc: "Crisp baked chena toast soaked in light rose sugar syrup." },
    { name: "BAKE RASGULLA", price: 70.0, desc: "Rasgulla baked in thick saffron rabdi with a caramelized crust." },
    { name: "ANGURI RABDI", price: 70.0, desc: "Mini chena rasgulla drops served in chilled rabdi." },
    { name: "MALAI RABDI", price: 70.0, desc: "Slow-cooked thickened sweet milk cream layered with nuts." },
    { name: "MANGO PIE [SEASONAL]", price: 90.0, desc: "Fresh Alphonso mango pulp layered over sweet chena pie." },
    { name: "RASBHARI 250G", price: 190.0, desc: "Mini juicy chena rasbharis in syrup (250g pack)." },
    { name: "MINI GULAB JAMUN 250G", price: 190.0, desc: "Juicy bite-sized gulab jamuns (250g pack)." },
    { name: "JALEBI KG", price: 200.0, desc: "Crispy desi ghee jalebi. [250g: ₹200 | 500g: ₹400 | 1Kg: ₹800]" },
    { name: "MOONG DAL HALWA", price: 200.0, desc: "Rich desi ghee moong dal halwa. [250g: ₹200 | 500g: ₹400 | 1Kg: ₹800]" },
  ];

  for (const item of bengaliItems) {
    const existing = await prisma.menuItem.findFirst({ where: { branchId: branch.id, name: item.name } });
    if (existing) {
      await prisma.menuItem.update({
        where: { id: existing.id },
        data: { price: item.price, description: item.desc, categoryId: sweetsCategory.id, subCategoryId: bengaliSub.id },
      });
    } else {
      await prisma.menuItem.create({
        data: {
          branchId: branch.id,
          categoryId: sweetsCategory.id,
          subCategoryId: bengaliSub.id,
          name: item.name,
          description: item.desc,
          price: item.price,
          image: defaultImg,
          isVeg: true,
          isBestseller: item.name.includes("RASMALAI") || item.name.includes("RASGULLA") || item.name.includes("BAKE"),
          isSpecial: item.name.includes("BAKE") || item.name.includes("MANGO"),
        },
      });
    }
  }

  // 2. DESSERTS ITEMS
  const dessertItems = [
    { name: "GULAB JAMUN PER Plt", price: 80.0, desc: "Warm gulab jamuns served hot per plate (2 pcs)." },
    { name: "MOONG DAL HALWA Plt", price: 80.0, desc: "Fresh hot desi ghee moong dal halwa portion plate." },
    { name: "JALEBI PLATE", price: 80.0, desc: "Crispy hot desi ghee jalebi served fresh per plate." },
  ];

  for (const item of dessertItems) {
    const existing = await prisma.menuItem.findFirst({ where: { branchId: branch.id, name: item.name } });
    if (existing) {
      await prisma.menuItem.update({
        where: { id: existing.id },
        data: { price: item.price, description: item.desc, categoryId: sweetsCategory.id, subCategoryId: dessertSub.id },
      });
    } else {
      await prisma.menuItem.create({
        data: {
          branchId: branch.id,
          categoryId: sweetsCategory.id,
          subCategoryId: dessertSub.id,
          name: item.name,
          description: item.desc,
          price: item.price,
          image: defaultImg,
          isVeg: true,
          isBestseller: true,
        },
      });
    }
  }

  console.log("✅ All BENGALI SWEETS & DESSERTS added successfully!");
}

addBengaliAndDesserts()
  .catch((e) => {
    console.error("Error adding bengali sweets & desserts:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
