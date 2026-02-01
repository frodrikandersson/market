/**
 * Bluesky API Integration
 *
 * Fetches posts from Bluesky (AT Protocol) for sentiment analysis
 * Replaces Twitter/X API for the hype model
 *
 * API Docs: https://docs.bsky.app/
 *
 * Authentication: Requires BLUESKY_USERNAME and BLUESKY_PASSWORD
 * Create account at: https://bsky.app/
 */

import type { XTweet } from "@/types";

// ===========================================
// Configuration
// ===========================================

const BLUESKY_API_BASE = "https://bsky.social";
const BLUESKY_USERNAME = process.env.BLUESKY_USERNAME;
const BLUESKY_PASSWORD = process.env.BLUESKY_PASSWORD;

// Session management
let cachedSession: {
  accessJwt: string;
  refreshJwt: string;
  did: string;
  expiresAt: number;
} | null = null;

// Influential finance accounts on Bluesky (50+ accounts)
const FINANCE_ACCOUNTS = [
  // Original 6
  "elonmusk.bsky.social",
  "cathiewood.bsky.social",
  "jimcramer.bsky.social",
  "chamath.bsky.social",
  "naval.bsky.social",
  "balajis.bsky.social",

  // Market Analysts & Fund Managers
  "bill.ackman.bsky.social",
  "carl.icahn.bsky.social",
  "ray.dalio.bsky.social",
  "howard.marks.bsky.social",
  "jeff.gundlach.bsky.social",
  "david.einhorn.bsky.social",

  // Tech/Crypto Influencers
  "vitalik.buterin.bsky.social",
  "pmarca.bsky.social", // Marc Andreessen
  "jack.bsky.social", // Jack Dorsey
  "brian.armstrong.bsky.social",
  "sam.bankman-fried.bsky.social",
  "cz.binance.bsky.social",

  // Financial Media & Analysts
  "joshua.brown.bsky.social", // The Reformed Broker
  "howard.lindzon.bsky.social",
  "gary.black.bsky.social", // Tesla analyst
  "michael.burry.bsky.social", // The Big Short
  "katie.jenner.bsky.social",
  "adam.jonas.bsky.social",

  // Retail Trader Influencers
  "roaring.kitty.bsky.social", // Keith Gill
  "unusual.whales.bsky.social",
  "fxhedgers.bsky.social",
  "zerohedge.bsky.social",
  "whale.alert.bsky.social",
  "walter.bloomberg.bsky.social",

  // Financial News Accounts
  "bloomberg.bsky.social",
  "cnbc.bsky.social",
  "wsj.bsky.social",
  "ft.bsky.social", // Financial Times
  "marketwatch.bsky.social",
  "benzinga.bsky.social",
  "seekingalpha.bsky.social",
  "barrons.bsky.social",
  "reuters.business.bsky.social",

  // Tech Media
  "techcrunch.bsky.social",
  "theverge.bsky.social",
  "wired.bsky.social",

  // Economic Data & Fed
  "nick.timiraos.bsky.social", // WSJ Fed reporter
  "greg.ip.bsky.social", // WSJ Chief Economics Commentator
  "lisa.abramowicz.bsky.social", // Bloomberg
  "mohamed.elerian.bsky.social",

  // Additional Influential Traders
  "scott.redler.bsky.social",
  "dan.ives.bsky.social", // Wedbush tech analyst
  "gene.munster.bsky.social",
  "kathy.wood.bsky.social", // ARK Invest
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
// Authentication
// ===========================================

/**
 * Create an authenticated session with Bluesky
 */
async function createSession(): Promise<{
  accessJwt: string;
  refreshJwt: string;
  did: string;
} | null> {
  if (!BLUESKY_USERNAME || !BLUESKY_PASSWORD) {
    console.error('[Bluesky] Missing BLUESKY_USERNAME or BLUESKY_PASSWORD environment variables');
    return null;
  }

  try {
    const response = await fetch(`${BLUESKY_API_BASE}/xrpc/com.atproto.server.createSession`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identifier: BLUESKY_USERNAME,
        password: BLUESKY_PASSWORD,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Auth failed: ${response.status} - ${error}`);
    }

    const data = await response.json();

    // Cache session for 2 hours (tokens typically expire after 2 hours)
    cachedSession = {
      accessJwt: data.accessJwt,
      refreshJwt: data.refreshJwt,
      did: data.did,
      expiresAt: Date.now() + 2 * 60 * 60 * 1000,
    };

    console.log('[Bluesky] Successfully authenticated');
    return cachedSession;
  } catch (error) {
    console.error('[Bluesky] Authentication error:', error);
    return null;
  }
}

/**
 * Get a valid access token (creates session if needed)
 */
async function getAccessToken(): Promise<string | null> {
  // Return cached token if still valid
  if (cachedSession && cachedSession.expiresAt > Date.now()) {
    return cachedSession.accessJwt;
  }

  // Create new session
  const session = await createSession();
  return session?.accessJwt || null;
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
    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.error('[Bluesky] Cannot fetch posts without authentication');
      return { posts: [] };
    }

    const headers: HeadersInit = {
      'Authorization': `Bearer ${accessToken}`,
    };

    // Resolve handle to DID
    const profileRes = await fetch(
      `${BLUESKY_API_BASE}/xrpc/app.bsky.actor.getProfile?actor=${handle}`,
      { headers }
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

    const feedRes = await fetch(url, { headers });

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
    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.error('[Bluesky] Cannot search posts without authentication');
      return { posts: [] };
    }

    let url = `${BLUESKY_API_BASE}/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(query)}&limit=${limit}`;
    if (cursor) {
      url += `&cursor=${cursor}`;
    }

    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

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
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return false;
    }

    const res = await fetch(`${BLUESKY_API_BASE}/xrpc/app.bsky.actor.getProfile?actor=bsky.app`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Get trending finance posts (based on engagement)
 * EXPANDED: 40+ → 80+ search terms for comprehensive coverage
 */
export async function getTrendingFinancePosts(limit: number = 200): Promise<XTweet[]> {
  const queries = [
    // Major Indices & ETFs
    "$SPY", "$SPX", "$QQQ", "$DIA", "$IWM", "$VIX",
    "$TQQQ", "$SQQQ", "$ARKK", "$SOXX", "$SMH",

    // FAANG+
    "$AAPL", "$MSFT", "$GOOGL", "$AMZN", "$META", "$NVDA", "$TSLA",

    // Popular Tech Stocks
    "$AMD", "$NFLX", "$BABA", "$CRM", "$ORCL", "$INTC",

    // Trending Tech/Growth Stocks (NEW)
    "$COIN", "$SQ", "$SHOP", "$PLTR", "$RBLX",
    "$UBER", "$ABNB", "$SNOW", "$NET", "$DDOG",
    "$CRWD", "$PANW", "$ZS", "$OKTA", "$MDB",

    // Meme/Retail Favorites (NEW)
    "$GME", "$AMC", "$BB", "$NOK", "$HOOD",

    // Sector ETFs
    "$XLK", "$XLF", "$XLE", "$XLV", "$XLI",
    "$VGT", "$VOO", "$VTI",

    // General Finance Keywords
    "stocks", "trading", "stockmarket", "investing",
    "stock market", "wall street", "nasdaq", "dow jones",

    // Trading Terms
    "#daytrading", "#swingtrading", "#optionstrading",
    "#daytrader", "#scalping", "#momentum",

    // Investment Styles (NEW)
    "#valuestock", "#growthstock", "#dividends",
    "#passiveincome", "#fire", "#investing101",

    // Sentiment Keywords
    "#bullish", "#bearish", "#FOMO", "#BTD",
    "#bullmarket", "#bearmarket", "#marketrally",

    // Sector Tags (NEW)
    "#technology", "#AI", "#semiconductor", "#fintech",
    "#biotech", "#EV", "#cleanenergy", "#crypto",

    // Event Keywords
    "#earnings", "#fed", "#inflation", "#jobs",
    "#earningsseason", "#fomc", "#cpi", "#gdp",

    // Market Events (NEW)
    "#opex", "#quadwitching", "#marketclose",
    "#premarket", "#afterhours", "#marketopen",

    // Popular Market Terms (NEW)
    "short squeeze", "gamma squeeze", "market crash",
    "all time high", "correction", "recession",
  ];

  const allPosts: XTweet[] = [];
  const postsPerQuery = Math.ceil(limit / queries.length);

  for (const query of queries) {
    try {
      const { posts } = await searchPosts(query, { limit: postsPerQuery });
      allPosts.push(...posts);

      // Small delay between searches to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`[Bluesky] Error searching for "${query}":`, error);
    }
  }

  // Remove duplicates by ID
  const uniquePosts = Array.from(
    new Map(allPosts.map((post) => [post.id, post])).values()
  );

  console.log(`[Bluesky] Found ${uniquePosts.length} unique posts from ${queries.length} search queries`);

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
