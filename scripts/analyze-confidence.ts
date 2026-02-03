import { db } from '../src/lib/db';

async function analyze() {
  // Get recent fundamentals predictions
  const preds = await db.prediction.findMany({
    where: { modelType: 'fundamentals' },
    select: { newsImpactScore: true, confidence: true, priceMomentum: true, priceVolatility: true },
    take: 50,
    orderBy: { createdAt: 'desc' }
  });

  console.log('=== News Impact Score Distribution ===');
  const scores = preds.map(p => p.newsImpactScore).filter(s => s !== null) as number[];
  console.log('Min:', Math.min(...scores).toFixed(3));
  console.log('Max:', Math.max(...scores).toFixed(3));
  console.log('Avg:', (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(3));

  console.log('\n=== Confidence Distribution ===');
  const confs = preds.map(p => p.confidence);
  console.log('Min:', (Math.min(...confs) * 100).toFixed(0) + '%');
  console.log('Max:', (Math.max(...confs) * 100).toFixed(0) + '%');
  console.log('Avg:', ((confs.reduce((a, b) => a + b, 0) / confs.length) * 100).toFixed(0) + '%');

  // Count by confidence bucket
  console.log('\n=== Confidence Buckets ===');
  const buckets = { '30-40%': 0, '40-50%': 0, '50-60%': 0, '60-70%': 0, '70-80%': 0, '80%+': 0 };
  for (const p of preds) {
    const c = p.confidence * 100;
    if (c < 40) buckets['30-40%']++;
    else if (c < 50) buckets['40-50%']++;
    else if (c < 60) buckets['50-60%']++;
    else if (c < 70) buckets['60-70%']++;
    else if (c < 80) buckets['70-80%']++;
    else buckets['80%+']++;
  }
  for (const [bucket, count] of Object.entries(buckets)) {
    console.log(`${bucket}: ${count} (${((count / preds.length) * 100).toFixed(0)}%)`);
  }

  // Show a few examples with calculation breakdown
  console.log('\n=== Sample Calculations ===');
  for (const p of preds.slice(0, 8)) {
    const news = p.newsImpactScore || 0;
    const mom = p.priceMomentum || 0;
    const vol = p.priceVolatility || 0;

    // Recreate the calculation
    const normalizedNews = Math.max(-1, Math.min(1, news));
    const normalizedMomentum = mom ? Math.max(-1, Math.min(1, mom * 10)) : 0;
    const score = normalizedNews * 0.6 + normalizedMomentum * 0.25;
    const baseConf = Math.abs(score);
    const volPenalty = vol ? Math.min(0.15, vol * 3) : 0;
    const rawConf = baseConf * 0.95 + 0.25 - volPenalty;

    console.log(`news=${news.toFixed(3)}, mom=${mom.toFixed(3)} → score=${score.toFixed(3)} → conf=${(p.confidence * 100).toFixed(0)}%`);
  }
}

analyze().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
