import { PrismaClient } from "@prisma/client";
import { PLATFORM_CATALOG } from "../src/lib/contests/platforms";

const prisma = new PrismaClient();

async function main() {
  const slugs = PLATFORM_CATALOG.map((p) => p.slug);

  for (const platform of PLATFORM_CATALOG) {
    await prisma.platform.upsert({
      where: { slug: platform.slug },
      create: { slug: platform.slug, name: platform.name },
      update: { name: platform.name, isActive: true },
    });
  }

  // Retire platforms that are no longer in the catalog (e.g. dropped when the
  // clist.by dependency was removed).
  const retired = await prisma.platform.updateMany({
    where: { slug: { notIn: slugs }, isActive: true },
    data: { isActive: false },
  });

  console.log(`Seeded ${PLATFORM_CATALOG.length} platforms, retired ${retired.count}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
