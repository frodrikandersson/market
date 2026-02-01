import { db } from './src/lib/db';

async function checkDuplicateURLs() {
  try {
    // Get all article URLs grouped by URL
    const urlCounts = await db.newsArticle.groupBy({
      by: ['url'],
      _count: true,
      having: {
        url: {
          _count: {
            gt: 1, // Only show URLs that appear more than once
          },
        },
      },
    });

    console.log(`\n=== DUPLICATE URLs ===`);
    console.log(`Found ${urlCounts.length} URLs that appear multiple times`);

    if (urlCounts.length > 0) {
      console.log('\nTop 10 duplicate URLs:');
      urlCounts.slice(0, 10).forEach((item, i) => {
        console.log(`${i + 1}. Count: ${item._count}, URL: ${item.url.substring(0, 100)}...`);
      });
    }

    // Check if there's a single URL being reused
    const mostCommonUrl = await db.newsArticle.groupBy({
      by: ['url'],
      _count: true,
      orderBy: {
        _count: {
          url: 'desc',
        },
      },
      take: 5,
    });

    console.log('\n=== MOST COMMON URLs ===');
    mostCommonUrl.forEach((item, i) => {
      console.log(`${i + 1}. Count: ${item._count}, URL: ${item.url.substring(0, 100)}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.$disconnect();
  }
}

checkDuplicateURLs();
