/**
 * Bluesky API Integration
 *
 * Fetches posts from Bluesky (AT Protocol) for sentiment analysis
 * Replaces Twitter/X API for the hype model
 *
 * API Docs: https://docs.bsky.app/
 */

import type { XTweet } from "@/types";

// ===========================================
// Configuration
// ===========================================

const BLUESKY_API_BASE = "https://public.api.bsky.app";

// Influential finance accounts on Bluesky
const FINANCE_ACCOUNTS = [
  "elonmusk.bsky.social",
  "cathiewood.bsky.social",
  "jimcramer.bsky.social",
  "chamath.bsky.social",
  "naval.bsky.social",
  "balajis.bsky.social",
];

// ===========================================
// Types
// ===========================================

interface BlueskyPost {
  uri: string;
  cid: string;
  author: {
    did: string;
    handle: string;
    displayName?: string;
  };
  record: {
    text: string;
    createdAt: string;
    embed?: unknown;
    facets?: Array<{
      features: Array<{
        $type: string;
        tag?: string;
        uri?: string;
      }>;
    }>;
  };
  replyCount: number;
  repostCount: number;
  likeCount: number;
  quoteCount?: number;
}

interface BlueskyFeed {
  cursor?: string;
  feed: Array<{
    post: BlueskyPost;
  }>;
}

// ===========================================
// Helper Functions
// ===========================================

/**
 * Convert Bluesky post to XTweet format for compatibility
 */
function convertToXTweet(post: BlueskyPost): XTweet {
  const { record, author, replyCount, repostCount, likeCount, quoteCount } = post;

  // Extract cashtags ($TICKER) from text
  const cashtags: Array<{ start: number; end: number; tag: string }> = [];
  const cashtagRegex = /\$([A-Z]{1,5})\b/g;
  let match;

  while ((match = cashtagRegex.exec(record.text)) !== null) {
    cashtags.push({
      start: match.index,
      end: match.index + match[0].length,
      tag: match[1],
    });
  }

  // Extract hashtags from facets if available
  const hashtags: Array<{ start: number; end: number; tag: string }> = [];
  if (record.facets) {
    for (const facet of record.facets) {
      for (const feature of facet.features) {
        if (feature.$type === "app.bsky.richtext.facet#tag" && feature.tag) {
          hashtags.push({
            start: 0, // Bluesky doesn't provide exact positions in the same way
            end: feature.tag.length,
            tag: feature.tag,
          });
        }
      }
    }
  }

  return {
    id: post.cid,
    text: record.text,
    created_at: record.createdAt,
    public_metrics: {
      retweet_count: repostCount,
      reply_count: replyCount,
      like_count: likeCount,
      quote_count: quoteCount || 0,
    },
    entities: {
      cashtags,
      hashtags,
      mentions: [], // Could parse mentions from facets if needed
    },
  };
}

/**
 * Calculate engagement score for a post
 */
export function calculateEngagement(post: XTweet): number {
  if (!post.public_metrics) return 0;

  const { like_count, retweet_count, reply_count, quote_count } = post.public_metrics;

  // Weighted engagement score
  return (
    like_count * 1 +
    retweet_count * 2 +
    reply_count * 1.5 +
    quote_count * 2
  );
}

/**
 * Extract cashtags from post text
 */
export function extractCashtags(post: XTweet): string[] {
  if (post.entities?.cashtags) {
    return post.entities.cashtags.map((ct) => ct.tag);
  }

  // Fallback: extract from text
  const matches = post.text.match(/\$([A-Z]{1,5})\b/g);
  return matches ? matches.map((m) => m.substring(1)) : [];
}

// ===========================================
// API Functions
// ===========================================

/**
 * Get posts from a specific Bluesky user
 */
export async function getUserPosts(
  handle: string,
  options: {
    limit?: number;
    cursor?: string;
  } = {}
): Promise<{ posts: XTweet[]; cursor?: string }> {
  const { limit = 50, cursor } = options;

  try {
    // Resolve handle to DID
    const profileRes = await fetch(
      `${BLUESKY_API_BASE}/xrpc/app.bsky.actor.getProfile?actor=${handle}`
    );

    if (!profileRes.ok) {
      throw new Error(`Failed to get profile: ${profileRes.statusText}`);
    }

    const profile = await profileRes.json();
    const did = profile.did;

    // Get author feed
    let url = `${BLUESKY_API_BASE}/xrpc/app.bsky.feed.getAuthorFeed?actor=${did}&limit=${limit}`;
    if (cursor) {
      url += `&cursor=${cursor}`;
    }

    const feedRes = await fetch(url);

    if (!feedRes.ok) {
      throw new Error(`Failed to get feed: ${feedRes.statusText}`);
    }

    const feed: BlueskyFeed = await feedRes.json();

    const posts = feed.feed.map((item) => convertToXTweet(item.post));

    return {
      posts,
      cursor: feed.cursor,
    };
  } catch (error) {
    console.error(`[Bluesky] Error fetching posts for ${handle}:`, error);
    return { posts: [] };
  }
}

/**
 * Get posts from multiple influential accounts
 */
export async function getInfluentialPosts(
  accounts: string[] = FINANCE_ACCOUNTS,
  postsPerAccount: number = 20
): Promise<XTweet[]> {
  const allPosts: XTweet[] = [];

  for (const account of accounts) {
    try {
      const { posts } = await getUserPosts(account, { limit: postsPerAccount });
      allPosts.push(...posts);
    } catch (error) {
      console.error(`[Bluesky] Failed to fetch from ${account}:`, error);
    }
  }

  // Sort by engagement
  return allPosts.sort((a, b) => calculateEngagement(b) - calculateEngagement(a));
}

/**
 * Search for posts by keyword/ticker
 */
export async function searchPosts(
  query: string,
  options: {
    limit?: number;
    cursor?: string;
  } = {}
): Promise<{ posts: XTweet[]; cursor?: string }> {
  const { limit = 50, cursor } = options;

  try {
    let url = `${BLUESKY_API_BASE}/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(query)}&limit=${limit}`;
    if (cursor) {
      url += `&cursor=${cursor}`;
    }

    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`Search failed: ${res.statusText}`);
    }

    const data = await res.json();

    const posts = data.posts.map((post: BlueskyPost) => convertToXTweet(post));

    return {
      posts,
      cursor: data.cursor,
    };
  } catch (error) {
    console.error(`[Bluesky] Search error for "${query}":`, error);
    return { posts: [] };
  }
}

/**
 * Check if Bluesky API is available
 */
export async function isAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${BLUESKY_API_BASE}/xrpc/app.bsky.actor.getProfile?actor=bsky.app`, {
      method: "HEAD",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Get trending finance posts (based on engagement)
 */
export async function getTrendingFinancePosts(limit: number = 50): Promise<XTweet[]> {
  const queries = ["$SPY", "$AAPL", "$TSLA", "$NVDA", "stocks", "trading"];
  const allPosts: XTweet[] = [];

  for (const query of queries) {
    const { posts } = await searchPosts(query, { limit: Math.ceil(limit / queries.length) });
    allPosts.push(...posts);
  }

  // Remove duplicates by ID
  const uniquePosts = Array.from(
    new Map(allPosts.map((post) => [post.id, post])).values()
  );

  // Sort by engagement and return top posts
  return uniquePosts
    .sort((a, b) => calculateEngagement(b) - calculateEngagement(a))
    .slice(0, limit);
}

// ===========================================
// Export
// ===========================================

export const bluesky = {
  getUserPosts,
  getInfluentialPosts,
  searchPosts,
  getTrendingFinancePosts,
  isAvailable,
  extractCashtags,
  calculateEngagement,
  FINANCE_ACCOUNTS,
};
