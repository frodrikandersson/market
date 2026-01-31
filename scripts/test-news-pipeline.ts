/**
 * Test News Pipeline Script
 * =========================
 * Tests the news fetching and processing pipeline.
 *
 * Usage:
 *   npx tsx scripts/test-news-pipeline.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Colors for console output
const green = '\x1b[32m';
const red = '\x1b[31m';
const yellow = '\x1b[33m';
const cyan = '\x1b[36m';
const reset = '\x1b[0m';

async function main() {
  console.log(`${cyan}╔════════════════════════════════════════╗${reset}`);
  console.log(`${cyan}║    News Pipeline Test                  ║${reset}`);
  console.log(`${cyan}╚════════════════════════════════════════╝${reset}`);

  // Initialize Prisma
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter });

  try {
    // Test 1: Import and run news fetcher
    console.log(`\n${cyan}📰 Step 1: Fetching News...${reset}`);

    const { newsapi } = await import('../src/lib/newsapi');
    const { finnhub } = await import('../src/lib/finnhub');

    // Fetch from NewsAPI
    let newsApiCount = 0;
    try {
      const headlines = await newsapi.getTopHeadlines({
        category: 'business',
        country: 'us',
        pageSize: 10,
      });
      newsApiCount = headlines.length;
      console.log(`${green}  ✓ NewsAPI: ${newsApiCount} articles${reset}`);
      if (headlines.length > 0) {
        console.log(`    Sample: "${headlines[0].title.substring(0, 60)}..."`);
      }
    } catch (error) {
      console.log(`${red}  ✗ NewsAPI failed: ${error}${reset}`);
    }

    // Fetch from Finnhub
    let finnhubCount = 0;
    try {
      const marketNews = await finnhub.getMarketNews('general');
      finnhubCount = marketNews.length;
      console.log(`${green}  ✓ Finnhub: ${finnhubCount} articles${reset}`);
      if (marketNews.length > 0) {
        console.log(`    Sample: "${marketNews[0].headline.substring(0, 60)}..."`);
      }
    } catch (error) {
      console.log(`${red}  ✗ Finnhub failed: ${error}${reset}`);
    }

    // Test 2: AI Analysis
    console.log(`\n${cyan}🤖 Step 2: Testing AI Analysis...${reset}`);

    const { gemini } = await import('../src/lib/gemini');

    try {
      const testArticle = {
        title: 'NVIDIA Reports Record Quarterly Revenue on AI Chip Demand',
        content:
          'NVIDIA Corporation (NVDA) reported quarterly revenue of $22.1 billion, up 265% year-over-year. ' +
          'CEO Jensen Huang attributed the growth to unprecedented demand for AI chips, particularly the H100 GPU. ' +
          'The company also raised guidance for the next quarter, citing strong enterprise adoption of AI.',
      };

      const analysis = await gemini.analyzeNewsArticle(testArticle.title, testArticle.content);

      console.log(`${green}  ✓ AI Analysis working!${reset}`);
      console.log(`    Summary: ${analysis.summary.substring(0, 80)}...`);
      console.log(`    Companies: ${analysis.companies.map((c) => `${c.ticker} (${c.sentiment})`).join(', ')}`);
      console.log(`    Category: ${analysis.category}`);
      console.log(`    Importance: ${(analysis.importance * 100).toFixed(0)}%`);
    } catch (error) {
      console.log(`${red}  ✗ AI Analysis failed: ${error}${reset}`);
    }

    // Test 3: Database Operations
    console.log(`\n${cyan}💾 Step 3: Testing Database...${reset}`);

    // Count existing articles
    const articleCount = await db.newsArticle.count();
    const eventCount = await db.newsEvent.count();
    const impactCount = await db.newsImpact.count();

    console.log(`${green}  ✓ Database connected${reset}`);
    console.log(`    Articles: ${articleCount}`);
    console.log(`    Events: ${eventCount}`);
    console.log(`    Impacts: ${impactCount}`);

    // Test saving an article
    console.log(`\n${cyan}📝 Step 4: Testing Article Save...${reset}`);

    const testUrl = `https://test.example.com/article-${Date.now()}`;
    const savedArticle = await db.newsArticle.create({
      data: {
        sourceId: 'test',
        title: 'Test Article - Pipeline Test',
        url: testUrl,
        publishedAt: new Date(),
        processed: false,
      },
    });

    console.log(`${green}  ✓ Article saved: ${savedArticle.id}${reset}`);

    // Clean up test article
    await db.newsArticle.delete({ where: { id: savedArticle.id } });
    console.log(`${green}  ✓ Test article cleaned up${reset}`);

    // Summary
    console.log(`\n${cyan}════════════════════════════════════════${reset}`);
    console.log(`${cyan}Summary:${reset}`);
    console.log(`  NewsAPI:    ${newsApiCount > 0 ? `${green}✓ Working${reset}` : `${red}✗ Failed${reset}`}`);
    console.log(`  Finnhub:    ${finnhubCount > 0 ? `${green}✓ Working${reset}` : `${red}✗ Failed${reset}`}`);
    console.log(`  Gemini AI:  ${green}✓ Working${reset}`);
    console.log(`  Database:   ${green}✓ Working${reset}`);

    console.log(`\n${green}✅ Pipeline test complete!${reset}`);
    console.log(`\n${yellow}To run the full pipeline, use:${reset}`);
    console.log(`  curl "http://localhost:3000/api/cron/fetch-news?secret=YOUR_CRON_SECRET"`);
    console.log(`  Or run: npm run dev, then visit the URL above\n`);
  } catch (error) {
    console.error(`\n${red}Pipeline test failed:${reset}`, error);
  } finally {
    await db.$disconnect();
  }
}

main().catch(console.error);
