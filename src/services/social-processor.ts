/**
 * Social Media Processor Service
 * ===============================
 * Fetches and processes social media posts from influential accounts.
 * Powers the Hype Model predictions.
 *
 * Usage:
 *   import { socialProcessor } from '@/services/social-processor';
 *   await socialProcessor.fetchAndProcessSocial();
 */

import { db } from '@/lib/db';
import { twitter } from '@/lib/twitter';
import { gemini } from '@/lib/gemini';
import type { XTweet, Sentiment } from '@/types';

// ===========================================
// Types
// ===========================================

interface ProcessedPost {
  accountId: string;
  externalId: string;
  content: string;
  sentiment: Sentiment | null;
  impactScore: number | null;
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
    quotes: number;
  };
  publishedAt: Date;
}

interface SocialProcessorResult {
  accountsProcessed: number;
  postsFound: number;
  postsSaved: number;
  postsAnalyzed: number;
  mentionsCreated: number;
  errors: string[];
}

// ===========================================
// Main Functions
// ===========================================

/**
 * Fetch posts from all active influential accounts
 */
export async function fetchAllPosts(): Promise<Map<string, ProcessedPost[]>> {
  const results = new Map<string, ProcessedPost[]>();

  // Check if Twitter is configured
  if (!twitter.isConfigured()) {
    console.log('[Social] Twitter API not configured - skipping');
    return results;
  }

  // Get active accounts
  const accounts = await db.influentialAccount.findMany({
    where: { isActive: true, platform: 'twitter' },
  });

  console.log(`[Social] Fetching posts from ${accounts.length} Twitter accounts`);

  for (const account of accounts) {
    try {
      // Get user ID if not stored
      let userId = account.userId;
      if (!userId) {
        userId = await twitter.getUserId(account.handle);
        if (userId) {
          await db.influentialAccount.update({
            where: { id: account.id },
            data: { userId },
          });
        }
      }

      if (!userId) {
        console.log(`[Social] Could not find user ID for @${account.handle}`);
        continue;
      }

      // Fetch recent tweets
      const tweets = await twitter.getUserTweets(userId, { maxResults: 10 });

      const posts: ProcessedPost[] = tweets.map((tweet) => ({
        accountId: account.id,
        externalId: tweet.id,
        content: tweet.text,
        sentiment: null,
        impactScore: null,
        metrics: {
          likes: tweet.public_metrics?.like_count || 0,
          retweets: tweet.public_metrics?.retweet_count || 0,
          replies: tweet.public_metrics?.reply_count || 0,
          quotes: tweet.public_metrics?.quote_count || 0,
        },
        publishedAt: new Date(tweet.created_at),
      }));

      results.set(account.id, posts);
      console.log(`[Social] @${account.handle}: ${posts.length} tweets`);

      // Rate limit delay
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`[Social] Failed to fetch @${account.handle}:`, error);
    }
  }

  return results;
}

/**
 * Save posts to database (skip existing)
 */
export async function savePosts(
  postsMap: Map<string, ProcessedPost[]>
): Promise<{ saved: number; skipped: number }> {
  let saved = 0;
  let skipped = 0;

  for (const [accountId, posts] of postsMap) {
    for (const post of posts) {
      try {
        // Check if exists
        const existing = await db.socialPost.findUnique({
          where: {
            accountId_externalId: {
              accountId,
              externalId: post.externalId,
            },
          },
        });

        if (existing) {
          skipped++;
          continue;
        }

        // Save new post
        await db.socialPost.create({
          data: {
            accountId: post.accountId,
            externalId: post.externalId,
            content: post.content,
            metrics: post.metrics,
            publishedAt: post.publishedAt,
            processed: false,
          },
        });
        saved++;
      } catch (error) {
        console.error(`[Social] Failed to save post ${post.externalId}:`, error);
      }
    }
  }

  console.log(`[Social] Saved ${saved} new posts, skipped ${skipped} existing`);
  return { saved, skipped };
}

/**
 * Analyze unprocessed posts with AI
 */
export async function analyzeUnprocessedPosts(
  limit: number = 20
): Promise<{ analyzed: number; mentions: number }> {
  // Get unprocessed posts
  const posts = await db.socialPost.findMany({
    where: { processed: false },
    orderBy: { publishedAt: 'desc' },
    take: limit,
    include: {
      account: { select: { name: true, weight: true } },
    },
  });

  console.log(`[Social] Analyzing ${posts.length} unprocessed posts`);

  let analyzed = 0;
  let mentions = 0;

  // Get all companies for matching
  const companies = await db.company.findMany({
    where: { isActive: true },
    select: { id: true, ticker: true, name: true },
  });
  const tickerToCompany = new Map(companies.map((c) => [c.ticker, c]));

  for (const post of posts) {
    try {
      // Analyze with Gemini
      const analysis = await gemini.analyzeSocialPost(post.content, post.account.name);

      // Calculate impact score based on engagement and account weight
      const engagementScore = calculateEngagementScore(post.metrics as {
        likes: number;
        retweets: number;
        replies: number;
        quotes: number;
      });
      const sentimentValue =
        analysis.overallSentiment === 'positive'
          ? 1
          : analysis.overallSentiment === 'negative'
            ? -1
            : 0;
      const impactScore = sentimentValue * engagementScore * post.account.weight;

      // Update post
      await db.socialPost.update({
        where: { id: post.id },
        data: {
          sentiment: analysis.overallSentiment,
          impactScore,
          processed: true,
        },
      });

      // Create mentions for identified companies
      for (const company of analysis.companies) {
        const matchedCompany = tickerToCompany.get(company.ticker);
        if (matchedCompany) {
          await db.socialMention.create({
            data: {
              postId: post.id,
              companyId: matchedCompany.id,
              sentiment: company.sentiment,
              confidence: company.confidence,
            },
          });
          mentions++;
        }
      }

      analyzed++;
      console.log(
        `[Social] Analyzed: "${post.content.substring(0, 50)}..." - ${analysis.overallSentiment}`
      );

      // Rate limit delay for AI
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`[Social] Failed to analyze post:`, error);
      // Mark as processed to avoid retrying
      await db.socialPost.update({
        where: { id: post.id },
        data: { processed: true },
      });
    }
  }

  console.log(`[Social] Analyzed ${analyzed} posts, created ${mentions} mentions`);
  return { analyzed, mentions };
}

/**
 * Calculate engagement score (0-1 normalized)
 */
function calculateEngagementScore(metrics: {
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
}): number {
  // Weighted engagement
  const raw =
    metrics.likes * 1 +
    metrics.retweets * 3 +
    metrics.replies * 2 +
    metrics.quotes * 3;

  // Normalize to 0-1 (assuming max ~100k engagement)
  return Math.min(1, raw / 100000);
}

/**
 * Full social media processing pipeline
 */
export async function fetchAndProcessSocial(): Promise<SocialProcessorResult> {
  const result: SocialProcessorResult = {
    accountsProcessed: 0,
    postsFound: 0,
    postsSaved: 0,
    postsAnalyzed: 0,
    mentionsCreated: 0,
    errors: [],
  };

  try {
    // Check if configured
    if (!twitter.isConfigured()) {
      result.errors.push('Twitter API not configured');
      console.log('[Social] Twitter API not configured - skipping social processing');
      return result;
    }

    // Step 1: Fetch posts
    console.log('\n=== Social Step 1: Fetching Posts ===');
    const postsMap = await fetchAllPosts();
    result.accountsProcessed = postsMap.size;
    result.postsFound = Array.from(postsMap.values()).reduce((sum, posts) => sum + posts.length, 0);

    // Step 2: Save posts
    console.log('\n=== Social Step 2: Saving Posts ===');
    const { saved } = await savePosts(postsMap);
    result.postsSaved = saved;

    // Step 3: Analyze with AI
    console.log('\n=== Social Step 3: AI Analysis ===');
    const { analyzed, mentions } = await analyzeUnprocessedPosts(20);
    result.postsAnalyzed = analyzed;
    result.mentionsCreated = mentions;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    result.errors.push(errorMsg);
    console.error('[Social] Pipeline error:', errorMsg);
  }

  return result;
}

/**
 * Get social impact for a company
 */
export async function getSocialImpact(
  companyId: string,
  hoursBack: number = 24
): Promise<{ score: number; postCount: number }> {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - hoursBack);

  const mentions = await db.socialMention.findMany({
    where: {
      companyId,
      createdAt: { gte: cutoff },
    },
    include: {
      post: {
        include: {
          account: { select: { weight: true } },
        },
      },
    },
  });

  if (mentions.length === 0) {
    return { score: 0, postCount: 0 };
  }

  // Calculate weighted score
  let totalWeight = 0;
  let weightedScore = 0;

  for (const mention of mentions) {
    const weight = mention.post.account.weight * mention.confidence;
    const value = mention.sentiment === 'positive' ? 1 : mention.sentiment === 'negative' ? -1 : 0;
    weightedScore += value * weight;
    totalWeight += weight;
  }

  return {
    score: totalWeight > 0 ? weightedScore / totalWeight : 0,
    postCount: mentions.length,
  };
}

// Export as namespace
export const socialProcessor = {
  fetchAllPosts,
  savePosts,
  analyzeUnprocessedPosts,
  fetchAndProcessSocial,
  getSocialImpact,
};
