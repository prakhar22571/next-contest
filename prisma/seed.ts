import { PrismaClient } from "@prisma/client";
import { PLATFORM_CATALOG } from "../src/lib/clist/platforms";

const prisma = new PrismaClient();

async function main() {
  for (const platform of PLATFORM_CATALOG) {
    await prisma.platform.upsert({
      where: { slug: platform.slug },
      create: { slug: platform.slug, name: platform.name },
      update: { name: platform.name, isActive: true },
    });
  }
  console.log(`Seeded ${PLATFORM_CATALOG.length} platforms.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
