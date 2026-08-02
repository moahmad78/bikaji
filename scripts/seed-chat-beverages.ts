import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function addChatAndBeverages() {
  console.log("🥙 Adding CHAT & BEVERAGES categories and menu items...");

  // 1. Get branch
  let branch = await prisma.branch.findFirst();
  if (!branch) {
    throw new Error("No branch found. Please seed initial branch first.");
  }

  // 2. Create or find "CHAT" category
  let chatCategory = await prisma.category.findFirst({
    where: {
      branchId: branch.id,
      name: { equals: "CHAT", mode: "insensitive" },
    },
  });

  if (!chatCategory) {
    chatCategory = await prisma.category.create({
      data: {
        branchId: branch.id,
        name: "CHAT",
        description: "Tangy, spicy, creamy authentic Indian street chaat delicacies.",
        image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=800&q=80",
        order: 5,
      },
    });
  }

  // 3. Create or find "BEVERAGES" category
  let bevCategory = await prisma.category.findFirst({
    where: {
      branchId: branch.id,
      name: { equals: "BEVERAGES", mode: "insensitive" },
    },
  });

  if (!bevCategory) {
    bevCategory = await prisma.category.create({
      data: {
        branchId: branch.id,
        name: "BEVERAGES",
        description: "Refreshing traditional drinks, badam milk, sweet lassi & masala chaas.",
        image: "https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=800&q=80",
        order: 6,
      },
    });
  }

  // Items for CHAT
  const chatItems = [
    {
      name: "DAHI BHALLA(DAHI VADA)",
      description: "Soft lentil dumplings soaked in sweet creamy dahi, topped with cumin & chutneys.",
      price: 120.0,
      image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      isBestseller: true,
      preparationTime: 5,
    },
    {
      name: "BHALLA PAPADI CHAT PER PLATE",
      description: "Combo of soft lentil bhalla and crisp papdis loaded with yogurt, sev & spices.",
      price: 130.0,
      image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      isBestseller: true,
      preparationTime: 5,
    },
    {
      name: "DAHI PAPADI CHAT",
      description: "Crispy fried flour crackers topped with boiled potato, chickpeas, sweet dahi & tangy chutney.",
      price: 90.0,
      image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      preparationTime: 5,
    },
    {
      name: "DAHI PURI",
      description: "Crisp hollow puris filled with potatoes, sweetened curd, tamarind chutney & crunchy sev.",
      price: 90.0,
      image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      isBestseller: true,
      preparationTime: 5,
    },
    {
      name: "SEV PURI",
      description: "Crispy papdis topped with diced potatoes, onions, spicy garlic chutney & generous sev.",
      price: 60.0,
      image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      preparationTime: 5,
    },
    {
      name: "PANI PURI (6PCS)",
      description: "6 Crispy puris filled with spiced potato-sprout filling and chilled mint spicy pani.",
      price: 60.0,
      image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      isBestseller: true,
      preparationTime: 5,
    },
    {
      name: "BHEL PURI",
      description: "Crispy puffed rice mixed with roasted peanuts, raw onions, tomatoes & tangy tamarind sauce.",
      price: 60.0,
      image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      preparationTime: 5,
    },
    {
      name: "RAJ KACHORI",
      description: "The King of Chaats! Large crisp kachori stuffed with sprouts, potatoes, curd, pomegranate & spices.",
      price: 160.0,
      image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      isBestseller: true,
      isSpecial: true,
      preparationTime: 8,
    },
  ];

  // Items for BEVERAGES
  const bevItems = [
    {
      name: "BADAM MILK PER GLASS",
      description: "Rich saffron & cardamom infused chilled almond milk garnished with pistachio flakes.",
      price: 90.0,
      image: "https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      isBestseller: true,
      isSpecial: true,
      preparationTime: 5,
    },
    {
      name: "LASSI [ SEASONAL]",
      description: "Thick creamy churned sweet yogurt drink topped with rabri & saffron (Seasonal special).",
      price: 70.0,
      image: "https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      isBestseller: true,
      preparationTime: 5,
    },
    {
      name: "MASALA CHAAS",
      description: "Traditional refreshing spiced buttermilk with roasted cumin, mint & black salt.",
      price: 40.0,
      image: "https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      isBestseller: true,
      preparationTime: 3,
    },
  ];

  // Add CHAT
  for (const item of chatItems) {
    const existing = await prisma.menuItem.findFirst({
      where: { branchId: branch.id, name: item.name },
    });
    if (existing) {
      await prisma.menuItem.update({
        where: { id: existing.id },
        data: { price: item.price, description: item.description, categoryId: chatCategory.id },
      });
      console.log(`Updated CHAT: ${item.name} (₹${item.price})`);
    } else {
      await prisma.menuItem.create({
        data: {
          branchId: branch.id,
          categoryId: chatCategory.id,
          name: item.name,
          description: item.description,
          price: item.price,
          image: item.image,
          isVeg: item.isVeg,
          isBestseller: item.isBestseller || false,
          isSpecial: item.isSpecial || false,
          preparationTime: item.preparationTime || 5,
        },
      });
      console.log(`Created CHAT: ${item.name} (₹${item.price})`);
    }
  }

  // Add BEVERAGES
  for (const item of bevItems) {
    const existing = await prisma.menuItem.findFirst({
      where: { branchId: branch.id, name: item.name },
    });
    if (existing) {
      await prisma.menuItem.update({
        where: { id: existing.id },
        data: { price: item.price, description: item.description, categoryId: bevCategory.id },
      });
      console.log(`Updated BEVERAGE: ${item.name} (₹${item.price})`);
    } else {
      await prisma.menuItem.create({
        data: {
          branchId: branch.id,
          categoryId: bevCategory.id,
          name: item.name,
          description: item.description,
          price: item.price,
          image: item.image,
          isVeg: item.isVeg,
          isBestseller: item.isBestseller || false,
          isSpecial: item.isSpecial || false,
          preparationTime: item.preparationTime || 5,
        },
      });
      console.log(`Created BEVERAGE: ${item.name} (₹${item.price})`);
    }
  }

  console.log("✅ All CHAT & BEVERAGES items added successfully!");
}

addChatAndBeverages()
  .catch((e) => {
    console.error("Error adding chat and beverages:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
