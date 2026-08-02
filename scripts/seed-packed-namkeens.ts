import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function addPackedNamkeens() {
  console.log("🥨 Adding PACKED NAMKEENS, PAPAD, SOAN PAPDI & COOKIES (92 Items)...");

  // 1. Get branch
  let branch = await prisma.branch.findFirst();
  if (!branch) {
    throw new Error("No branch found.");
  }

  // 2. Create or find Category "PACKED NAMKEENS"
  let mainCategory = await prisma.category.findFirst({
    where: {
      branchId: branch.id,
      name: { equals: "PACKED NAMKEENS", mode: "insensitive" },
    },
  });

  if (!mainCategory) {
    mainCategory = await prisma.category.create({
      data: {
        branchId: branch.id,
        name: "PACKED NAMKEENS",
        description: "Bikaji signature sealed bhujia packs, dry fruit mixtures, matthi, papad, tin sweets & cookies.",
        image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80",
        order: 3,
      },
    });
  }

  // Helper for subcategories
  async function getSubCategory(name: string, order: number) {
    let sub = await prisma.subCategory.findFirst({
      where: {
        categoryId: mainCategory!.id,
        name: { equals: name, mode: "insensitive" },
      },
    });
    if (!sub) {
      sub = await prisma.subCategory.create({
        data: {
          categoryId: mainCategory!.id,
          name,
          description: `${name} items at Bikaji`,
          order,
        },
      });
    }
    return sub;
  }

  const bhujiaSub = await getSubCategory("BHUJIA & NAMKEEN PACKS", 1);
  const dryfruitSub = await getSubCategory("DRY FRUIT MIXTURE", 2);
  const matthiSub = await getSubCategory("MATTHI & SAVORIES", 3);
  const papadSub = await getSubCategory("BIKANERI PAPAD", 4);
  const tinSub = await getSubCategory("TIN SWEETS & SOAN PAPDI", 5);
  const cookiesSub = await getSubCategory("BAKERY COOKIES", 6);

  const defaultImg = "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80";

  // Section 1: 1KG / 400G / 200G PACKS (42 Items)
  const bhujiaItems = [
    // 1KG
    { name: "BIKANERI BHUJIA [1KG]", price: 330.0 },
    { name: "KUCH KUCH ALL IN ONE [1KG]", price: 330.0 },
    { name: "TANA TAN ALOO BHUJIA [1KG]", price: 330.0 },
    { name: "SUB -KUCH NAVRATNA MIX [1KG]", price: 370.0 },
    { name: "TANA BANA KHATTA MEETHA [1KG]", price: 370.0 },
    // 400GM
    { name: "BIKANERI BHUJIA [400GM]", price: 115.0 },
    { name: "KUCH KUCH ALL IN ONE [400GM]", price: 115.0 },
    { name: "TANA TAN ALOO BHUJIA [400GM]", price: 115.0 },
    { name: "SUB -KUCH NAVRATNA MIX [400GM]", price: 110.0 },
    { name: "MOONG DAL [400GM]", price: 115.0 },
    { name: "TANA BANA KHATTA MEETHA [400GM]", price: 115.0 },
    { name: "BOONDI BHUJIA [400GM]", price: 100.0 },
    { name: "SP.CHATPATA RATLAMI SEV [400GM]", price: 100.0 },
    { name: "KHOKHA BHUJIA [400GM]", price: 100.0 },
    { name: "KOLKATA CHANACHUR [400GM]", price: 115.0 },
    { name: "MAKHAN MALAI BHUJIA [400GM]", price: 110.0 },
    { name: "MARWADI SEV [400GM]", price: 100.0 },
    { name: "NUTCRACKER [400GM]", price: 105.0 },
    { name: "SEEDHA-SADHA BHUJIA [400GM]", price: 100.0 },
    { name: "SUPER NO. 3 BHUJIA [400GM]", price: 110.0 },
    // 200GM & SPECIAL PACKS
    { name: "BIKANERI BHUJIA [200GM]", price: 58.0 },
    { name: "KUCH KUCH ALL IN ONE [200GM]", price: 58.0 },
    { name: "TANA TAN ALOO BHUJIA [200GM]", price: 58.0 },
    { name: "SUB -KUCH NAVRATNA MIX [200GM]", price: 56.0 },
    { name: "MOONG DAL [200GM]", price: 58.0 },
    { name: "TANA BANA KHATTA MEETHA [200GM]", price: 60.0 },
    { name: "ALOO LACCHA [150GM]", price: 60.0 },
    { name: "CHOWPATI BHEL [300GM]", price: 65.0 },
    { name: "CHOWPATI BHELPURI CAN [110GM]", price: 47.0 },
    { name: "CRUSHED PEANUTS [200GM]", price: 58.0 },
    { name: "CRUSTY NUTS [200GM]", price: 58.0 },
    { name: "FALAHARI MIX [200GM]", price: 75.0 },
    { name: "PUNJABI TADKA [200GM]", price: 50.0 },
    { name: "SOYA STICKS [200GM]", price: 75.0 },
    { name: "MURUKKU CHAKRI [200GM]", price: 60.0 },
    { name: "NASHTA MATHRI [200GM]", price: 50.0 },
    { name: "NASHTA SAMOSA [200GM]", price: 50.0 },
    { name: "KOLKATA CHANACHUR [200GM]", price: 58.0 },
    { name: "LITE JHALMURI [200GM]", price: 38.0 },
    { name: "MAIDA KAJU NAMKEEN [400GM]", price: 90.0 },
    { name: "SUJI RUSK (300GM)", price: 50.0 },
    { name: "KHARI [250GM]", price: 60.0 },
  ];

  for (const item of bhujiaItems) {
    const existing = await prisma.menuItem.findFirst({ where: { branchId: branch.id, name: item.name } });
    if (existing) {
      await prisma.menuItem.update({
        where: { id: existing.id },
        data: { price: item.price, categoryId: mainCategory.id, subCategoryId: bhujiaSub.id },
      });
    } else {
      await prisma.menuItem.create({
        data: {
          branchId: branch.id,
          categoryId: mainCategory.id,
          subCategoryId: bhujiaSub.id,
          name: item.name,
          description: `Sealed authentic Bikaji pack (${item.name}).`,
          price: item.price,
          image: defaultImg,
          isVeg: true,
          isBestseller: item.name.includes("BIKANERI BHUJIA") || item.name.includes("ALL IN ONE"),
        },
      });
    }
  }

  // Section 2: DRY FRUIT MIXTURE (8 Items)
  const dryfruitItems = [
    { name: "MASTKIN CONFLAKE MIX [350GM]", price: 140.0 },
    { name: "MASTKIN CONFLAKE MIX [150GM]", price: 60.0 },
    { name: "SHAHI MIXTURE [350GM]", price: 140.0 },
    { name: "SHAHI MIXTURE [150GM]", price: 60.0 },
    { name: "KAJU KISMIS MIX [350GM]", price: 140.0 },
    { name: "KAJU KISMIS MIX [150GM]", price: 60.0 },
    { name: "KAJU BADAM LACCHA [350GM]", price: 140.0 },
    { name: "KAJU BADAM LACCHA [150GM]", price: 60.0 },
  ];

  for (const item of dryfruitItems) {
    const existing = await prisma.menuItem.findFirst({ where: { branchId: branch.id, name: item.name } });
    if (existing) {
      await prisma.menuItem.update({
        where: { id: existing.id },
        data: { price: item.price, categoryId: mainCategory.id, subCategoryId: dryfruitSub.id },
      });
    } else {
      await prisma.menuItem.create({
        data: {
          branchId: branch.id,
          categoryId: mainCategory.id,
          subCategoryId: dryfruitSub.id,
          name: item.name,
          description: `Premium Bikaji dry fruit mixture pack (${item.name}).`,
          price: item.price,
          image: defaultImg,
          isVeg: true,
          isBestseller: true,
        },
      });
    }
  }

  // Section 3: MATTHI PRODUCTS (18 Items)
  const matthiItems = [
    { name: "ACHARI MASALA MATTHI [400GM]", price: 90.0 },
    { name: "BHAKARWADI SWEETKIN [400GM]", price: 90.0 },
    { name: "BHAKHARWADI SWEETKIN", price: 90.0 },
    { name: "CHAI PURI [400GM]", price: 90.0 },
    { name: "CHAKOLI [400GM]", price: 90.0 },
    { name: "CHASKA MASKA [400GM]", price: 90.0 },
    { name: "DRY KACHORI [400GM]", price: 90.0 },
    { name: "DRY KACHORI [200GM]", price: 90.0 },
    { name: "GOL MATTHI [400GM]", price: 90.0 },
    { name: "GURPARA [400GM]", price: 90.0 },
    { name: "METHI MATTHI [400GM]", price: 90.0 },
    { name: "METHI PARA [400GM]", price: 90.0 },
    { name: "MILK MATTHI [400GM]", price: 90.0 },
    { name: "MINI BHAKARWADI [400GM]", price: 90.0 },
    { name: "NAMAK PARA [400GM]", price: 90.0 },
    { name: "SHAKKAR PARA [400GM]", price: 90.0 },
    { name: "SHAKKAR PARA [200GM]", price: 90.0 },
    { name: "TRIKONI MATTHI [400GM]", price: 90.0 },
  ];

  for (const item of matthiItems) {
    const existing = await prisma.menuItem.findFirst({ where: { branchId: branch.id, name: item.name } });
    if (existing) {
      await prisma.menuItem.update({
        where: { id: existing.id },
        data: { price: item.price, categoryId: mainCategory.id, subCategoryId: matthiSub.id },
      });
    } else {
      await prisma.menuItem.create({
        data: {
          branchId: branch.id,
          categoryId: mainCategory.id,
          subCategoryId: matthiSub.id,
          name: item.name,
          description: `Crispy traditional teatime savory (${item.name}).`,
          price: item.price,
          image: defaultImg,
          isVeg: true,
        },
      });
    }
  }

  // Section 4: PAPAD (4 Items)
  const papadItems = [
    { name: "BAAT CHEET PAPAD [1 KG]", price: 320.0 },
    { name: "BAAT CHEET PAPAD [400GM]", price: 135.0 },
    { name: "CHANA PAPAD [400GM]", price: 122.0 },
    { name: "DILKHUSH PAPAD [400GM]", price: 140.0 },
  ];

  for (const item of papadItems) {
    const existing = await prisma.menuItem.findFirst({ where: { branchId: branch.id, name: item.name } });
    if (existing) {
      await prisma.menuItem.update({
        where: { id: existing.id },
        data: { price: item.price, categoryId: mainCategory.id, subCategoryId: papadSub.id },
      });
    } else {
      await prisma.menuItem.create({
        data: {
          branchId: branch.id,
          categoryId: mainCategory.id,
          subCategoryId: papadSub.id,
          name: item.name,
          description: `Crispy Bikaneri moong & chana papad (${item.name}).`,
          price: item.price,
          image: defaultImg,
          isVeg: true,
          isBestseller: true,
        },
      });
    }
  }

  // Section 5: TIN PACK SWEETS & SOAN PAPDI (10 Items)
  const tinItems = [
    { name: "RASGULLA [1.25 KG TIN]", price: 250.0 },
    { name: "GULAB JAMUN [1.25 KG TIN]", price: 275.0 },
    { name: "RAJBHOG [1.25 KG TIN]", price: 265.0 },
    { name: "MASALA BADAM [250GM]", price: 400.0 },
    { name: "NAMKEEN KAJU [250GM]", price: 400.0 },
    { name: "MASALA KAJU [250GM]", price: 400.0 },
    { name: "SOAN PAPADI SADABAHAR [450GM]", price: 205.0 },
    { name: "SOAN PAPADI SADABAHAR [200GM]", price: 98.0 },
    { name: "SOAN PAPADI MANBHAVAN [450GM]", price: 135.0 },
    { name: "SOAN PAPADI MANBHAVAN [200GM]", price: 62.0 },
  ];

  for (const item of tinItems) {
    const existing = await prisma.menuItem.findFirst({ where: { branchId: branch.id, name: item.name } });
    if (existing) {
      await prisma.menuItem.update({
        where: { id: existing.id },
        data: { price: item.price, categoryId: mainCategory.id, subCategoryId: tinSub.id },
      });
    } else {
      await prisma.menuItem.create({
        data: {
          branchId: branch.id,
          categoryId: mainCategory.id,
          subCategoryId: tinSub.id,
          name: item.name,
          description: `Sealed tin pack sweet / dry fruit / soan papdi (${item.name}).`,
          price: item.price,
          image: defaultImg,
          isVeg: true,
          isBestseller: true,
        },
      });
    }
  }

  // Section 6: COOKIES (10 Items)
  const cookieItems = [
    { name: "AJWAIN COOKIES [400GM]", price: 105.0 },
    { name: "ASSORTED COOKIES [400GM]", price: 105.0 },
    { name: "ASSORTED DRY FRUIT COOKIES [400GM]", price: 135.0 },
    { name: "BUTTER BADAM COOKIES [400GM]", price: 135.0 },
    { name: "COCONUT COOKIES [400GM]", price: 105.0 },
    { name: "JEERA COOKIES [400GM]", price: 105.0 },
    { name: "KAJU NANKHATAI COOKIES [300GM]", price: 105.0 },
    { name: "KAJU PISTA COOKIES [400GM]", price: 135.0 },
    { name: "KESAR PISTA BADAM COOKIES [400GM]", price: 135.0 },
    { name: "PUNJABI COOKIES [400GM]", price: 105.0 },
  ];

  for (const item of cookieItems) {
    const existing = await prisma.menuItem.findFirst({ where: { branchId: branch.id, name: item.name } });
    if (existing) {
      await prisma.menuItem.update({
        where: { id: existing.id },
        data: { price: item.price, categoryId: mainCategory.id, subCategoryId: cookiesSub.id },
      });
    } else {
      await prisma.menuItem.create({
        data: {
          branchId: branch.id,
          categoryId: mainCategory.id,
          subCategoryId: cookiesSub.id,
          name: item.name,
          description: `Freshly baked premium Bikaji cookies (${item.name}).`,
          price: item.price,
          image: defaultImg,
          isVeg: true,
        },
      });
    }
  }

  console.log("✅ All 92 PACKED NAMKEENS, PAPAD, SOAN PAPDI & COOKIES added successfully!");
}

addPackedNamkeens()
  .catch((e) => {
    console.error("Error adding packed namkeens:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
