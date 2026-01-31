/**
 * Cron Endpoint: Full Pipeline
 * ============================
 * Runs the complete data pipeline in sequence:
 * 1. Fetch news from all sources
 * 2. Fetch social media posts
 * 3. Run predictions
 * 4. Evaluate previous predictions
 *
 * Recommended schedule: Every 30 minutes during market hours
 *
 * Usage:
 *   GET /api/cron/full-pipeline?secret=YOUR_CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { newsProcessor } from '@/services/news-processor';
import { socialProcessor } from '@/services/social-processor';
import { predictor } from '@/services/predictor';
import { evaluator } from '@/services/evaluator';
import { stockPriceService } from '@/services/stock-price';
import type { Prisma } from '@prisma/client';

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

async function logCronJob(
  name: string,
  status: 'running' | 'completed' | 'failed',
  metadata?: Record<string, unknown>,
  error?: string
) {
  try {
    if (status === 'running') {
      return await db.cronJob.create({
        data: { name, status, metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined },
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
            metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
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
  const results: Record<string, unknown> = {};

  try {
    await logCronJob('full-pipeline', 'running');
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║    FULL PIPELINE - Starting            ║');
    console.log('╚════════════════════════════════════════╝\n');

    // Step 1: Fetch and process news
    console.log('━━━ Step 1/5: Fetching News ━━━');
    try {
      results.news = await newsProcessor.fetchAndProcessNews();
      console.log(`✓ News: ${(results.news as { articlesFound: number }).articlesFound} found, ${(results.news as { articlesProcessed: number }).articlesProcessed} processed`);
    } catch (error) {
      console.error('✗ News fetch failed:', error);
      results.news = { error: String(error) };
    }

    // Step 2: Fetch and process social media
    console.log('\n━━━ Step 2/5: Fetching Social Media ━━━');
    try {
      results.social = await socialProcessor.fetchAndProcessSocial();
      console.log(`✓ Social: ${(results.social as { postsFound: number }).postsFound} found, ${(results.social as { postsAnalyzed: number }).postsAnalyzed} analyzed`);
    } catch (error) {
      console.error('✗ Social fetch failed:', error);
      results.social = { error: String(error) };
    }

    // Step 3: Fetch stock prices (sample to avoid rate limits)
    console.log('\n━━━ Step 3/5: Fetching Stock Prices ━━━');
    try {
      results.prices = await stockPriceService.fetchAllPrices();
      console.log(`✓ Prices: ${(results.prices as { fetched: number }).fetched} fetched`);
    } catch (error) {
      console.error('✗ Price fetch failed:', error);
      results.prices = { error: String(error) };
    }

    // Step 4: Run predictions
    console.log('\n━━━ Step 4/5: Running Predictions ━━━');
    try {
      results.predictions = await predictor.runDailyPredictions();
      console.log(`✓ Predictions: ${(results.predictions as { fundamentalsPredictions: number }).fundamentalsPredictions} fundamentals, ${(results.predictions as { hypePredictions: number }).hypePredictions} hype`);
    } catch (error) {
      console.error('✗ Predictions failed:', error);
      results.predictions = { error: String(error) };
    }

    // Step 5: Evaluate previous predictions
    console.log('\n━━━ Step 5/5: Evaluating Predictions ━━━');
    try {
      results.evaluations = await evaluator.evaluatePendingPredictions();
      console.log(`✓ Evaluations: ${(results.evaluations as { evaluated: number }).evaluated} evaluated, ${(results.evaluations as { correct: number }).correct} correct`);
    } catch (error) {
      console.error('✗ Evaluations failed:', error);
      results.evaluations = { error: String(error) };
    }

    const duration = Date.now() - startTime;
    results.durationMs = duration;

    await logCronJob('full-pipeline', 'completed', results);

    console.log('\n╔════════════════════════════════════════╗');
    console.log(`║    FULL PIPELINE - Complete            ║`);
    console.log(`║    Duration: ${(duration / 1000).toFixed(1)}s                      ║`);
    console.log('╚════════════════════════════════════════╝\n');

    return NextResponse.json({
      success: true,
      results,
      durationMs: duration,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logCronJob('full-pipeline', 'failed', results, errorMessage);

    console.error('[CRON] Full pipeline failed:', errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        results,
        durationMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
