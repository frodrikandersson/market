import { db } from '../src/lib/db';

async function check() {
  const predictions = await db.prediction.findMany({
    where: { wasCorrect: null, targetDate: { lt: new Date() } },
    select: { id: true, baselinePrice: true, targetDate: true },
    take: 10
  });

  console.log('Sample predictions with baselinePrice:');
  for (const p of predictions) {
    console.log(`  baselinePrice: ${p.baselinePrice}, targetDate: ${p.targetDate.toISOString().split('T')[0]}`);
  }

  const withBaseline = await db.prediction.count({
    where: { wasCorrect: null, targetDate: { lt: new Date() }, baselinePrice: { not: null } }
  });

  const withoutBaseline = await db.prediction.count({
    where: { wasCorrect: null, targetDate: { lt: new Date() }, baselinePrice: null }
  });

  console.log(`\nWith baselinePrice: ${withBaseline}`);
  console.log(`Without baselinePrice: ${withoutBaseline}`);
}

check().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
