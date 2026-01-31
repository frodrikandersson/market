/**
 * Cron Endpoint: Fetch Social Media
 * ==================================
 * Fetches and processes social media posts from influential accounts.
 *
 * Usage:
 *   GET /api/cron/fetch-social?secret=YOUR_CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { socialProcessor } from '@/services/social-processor';

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
    await logCronJob('fetch-social', 'running');
    console.log('\n========================================');
    console.log('[CRON] Starting social media fetch job');
    console.log('========================================\n');

    const result = await socialProcessor.fetchAndProcessSocial();

    const duration = Date.now() - startTime;

    await logCronJob('fetch-social', 'completed', {
      ...result,
      durationMs: duration,
    });

    console.log('\n========================================');
    console.log('[CRON] Social media fetch job completed');
    console.log(`Duration: ${(duration / 1000).toFixed(1)}s`);
    console.log('========================================\n');

    return NextResponse.json({
      success: true,
      result,
      durationMs: duration,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logCronJob('fetch-social', 'failed', undefined, errorMessage);

    console.error('[CRON] Social media fetch job failed:', errorMessage);

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
