import { db } from './src/lib/db';

async function checkLastFetch() {
  try {
    // Check latest articles
    const latestArticles = await db.newsArticle.findMany({
      orderBy: { fetchedAt: 'desc' },
      take: 5,
      select: {
        title: true,
        sourceId: true,
        fetchedAt: true,
        processed: true,
      },
    });

    console.log('\n=== LATEST ARTICLES ===');
    latestArticles.forEach((article, i) => {
      console.log(`${i + 1}. [${article.sourceId}] ${article.title}`);
      console.log(`   Fetched: ${article.fetchedAt.toISOString()}`);
      console.log(`   Processed: ${article.processed}`);
    });

    // Check article count by source
    const articlesBySource = await db.newsArticle.groupBy({
      by: ['sourceId'],
      _count: true,
    });

    console.log('\n=== ARTICLES BY SOURCE ===');
    articlesBySource.forEach((source) => {
      console.log(`${source.sourceId}: ${source._count} articles`);
    });

    // Check last cron job
    const lastCronJob = await db.cronJob.findFirst({
      where: { name: 'full-pipeline' },
      orderBy: { startedAt: 'desc' },
    });

    if (lastCronJob) {
      console.log('\n=== LAST FULL PIPELINE RUN ===');
      console.log(`Started: ${lastCronJob.startedAt.toISOString()}`);
      console.log(`Status: ${lastCronJob.status}`);
      console.log(`Completed: ${lastCronJob.completedAt?.toISOString() || 'N/A'}`);
    } else {
      console.log('\n=== NO CRON JOB HISTORY ===');
      console.log('The full-pipeline has never been run!');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.$disconnect();
  }
}

checkLastFetch();
