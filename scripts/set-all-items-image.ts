import db from "../src/lib/db";

async function setAllItemsToItemPng() {
  console.log("🔄 Updating all menu item images to '/item.png'...");

  const updateResult = await db.menuItem.updateMany({
    data: {
      image: "/item.png",
    },
  });

  console.log(`✅ Successfully updated ${updateResult.count} menu items to use '/item.png'.`);

  try {
    const imgUpdateResult = await db.menuImage.updateMany({
      data: {
        url: "/item.png",
      },
    });
    console.log(`✅ Successfully updated ${imgUpdateResult.count} menu gallery images to use '/item.png'.`);
  } catch (e) {
    console.log("Note: MenuImage table update skipped.");
  }
}

setAllItemsToItemPng()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
