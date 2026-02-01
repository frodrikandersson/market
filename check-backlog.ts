import { db } from './src/lib/db';

async function checkBacklog() {
  try {
    const total = await db.newsArticle.count();
    const processed = await db.newsArticle.count({ where: { processed: true } });
    const unprocessed = await db.newsArticle.count({ where: { processed: false } });

    console.log('\n=== DATABASE ARTICLE COUNTS ===');
    console.log(`Total articles: ${total}`);
    console.log(`Processed (analyzed by AI): ${processed}`);
    console.log(`Unprocessed (backlog): ${unprocessed}`);
    console.log(`Processing rate: ${total > 0 ? ((processed / total) * 100).toFixed(1) : 0}%`);

    // Also check social posts
    const totalPosts = await db.socialPost.count();
    const analyzedPosts = await db.socialPost.count({ where: { sentiment: { not: null } } });

    console.log('\n=== SOCIAL POST COUNTS ===');
    console.log(`Total posts: ${totalPosts}`);
    console.log(`Analyzed posts: ${analyzedPosts}`);
    console.log(`Unanalyzed posts: ${totalPosts - analyzedPosts}`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.$disconnect();
  }
}

checkBacklog();
