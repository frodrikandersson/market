/**
 * Cron Endpoint: Auto-Trade
 * =========================
 * Runs the auto-trader independently to check buy/sell signals more frequently.
 * This allows catching profit targets and stop-losses during market hours.
 *
 * Recommended schedule: Every 1-2 hours during market hours (9:30 AM - 4:00 PM ET)
 *
 * What it does:
 * 1. Checks existing positions for sell signals (profit target, stop-loss, reversal)
 * 2. Checks for new buy opportunities based on current predictions
 * 3. Executes trades for all model portfolios (fundamentals, hype, combined)
 *
 * Usage:
 *   GET /api/cron/auto-trade?secret=YOUR_CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { autoTrader } from '@/services/auto-trader';
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
    await logCronJob('auto-trade', 'running');
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║    AUTO-TRADER - Checking Positions    ║');
    console.log('╚════════════════════════════════════════╝\n');

    // Check if market is open (rough check - weekday, 9:30 AM - 4:00 PM ET)
    const now = new Date();
    const etHour = now.getUTCHours() - 5; // Rough ET conversion
    const dayOfWeek = now.getUTCDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isMarketHours = etHour >= 9 && etHour < 16;

    if (isWeekend) {
      console.log('⚠️ Weekend - market closed, skipping trade execution');
      results.skipped = true;
      results.reason = 'Weekend - market closed';

      await logCronJob('auto-trade', 'completed', results);
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'Weekend - market closed',
        durationMs: Date.now() - startTime,
      });
    }

    if (!isMarketHours) {
      console.log('⚠️ Outside market hours, but proceeding with check anyway');
      results.outsideMarketHours = true;
    }

    // Run the auto-trader
    const autoTradeResult = await autoTrader.executeFromPredictions();

    // Aggregate results
    const totalBuyOrders = autoTradeResult.portfolios.reduce((sum, p) => sum + p.buyOrders, 0);
    const totalSellOrders = autoTradeResult.portfolios.reduce((sum, p) => sum + p.sellOrders, 0);

    results.tradesExecuted = autoTradeResult.totalTradesExecuted;
    results.buyOrders = totalBuyOrders;
    results.sellOrders = totalSellOrders;
    results.portfolios = autoTradeResult.portfolios.map(p => ({
      model: p.modelType,
      trades: p.tradesExecuted,
      buys: p.buyOrders,
      sells: p.sellOrders,
      decisions: p.decisions.length,
    }));
    results.errors = autoTradeResult.errors;

    const duration = Date.now() - startTime;
    results.durationMs = duration;

    await logCronJob('auto-trade', 'completed', results);

    console.log('\n╔════════════════════════════════════════╗');
    console.log(`║    AUTO-TRADER - Complete              ║`);
    console.log(`║    Trades: ${autoTradeResult.totalTradesExecuted} (${totalBuyOrders} buys, ${totalSellOrders} sells)    `);
    console.log(`║    Duration: ${(duration / 1000).toFixed(1)}s                      ║`);
    console.log('╚════════════════════════════════════════╝\n');

    return NextResponse.json({
      success: true,
      results,
      durationMs: duration,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logCronJob('auto-trade', 'failed', results, errorMessage);

    console.error('[CRON] Auto-trade failed:', errorMessage);

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
