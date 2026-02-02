import { db } from './src/lib/db';

async function checkCompanies() {
  const total = await db.company.count();
  const withPrices = await db.company.count({
    where: { stockPrices: { some: {} } }
  });

  console.log(`Total companies: ${total}`);
  console.log(`With price data: ${withPrices}`);
  console.log(`Without prices: ${total - withPrices}`);

  // Show some examples without prices
  const noPrices = await db.company.findMany({
    where: { stockPrices: { none: {} } },
    take: 10,
    select: { ticker: true, name: true, createdAt: true }
  });

  console.log('\nExamples without price data:');
  noPrices.forEach(c => {
    console.log(`  ${c.ticker} - ${c.name} (added ${c.createdAt.toISOString().split('T')[0]})`);
  });

  await db.$disconnect();
}

checkCompanies();
