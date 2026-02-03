import { db } from '../src/lib/db';

async function check() {
  // Get pending predictions
  const pending = await db.prediction.findMany({
    where: { wasCorrect: null, targetDate: { lt: new Date() } },
    include: { company: { select: { ticker: true } } },
  });

  console.log('Total pending predictions:', pending.length);

  let canEvaluate = 0;
  let missingPrices = 0;

  for (const p of pending.slice(0, 10)) {
    const targetDate = new Date(p.targetDate);
    const dayBefore = new Date(targetDate);
    dayBefore.setDate(dayBefore.getDate() - 1);

    // Check if we have prices for these dates
    const [fromPrice, toPrice] = await Promise.all([
      db.stockPrice.findFirst({
        where: { companyId: p.companyId, date: { lte: dayBefore } },
        orderBy: { date: 'desc' },
      }),
      db.stockPrice.findFirst({
        where: { companyId: p.companyId, date: { lte: targetDate } },
        orderBy: { date: 'desc' },
      }),
    ]);

    const hasBothPrices = fromPrice && toPrice;

    console.log(`\n${p.company.ticker} - Target: ${targetDate.toISOString().split('T')[0]}`);
    console.log(`  Day before (${dayBefore.toISOString().split('T')[0]}): ${fromPrice ? fromPrice.date.toISOString().split('T')[0] : 'MISSING'}`);
    console.log(`  Target date: ${toPrice ? toPrice.date.toISOString().split('T')[0] : 'MISSING'}`);
    console.log(`  Can evaluate: ${hasBothPrices ? 'YES' : 'NO'}`);

    if (hasBothPrices) canEvaluate++;
    else missingPrices++;
  }

  console.log('\n--- Summary (first 10) ---');
  console.log(`Can evaluate: ${canEvaluate}`);
  console.log(`Missing prices: ${missingPrices}`);
}

check().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
