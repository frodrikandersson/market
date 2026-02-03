import { db } from '../src/lib/db';

async function diagnose() {
  console.log('='.repeat(60));
  console.log('SYSTEM DIAGNOSTIC');
  console.log('='.repeat(60));

  // 1. Check data freshness
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  const recentNews = await db.newsArticle.count({ where: { fetchedAt: { gte: oneDayAgo } } });
  const recentNewsImpacts = await db.newsImpact.count({ where: { createdAt: { gte: oneDayAgo } } });
  const recentSocialPosts = await db.socialPost.count({ where: { fetchedAt: { gte: oneDayAgo } } });
  const recentSocialMentions = await db.socialMention.count({ where: { createdAt: { gte: oneDayAgo } } });
  const recentPrices = await db.stockPrice.count({ where: { createdAt: { gte: oneDayAgo } } });

  console.log('\n📊 DATA FRESHNESS (last 24h):');
  console.log(`  News articles fetched: ${recentNews}`);
  console.log(`  News impacts created: ${recentNewsImpacts}`);
  console.log(`  Social posts fetched: ${recentSocialPosts}`);
  console.log(`  Social mentions created: ${recentSocialMentions}`);
  console.log(`  Stock prices fetched: ${recentPrices}`);

  // 2. Check prediction quality
  const totalPredictions = await db.prediction.count();
  const evaluatedPredictions = await db.prediction.count({ where: { wasCorrect: { not: null } } });
  const pendingPredictions = await db.prediction.count({
    where: { wasCorrect: null, targetDate: { lte: now } }
  });
  const futurePredictions = await db.prediction.count({
    where: { targetDate: { gt: now } }
  });

  console.log('\n🎯 PREDICTIONS:');
  console.log(`  Total: ${totalPredictions}`);
  console.log(`  Evaluated: ${evaluatedPredictions}`);
  console.log(`  Pending (past target date, not evaluated): ${pendingPredictions}`);
  console.log(`  Future (waiting for target date): ${futurePredictions}`);

  // 3. Check for predictions with missing baseline price
  const noBaselinePrice = await db.prediction.count({
    where: { baselinePrice: null }
  });
  console.log(`  ⚠️  Missing baseline price: ${noBaselinePrice}`);

  // 4. Check model distribution
  const fundsPreds = await db.prediction.count({ where: { modelType: 'fundamentals' } });
  const hypePreds = await db.prediction.count({ where: { modelType: 'hype' } });
  console.log(`\n📈 MODEL DISTRIBUTION:`);
  console.log(`  Fundamentals: ${fundsPreds}`);
  console.log(`  Hype: ${hypePreds}`);
  console.log(`  Ratio: ${(fundsPreds / (hypePreds || 1)).toFixed(2)}:1`);

  // 5. Check for zero-score predictions
  const fundsZeroNews = await db.prediction.count({
    where: { modelType: 'fundamentals', newsImpactScore: 0 }
  });
  const hypeZeroSocial = await db.prediction.count({
    where: { modelType: 'hype', socialImpactScore: 0 }
  });
  console.log(`\n⚠️  ZERO-SCORE PREDICTIONS (bad data):`);
  console.log(`  Fundamentals with newsImpactScore=0: ${fundsZeroNews}`);
  console.log(`  Hype with socialImpactScore=0: ${hypeZeroSocial}`);

  // 6. Check evaluation accuracy
  const correctPreds = await db.prediction.count({ where: { wasCorrect: true } });
  const incorrectPreds = await db.prediction.count({ where: { wasCorrect: false } });
  if (evaluatedPredictions > 0) {
    console.log(`\n✅ ACCURACY:`);
    console.log(`  Correct: ${correctPreds} (${((correctPreds / evaluatedPredictions) * 100).toFixed(1)}%)`);
    console.log(`  Incorrect: ${incorrectPreds} (${((incorrectPreds / evaluatedPredictions) * 100).toFixed(1)}%)`);
  }

  // 7. Check for duplicate predictions (same company, date, model)
  const duplicateCheck = await db.$queryRaw<{count: bigint}[]>`
    SELECT COUNT(*) as count FROM (
      SELECT "companyId", "targetDate", "modelType", COUNT(*) as cnt
      FROM "Prediction"
      GROUP BY "companyId", "targetDate", "modelType"
      HAVING COUNT(*) > 1
    ) as dupes
  `;
  const duplicates = Number(duplicateCheck[0]?.count || 0);
  if (duplicates > 0) {
    console.log(`\n🚨 DUPLICATE PREDICTIONS: ${duplicates} groups have duplicates!`);
  }

  // 8. Check companies without prices
  const companiesWithoutPrices = await db.company.count({
    where: {
      isActive: true,
      stockPrices: { none: {} }
    }
  });
  const totalActiveCompanies = await db.company.count({ where: { isActive: true } });
  console.log(`\n💰 PRICE COVERAGE:`);
  console.log(`  Active companies: ${totalActiveCompanies}`);
  console.log(`  Without any prices: ${companiesWithoutPrices}`);

  // 9. Check for stale prices (>7 days old)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const companiesWithStalePrices = await db.$queryRaw<{count: bigint}[]>`
    SELECT COUNT(DISTINCT c.id) as count
    FROM "Company" c
    WHERE c."isActive" = true
    AND NOT EXISTS (
      SELECT 1 FROM "StockPrice" sp
      WHERE sp."companyId" = c.id
      AND sp."createdAt" > ${sevenDaysAgo}
    )
  `;
  const staleCount = Number(companiesWithStalePrices[0]?.count || 0);
  console.log(`  With stale prices (>7 days): ${staleCount}`);

  // 10. Check influential accounts activity
  const activeInfluencers = await db.influentialAccount.count({
    where: {
      posts: { some: { fetchedAt: { gte: twoDaysAgo } } }
    }
  });
  const totalInfluencers = await db.influentialAccount.count();
  console.log(`\n👤 INFLUENCER COVERAGE:`);
  console.log(`  Total accounts: ${totalInfluencers}`);
  console.log(`  Active (posts in 48h): ${activeInfluencers}`);

  // 11. Check for any weird evaluation data
  const wrongEvaluations = await db.prediction.count({
    where: {
      wasCorrect: { not: null },
      actualChange: null
    }
  });
  if (wrongEvaluations > 0) {
    console.log(`\n🚨 BAD EVALUATIONS: ${wrongEvaluations} have wasCorrect but no actualChange`);
  }

  // 12. Sample of recent predictions to check sanity
  const recentPreds = await db.prediction.findMany({
    where: { wasCorrect: { not: null } },
    orderBy: { evaluatedAt: 'desc' },
    take: 5,
    include: { company: { select: { ticker: true } } }
  });

  console.log(`\n📝 RECENT EVALUATIONS (sanity check):`);
  for (const p of recentPreds) {
    const result = p.wasCorrect ? '✓' : '✗';
    console.log(`  ${p.company.ticker} ${p.modelType}: predicted ${p.predictedDirection}, actual ${p.actualChange?.toFixed(2)}% → ${result}`);
  }

  console.log('\n' + '='.repeat(60));
}

diagnose().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
