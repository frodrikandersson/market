/**
 * Test Nitter Scraper
 * ===================
 * Quick test to verify Nitter scraping works.
 *
 * Usage:
 *   npx tsx scripts/test-nitter.ts
 */

import { nitter } from '../src/lib/nitter';

async function main() {
  console.log('Testing Nitter Scraper');
  console.log('======================\n');

  // Test 1: Check if Nitter is available
  console.log('1. Checking Nitter availability...');
  const available = await nitter.isAvailable();
  console.log(`   Nitter available: ${available ? '✓ Yes' : '✗ No'}\n`);

  if (!available) {
    console.log('No Nitter instances are working. Exiting.');
    process.exit(1);
  }

  // Test 2: Fetch tweets from a test account
  const testAccounts = ['elonmusk', 'unusual_whales', 'jimcramer'];

  for (const username of testAccounts) {
    console.log(`2. Fetching tweets from @${username}...`);
    const tweets = await nitter.getUserTweets(username, { maxResults: 5 });

    if (tweets.length === 0) {
      console.log(`   ✗ No tweets found for @${username}\n`);
      continue;
    }

    console.log(`   ✓ Found ${tweets.length} tweets\n`);

    // Show first few tweets
    for (const tweet of tweets.slice(0, 3)) {
      const preview = tweet.text.substring(0, 80).replace(/\n/g, ' ');
      const cashtags = nitter.extractCashtags(tweet);
      console.log(`   - "${preview}..."`);
      console.log(`     Posted: ${tweet.created_at}`);
      if (cashtags.length > 0) {
        console.log(`     Cashtags: ${cashtags.join(', ')}`);
      }
      console.log();
    }

    // Delay between accounts
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log('Done!');
}

main().catch(console.error);
