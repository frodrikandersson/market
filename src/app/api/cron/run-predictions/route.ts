/**
 * Cron Endpoint: Run Predictions
 * ===============================
 * Runs daily predictions and evaluates previous predictions.
 * Should be called daily after market close (e.g., 5:00 PM ET).
 *
 * Usage:
 *   GET /api/cron/run-predictions?secret=YOUR_CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { stockPriceService } from '@/services/stock-price';
import { predictor } from '@/services/predictor';
import { evaluator } from '@/services/evaluator';

/**
 * Verify the request is authorized
 */
function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret && process.env.NODE_ENV === 'development') {
    return true;
  }

  const url = new URL(request.url);
  if (url.searchParams.get('secret') === cronSecret) {
    return true;
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  return false;
}

/**
 * Log cron job
 */
async function logCronJob(
  name: string,
  status: 'running' | 'completed' | 'failed',
  metadata?: Record<string, unknown>,
  error?: string
) {
  try {
    if (status === 'running') {
      return await db.cronJob.create({
        data: { name, status, metadata: metadata ?? undefined },
      });
    } else {
      const job = await db.cronJob.findFirst({
        where: { name, status: 'running' },
        orderBy: { startedAt: 'desc' },
      });

      if (job) {
        return await db.cronJob.update({
          where: { id: job.id },
          data: {
            status,
            completedAt: new Date(),
            metadata: metadata ?? undefined,
            error,
          },
        });
      }
    }
  } catch (err) {
    console.error('[CronLog] Failed to log job:', err);
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    await logCronJob('run-predictions', 'running');
    console.log('\n========================================');
    console.log('[CRON] Starting prediction job');
    console.log('========================================\n');

    const results = {
      prices: { fetched: 0, failed: 0 },
      predictions: { fundamentals: 0, hype: 0, errors: [] as string[] },
      evaluations: { evaluated: 0, correct: 0, incorrect: 0, errors: [] as string[] },
    };

    // Step 1: Fetch latest stock prices (sample of companies to avoid rate limits)
    console.log('\n=== Step 1: Fetching Stock Prices ===');
    const priceResult = await stockPriceService.fetchAllPrices();
    results.prices = priceResult;

    // Step 2: Run predictions for companies with news
    console.log('\n=== Step 2: Running Predictions ===');
    const predictionResult = await predictor.runDailyPredictions();
    results.predictions = predictionResult;

    // Step 3: Evaluate previous predictions
    console.log('\n=== Step 3: Evaluating Previous Predictions ===');
    const evaluationResult = await evaluator.evaluatePendingPredictions();
    results.evaluations = evaluationResult;

    const duration = Date.now() - startTime;

    await logCronJob('run-predictions', 'completed', {
      ...results,
      durationMs: duration,
    });

    console.log('\n========================================');
    console.log('[CRON] Prediction job completed');
    console.log(`Duration: ${(duration / 1000).toFixed(1)}s`);
    console.log('========================================\n');

    return NextResponse.json({
      success: true,
      results,
      durationMs: duration,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logCronJob('run-predictions', 'failed', undefined, errorMessage);

    console.error('[CRON] Prediction job failed:', errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        durationMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
