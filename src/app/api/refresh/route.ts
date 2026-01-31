/**
 * Manual Refresh API Endpoint
 * ===========================
 * Triggers a manual data refresh from the UI.
 * Runs a lightweight version of the full pipeline.
 *
 * Usage:
 *   POST /api/refresh
 */

import { NextResponse } from 'next/server';
import { newsProcessor } from '@/services/news-processor';
import { socialProcessor } from '@/services/social-processor';
import { predictor } from '@/services/predictor';

export async function POST() {
  const startTime = Date.now();

  try {
    console.log('\n========================================');
    console.log('[REFRESH] Manual refresh triggered');
    console.log('========================================\n');

    const results = {
      news: { articles: 0, processed: 0 },
      social: { posts: 0, saved: 0 },
      predictions: { generated: 0 },
      errors: [] as string[],
    };

    // Step 1: Fetch and process news (quick version)
    console.log('[REFRESH] Step 1: Fetching news...');
    try {
      const newsResult = await newsProcessor.fetchAndProcessNews();
      results.news.articles = newsResult.articlesFound;
      results.news.processed = newsResult.articlesProcessed;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      results.errors.push(`News: ${msg}`);
      console.error('[REFRESH] News error:', msg);
    }

    // Step 2: Fetch social media posts
    console.log('[REFRESH] Step 2: Fetching social media...');
    try {
      const socialResult = await socialProcessor.fetchAndProcessSocial();
      results.social.posts = socialResult.postsFound;
      results.social.saved = socialResult.postsSaved;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      results.errors.push(`Social: ${msg}`);
      console.error('[REFRESH] Social error:', msg);
    }

    // Step 3: Generate predictions
    console.log('[REFRESH] Step 3: Generating predictions...');
    try {
      const predResult = await predictor.runDailyPredictions();
      results.predictions.generated = predResult.predictionsGenerated;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      results.errors.push(`Predictions: ${msg}`);
      console.error('[REFRESH] Predictions error:', msg);
    }

    const duration = Date.now() - startTime;

    console.log('\n========================================');
    console.log('[REFRESH] Complete!');
    console.log(`Duration: ${(duration / 1000).toFixed(1)}s`);
    console.log('========================================\n');

    return NextResponse.json({
      success: true,
      results,
      durationMs: duration,
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
