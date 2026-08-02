import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function addWeekendSpecials() {
  console.log("🌟 Adding WEEKEND SPECIALS category and menu items...");

  // 1. Get branch
  let branch = await prisma.branch.findFirst();
  if (!branch) {
    throw new Error("No branch found. Please seed initial branch first.");
  }

  // 2. Create or find "WEEKEND SPECIALS" category
  let category = await prisma.category.findFirst({
    where: {
      branchId: branch.id,
      name: { equals: "WEEKEND SPECIALS", mode: "insensitive" },
    },
  });

  if (!category) {
    category = await prisma.category.create({
      data: {
        branchId: branch.id,
        name: "WEEKEND SPECIALS",
        description: "Exclusive authentic delicacies available on Friday, Saturday & Sunday.",
        image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=800&q=80",
        order: 2,
      },
    });
  }

  const items = [
    {
      name: "MIRCHI BADA(FRI-SAT-SUN)",
      description: "Traditional Jodhpuri large green chili stuffed with spicy potato mash, batter fried crisp (Available Fri-Sun).",
      price: 30.0,
      image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      isBestseller: true,
      isSpecial: true,
      preparationTime: 8,
    },
    {
      name: "PANEER KOFTA(FRI-SAT-SUN)",
      description: "Rich cottage cheese dumpling stuffed with dry fruits and deep fried to golden perfection (Available Fri-Sun).",
      price: 40.0,
      image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      isBestseller: true,
      isSpecial: true,
      preparationTime: 8,
    },
    {
      name: "PURI ALOO SABJI (SAT-SUN)",
      description: "Fluffy golden fried puris served with traditional spicy Bikaneri potato curry (Available Sat-Sun).",
      price: 140.0,
      image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      isBestseller: true,
      isSpecial: true,
      preparationTime: 12,
    },
    {
      name: "SANDWICH SAMOSA(SAT-SUN)",
      description: "Innovative fusion samosa layered with spicy potato, chutney & sandwich seasonings (Available Sat-Sun).",
      price: 30.0,
      image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      isSpecial: true,
      preparationTime: 8,
    },
  ];

  for (const item of items) {
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
          price: item.price,
          description: item.description,
          categoryId: category.id,
          isSpecial: true,
        },
      });
      console.log(`Updated: ${item.name} (₹${item.price})`);
    } else {
      await prisma.menuItem.create({
        data: {
          branchId: branch.id,
          categoryId: category.id,
          name: item.name,
          description: item.description,
          price: item.price,
          image: item.image,
          isVeg: item.isVeg,
          isBestseller: item.isBestseller || false,
          isSpecial: true,
          preparationTime: item.preparationTime || 8,
        },
      });
      console.log(`Created: ${item.name} (₹${item.price})`);
    }
  }

  console.log("✅ All WEEKEND SPECIALS items added successfully!");
}

addWeekendSpecials()
  .catch((e) => {
    console.error("Error adding weekend specials:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
