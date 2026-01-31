/**
 * Test StockTwits API
 * ===================
 * Quick test to verify StockTwits integration works.
 *
 * Usage:
 *   npx tsx scripts/test-stocktwits.ts
 */

import { stocktwits } from '../src/lib/stocktwits';

async function main() {
  console.log('Testing StockTwits API');
  console.log('======================\n');

  // Test 1: Check availability
  console.log('1. Checking StockTwits availability...');
  const available = await stocktwits.isAvailable();
  console.log(`   Available: ${available ? '✓ Yes' : '✗ No'}\n`);

  if (!available) {
    console.log('StockTwits API not available. Exiting.');
    process.exit(1);
  }

  // Test 2: Get trending symbols
  console.log('2. Fetching trending symbols...');
  const trending = await stocktwits.getTrendingSymbols(10);
  console.log(`   Trending: ${trending.join(', ')}\n`);

  // Test 3: Fetch posts for specific symbols
  const testSymbols = ['TSLA', 'AAPL', 'NVDA'];

  for (const symbol of testSymbols) {
    console.log(`3. Fetching posts for $${symbol}...`);
    const posts = await stocktwits.getSymbolStream(symbol, { limit: 5 });

    if (posts.length === 0) {
      console.log(`   ✗ No posts found\n`);
      continue;
    }

    console.log(`   ✓ Found ${posts.length} posts\n`);

    // Show sample posts
    for (const post of posts.slice(0, 3)) {
      const preview = post.text.substring(0, 70).replace(/\n/g, ' ');
      const cashtags = stocktwits.extractCashtags(post);
      console.log(`   - "${preview}..."`);
      console.log(`     Cashtags: ${cashtags.join(', ') || 'none'}`);
      console.log(`     Likes: ${post.public_metrics?.like_count || 0}`);
      console.log();
    }

    // Delay between requests
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Test 4: Get sentiment for a symbol
  console.log('4. Getting sentiment analysis for TSLA...');
  const sentiment = await stocktwits.getSymbolSentiment('TSLA');
  console.log(`   Bullish: ${sentiment.bullish}`);
  console.log(`   Bearish: ${sentiment.bearish}`);
  console.log(`   Total posts: ${sentiment.total}`);
  console.log(
    `   Ratio: ${((sentiment.bullish / (sentiment.bullish + sentiment.bearish || 1)) * 100).toFixed(1)}% bullish\n`
  );

  console.log('Done!');
}

main().catch(console.error);
