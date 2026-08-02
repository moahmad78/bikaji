import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkSweets() {
  console.log("🔍 Inspecting 'SWEETS' category & subcategories...");

  const sweetsCat = await prisma.category.findFirst({
    where: {
      name: { equals: "SWEETS", mode: "insensitive" },
    },
    include: {
      subCategories: {
        include: {
          items: true,
        },
      },
      items: {
        where: {
          subCategory: null,
        },
      },
    },
  });

  if (!sweetsCat) {
    console.log("❌ Category 'SWEETS' not found!");
    return;
  }

  console.log(`Category: ${sweetsCat.name} (Total Items: ${sweetsCat.items.length})`);
  console.log("SubCategories:");
  for (const sub of sweetsCat.subCategories) {
    console.log(` - SubCategory: '${sub.name}' (${sub.items.length} items)`);
    for (const item of sub.items) {
      console.log(`    • ${item.name} - ₹${item.price}`);
    }
  }
}

checkSweets()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
