import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function addMealsAndExtra() {
  console.log("🍲 Adding MEALS & EXTRA categories and menu items...");

  // 1. Get branch
  let branch = await prisma.branch.findFirst();
  if (!branch) {
    throw new Error("No branch found. Please seed initial branch first.");
  }

  // 2. Create or find "MEALS" category
  let mealsCategory = await prisma.category.findFirst({
    where: {
      branchId: branch.id,
      name: { equals: "MEALS", mode: "insensitive" },
    },
  });

  if (!mealsCategory) {
    mealsCategory = await prisma.category.create({
      data: {
        branchId: branch.id,
        name: "MEALS",
        description: "Hearty North Indian thalis, chola bhatura, combo platters & rice meals.",
        image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=800&q=80",
        order: 3,
      },
    });
  }

  // 3. Create or find "EXTRA" category
  let extraCategory = await prisma.category.findFirst({
    where: {
      branchId: branch.id,
      name: { equals: "EXTRA", mode: "insensitive" },
    },
  });

  if (!extraCategory) {
    extraCategory = await prisma.category.create({
      data: {
        branchId: branch.id,
        name: "EXTRA",
        description: "Extra bhatura, chola, kulcha and pav portions.",
        image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=800&q=80",
        order: 4,
      },
    });
  }

  // Items for MEALS
  const mealsItems = [
    {
      name: "CHOLA BHATURA",
      description: "Spicy chickpea gravy served with 2 fluffy deep-fried bhaturas, pickled onions and chili.",
      price: 220.0,
      image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      isBestseller: true,
      preparationTime: 12,
    },
    {
      name: "CHOLA KULCHA",
      description: "Tangy street-style chola served with soft butter-toasted kulchas.",
      price: 200.0,
      image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      isBestseller: true,
      preparationTime: 10,
    },
    {
      name: "RAJMA RICE PER",
      description: "Comforting kidney bean curry slow-cooked with aromatic spices, served with steamed basmati rice.",
      price: 150.0,
      image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      isBestseller: true,
      preparationTime: 10,
    },
    {
      name: "CHOLA RICE",
      description: "Rich spiced pindi chola served alongside fragrant basmati rice.",
      price: 190.0,
      image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      preparationTime: 10,
    },
    {
      name: "ALOO TIKKI",
      description: "Crispy potato patties topped with sweet curd, tamarind & mint chutneys.",
      price: 120.0,
      image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      isBestseller: true,
      preparationTime: 8,
    },
    {
      name: "PAV BHAJI",
      description: "Mashed vegetable curry cooked with special spices and butter, served with butter-toasted pavs.",
      price: 150.0,
      image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      isBestseller: true,
      preparationTime: 10,
    },
    {
      name: "SHAHI PANEER WITH TAWA PARATHA",
      description: "Royal cottage cheese curry cooked in tomato cashew gravy served with 2 wheat tawa parathas.",
      price: 220.0,
      image: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      isSpecial: true,
      preparationTime: 12,
    },
    {
      name: "DAL MAKHANI WITH TAWA PARATHA",
      description: "Slow-cooked black lentils in butter gravy served with 2 layered tawa parathas.",
      price: 200.0,
      image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      isBestseller: true,
      preparationTime: 12,
    },
    {
      name: "CHOLA WITH TAWA PARATHA",
      description: "Classic pindi chola served with 2 crispy wheat tawa parathas.",
      price: 200.0,
      image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      preparationTime: 10,
    },
    {
      name: "SHAHI PANEER WITH RICE",
      description: "Rich shahi paneer gravy served with steamed basmati rice.",
      price: 200.0,
      image: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      preparationTime: 10,
    },
    {
      name: "DAL MAKHANI WITH RICE",
      description: "Creamy 24-hr cooked dal makhani served with basmati rice.",
      price: 190.0,
      image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      preparationTime: 10,
    },
    {
      name: "EXECUTIVE THALI",
      description: "Chola, 2 Mini paratha, Rice, Shahi paneer, Dal makhni, Raita, 1 Sweet, Masala chaas, Papad & Pickle.",
      price: 360.0,
      image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      isBestseller: true,
      isSpecial: true,
      preparationTime: 15,
    },
  ];

  // Items for EXTRA
  const extraItems = [
    {
      name: "EXTRA BHATURA",
      description: "Single fresh fluffy deep-fried bhatura.",
      price: 40.0,
      image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      preparationTime: 5,
    },
    {
      name: "EXTRA CHOLA",
      description: "Extra portion bowl of spicy chola gravy.",
      price: 160.0,
      image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      preparationTime: 5,
    },
    {
      name: "EXTRA KULCHA",
      description: "Single extra buttered kulcha bread.",
      price: 60.0,
      image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      preparationTime: 5,
    },
    {
      name: "EXTRA PAV",
      description: "Pair of extra butter-toasted pav breads.",
      price: 40.0,
      image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      preparationTime: 5,
    },
  ];

  // Add MEALS
  for (const item of mealsItems) {
    const existing = await prisma.menuItem.findFirst({
      where: { branchId: branch.id, name: item.name },
    });
    if (existing) {
      await prisma.menuItem.update({
        where: { id: existing.id },
        data: { price: item.price, description: item.description, categoryId: mealsCategory.id },
      });
      console.log(`Updated MEAL: ${item.name} (₹${item.price})`);
    } else {
      await prisma.menuItem.create({
        data: {
          branchId: branch.id,
          categoryId: mealsCategory.id,
          name: item.name,
          description: item.description,
          price: item.price,
          image: item.image,
          isVeg: item.isVeg,
          isBestseller: item.isBestseller || false,
          isSpecial: item.isSpecial || false,
          preparationTime: item.preparationTime || 10,
        },
      });
      console.log(`Created MEAL: ${item.name} (₹${item.price})`);
    }
  }

  // Add EXTRA
  for (const item of extraItems) {
    const existing = await prisma.menuItem.findFirst({
      where: { branchId: branch.id, name: item.name },
    });
    if (existing) {
      await prisma.menuItem.update({
        where: { id: existing.id },
        data: { price: item.price, description: item.description, categoryId: extraCategory.id },
      });
      console.log(`Updated EXTRA: ${item.name} (₹${item.price})`);
    } else {
      await prisma.menuItem.create({
        data: {
          branchId: branch.id,
          categoryId: extraCategory.id,
          name: item.name,
          description: item.description,
          price: item.price,
          image: item.image,
          isVeg: item.isVeg,
          preparationTime: item.preparationTime || 5,
        },
      });
      console.log(`Created EXTRA: ${item.name} (₹${item.price})`);
    }
  }

  console.log("✅ All MEALS & EXTRA items added successfully!");
}

addMealsAndExtra()
  .catch((e) => {
    console.error("Error adding meals and extra:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
