import { db } from '../src/lib/db';

async function cleanup() {
  // Find predictions with exactly 0.00% actual change
  const count = await db.prediction.count({
    where: { actualChange: 0 }
  });
  console.log('Predictions with actualChange = 0:', count);

  // Delete them
  const deleted = await db.prediction.deleteMany({
    where: { actualChange: 0 }
  });
  console.log('Deleted:', deleted.count);

  // Show remaining stats
  const remaining = await db.prediction.count();
  const evaluated = await db.prediction.count({ where: { wasCorrect: { not: null } } });
  const pending = await db.prediction.count({ where: { wasCorrect: null, targetDate: { lte: new Date() } } });

  console.log('\nAfter cleanup:');
  console.log('  Total predictions:', remaining);
  console.log('  Evaluated:', evaluated);
  console.log('  Pending:', pending);
}

cleanup().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
