/**
 * Cron Endpoint: Fetch Data
 * ==========================
 * Lightweight endpoint that ONLY fetches news and social media posts.
 * Does NOT process with AI - that's handled by backlog-processor.
 *
 * This is optimized for speed to avoid timeouts on cron-job.org.
 *
 * Workflow:
 * 1. Fetch news from all sources (NewsAPI, Finnhub, RSS, SEC, Earnings, YouTube)
 * 2. Fetch social posts (Reddit, Bluesky)
 * 3. Save to database (mark as processed=false for later AI analysis)
 *
 * Recommended schedule: Every 30 minutes
 * Expected duration: 5-15 seconds
 *
 * Usage:
 *   GET /api/cron/fetch-data?secret=YOUR_CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { newsProcessor } from '@/services/news-processor';
import { socialProcessor } from '@/services/social-processor';
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
    await logCronJob('fetch-data', 'running');
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║    FETCH DATA - Starting               ║');
    console.log('╚════════════════════════════════════════╝\n');

    // Step 1: Fetch news from all sources (NO AI PROCESSING)
    console.log('━━━ Step 1/2: Fetching News ━━━');
    try {
      const articles = await newsProcessor.fetchAllNews();
      const { saved, skipped } = await newsProcessor.saveArticles(articles);

      results.news = {
        articlesFound: articles.length,
        articlesSaved: saved,
        articlesSkipped: skipped,
      };

      console.log(`✓ News: ${articles.length} found, ${saved} saved, ${skipped} skipped`);
    } catch (error) {
      console.error('✗ News fetch failed:', error);
      results.news = { error: String(error) };
    }

    // Step 2: Fetch social media posts (NO AI PROCESSING)
    console.log('\n━━━ Step 2/2: Fetching Social Media ━━━');
    try {
      // Fetch Reddit posts
      const redditResult = await socialProcessor.fetchRedditPosts();

      // Fetch Bluesky posts
      const blueskyResult = await socialProcessor.fetchBlueskyPosts();

      // Fetch RSS posts
      const rssResult = await socialProcessor.fetchRSSPosts();

      results.social = {
        reddit: {
          postsFound: redditResult.postsFound,
          postsSaved: redditResult.postsSaved,
        },
        bluesky: {
          postsFound: blueskyResult.postsFound,
          postsSaved: blueskyResult.postsSaved,
        },
        rss: {
          postsFound: rssResult.postsFound,
          postsSaved: rssResult.postsSaved,
        },
        totalFound: redditResult.postsFound + blueskyResult.postsFound + rssResult.postsFound,
        totalSaved: redditResult.postsSaved + blueskyResult.postsSaved + rssResult.postsSaved,
      };

      const socialResults = results.social as { totalFound: number; totalSaved: number };
      console.log(`✓ Social: ${socialResults.totalFound} found, ${socialResults.totalSaved} saved`);
    } catch (error) {
      console.error('✗ Social fetch failed:', error);
      results.social = { error: String(error) };
    }

    const duration = Date.now() - startTime;
    results.durationMs = duration;

    await logCronJob('fetch-data', 'completed', results);

    console.log('\n╔════════════════════════════════════════╗');
    console.log(`║    FETCH DATA - Complete               ║`);
    console.log(`║    Duration: ${(duration / 1000).toFixed(1)}s                       ║`);
    console.log('╚════════════════════════════════════════╝\n');

    return NextResponse.json({
      success: true,
      results,
      durationMs: duration,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logCronJob('fetch-data', 'failed', results, errorMessage);

    console.error('[CRON] Fetch data failed:', errorMessage);

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
