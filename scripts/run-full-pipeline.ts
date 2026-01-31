/**
 * Run Full Pipeline Script
 * ========================
 * Executes the complete data pipeline:
 * 1. Fetch news
 * 2. Fetch social media
 * 3. Fetch stock prices
 * 4. Run predictions
 * 5. Evaluate predictions
 *
 * Usage:
 *   npx tsx scripts/run-full-pipeline.ts
 */

import 'dotenv/config';

const green = '\x1b[32m';
const red = '\x1b[31m';
const cyan = '\x1b[36m';
const yellow = '\x1b[33m';
const reset = '\x1b[0m';

async function main() {
  console.log(`${cyan}╔════════════════════════════════════════╗${reset}`);
  console.log(`${cyan}║       FULL PIPELINE EXECUTION          ║${reset}`);
  console.log(`${cyan}╚════════════════════════════════════════╝${reset}`);

  const startTime = Date.now();
  const results: Record<string, unknown> = {};

  try {
    // Step 1: Fetch and process news
    console.log(`\n${cyan}━━━ Step 1/5: Fetching News ━━━${reset}`);
    try {
      const { newsProcessor } = await import('../src/services/news-processor');
      results.news = await newsProcessor.fetchAndProcessNews();
      const news = results.news as { articlesFound: number; articlesProcessed: number; impactsCreated: number };
      console.log(`${green}✓ News: ${news.articlesFound} found, ${news.articlesProcessed} processed, ${news.impactsCreated} impacts${reset}`);
    } catch (error) {
      console.log(`${red}✗ News fetch failed: ${error}${reset}`);
      results.news = { error: String(error) };
    }

    // Step 2: Fetch and process social media
    console.log(`\n${cyan}━━━ Step 2/5: Fetching Social Media ━━━${reset}`);
    try {
      const { socialProcessor } = await import('../src/services/social-processor');
      results.social = await socialProcessor.fetchAndProcessSocial();
      const social = results.social as { postsFound: number; postsAnalyzed: number; mentionsCreated: number; errors: string[] };
      if (social.errors && social.errors.length > 0) {
        console.log(`${yellow}⚠ Social: ${social.errors[0]}${reset}`);
      } else {
        console.log(`${green}✓ Social: ${social.postsFound} found, ${social.postsAnalyzed} analyzed${reset}`);
      }
    } catch (error) {
      console.log(`${red}✗ Social fetch failed: ${error}${reset}`);
      results.social = { error: String(error) };
    }

    // Step 3: Fetch stock prices
    console.log(`\n${cyan}━━━ Step 3/5: Fetching Stock Prices ━━━${reset}`);
    try {
      const { stockPriceService } = await import('../src/services/stock-price');
      results.prices = await stockPriceService.fetchAllPrices();
      const prices = results.prices as { fetched: number; failed: number };
      console.log(`${green}✓ Prices: ${prices.fetched} fetched, ${prices.failed} failed${reset}`);
    } catch (error) {
      console.log(`${red}✗ Price fetch failed: ${error}${reset}`);
      results.prices = { error: String(error) };
    }

    // Step 4: Run predictions
    console.log(`\n${cyan}━━━ Step 4/5: Running Predictions ━━━${reset}`);
    try {
      const { predictor } = await import('../src/services/predictor');
      results.predictions = await predictor.runDailyPredictions();
      const preds = results.predictions as { fundamentalsPredictions: number; hypePredictions: number };
      console.log(`${green}✓ Predictions: ${preds.fundamentalsPredictions} fundamentals, ${preds.hypePredictions} hype${reset}`);
    } catch (error) {
      console.log(`${red}✗ Predictions failed: ${error}${reset}`);
      results.predictions = { error: String(error) };
    }

    // Step 5: Evaluate predictions
    console.log(`\n${cyan}━━━ Step 5/5: Evaluating Predictions ━━━${reset}`);
    try {
      const { evaluator } = await import('../src/services/evaluator');
      results.evaluations = await evaluator.evaluatePendingPredictions();
      const evals = results.evaluations as { evaluated: number; correct: number; incorrect: number };
      console.log(`${green}✓ Evaluations: ${evals.evaluated} evaluated, ${evals.correct} correct, ${evals.incorrect} incorrect${reset}`);
    } catch (error) {
      console.log(`${red}✗ Evaluations failed: ${error}${reset}`);
      results.evaluations = { error: String(error) };
    }

    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n${cyan}╔════════════════════════════════════════╗${reset}`);
    console.log(`${cyan}║       PIPELINE COMPLETE                ║${reset}`);
    console.log(`${cyan}║       Duration: ${duration.padStart(5)}s                   ║${reset}`);
    console.log(`${cyan}╚════════════════════════════════════════╝${reset}`);

    // Show model comparison
    console.log(`\n${cyan}📊 Model Comparison:${reset}`);
    try {
      const { evaluator } = await import('../src/services/evaluator');
      const comparison = await evaluator.getModelComparison();
      console.log(`   Fundamentals: ${(comparison.fundamentals.accuracy * 100).toFixed(1)}% (${comparison.fundamentals.totalEvaluated} evaluated)`);
      console.log(`   Hype Model:   ${(comparison.hype.accuracy * 100).toFixed(1)}% (${comparison.hype.totalEvaluated} evaluated)`);
      if (comparison.winner !== 'tie') {
        console.log(`   ${green}Winner: ${comparison.winner.toUpperCase()}${reset}`);
      }
    } catch {
      console.log('   No evaluated predictions yet');
    }

    // Disconnect
    const { db } = await import('../src/lib/db');
    await db.$disconnect();

  } catch (error) {
    console.error(`\n${red}Pipeline failed:${reset}`, error);
    process.exit(1);
  }
}

main().catch(console.error);
