import db from "../src/lib/db";

async function inspectImages() {
  const items = await db.menuItem.findMany({ select: { id: true, name: true, image: true } });
  console.log(`Total menu items: ${items.length}`);
  const uniqueImages = new Set(items.map(i => i.image));
  console.log("Distinct Image URLs:", Array.from(uniqueImages).slice(0, 20));

  // Check if any items have non-local image URLs
  const external = items.filter(i => i.image.startsWith("http"));
  console.log(`Items with external HTTP images: ${external.length}`);
  for (const item of external) {
    console.log(` - [${item.name}]: ${item.image}`);
    await db.menuItem.update({
      where: { id: item.id },
      data: { image: "/logo.png" }
    });
  }
  if (external.length > 0) {
    console.log(`✅ Replaced ${external.length} external HTTP image URLs with local /logo.png.`);
  }
}

inspectImages().finally(() => db.$disconnect());
