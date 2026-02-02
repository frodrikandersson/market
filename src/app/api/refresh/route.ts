/**
 * Manual Refresh API Endpoint
 * ===========================
 * Triggers a manual data refresh from the UI.
 * ONLY fetches raw data - NO AI processing (to avoid cost abuse).
 *
 * ADMIN ONLY: Requires ADMIN_PASSWORD environment variable.
 *
 * AI processing happens later via the backlog-processor cron job.
 *
 * Usage:
 *   POST /api/refresh
 */

import { NextRequest, NextResponse } from 'next/server';
import { newsProcessor } from '@/services/news-processor';
import { socialProcessor } from '@/services/social-processor';

export async function POST(request: NextRequest) {
  // Check admin authentication
  const adminPassword = process.env.ADMIN_PASSWORD;
  const authHeader = request.headers.get('authorization');

  if (adminPassword && authHeader !== `Bearer ${adminPassword}`) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const startTime = Date.now();

  try {
    console.log('\n========================================');
    console.log('[REFRESH] Manual refresh triggered (fetch only, no AI)');
    console.log('========================================\n');

    const results = {
      news: { articles: 0, saved: 0 },
      social: { posts: 0, saved: 0 },
      errors: [] as string[],
    };

    // Step 1: Fetch news (NO AI processing)
    console.log('[REFRESH] Step 1: Fetching news...');
    try {
      const articles = await newsProcessor.fetchAllNews();
      const { saved, skipped } = await newsProcessor.saveArticles(articles);
      results.news.articles = articles.length;
      results.news.saved = saved;
      console.log(`[REFRESH] News: ${articles.length} fetched, ${saved} saved, ${skipped} skipped`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      results.errors.push(`News: ${msg}`);
      console.error('[REFRESH] News error:', msg);
    }

    // Step 2: Fetch social media posts (NO AI processing)
    console.log('[REFRESH] Step 2: Fetching social media...');
    try {
      const socialResult = await socialProcessor.fetchAndProcessSocial();
      results.social.posts = socialResult.postsFound;
      results.social.saved = socialResult.postsSaved;
      console.log(`[REFRESH] Social: ${socialResult.postsFound} fetched, ${socialResult.postsSaved} saved`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      results.errors.push(`Social: ${msg}`);
      console.error('[REFRESH] Social error:', msg);
    }

    const duration = Date.now() - startTime;

    console.log('\n========================================');
    console.log('[REFRESH] Complete! (AI processing will happen via backlog-processor)');
    console.log(`Duration: ${(duration / 1000).toFixed(1)}s`);
    console.log('========================================\n');

    return NextResponse.json({
      success: true,
      results,
      durationMs: duration,
      message: 'Data fetched successfully. AI processing will happen in background.',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[REFRESH] Failed:', errorMessage);

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
