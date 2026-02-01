/**
 * Social Media Processor Service
 * ===============================
 * Fetches and processes social media posts for stock sentiment analysis.
 * Powers the Hype Model predictions.
 *
 * Sources:
 * 1. Financial news RSS feeds (influencer statements via news)
 * 2. Reddit r/wallstreetbets (retail investor sentiment)
 *
 * Usage:
 *   import { socialProcessor } from '@/services/social-processor';
 *   await socialProcessor.fetchAndProcessSocial();
 */

import { db } from '@/lib/db';
import { socialRSS } from '@/lib/social-rss';
import { reddit } from '@/lib/reddit';
import { bluesky } from '@/lib/bluesky';
import { gemini } from '@/lib/gemini';
import type { Sentiment } from '@/types';

// ===========================================
// Types
// ===========================================

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
 * Fetch influencer-related posts from financial news RSS feeds
 * This is the primary source for the Hype Model
 */
export async function fetchRSSPosts(): Promise<{
  postsFound: number;
  postsSaved: number;
  errors: string[];
}> {
  const result = { postsFound: 0, postsSaved: 0, errors: [] as string[] };

  // Check if RSS is available
  const rssAvailable = await socialRSS.isAvailable();
  if (!rssAvailable) {
    result.errors.push('RSS feeds not available');
    return result;
  }

  // Get active companies for matching
  const companies = await db.company.findMany({
    where: { isActive: true },
    select: { id: true, ticker: true, name: true },
  });
  const tickerToCompany = new Map(companies.map((c) => [c.ticker, c]));

  console.log(`[SocialRSS] Fetching influencer-related news from RSS feeds`);

  // Get or create a "News RSS" account entry for posts
  let rssAccount = await db.influentialAccount.findFirst({
    where: { platform: 'rss', handle: 'financial-news' },
  });

  if (!rssAccount) {
    rssAccount = await db.influentialAccount.create({
      data: {
        platform: 'rss',
        handle: 'financial-news',
        name: 'Financial News Aggregator',
        weight: 0.7, // Higher weight since it's curated news
        isActive: true,
      },
    });
  }

  try {
    // Fetch influencer-related posts from RSS
    const posts = await socialRSS.fetchAll();
    result.postsFound = posts.length;

    if (posts.length === 0) {
      console.log('[SocialRSS] No posts to process');
      return result;
    }

    // Batch check which posts already exist
    const postKeys = posts.map(post => ({
      accountId: rssAccount.id,
      externalId: post.id,
    }));

    const existingPosts = await db.socialPost.findMany({
      where: {
        OR: postKeys.map(key => ({
          accountId: key.accountId,
          externalId: key.externalId,
        })),
      },
      select: { accountId: true, externalId: true, id: true },
    });

    // Create a set of existing post keys for quick lookup
    const existingKeys = new Set(
      existingPosts.map(p => `${p.accountId}:${p.externalId}`)
    );

    // Filter to only new posts
    const newPosts = posts.filter(
      post => !existingKeys.has(`${rssAccount.id}:${post.id}`)
    );

    if (newPosts.length === 0) {
      console.log('[SocialRSS] All posts already exist');
      return result;
    }

    // Batch create new posts
    const postsToCreate = newPosts.map(post => ({
      accountId: rssAccount.id,
      externalId: post.id,
      content: post.text,
      metrics: {
        likes: post.public_metrics?.like_count || 0,
        retweets: 0,
        replies: 0,
        quotes: 0,
      },
      publishedAt: new Date(post.created_at),
      processed: false,
    }));

    await db.socialPost.createMany({
      data: postsToCreate,
      skipDuplicates: true,
    });
    result.postsSaved = postsToCreate.length;

    // Fetch the created posts to get their IDs for mentions
    const createdPosts = await db.socialPost.findMany({
      where: {
        OR: newPosts.map(post => ({
          accountId: rssAccount.id,
          externalId: post.id,
        })),
      },
      select: { id: true, accountId: true, externalId: true },
    });

    // Create a map for quick lookup
    const postIdMap = new Map(
      createdPosts.map(p => [`${p.accountId}:${p.externalId}`, p.id])
    );

    // Batch create mentions
    const mentionsToCreate: Array<{
      postId: string;
      companyId: string;
      sentiment: string;
      confidence: number;
    }> = [];

    for (const post of newPosts) {
      const postId = postIdMap.get(`${rssAccount.id}:${post.id}`);
      if (!postId) continue;

      const tickers = socialRSS.extractTickers(post.text);
      const sentiment = socialRSS.detectSentiment(post.text);

      for (const ticker of tickers) {
        const company = tickerToCompany.get(ticker);
        if (company) {
          mentionsToCreate.push({
            postId,
            companyId: company.id,
            sentiment,
            confidence: 0.75, // Good confidence for news-reported content
          });
        }
      }
    }

    // Batch insert mentions
    if (mentionsToCreate.length > 0) {
      await db.socialMention.createMany({
        data: mentionsToCreate,
        skipDuplicates: true,
      });
    }

    console.log(`[SocialRSS] Found ${result.postsFound} posts, saved ${result.postsSaved} new`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    result.errors.push(errorMsg);
    console.error('[SocialRSS] Error:', errorMsg);
  }

  return result;
}

/**
 * Fetch posts from all Reddit finance subreddits
 */
export async function fetchRedditPosts(): Promise<{
  postsFound: number;
  postsSaved: number;
  errors: string[];
}> {
  const result = { postsFound: 0, postsSaved: 0, errors: [] as string[] };

  // Check if Reddit is available
  const redditAvailable = await reddit.isAvailable();
  if (!redditAvailable) {
    result.errors.push('Reddit API not available');
    return result;
  }

  // Get active companies for matching
  const companies = await db.company.findMany({
    where: { isActive: true },
    select: { id: true, ticker: true, name: true },
  });
  const tickerToCompany = new Map(companies.map((c) => [c.ticker, c]));

  console.log(`[Reddit] Fetching from all finance subreddits...`);

  // Get or create accounts for each subreddit (OPTIMIZED: batch query)
  const subredditAccounts = new Map<string, { id: string; weight: number }>();
  const subreddits = Object.keys(reddit.SUBREDDIT_CONFIG) as Array<keyof typeof reddit.SUBREDDIT_CONFIG>;

  // Fetch all existing Reddit accounts in one query
  const existingAccounts = await db.influentialAccount.findMany({
    where: {
      platform: 'reddit',
      handle: { in: subreddits }
    },
    select: { id: true, handle: true, weight: true }
  });

  // Identify missing accounts
  const existingHandles = new Set(existingAccounts.map(a => a.handle));
  const missingSubreddits = subreddits.filter(s => !existingHandles.has(s));

  // Bulk create missing accounts
  if (missingSubreddits.length > 0) {
    await db.influentialAccount.createMany({
      data: missingSubreddits.map(subreddit => ({
        platform: 'reddit',
        handle: subreddit,
        name: reddit.SUBREDDIT_CONFIG[subreddit].name,
        weight: reddit.SUBREDDIT_CONFIG[subreddit].weight,
        isActive: true,
      })),
      skipDuplicates: true,
    });
    console.log(`[Reddit] Created ${missingSubreddits.length} new accounts`);

    // Fetch the newly created accounts
    const newAccounts = await db.influentialAccount.findMany({
      where: {
        platform: 'reddit',
        handle: { in: missingSubreddits }
      },
      select: { id: true, handle: true, weight: true }
    });
    existingAccounts.push(...newAccounts);
  }

  // Map all accounts for quick lookup
  for (const account of existingAccounts) {
    subredditAccounts.set(account.handle, { id: account.id, weight: account.weight });
  }

  try {
    // Fetch posts from all subreddits
    const posts = await reddit.fetchAllSubreddits(20);
    result.postsFound = posts.length;

    // Filter out posts from unknown subreddits and collect post keys for batch check
    const postsWithAccounts = posts
      .map(post => {
        const accountInfo = subredditAccounts.get(post.subreddit);
        return accountInfo ? { post, accountInfo } : null;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    if (postsWithAccounts.length === 0) {
      console.log('[Reddit] No posts to process');
      return result;
    }

    // Batch check which posts already exist
    const postKeys = postsWithAccounts.map(({ post, accountInfo }) => ({
      accountId: accountInfo.id,
      externalId: post.id,
    }));

    const existingPosts = await db.socialPost.findMany({
      where: {
        OR: postKeys.map(key => ({
          accountId: key.accountId,
          externalId: key.externalId,
        })),
      },
      select: { accountId: true, externalId: true, id: true },
    });

    // Create a set of existing post keys for quick lookup
    const existingKeys = new Set(
      existingPosts.map(p => `${p.accountId}:${p.externalId}`)
    );

    // Filter to only new posts
    const newPostsWithAccounts = postsWithAccounts.filter(
      ({ post, accountInfo }) =>
        !existingKeys.has(`${accountInfo.id}:${post.id}`)
    );

    if (newPostsWithAccounts.length === 0) {
      console.log('[Reddit] All posts already exist');
      return result;
    }

    // Batch create new posts
    const postsToCreate = newPostsWithAccounts.map(({ post, accountInfo }) => {
      const engagement = reddit.calculateEngagement(post);
      return {
        accountId: accountInfo.id,
        externalId: post.id,
        content: `${post.title}\n\n${post.content}`.substring(0, 5000),
        sentiment: post.sentiment,
        impactScore: engagement * accountInfo.weight * (post.sentiment === 'positive' ? 1 : post.sentiment === 'negative' ? -1 : 0),
        metrics: {
          score: post.score,
          upvoteRatio: post.upvoteRatio,
          comments: post.commentCount,
          flair: post.flair,
          subreddit: post.subreddit,
        },
        publishedAt: post.createdAt,
        processed: true, // Already analyzed during fetch
      };
    });

    await db.socialPost.createMany({
      data: postsToCreate,
      skipDuplicates: true,
    });
    result.postsSaved = postsToCreate.length;

    // Fetch the created posts to get their IDs for mentions
    const createdPosts = await db.socialPost.findMany({
      where: {
        OR: newPostsWithAccounts.map(({ post, accountInfo }) => ({
          accountId: accountInfo.id,
          externalId: post.id,
        })),
      },
      select: { id: true, accountId: true, externalId: true },
    });

    // Create a map for quick lookup
    const postIdMap = new Map(
      createdPosts.map(p => [`${p.accountId}:${p.externalId}`, p.id])
    );

    // Batch create mentions
    const mentionsToCreate: Array<{
      postId: string;
      companyId: string;
      sentiment: string;
      confidence: number;
    }> = [];

    for (const { post, accountInfo } of newPostsWithAccounts) {
      const postId = postIdMap.get(`${accountInfo.id}:${post.id}`);
      if (!postId) continue;

      const engagement = reddit.calculateEngagement(post);
      for (const ticker of post.tickers) {
        const company = tickerToCompany.get(ticker);
        if (company) {
          mentionsToCreate.push({
            postId,
            companyId: company.id,
            sentiment: post.sentiment,
            confidence: Math.min(0.9, 0.5 + engagement * accountInfo.weight),
          });
        }
      }
    }

    // Batch insert mentions (use createMany with skipDuplicates)
    if (mentionsToCreate.length > 0) {
      await db.socialMention.createMany({
        data: mentionsToCreate,
        skipDuplicates: true,
      });
    }

    console.log(`[Reddit] Found ${result.postsFound} posts, saved ${result.postsSaved} new`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    result.errors.push(errorMsg);
    console.error('[Reddit] Error:', errorMsg);
  }

  return result;
}

/**
 * Fetch posts from Bluesky influential accounts
 */
export async function fetchBlueskyPosts(): Promise<{
  postsFound: number;
  postsSaved: number;
  errors: string[];
}> {
  const result = { postsFound: 0, postsSaved: 0, errors: [] as string[] };

  // Check if Bluesky is available
  const blueskyAvailable = await bluesky.isAvailable();
  if (!blueskyAvailable) {
    result.errors.push('Bluesky API not available');
    return result;
  }

  // Get active companies for matching
  const companies = await db.company.findMany({
    where: { isActive: true },
    select: { id: true, ticker: true, name: true },
  });
  const tickerToCompany = new Map(companies.map((c) => [c.ticker, c]));

  console.log(`[Bluesky] Fetching from influential accounts...`);

  // Get or create accounts for Bluesky influencers (OPTIMIZED: batch query)
  const blueskyAccounts = new Map<string, { id: string; weight: number }>();

  // Fetch all existing Bluesky accounts in one query
  const existingBlueskyAccounts = await db.influentialAccount.findMany({
    where: {
      platform: 'bluesky',
      handle: { in: bluesky.FINANCE_ACCOUNTS }
    },
    select: { id: true, handle: true, weight: true }
  });

  // Identify missing accounts
  const existingBlueskyHandles = new Set(existingBlueskyAccounts.map(a => a.handle));
  const missingHandles = bluesky.FINANCE_ACCOUNTS.filter(h => !existingBlueskyHandles.has(h));

  // Bulk create missing accounts
  if (missingHandles.length > 0) {
    await db.influentialAccount.createMany({
      data: missingHandles.map(handle => ({
        platform: 'bluesky',
        handle,
        name: handle.replace('.bsky.social', ''),
        weight: 0.75, // High weight for influential accounts
        isActive: true,
      })),
      skipDuplicates: true,
    });
    console.log(`[Bluesky] Created ${missingHandles.length} new accounts`);

    // Fetch the newly created accounts
    const newBlueskyAccounts = await db.influentialAccount.findMany({
      where: {
        platform: 'bluesky',
        handle: { in: missingHandles }
      },
      select: { id: true, handle: true, weight: true }
    });
    existingBlueskyAccounts.push(...newBlueskyAccounts);
  }

  // Map all accounts for quick lookup
  for (const account of existingBlueskyAccounts) {
    blueskyAccounts.set(account.handle, { id: account.id, weight: account.weight });
  }

  try {
    // Fetch trending finance posts with expanded hashtag search (30+ search terms)
    const posts = await bluesky.getTrendingFinancePosts(200);
    result.postsFound = posts.length;

    if (posts.length === 0) {
      console.log('[Bluesky] No posts to process');
      return result;
    }

    // Get or create generic "trending" account for posts we can't attribute
    let genericAccount = await db.influentialAccount.findFirst({
      where: { platform: 'bluesky', handle: 'trending' },
    });

    if (!genericAccount) {
      genericAccount = await db.influentialAccount.create({
        data: {
          platform: 'bluesky',
          handle: 'trending',
          name: 'Bluesky Trending',
          weight: 0.6,
          isActive: true,
        },
      });
    }

    const genericAccountInfo = { id: genericAccount.id, weight: 0.6 };

    // Assign account to each post (for now, use generic account for all)
    const postsWithAccounts = posts.map(post => ({
      post,
      accountInfo: genericAccountInfo,
    }));

    // Batch check which posts already exist
    const postKeys = postsWithAccounts.map(({ post, accountInfo }) => ({
      accountId: accountInfo.id,
      externalId: post.id,
    }));

    const existingPosts = await db.socialPost.findMany({
      where: {
        OR: postKeys.map(key => ({
          accountId: key.accountId,
          externalId: key.externalId,
        })),
      },
      select: { accountId: true, externalId: true, id: true },
    });

    // Create a set of existing post keys for quick lookup
    const existingKeys = new Set(
      existingPosts.map(p => `${p.accountId}:${p.externalId}`)
    );

    // Filter to only new posts
    const newPostsWithAccounts = postsWithAccounts.filter(
      ({ post, accountInfo }) =>
        !existingKeys.has(`${accountInfo.id}:${post.id}`)
    );

    if (newPostsWithAccounts.length === 0) {
      console.log('[Bluesky] All posts already exist');
      return result;
    }

    // Batch create new posts
    const postsToCreate = newPostsWithAccounts.map(({ post, accountInfo }) => ({
      accountId: accountInfo.id,
      externalId: post.id,
      content: post.text.substring(0, 5000),
      metrics: {
        likes: post.public_metrics?.like_count || 0,
        retweets: post.public_metrics?.retweet_count || 0,
        replies: post.public_metrics?.reply_count || 0,
        quotes: post.public_metrics?.quote_count || 0,
      },
      publishedAt: new Date(post.created_at),
      processed: false, // Will be analyzed by AI
    }));

    await db.socialPost.createMany({
      data: postsToCreate,
      skipDuplicates: true,
    });
    result.postsSaved = postsToCreate.length;

    // Fetch the created posts to get their IDs for mentions
    const createdPosts = await db.socialPost.findMany({
      where: {
        OR: newPostsWithAccounts.map(({ post, accountInfo }) => ({
          accountId: accountInfo.id,
          externalId: post.id,
        })),
      },
      select: { id: true, accountId: true, externalId: true },
    });

    // Create a map for quick lookup
    const postIdMap = new Map(
      createdPosts.map(p => [`${p.accountId}:${p.externalId}`, p.id])
    );

    // Batch create mentions
    const mentionsToCreate: Array<{
      postId: string;
      companyId: string;
      sentiment: string;
      confidence: number;
    }> = [];

    for (const { post, accountInfo } of newPostsWithAccounts) {
      const postId = postIdMap.get(`${accountInfo.id}:${post.id}`);
      if (!postId) continue;

      const tickers = bluesky.extractCashtags(post);
      for (const ticker of tickers) {
        const company = tickerToCompany.get(ticker);
        if (company) {
          mentionsToCreate.push({
            postId,
            companyId: company.id,
            sentiment: 'neutral', // Will be determined by AI
            confidence: 0.5,
          });
        }
      }
    }

    // Batch insert mentions
    if (mentionsToCreate.length > 0) {
      await db.socialMention.createMany({
        data: mentionsToCreate,
        skipDuplicates: true,
      });
    }

    console.log(`[Bluesky] Found ${result.postsFound} posts, saved ${result.postsSaved} new`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    result.errors.push(errorMsg);
    console.error('[Bluesky] Error:', errorMsg);
  }

  return result;
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
    // Step 1: Fetch posts from financial news RSS feeds
    console.log('\n=== Social Step 1: Fetching from Financial News RSS ===');
    const rssResult = await fetchRSSPosts();
    result.postsFound += rssResult.postsFound;
    result.postsSaved += rssResult.postsSaved;
    result.errors.push(...rssResult.errors);

    if (rssResult.postsFound > 0) {
      result.accountsProcessed++;
    }

    // Step 2: Fetch posts from Reddit r/wallstreetbets
    console.log('\n=== Social Step 2: Fetching from Reddit ===');
    const redditResult = await fetchRedditPosts();
    result.postsFound += redditResult.postsFound;
    result.postsSaved += redditResult.postsSaved;
    result.errors.push(...redditResult.errors);

    if (redditResult.postsFound > 0) {
      result.accountsProcessed++;
    }

    // Step 3: Fetch posts from Bluesky
    console.log('\n=== Social Step 3: Fetching from Bluesky ===');
    const blueskyResult = await fetchBlueskyPosts();
    result.postsFound += blueskyResult.postsFound;
    result.postsSaved += blueskyResult.postsSaved;
    result.errors.push(...blueskyResult.errors);

    if (blueskyResult.postsFound > 0) {
      result.accountsProcessed++;
    }

    // Step 4: Analyze any unprocessed posts with AI
    console.log('\n=== Social Step 4: AI Analysis ===');
    const { analyzed, mentions } = await analyzeUnprocessedPosts(20);
    result.postsAnalyzed = analyzed;
    result.mentionsCreated = mentions;

    console.log(
      `[Social] Complete: ${result.postsFound} found, ${result.postsSaved} saved, ${result.mentionsCreated} mentions`
    );
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
  fetchRSSPosts,
  fetchRedditPosts,
  fetchBlueskyPosts,
  analyzeUnprocessedPosts,
  fetchAndProcessSocial,
  getSocialImpact,
};
