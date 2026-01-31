/**
 * Nitter Scraper
 * ==============
 * Scrapes tweets from Nitter instances (privacy-respecting Twitter frontend).
 * Uses RSS feeds to get tweets without requiring Twitter API access.
 *
 * Usage:
 *   import { nitter } from '@/lib/nitter';
 *   const tweets = await nitter.getUserTweets('elonmusk');
 */

import type { XTweet } from '@/types';

// List of Nitter instances to try (they go up/down frequently)
// Updated list as of 2026 - many instances are down due to Twitter blocking
const NITTER_INSTANCES = [
  'https://nitter.privacydev.net',
  'https://nitter.poast.org',
  'https://nitter.lucabased.xyz',
  'https://nitter.io.lol',
  'https://nitter.d420.de',
  'https://nitter.moomoo.me',
  'https://nitter.it',
  'https://bird.trom.tf',
  'https://nitter.cz',
  'https://nitter.unixfox.eu',
];

// Cache for working instances
let workingInstance: string | null = null;
let lastInstanceCheck = 0;
const INSTANCE_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Find a working Nitter instance
 */
async function findWorkingInstance(): Promise<string | null> {
  const now = Date.now();

  // Return cached instance if recent
  if (workingInstance && now - lastInstanceCheck < INSTANCE_CHECK_INTERVAL) {
    return workingInstance;
  }

  // Try each instance
  for (const instance of NITTER_INSTANCES) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${instance}/`, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      clearTimeout(timeout);

      if (response.ok) {
        console.log(`[Nitter] Using instance: ${instance}`);
        workingInstance = instance;
        lastInstanceCheck = now;
        return instance;
      }
    } catch {
      // Instance not working, try next
    }
  }

  console.error('[Nitter] No working instances found');
  return null;
}

/**
 * Parse RSS XML to extract tweets
 */
function parseRSSToTweets(xml: string, username: string): XTweet[] {
  const tweets: XTweet[] = [];

  // Simple regex-based parsing (RSS is predictable)
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  const titleRegex = /<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/;
  const descRegex = /<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/;
  const pubDateRegex = /<pubDate>(.*?)<\/pubDate>/;
  const linkRegex = /<link>(.*?)<\/link>/;

  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];

    // Extract content
    const titleMatch = item.match(titleRegex);
    const descMatch = item.match(descRegex);
    const pubDateMatch = item.match(pubDateRegex);
    const linkMatch = item.match(linkRegex);

    if (!pubDateMatch) continue;

    // Get text content (prefer description, fallback to title)
    let text = '';
    if (descMatch) {
      // Strip HTML from description
      text = descMatch[1]
        .replace(/<[^>]*>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
    } else if (titleMatch) {
      text = titleMatch[1];
    }

    if (!text) continue;

    // Extract tweet ID from link
    const link = linkMatch ? linkMatch[1] : '';
    const idMatch = link.match(/\/status\/(\d+)/);
    const id = idMatch ? idMatch[1] : `${Date.now()}-${Math.random()}`;

    // Parse date
    const publishedAt = new Date(pubDateMatch[1]);

    // Extract cashtags ($TICKER)
    const cashtags: XTweet['entities'] = { cashtags: [] };
    const cashtagRegex = /\$([A-Z]{1,5})\b/g;
    let cashtagMatch;
    while ((cashtagMatch = cashtagRegex.exec(text)) !== null) {
      cashtags.cashtags!.push({
        start: cashtagMatch.index,
        end: cashtagMatch.index + cashtagMatch[0].length,
        tag: cashtagMatch[1],
      });
    }

    // Extract hashtags
    const hashtags: { start: number; end: number; tag: string }[] = [];
    const hashtagRegex = /#([A-Za-z0-9_]+)/g;
    let hashtagMatch;
    while ((hashtagMatch = hashtagRegex.exec(text)) !== null) {
      hashtags.push({
        start: hashtagMatch.index,
        end: hashtagMatch.index + hashtagMatch[0].length,
        tag: hashtagMatch[1],
      });
    }

    tweets.push({
      id,
      text,
      created_at: publishedAt.toISOString(),
      entities: {
        cashtags: cashtags.cashtags,
        hashtags,
      },
      // Nitter RSS doesn't include engagement metrics
      public_metrics: undefined,
    });
  }

  return tweets;
}

/**
 * Fetch tweets directly from a Nitter instance HTML page
 * More reliable than RSS when RSS is blocked
 */
async function fetchFromNitterHTML(
  instance: string,
  username: string,
  maxResults: number
): Promise<XTweet[]> {
  try {
    const url = `${instance}/${username}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) {
      return [];
    }

    const html = await response.text();
    const tweets: XTweet[] = [];

    // Nitter HTML structure: each tweet is in a div with class "timeline-item"
    // Tweet text is in div.tweet-content, date in span.tweet-date
    const tweetBlockRegex =
      /<div[^>]*class="[^"]*timeline-item[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;

    let match;
    while ((match = tweetBlockRegex.exec(html)) !== null && tweets.length < maxResults) {
      const block = match[1];

      // Extract tweet link to get ID
      const linkMatch = block.match(/href="\/[^/]+\/status\/(\d+)/);
      const id = linkMatch ? linkMatch[1] : `${Date.now()}-${tweets.length}`;

      // Extract tweet content
      const contentMatch = block.match(
        /<div[^>]*class="[^"]*tweet-content[^"]*"[^>]*>([\s\S]*?)<\/div>/
      );
      if (!contentMatch) continue;

      const text = contentMatch[1]
        .replace(/<[^>]*>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim();

      if (!text || text.length < 5) continue;

      // Extract date
      const dateMatch = block.match(
        /<span[^>]*class="[^"]*tweet-date[^"]*"[^>]*>[\s\S]*?title="([^"]+)"/
      );
      const dateStr = dateMatch ? dateMatch[1] : new Date().toISOString();

      // Parse cashtags
      const cashtags: { start: number; end: number; tag: string }[] = [];
      const cashtagRegex = /\$([A-Z]{1,5})\b/g;
      let cashMatch;
      while ((cashMatch = cashtagRegex.exec(text)) !== null) {
        cashtags.push({
          start: cashMatch.index,
          end: cashMatch.index + cashMatch[0].length,
          tag: cashMatch[1],
        });
      }

      tweets.push({
        id,
        text,
        created_at: new Date(dateStr).toISOString(),
        entities: { cashtags },
      });
    }

    return tweets;
  } catch (error) {
    console.error(`[NitterHTML] Failed for ${username}:`, error);
    return [];
  }
}

/**
 * Fetch tweets via Twitter's syndication API (embed API - no auth required)
 * This is a fallback when Nitter instances are unavailable
 */
async function fetchViaSyndication(username: string, maxResults: number): Promise<XTweet[]> {
  try {
    // Twitter's syndication timeline endpoint
    const url = `https://syndication.twitter.com/srv/timeline-profile/screen-name/${username}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) {
      return [];
    }

    const html = await response.text();

    // Extract tweets from the HTML response
    const tweets: XTweet[] = [];

    // Find all tweet containers - pattern: data-tweet-id="..."
    const tweetIdRegex = /data-tweet-id="(\d+)"/g;
    const tweetTextRegex = /<p[^>]*class="[^"]*timeline-Tweet-text[^"]*"[^>]*>([\s\S]*?)<\/p>/g;
    const timeRegex = /<time[^>]*datetime="([^"]+)"[^>]*>/g;

    // Extract tweet IDs
    const ids: string[] = [];
    let idMatch;
    while ((idMatch = tweetIdRegex.exec(html)) !== null) {
      ids.push(idMatch[1]);
    }

    // Extract tweet texts (simplified - the structure varies)
    const texts: string[] = [];
    let textMatch;
    while ((textMatch = tweetTextRegex.exec(html)) !== null) {
      const text = textMatch[1]
        .replace(/<[^>]*>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
      texts.push(text);
    }

    // Extract timestamps
    const times: string[] = [];
    let timeMatch;
    while ((timeMatch = timeRegex.exec(html)) !== null) {
      times.push(timeMatch[1]);
    }

    // Combine into tweets
    for (let i = 0; i < Math.min(ids.length, texts.length, maxResults); i++) {
      const text = texts[i] || '';
      if (!text) continue;

      // Extract cashtags
      const cashtags: XTweet['entities'] = { cashtags: [] };
      const cashtagRegex = /\$([A-Z]{1,5})\b/g;
      let cashtagMatch;
      while ((cashtagMatch = cashtagRegex.exec(text)) !== null) {
        cashtags.cashtags!.push({
          start: cashtagMatch.index,
          end: cashtagMatch.index + cashtagMatch[0].length,
          tag: cashtagMatch[1],
        });
      }

      tweets.push({
        id: ids[i] || `${Date.now()}-${i}`,
        text,
        created_at: times[i] || new Date().toISOString(),
        entities: cashtags,
      });
    }

    if (tweets.length > 0) {
      console.log(`[Syndication] Fetched ${tweets.length} tweets for @${username}`);
    }

    return tweets;
  } catch (error) {
    console.error(`[Syndication] Failed for ${username}:`, error);
    return [];
  }
}

/**
 * Fetch tweets from a user's timeline
 * Tries: 1) Nitter RSS, 2) Nitter HTML, 3) Twitter syndication
 */
export async function getUserTweets(
  username: string,
  options: { maxResults?: number } = {}
): Promise<XTweet[]> {
  const maxResults = options.maxResults || 20;
  const cleanUsername = username.replace('@', '');

  // First try Nitter
  const instance = await findWorkingInstance();
  if (instance) {
    // Try RSS first
    try {
      const rssUrl = `${instance}/${cleanUsername}/rss`;

      const response = await fetch(rssUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/rss+xml, application/xml, text/xml',
        },
      });

      if (response.ok) {
        const xml = await response.text();
        const tweets = parseRSSToTweets(xml, cleanUsername);

        if (tweets.length > 0) {
          console.log(`[Nitter RSS] Fetched ${tweets.length} tweets for @${cleanUsername}`);
          return tweets.slice(0, maxResults);
        }
      }
    } catch (error) {
      // RSS failed, continue to HTML
    }

    // Try HTML scraping
    const htmlTweets = await fetchFromNitterHTML(instance, cleanUsername, maxResults);
    if (htmlTweets.length > 0) {
      console.log(`[Nitter HTML] Fetched ${htmlTweets.length} tweets for @${cleanUsername}`);
      return htmlTweets;
    }
  }

  // Fallback to Twitter syndication API
  const syndicationTweets = await fetchViaSyndication(cleanUsername, maxResults);
  if (syndicationTweets.length > 0) {
    return syndicationTweets;
  }

  console.log(`[Social] Could not fetch tweets for @${cleanUsername} from any source`);
  return [];
}

/**
 * Fetch tweets from multiple users
 */
export async function getMultipleUsersTweets(
  usernames: string[],
  options: { maxResultsPerUser?: number } = {}
): Promise<Map<string, XTweet[]>> {
  const results = new Map<string, XTweet[]>();
  const maxResults = options.maxResultsPerUser || 10;

  for (const username of usernames) {
    // Add delay between requests to be respectful
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const tweets = await getUserTweets(username, { maxResults });
    results.set(username.replace('@', '').toLowerCase(), tweets);
  }

  return results;
}

/**
 * Extract cashtags from tweet text
 */
export function extractCashtags(tweet: XTweet): string[] {
  if (tweet.entities?.cashtags) {
    return tweet.entities.cashtags.map((c) => c.tag.toUpperCase());
  }

  // Fallback: extract from text
  const matches = tweet.text.match(/\$([A-Z]{1,5})\b/g) || [];
  return matches.map((m) => m.slice(1).toUpperCase());
}

/**
 * Calculate estimated engagement score
 * Since Nitter RSS doesn't include metrics, estimate based on text features
 */
export function estimateEngagement(tweet: XTweet): number {
  // If we have real metrics, use them
  if (tweet.public_metrics) {
    const m = tweet.public_metrics;
    return m.like_count + m.retweet_count * 2 + m.reply_count * 1.5;
  }

  // Estimate based on content features
  let score = 10; // Base score

  // More cashtags = likely more market-relevant
  const cashtags = extractCashtags(tweet);
  score += cashtags.length * 5;

  // Longer tweets may have more substance
  score += Math.min(tweet.text.length / 50, 5);

  // Keywords that suggest importance
  const impactKeywords = [
    'breaking',
    'just',
    'announce',
    'launch',
    'buy',
    'sell',
    'massive',
    'huge',
    'billion',
    'million',
  ];
  for (const keyword of impactKeywords) {
    if (tweet.text.toLowerCase().includes(keyword)) {
      score += 3;
    }
  }

  return score;
}

/**
 * Check if scraping is available (Nitter or syndication)
 */
export async function isAvailable(): Promise<boolean> {
  // First check Nitter
  const instance = await findWorkingInstance();
  if (instance) {
    return true;
  }

  // Try syndication API as fallback
  try {
    const testTweets = await fetchViaSyndication('twitter', 1);
    return testTweets.length > 0;
  } catch {
    return false;
  }
}

/**
 * Force refresh the instance cache
 */
export function refreshInstanceCache(): void {
  workingInstance = null;
  lastInstanceCheck = 0;
}

// Export as namespace for compatibility
export const nitter = {
  getUserTweets,
  getMultipleUsersTweets,
  extractCashtags,
  estimateEngagement,
  isAvailable,
  refreshInstanceCache,
};
