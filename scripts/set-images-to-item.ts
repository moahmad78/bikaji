import db from "../src/lib/db";

async function run() {
  console.log("🛠️ Updating all items to use /item.png and removing online images...");
  const DEFAULT_IMAGE = "/item.png";

  const retry = async (fn: () => Promise<any>, retries = 5) => {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (e: any) {
        if (i === retries - 1) throw e;
        console.log(`Connection error, retrying in 2 seconds... (${i + 1}/${retries})`);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  };

  try {
    const res1 = await retry(() => db.menuItem.updateMany({
      data: {
        image: DEFAULT_IMAGE,
      },
    }));
    console.log(`✅ Updated ${res1.count} MenuItems to use /item.png`);
  } catch (e) {
    console.error("Error updating MenuItems", e);
  }

  try {
    const res2 = await retry(() => db.menuImage.updateMany({
      data: {
        url: DEFAULT_IMAGE,
      },
    }));
    console.log(`✅ Updated ${res2.count} MenuImages to use /item.png`);
  } catch (e) {
    console.log("Note: MenuImage table update skipped or failed.");
  }

  try {
    const res3 = await retry(() => db.category.updateMany({
      where: {
        image: {
            contains: "http"
        }
      },
      data: {
        image: DEFAULT_IMAGE,
      },
    }));
    console.log(`✅ Updated ${res3.count} Categories that had online images to use /item.png`);
  } catch (e) {
    console.log("Note: Category table update skipped or failed.");
  }

  console.log("🎉 All online images have been replaced with /item.png!");
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
