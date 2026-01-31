/**
 * Run News Pipeline Script
 * ========================
 * Executes the full news fetching and processing pipeline.
 *
 * Usage:
 *   npx tsx scripts/run-news-pipeline.ts
 */

import 'dotenv/config';

// Colors for console output
const green = '\x1b[32m';
const red = '\x1b[31m';
const cyan = '\x1b[36m';
const reset = '\x1b[0m';

async function main() {
  console.log(`${cyan}╔════════════════════════════════════════╗${reset}`);
  console.log(`${cyan}║    Running Full News Pipeline          ║${reset}`);
  console.log(`${cyan}╚════════════════════════════════════════╝${reset}`);

  const startTime = Date.now();

  try {
    // Import the news processor
    const { newsProcessor } = await import('../src/services/news-processor');

    // Run the full pipeline
    const result = await newsProcessor.fetchAndProcessNews();

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`\n${cyan}════════════════════════════════════════${reset}`);
    console.log(`${cyan}Results:${reset}`);
    console.log(`  Articles Found:     ${result.articlesFound}`);
    console.log(`  Articles Saved:     ${result.articlesSaved}`);
    console.log(`  Articles Processed: ${result.articlesProcessed}`);
    console.log(`  Events Created:     ${result.eventsCreated}`);
    console.log(`  Impacts Created:    ${result.impactsCreated}`);

    if (result.errors.length > 0) {
      console.log(`\n${red}Errors:${reset}`);
      result.errors.forEach((e) => console.log(`  - ${e}`));
    }

    console.log(`\n${green}✅ Pipeline complete in ${duration}s${reset}\n`);

    // Show sample data
    const { db } = await import('../src/lib/db');

    const recentArticles = await db.newsArticle.findMany({
      where: { processed: true },
      orderBy: { publishedAt: 'desc' },
      take: 5,
      select: {
        title: true,
        summary: true,
        publishedAt: true,
      },
    });

    if (recentArticles.length > 0) {
      console.log(`${cyan}Recent Processed Articles:${reset}`);
      recentArticles.forEach((a, i) => {
        console.log(`  ${i + 1}. ${a.title.substring(0, 70)}...`);
        if (a.summary) {
          console.log(`     Summary: ${a.summary.substring(0, 60)}...`);
        }
      });
    }

    const recentImpacts = await db.newsImpact.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        company: { select: { ticker: true, name: true } },
      },
    });

    if (recentImpacts.length > 0) {
      console.log(`\n${cyan}Recent Company Impacts:${reset}`);
      recentImpacts.forEach((impact) => {
        const emoji = impact.sentiment === 'positive' ? '📈' : impact.sentiment === 'negative' ? '📉' : '➖';
        console.log(
          `  ${emoji} ${impact.company.ticker}: ${impact.sentiment} (${(impact.confidence * 100).toFixed(0)}% confidence)`
        );
      });
    }

    await db.$disconnect();
  } catch (error) {
    console.error(`\n${red}Pipeline failed:${reset}`, error);
    process.exit(1);
  }
}

main().catch(console.error);
