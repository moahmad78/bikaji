import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function addGheeSugarFreeAssortedSweets() {
  console.log("🍬 Adding GHEE SWEETS, SUGAR FREE, HOT SWEETS & ASSORTED BOXES...");

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
        description: "Premium authentic Bikaneri mithai, kaju katli, dryfruit sweets, peda & burfi.",
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

  const gheeSub = await getSubCategory("GHEE SWEETS", 2);
  const sugarFreeSub = await getSubCategory("SUGAR FREE", 3);
  const hotSweetsSub = await getSubCategory("HOT & FRESH SWEETS", 4);
  const assortedSub = await getSubCategory("ASSORTED SWEETS BOXES", 5);

  const defaultImg = "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80";

  // 1. GHEE SWEETS
  const gheeItems = [
    { name: "MOONG DAL BURFI", mrp: 980.0, p500: 490.0, p250: 245.0 },
    { name: "BESAN BURFI", mrp: 980.0, p500: 490.0, p250: 245.0 },
    { name: "DODA BURFI", mrp: 880.0, p500: 440.0, p250: 220.0 },
    { name: "MOTI PAK", mrp: 940.0, p500: 470.0, p250: 235.0 },
    { name: "MAIDA GUJIYA", mrp: 980.0, p500: 490.0, p250: 245.0 },
    { name: "BALOO SHAHI", mrp: 880.0, p500: 440.0, p250: 220.0 },
    { name: "MEETHA BUNDI", mrp: 600.0, p500: 300.0, p250: 150.0 },
    { name: "MOTICHOOR LADOO", mrp: 720.0, p500: 360.0, p250: 180.0 },
    { name: "MEWA LADOO (DRY FRUIT BUNDI LADOO)", mrp: 760.0, p500: 380.0, p250: 190.0 },
    { name: "BESAN LADOO", mrp: 720.0, p500: 360.0, p250: 180.0 },
    { name: "AATA LADOO", mrp: 720.0, p500: 360.0, p250: 180.0 },
    { name: "BUNDI SHAHI LADOO", mrp: 900.0, p500: 450.0, p250: 225.0 },
    { name: "MYSOOR PAAK", mrp: 880.0, p500: 440.0, p250: 220.0 },
  ];

  for (const item of gheeItems) {
    const desc = `Pure Desi Ghee Sweet. [250g: ₹${item.p250} | 500g: ₹${item.p500} | 1Kg: ₹${item.mrp}]`;
    const existing = await prisma.menuItem.findFirst({ where: { branchId: branch.id, name: item.name } });
    if (existing) {
      await prisma.menuItem.update({
        where: { id: existing.id },
        data: { price: item.p250, description: desc, categoryId: sweetsCategory.id, subCategoryId: gheeSub.id },
      });
    } else {
      await prisma.menuItem.create({
        data: {
          branchId: branch.id,
          categoryId: sweetsCategory.id,
          subCategoryId: gheeSub.id,
          name: item.name,
          description: desc,
          price: item.p250,
          image: defaultImg,
          isVeg: true,
          isBestseller: item.name.includes("MOTICHOOR") || item.name.includes("BESAN"),
        },
      });
    }
  }

  // 2. SUGAR FREE
  const sugarFreeItems = [
    { name: "ANJEER DRY FRUIT", mrp: 1600.0, p500: 800.0, p250: 400.0 },
    { name: "KHAJOOR DRY FRUIT", mrp: 1600.0, p500: 800.0, p250: 400.0 },
    { name: "ANJEER KAJU SUGAR FREE", mrp: 2000.0, p500: 1000.0, p250: 500.0 },
    { name: "PROTIEN LADOO", mrp: 1600.0, p500: 800.0, p250: 400.0 },
    { name: "APRICOT SUGAR FREE", mrp: 2000.0, p500: 1000.0, p250: 500.0 },
    { name: "DRY FRUIT COIN", mrp: 1600.0, p500: 800.0, p250: 400.0 },
  ];

  for (const item of sugarFreeItems) {
    const desc = `Healthy Sugar-Free Guiltless Sweet. [250g: ₹${item.p250} | 500g: ₹${item.p500} | 1Kg: ₹${item.mrp}]`;
    const existing = await prisma.menuItem.findFirst({ where: { branchId: branch.id, name: item.name } });
    if (existing) {
      await prisma.menuItem.update({
        where: { id: existing.id },
        data: { price: item.p250, description: desc, categoryId: sweetsCategory.id, subCategoryId: sugarFreeSub.id },
      });
    } else {
      await prisma.menuItem.create({
        data: {
          branchId: branch.id,
          categoryId: sweetsCategory.id,
          subCategoryId: sugarFreeSub.id,
          name: item.name,
          description: desc,
          price: item.p250,
          image: defaultImg,
          isVeg: true,
          isSpecial: true,
        },
      });
    }
  }

  // 3. HOT & FRESH SWEETS
  const hotItems = [
    { name: "MINI GULAB JAMUN 250G", price: 190.0, desc: "Bite-sized mini gulab jamuns in sweet syrup (250g pack)." },
    { name: "JALEBI KG", price: 200.0, desc: "Crispy golden ghee jalebis. [250g: ₹200 | 500g: ₹400 | 1Kg: ₹800]" },
    { name: "JALEBI PLATE", price: 80.0, desc: "Fresh piping hot ghee jalebi per plate." },
    { name: "MOONG DAL HALWA", price: 200.0, desc: "Rich desi ghee moong dal halwa. [250g: ₹200 | 500g: ₹400 | 1Kg: ₹800]" },
    { name: "GULAB JAMUN PER PC", price: 40.0, desc: "Single soft fried milk jamun soaked in cardamom syrup." },
  ];

  for (const item of hotItems) {
    const existing = await prisma.menuItem.findFirst({ where: { branchId: branch.id, name: item.name } });
    if (existing) {
      await prisma.menuItem.update({
        where: { id: existing.id },
        data: { price: item.price, description: item.desc, categoryId: sweetsCategory.id, subCategoryId: hotSweetsSub.id },
      });
    } else {
      await prisma.menuItem.create({
        data: {
          branchId: branch.id,
          categoryId: sweetsCategory.id,
          subCategoryId: hotSweetsSub.id,
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

  // 4. ASSORTED SWEETS BOXES
  const assortedItems = [
    { name: "ASSORTED PEDA 500G", price: 425.0, desc: "Includes Chidawa Peda, Kesar Peda & Malai Peda (500g Gift Box)." },
    { name: "ASSORTED KATLI 400G", price: 580.0, desc: "Includes Kaju Katli, Kesar Katli & Strawberry Katli (400g Box)." },
    { name: "ASSORTED KAJU 400G", price: 475.0, desc: "Includes Kaju Sangam, Kaju Katli & Kaju Roll (400g Gift Box)." },
    { name: "ASSORTED LADOO 500G", price: 365.0, desc: "Includes Atta Ladoo & Besan Ladoo (500g Box)." },
    { name: "ASSORTED BUNDI LADOO 500G", price: 370.0, desc: "Includes Motichoor Ladoo & Mewa Ladoo (500g Box)." },
    { name: "BADAM KAJU MIX 1 KG (CODE 101)", price: 1670.0, desc: "Diamond Cake, Badam Katli, Kaju Strawberry Roll & Hazelnut Rocher Ladoo (1 Kg Box)." },
    { name: "SUPER KAJU MIX 1 KG (CODE 102)", price: 1610.0, desc: "Kesar Katli, Rose Badam Ladoo, Kaju Ladoo & Dry Fruit Cassta (1 Kg Box)." },
    { name: "BADAM KAJU SUPER MIX 900G (CODE 103)", price: 1515.0, desc: "Almond Basket, Chilli Guava, Badam Biscoff & Diamond Cake (900g Box)." },
    { name: "KAJU MIX 1 KG (CODE 104)", price: 1420.0, desc: "Gulab Katli, Almond Katori, Pineapple Dryfruit & Dry Fruit Rose Crunch (1 Kg Box)." },
    { name: "SPECIAL KAJU MIX 1 KG (CODE 105)", price: 1510.0, desc: "Kaju Katli, Anjeer Chakkar, Kaju Ladoo & Butter Scotch Roll (1 Kg Box)." },
    { name: "KAJU GHEE MIX 1 KG (CODE 106)", price: 1355.0, desc: "Kaju Katli, Besan Burfi, Malai Kaju Burfi & Kaju Roll (1 Kg Box)." },
    { name: "KAJU MANGO MIX 800G (CODE 108)", price: 1220.0, desc: "Kaju Katli, Strawberry Roll, Mango Chocolate & Kaju Roll (800g Box)." },
    { name: "KAJU PINEAPPLE MIX 500G (CODE 110)", price: 760.0, desc: "Kaju Katli, Pineapple Dryfruit, Kaju Ladoo & Anjeer Chakkar (500g Box)." },
    { name: "KAJU GHEE MIX 500G (CODE 111)", price: 665.0, desc: "Kaju Katli, Besan Burfi, Doda Burfi & Kaju Roll (500g Box)." },
  ];

  for (const item of assortedItems) {
    const existing = await prisma.menuItem.findFirst({ where: { branchId: branch.id, name: item.name } });
    if (existing) {
      await prisma.menuItem.update({
        where: { id: existing.id },
        data: { price: item.price, description: item.desc, categoryId: sweetsCategory.id, subCategoryId: assortedSub.id },
      });
    } else {
      await prisma.menuItem.create({
        data: {
          branchId: branch.id,
          categoryId: sweetsCategory.id,
          subCategoryId: assortedSub.id,
          name: item.name,
          description: item.desc,
          price: item.price,
          image: defaultImg,
          isVeg: true,
          isBestseller: true,
          isSpecial: true,
        },
      });
    }
  }

  console.log("✅ Ghee Sweets, Sugar Free, Hot Sweets & Assorted Boxes added successfully!");
}

addGheeSugarFreeAssortedSweets()
  .catch((e) => {
    console.error("Error adding sweets:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
