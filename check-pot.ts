import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const c = await prisma.baseItem.count({where: {potSize: {not: null}}});
  console.log('Pot sizes updated:', c);
}

main().finally(() => prisma.$disconnect());
