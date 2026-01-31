/**
 * Run Predictions Script
 * ======================
 * Manually runs the prediction pipeline.
 *
 * Usage:
 *   npx tsx scripts/run-predictions.ts
 */

import 'dotenv/config';

const green = '\x1b[32m';
const red = '\x1b[31m';
const cyan = '\x1b[36m';
const yellow = '\x1b[33m';
const reset = '\x1b[0m';

async function main() {
  console.log(`${cyan}╔════════════════════════════════════════╗${reset}`);
  console.log(`${cyan}║    Running Prediction Pipeline         ║${reset}`);
  console.log(`${cyan}╚════════════════════════════════════════╝${reset}`);

  const startTime = Date.now();

  try {
    // Import services
    const { predictor } = await import('../src/services/predictor');
    const { evaluator } = await import('../src/services/evaluator');
    const { db } = await import('../src/lib/db');

    // Step 1: Run predictions
    console.log(`\n${cyan}🎯 Step 1: Running Predictions...${reset}`);
    const predictionResult = await predictor.runDailyPredictions();

    console.log(`\n${green}  Fundamentals predictions: ${predictionResult.fundamentalsPredictions}${reset}`);
    console.log(`${green}  Hype predictions: ${predictionResult.hypePredictions}${reset}`);

    if (predictionResult.errors.length > 0) {
      console.log(`${yellow}  Errors: ${predictionResult.errors.length}${reset}`);
    }

    // Step 2: Evaluate previous predictions
    console.log(`\n${cyan}📊 Step 2: Evaluating Previous Predictions...${reset}`);
    const evaluationResult = await evaluator.evaluatePendingPredictions();

    console.log(`${green}  Evaluated: ${evaluationResult.evaluated}${reset}`);
    console.log(`${green}  Correct: ${evaluationResult.correct}${reset}`);
    console.log(`${red}  Incorrect: ${evaluationResult.incorrect}${reset}`);

    // Step 3: Show model comparison
    console.log(`\n${cyan}🏆 Step 3: Model Comparison...${reset}`);
    const comparison = await evaluator.getModelComparison();

    console.log(`\n  Fundamentals Model:`);
    console.log(`    Total evaluated: ${comparison.fundamentals.totalEvaluated}`);
    console.log(`    Accuracy: ${(comparison.fundamentals.accuracy * 100).toFixed(1)}%`);

    console.log(`\n  Hype Model:`);
    console.log(`    Total evaluated: ${comparison.hype.totalEvaluated}`);
    console.log(`    Accuracy: ${(comparison.hype.accuracy * 100).toFixed(1)}%`);

    if (comparison.winner !== 'tie') {
      console.log(`\n  ${green}Winner: ${comparison.winner.toUpperCase()} (by ${comparison.difference.toFixed(1)}%)${reset}`);
    } else {
      console.log(`\n  ${yellow}Result: TIE${reset}`);
    }

    // Step 4: Show latest predictions
    console.log(`\n${cyan}📋 Latest Predictions:${reset}`);
    const latestPredictions = await predictor.getLatestPredictions(10);

    if (latestPredictions.length > 0) {
      for (const pred of latestPredictions) {
        const directionEmoji = pred.direction === 'up' ? '📈' : '📉';
        const correctEmoji = pred.wasCorrect === null ? '⏳' : pred.wasCorrect ? '✅' : '❌';
        console.log(
          `  ${directionEmoji} ${pred.ticker.padEnd(6)} ${pred.modelType.padEnd(13)} ` +
            `${pred.direction.toUpperCase().padEnd(4)} (${(pred.confidence * 100).toFixed(0)}%) ${correctEmoji}`
        );
      }
    } else {
      console.log(`  No predictions yet`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n${green}✅ Pipeline complete in ${duration}s${reset}\n`);

    await db.$disconnect();
  } catch (error) {
    console.error(`\n${red}Pipeline failed:${reset}`, error);
    process.exit(1);
  }
}

main().catch(console.error);
