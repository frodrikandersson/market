/**
 * Cron Endpoint: Fetch News
 * =========================
 * Endpoint called every 30 minutes to fetch and process news.
 * Protected by CRON_SECRET environment variable.
 *
 * Usage:
 *   GET /api/cron/fetch-news?secret=YOUR_CRON_SECRET
 *   POST /api/cron/fetch-news (with Authorization header)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { newsProcessor } from '@/services/news-processor';

/**
 * Verify the request is authorized to run cron jobs
 */
function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;

  // If no secret is set, allow in development
  if (!cronSecret && process.env.NODE_ENV === 'development') {
    return true;
  }

  // Check query parameter
  const url = new URL(request.url);
  if (url.searchParams.get('secret') === cronSecret) {
    return true;
  }

  // Check Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  return false;
}

/**
 * Log cron job execution
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
        data: {
          name,
          status,
          metadata: metadata ?? undefined,
        },
      });
    } else {
      // Find the most recent running job
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

/**
 * GET handler for cron job
 */
export async function GET(request: NextRequest) {
  // Verify authorization
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    // Log job start
    await logCronJob('fetch-news', 'running');
    console.log('\n========================================');
    console.log('[CRON] Starting news fetch job');
    console.log('========================================\n');

    // Run the news processor
    const result = await newsProcessor.fetchAndProcessNews();

    const duration = Date.now() - startTime;

    // Log job completion
    await logCronJob('fetch-news', 'completed', {
      ...result,
      durationMs: duration,
    });

    console.log('\n========================================');
    console.log('[CRON] News fetch job completed');
    console.log(`Duration: ${(duration / 1000).toFixed(1)}s`);
    console.log('========================================\n');

    return NextResponse.json({
      success: true,
      result,
      durationMs: duration,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Log job failure
    await logCronJob('fetch-news', 'failed', undefined, errorMessage);

    console.error('[CRON] News fetch job failed:', errorMessage);

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

/**
 * POST handler (same as GET, for flexibility)
 */
export async function POST(request: NextRequest) {
  return GET(request);
}
