/**
 * Cron Endpoint: Stock Price Fetcher (All Companies)
 * ===================================================
 * Fetches stock prices for ALL active companies in the database.
 *
 * Runs every 1 hour, fetches all companies in one run (~1-2 minutes total).
 * Uses Yahoo Finance which supports all global exchanges (US, Canada, UK, Australia, Europe, etc.)
 *
 * This ensures:
 * - All companies get fresh prices every hour
 * - New companies get prices within 1 hour of discovery
 * - No rate limit issues (Yahoo Finance has no official limits)
 *
 * Workflow:
 * 1. Fetch current quotes for ALL active companies
 * 2. Store as daily OHLCV data
 * 3. Small delay between requests (100ms) to be respectful
 * 4. Completes in ~1-2 minutes for 600+ companies
 *
 * Usage:
 *   GET /api/cron/fetch-prices?secret=YOUR_CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
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
    await logCronJob('fetch-prices', 'running');
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║    STOCK PRICES - Fetching             ║');
    console.log('╚════════════════════════════════════════╝\n');

    // Get current stats
    const totalCompanies = await db.company.count({ where: { isActive: true } });
    const companiesWithPrices = await db.company.count({
      where: {
        isActive: true,
        stockPrices: { some: {} },
      },
    });

    console.log(`Active companies: ${totalCompanies}`);
    console.log(`With price data: ${companiesWithPrices}`);
    console.log(`Without prices: ${totalCompanies - companiesWithPrices}`);
    console.log();

    // Fetch ALL prices (no limit)
    const result = await stockPriceService.fetchAllPrices();

    results.totalCompanies = totalCompanies;
    results.pricesFetched = result.fetched;
    results.pricesFailed = result.failed;
    results.errors = result.errors.slice(0, 10); // Only first 10 errors

    const duration = Date.now() - startTime;
    results.durationMs = duration;

    await logCronJob('fetch-prices', 'completed', results);

    console.log('\n╔════════════════════════════════════════╗');
    console.log(`║    STOCK PRICES - Complete             ║`);
    console.log(`║    Fetched: ${result.fetched}/${totalCompanies}                      ║`);
    console.log(`║    Failed: ${result.failed}                        ║`);
    console.log(`║    Duration: ${(duration / 1000).toFixed(1)}s                    ║`);
    console.log('╚════════════════════════════════════════╝\n');

    return NextResponse.json({
      success: true,
      results,
      durationMs: duration,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logCronJob('fetch-prices', 'failed', results, errorMessage);

    console.error('[CRON] Stock price fetch failed:', errorMessage);

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
