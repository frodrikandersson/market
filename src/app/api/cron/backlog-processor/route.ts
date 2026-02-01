/**
 * Cron Endpoint: Backlog Processor
 * =================================
 * Dedicated endpoint to process large batches of unprocessed articles
 * to catch up on the AI analysis backlog.
 *
 * This endpoint ONLY processes existing articles - it does NOT fetch new data.
 * Use this to work through the backlog faster than the regular pipeline.
 *
 * Processing Batch Size: 2000 articles per run
 * Recommended schedule: Every 2 hours
 *
 * Workflow:
 * 1. Find unprocessed articles (processed: false)
 * 2. Process them with AI (sentiment, company extraction, impact scoring)
 * 3. Cluster into news events
 *
 * Usage:
 *   GET /api/cron/backlog-processor?secret=YOUR_CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { newsProcessor } from '@/services/news-processor';
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
    await logCronJob('backlog-processor', 'running');
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║    BACKLOG PROCESSOR - Starting        ║');
    console.log('╚════════════════════════════════════════╝\n');

    // Get current backlog size
    const backlogSize = await db.newsArticle.count({ where: { processed: false } });
    console.log(`Current backlog: ${backlogSize.toLocaleString()} unprocessed articles`);

    // Step 1: Process unprocessed articles in large batch
    console.log('\n━━━ Processing Backlog Articles ━━━');
    try {
      // Process 2000 articles per run (20x the normal pipeline)
      const { processed, impacts, companiesDiscovered } =
        await newsProcessor.processUnprocessedArticles(2000);

      results.articlesProcessed = processed;
      results.impactsCreated = impacts;
      results.companiesDiscovered = companiesDiscovered;

      console.log(`✓ Processed: ${processed} articles`);
      console.log(`✓ Impacts: ${impacts} created`);
      console.log(`✓ Companies: ${companiesDiscovered} discovered`);
    } catch (error) {
      console.error('✗ Processing failed:', error);
      results.processing = { error: String(error) };
    }

    // Step 2: Cluster into events
    console.log('\n━━━ Event Clustering ━━━');
    try {
      const eventsCreated = await newsProcessor.clusterIntoEvents(24);
      results.eventsCreated = eventsCreated;
      console.log(`✓ Events: ${eventsCreated} created`);
    } catch (error) {
      console.error('✗ Event clustering failed:', error);
      results.clustering = { error: String(error) };
    }

    // Get updated backlog size
    const remainingBacklog = await db.newsArticle.count({ where: { processed: false } });
    results.backlogBefore = backlogSize;
    results.backlogAfter = remainingBacklog;
    results.backlogReduction = backlogSize - remainingBacklog;

    const duration = Date.now() - startTime;
    results.durationMs = duration;

    await logCronJob('backlog-processor', 'completed', results);

    console.log('\n╔════════════════════════════════════════╗');
    console.log(`║    BACKLOG PROCESSOR - Complete        ║`);
    console.log(`║    Backlog: ${backlogSize} → ${remainingBacklog} (-${backlogSize - remainingBacklog})       `);
    console.log(`║    Duration: ${(duration / 1000).toFixed(1)}s                      ║`);
    console.log('╚════════════════════════════════════════╝\n');

    return NextResponse.json({
      success: true,
      results,
      durationMs: duration,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logCronJob('backlog-processor', 'failed', results, errorMessage);

    console.error('[CRON] Backlog processor failed:', errorMessage);

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
