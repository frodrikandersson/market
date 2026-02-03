import { db } from '../src/lib/db';

async function check() {
  const socialPosts = await db.socialPost.count();
  const socialMentions = await db.socialMention.count();
  const influentialAccounts = await db.influentialAccount.count();

  console.log('=== Social Media Data ===');
  console.log('Influential Accounts:', influentialAccounts);
  console.log('Social Posts:', socialPosts);
  console.log('Social Mentions:', socialMentions);

  // Check predictions with non-zero social scores
  const predsWithSocial = await db.prediction.count({
    where: {
      socialImpactScore: { not: null },
      NOT: { socialImpactScore: 0 }
    }
  });
  const predsWithZeroSocial = await db.prediction.count({
    where: { socialImpactScore: 0 }
  });

  console.log('\n=== Prediction Social Scores ===');
  console.log('Predictions with non-zero social score:', predsWithSocial);
  console.log('Predictions with zero social score:', predsWithZeroSocial);

  // Sample some hype predictions
  const hypeSample = await db.prediction.findMany({
    where: { modelType: 'hype' },
    select: {
      company: { select: { ticker: true } },
      socialImpactScore: true,
      newsImpactScore: true,
      confidence: true,
    },
    take: 10,
  });

  console.log('\n=== Sample Hype Predictions ===');
  for (const p of hypeSample) {
    console.log(`${p.company.ticker}: social=${p.socialImpactScore?.toFixed(3) ?? 'null'}, news=${p.newsImpactScore?.toFixed(3) ?? 'null'}, conf=${(p.confidence * 100).toFixed(0)}%`);
  }
}

check().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
