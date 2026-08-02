import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function addSnacks() {
  console.log("🍡 Adding SNACKS category and menu items...");

  // 1. Get or create branch
  let branch = await prisma.branch.findFirst();
  if (!branch) {
    const restaurant = await prisma.restaurant.create({
      data: {
        name: "Bikaji Group",
        description: "Bikaji Premium Indian Dining and Catering",
      },
    });
    branch = await prisma.branch.create({
      data: {
        restaurantId: restaurant.id,
        name: "Bikaji Main Branch",
        address: "Paupat Road, Bikaner, Rajasthan",
        phone: "+91 98765 43210",
        email: "main@bikaji.com",
      },
    });
  }

  // 2. Create or find "SNACKS" category
  let snacksCategory = await prisma.category.findFirst({
    where: {
      branchId: branch.id,
      name: { equals: "SNACKS", mode: "insensitive" },
    },
  });

  if (!snacksCategory) {
    snacksCategory = await prisma.category.create({
      data: {
        branchId: branch.id,
        name: "SNACKS",
        description: "Freshly fried & steamed authentic Indian snacks, kachoris, samosas & dhokla.",
        image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=800&q=80",
        order: 1,
      },
    });
  }

  const snacksItems = [
    {
      name: "SAMOSA (PER PC)",
      description: "Crispy golden fried pastry stuffed with spiced potato & green peas filling.",
      price: 25.0,
      image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      isBestseller: true,
      preparationTime: 5,
    },
    {
      name: "BIKANERI KACHORI (PER PC)",
      description: "Authentic Rajasthani fried kachori with spiced lentil stuffing.",
      price: 25.0,
      image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      isBestseller: true,
      preparationTime: 5,
    },
    {
      name: "ONION KACHORI PER PC",
      description: "Crispy fried kachori filled with caramelized onions and traditional spices.",
      price: 30.0,
      image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      isBestseller: true,
      preparationTime: 5,
    },
    {
      name: "MATAR KACHORI PER PC",
      description: "Crispy pastry stuffed with spiced green peas mash.",
      price: 25.0,
      image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      isBestseller: false,
      preparationTime: 5,
    },
    {
      name: "CHEESE SAMOSA 4PCS",
      description: "Mini crispy samosas stuffed with gooey molten cheese.",
      price: 60.0,
      image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      isSpecial: true,
      preparationTime: 8,
    },
    {
      name: "PLAIN DHOKLA PER KG",
      description: "Soft and spongy steamed gram flour dhokla tempered with mustard seeds (1 Kg).",
      price: 360.0,
      image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      isAvailable: true,
      preparationTime: 10,
    },
    {
      name: "PLAIN DHOKLA PER PLATE",
      description: "Freshly steamed soft dhokla served with green mint chutney.",
      price: 60.0,
      image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      isBestseller: true,
      preparationTime: 5,
    },
    {
      name: "PANEER DHOKLA PER PLATE",
      description: "Spongy dhokla layered with grated paneer and tempered spices.",
      price: 60.0,
      image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      isSpecial: true,
      preparationTime: 5,
    },
    {
      name: "KHANDVI PER KG",
      description: "Traditional Gujarati rolled chickpea flour sheets tempered with mustard and coconut (1 Kg).",
      price: 600.0,
      image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      preparationTime: 10,
    },
    {
      name: "FAFDA 100G",
      description: "Crispy gram flour strips seasoned with carom seeds, served with fried green chilies (100g).",
      price: 60.0,
      image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      isBestseller: true,
      preparationTime: 5,
    },
    {
      name: "DAHI SAMOSA",
      description: "Crushed hot samosa topped with sweet chilled curd, tamarind & mint chutney.",
      price: 35.0,
      image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      isBestseller: true,
      preparationTime: 5,
    },
    {
      name: "DAHI ONION KACHORI",
      description: "Crushed onion kachori layered with creamy curd, spices & sweet chutney.",
      price: 40.0,
      image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      isBestseller: true,
      preparationTime: 5,
    },
    {
      name: "DAHI MATAR KACHORI",
      description: "Fresh matar kachori smashed & dressed with savory yogurt and chutneys.",
      price: 35.0,
      image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      preparationTime: 5,
    },
    {
      name: "DAHI BIKANERI KACHORI",
      description: "Rajasthani kachori garnished with chilled dahi, bhujia & pomegranate.",
      price: 35.0,
      image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      isSpecial: true,
      preparationTime: 5,
    },
    {
      name: "KHANDVI PER PLATE",
      description: "Soft yellow khandvi rolls garnished with mustard seeds, sesame & fresh coriander.",
      price: 60.0,
      image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=800&q=80",
      isVeg: true,
      isBestseller: true,
      preparationTime: 5,
    },
  ];

  for (const item of snacksItems) {
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
          categoryId: snacksCategory.id,
        },
      });
      console.log(`Updated: ${item.name} (₹${item.price})`);
    } else {
      await prisma.menuItem.create({
        data: {
          branchId: branch.id,
          categoryId: snacksCategory.id,
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
      console.log(`Created: ${item.name} (₹${item.price})`);
    }
  }

  console.log("✅ All 15 SNACKS items added successfully!");
}

addSnacks()
  .catch((e) => {
    console.error("Error adding snacks:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
