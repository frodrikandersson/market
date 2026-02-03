import { db } from '../src/lib/db';

async function check() {
  // Check fundamentals predictions with zero/null news scores
  const fundsWithZeroNews = await db.prediction.count({
    where: { modelType: 'fundamentals', newsImpactScore: 0 }
  });
  const fundsWithNullNews = await db.prediction.count({
    where: { modelType: 'fundamentals', newsImpactScore: null }
  });
  const fundsWithNews = await db.prediction.count({
    where: {
      modelType: 'fundamentals',
      newsImpactScore: { not: 0 },
      NOT: { newsImpactScore: null }
    }
  });
  const totalFunds = await db.prediction.count({
    where: { modelType: 'fundamentals' }
  });

  console.log('=== Fundamentals Model ===');
  console.log('Total predictions:', totalFunds);
  console.log('With non-zero news score:', fundsWithNews);
  console.log('With zero news score:', fundsWithZeroNews);
  console.log('With null news score:', fundsWithNullNews);

  // Sample some fundamentals predictions with lowest scores
  const sampleLow = await db.prediction.findMany({
    where: { modelType: 'fundamentals' },
    select: {
      company: { select: { ticker: true } },
      newsImpactScore: true,
      confidence: true,
    },
    take: 10,
    orderBy: { newsImpactScore: 'asc' }
  });

  console.log('\n=== Sample (lowest news scores) ===');
  for (const p of sampleLow) {
    console.log(`${p.company.ticker}: news=${p.newsImpactScore?.toFixed(3) ?? 'null'}, conf=${(p.confidence * 100).toFixed(0)}%`);
  }

  // Sample with highest scores
  const sampleHigh = await db.prediction.findMany({
    where: { modelType: 'fundamentals' },
    select: {
      company: { select: { ticker: true } },
      newsImpactScore: true,
      confidence: true,
    },
    take: 10,
    orderBy: { newsImpactScore: 'desc' }
  });

  console.log('\n=== Sample (highest news scores) ===');
  for (const p of sampleHigh) {
    console.log(`${p.company.ticker}: news=${p.newsImpactScore?.toFixed(3) ?? 'null'}, conf=${(p.confidence * 100).toFixed(0)}%`);
  }
}

check().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
