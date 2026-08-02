import db from "../src/lib/db";

async function fixBrokenImages() {
  console.log("🛠️ Checking database menu items for broken image URLs...");

  const items = await db.menuItem.findMany();
  let updatedCount = 0;

  const DEFAULT_IMAGE = "/logo.png";

  for (const item of items) {
    if (
      !item.image ||
      item.image.includes("photo-1601050690597-df056fb4ce78") ||
      item.image.includes("unsplash.com")
    ) {
      await db.menuItem.update({
        where: { id: item.id },
        data: {
          image: DEFAULT_IMAGE,
        },
      });
      updatedCount++;
    }
  }

  // Also clean MenuImage table
  try {
    const images = await db.menuImage.findMany();
    for (const img of images) {
      if (img.url.includes("photo-1601050690597-df056fb4ce78") || img.url.includes("unsplash.com")) {
        await db.menuImage.update({
          where: { id: img.id },
          data: {
            url: DEFAULT_IMAGE,
          },
        });
      }
    }
  } catch (e) {
    console.log("Note: MenuImage table update skipped.");
  }

  console.log(`✅ Updated ${updatedCount} menu items with clean local logo/image fallbacks.`);
}

fixBrokenImages()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
