import { db } from '../src/lib/db';

async function cleanup() {
  console.log('='.repeat(60));
  console.log('PREDICTION CLEANUP');
  console.log('='.repeat(60));

  // 1. Delete fundamentals predictions with zero news impact
  const fundsZero = await db.prediction.deleteMany({
    where: { modelType: 'fundamentals', newsImpactScore: 0 }
  });
  console.log(`\n✓ Deleted ${fundsZero.count} fundamentals predictions with newsImpactScore=0`);

  // 2. Delete hype predictions with zero social impact
  const hypeZero = await db.prediction.deleteMany({
    where: { modelType: 'hype', socialImpactScore: 0 }
  });
  console.log(`✓ Deleted ${hypeZero.count} hype predictions with socialImpactScore=0`);

  // 3. Delete predictions without baseline price (can't evaluate)
  const noBaseline = await db.prediction.deleteMany({
    where: { baselinePrice: null }
  });
  console.log(`✓ Deleted ${noBaseline.count} predictions with no baseline price`);

  // 4. Reset evaluations with suspicious 0.00% actual change
  // These likely had bad price data
  const suspiciousEvals = await db.prediction.updateMany({
    where: {
      wasCorrect: { not: null },
      actualChange: 0
    },
    data: {
      wasCorrect: null,
      actualChange: null,
      actualDirection: null,
      evaluatedAt: null
    }
  });
  console.log(`✓ Reset ${suspiciousEvals.count} suspicious evaluations with exacty 0% change`);

  // Summary
  const remaining = await db.prediction.count();
  const pending = await db.prediction.count({
    where: { wasCorrect: null, targetDate: { lte: new Date() } }
  });
  const evaluated = await db.prediction.count({
    where: { wasCorrect: { not: null } }
  });

  console.log('\n' + '='.repeat(60));
  console.log('AFTER CLEANUP:');
  console.log(`  Total predictions: ${remaining}`);
  console.log(`  Evaluated: ${evaluated}`);
  console.log(`  Pending evaluation: ${pending}`);
  console.log('='.repeat(60));

  // Check model distribution now
  const funds = await db.prediction.count({ where: { modelType: 'fundamentals' } });
  const hype = await db.prediction.count({ where: { modelType: 'hype' } });
  console.log(`\nModel distribution: Fundamentals=${funds}, Hype=${hype}`);
}

cleanup().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
