import { db } from '../src/lib/db';

async function check() {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 90);

  // Get all evaluated predictions
  const predictions = await db.prediction.findMany({
    where: {
      targetDate: { gte: startDate, lte: endDate },
      wasCorrect: { not: null },
      actualChange: { not: null },
    },
    select: {
      modelType: true,
      wasCorrect: true,
    },
  });

  const fundamentals = predictions.filter(p => p.modelType === 'fundamentals');
  const hype = predictions.filter(p => p.modelType === 'hype');

  console.log('Total evaluated predictions:', predictions.length);
  console.log('Fundamentals predictions:', fundamentals.length);
  console.log('Hype predictions:', hype.length);

  // Check model type distribution
  const modelTypes = predictions.reduce((acc, p) => {
    acc[p.modelType] = (acc[p.modelType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log('\nModel type distribution:', modelTypes);
}

check().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
