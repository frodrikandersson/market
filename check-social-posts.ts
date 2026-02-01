import { db } from './src/lib/db';

async function checkSocialPosts() {
  try {
    const totalPosts = await db.socialPost.count();
    const processedFalse = await db.socialPost.count({ where: { processed: false } });
    const sentimentNull = await db.socialPost.count({ where: { sentiment: null } });
    const bothConditions = await db.socialPost.count({
      where: {
        OR: [
          { processed: false },
          { sentiment: null },
        ],
      },
    });

    console.log('\n=== SOCIAL POST STATUS ===');
    console.log(`Total posts: ${totalPosts}`);
    console.log(`Posts with processed=false: ${processedFalse}`);
    console.log(`Posts with sentiment=null: ${sentimentNull}`);
    console.log(`Posts matching either condition: ${bothConditions}`);

    // Check overlap
    const processedFalseAndSentimentNull = await db.socialPost.count({
      where: {
        processed: false,
        sentiment: null,
      },
    });

    console.log(`Posts with BOTH processed=false AND sentiment=null: ${processedFalseAndSentimentNull}`);

    // Sample posts with sentiment=null but processed=true
    const weirdPosts = await db.socialPost.findMany({
      where: {
        processed: true,
        sentiment: null,
      },
      take: 3,
      select: {
        id: true,
        content: true,
        processed: true,
        sentiment: true,
        impactScore: true,
      },
    });

    if (weirdPosts.length > 0) {
      console.log('\n=== SAMPLE: processed=true but sentiment=null ===');
      weirdPosts.forEach((post, i) => {
        console.log(`${i + 1}. processed: ${post.processed}, sentiment: ${post.sentiment}, impactScore: ${post.impactScore}`);
        console.log(`   Content: "${post.content.substring(0, 60)}..."`);
      });
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.$disconnect();
  }
}

checkSocialPosts();
