/**
 * Social RSS Feed Aggregator
 * ==========================
 * Fetches social/influencer-related news from RSS feeds.
 * Alternative to direct Twitter/StockTwits scraping.
 *
 * Sources include:
 * - MarketWatch social media coverage
 * - Yahoo Finance trending
 * - Benzinga/Seeking Alpha social mentions
 *
 * Usage:
 *   import { socialRSS } from '@/lib/social-rss';
 *   const posts = await socialRSS.fetchAll();
 */

import type { XTweet } from '@/types';

// RSS Feed sources for social/influencer coverage
const RSS_SOURCES = [
  {
    name: 'MarketWatch Top Stories',
    url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories',
    weight: 0.8,
  },
  {
    name: 'MarketWatch Markets',
    url: 'https://feeds.content.dowjones.io/public/rss/mw_marketpulse',
    weight: 0.7,
  },
  {
    name: 'CNBC Top News',
    url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html',
    weight: 0.8,
  },
  {
    name: 'Investing.com News',
    url: 'https://www.investing.com/rss/news.rss',
    weight: 0.7,
  },
];

// Keywords that indicate social/influencer-related content
const INFLUENCER_KEYWORDS = [
  'elon musk',
  'musk',
  '@elonmusk',
  'trump',
  'donald trump',
  'cathie wood',
  'jim cramer',
  'warren buffett',
  'michael saylor',
  'tweet',
  'tweeted',
  'twitter',
  'x post',
  'social media',
  'truth social',
  'viral',
];

const SENTIMENT_POSITIVE_KEYWORDS = [
  'bullish',
  'surge',
  'soar',
  'rally',
  'gain',
  'jump',
  'boost',
  'upgrade',
  'buy',
  'long',
  'moon',
  'breakout',
];

const SENTIMENT_NEGATIVE_KEYWORDS = [
  'bearish',
  'crash',
  'plunge',
  'fall',
  'drop',
  'decline',
  'downgrade',
  'sell',
  'short',
  'dump',
  'tank',
];

interface RSSItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  source: string;
  weight: number;
}

/**
 * Parse RSS XML to extract items
 */
function parseRSS(xml: string, source: string, weight: number): RSSItem[] {
  const items: RSSItem[] = [];

  // Extract all items
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;

  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];

    // Extract fields
    const titleMatch = item.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
    const linkMatch = item.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/);
    const descMatch = item.match(
      /<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/
    );
    const pubDateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/);

    if (!titleMatch) continue;

    const title = titleMatch[1]
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();

    const description = descMatch
      ? descMatch[1]
          .replace(/<[^>]*>/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&nbsp;/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      : '';

    items.push({
      title,
      link: linkMatch ? linkMatch[1].trim() : '',
      description,
      pubDate: pubDateMatch ? pubDateMatch[1].trim() : new Date().toISOString(),
      source,
      weight,
    });
  }

  return items;
}

/**
 * Check if an RSS item is related to influencers/social media
 */
function isInfluencerRelated(item: RSSItem): boolean {
  const text = `${item.title} ${item.description}`.toLowerCase();
  return INFLUENCER_KEYWORDS.some((keyword) => text.includes(keyword));
}

/**
 * Extract tickers from text
 */
function extractTickers(text: string): string[] {
  // Match $TICKER format
  const cashtagMatches = text.match(/\$([A-Z]{1,5})\b/g) || [];
  const tickers = cashtagMatches.map((m) => m.slice(1));

  // Also match common company names
  const companyPatterns: [RegExp, string][] = [
    [/\bapple\b/i, 'AAPL'],
    [/\btesla\b/i, 'TSLA'],
    [/\bmicrosoft\b/i, 'MSFT'],
    [/\bamazon\b/i, 'AMZN'],
    [/\bgoogle\b|\balphabet\b/i, 'GOOGL'],
    [/\bmeta\b|\bfacebook\b/i, 'META'],
    [/\bnvidia\b/i, 'NVDA'],
    [/\bnetflix\b/i, 'NFLX'],
    [/\bamd\b/i, 'AMD'],
    [/\bintel\b/i, 'INTC'],
  ];

  for (const [pattern, ticker] of companyPatterns) {
    if (pattern.test(text) && !tickers.includes(ticker)) {
      tickers.push(ticker);
    }
  }

  return [...new Set(tickers)];
}

/**
 * Detect sentiment from text
 */
function detectSentiment(text: string): 'positive' | 'negative' | 'neutral' {
  const lowerText = text.toLowerCase();

  const positiveScore = SENTIMENT_POSITIVE_KEYWORDS.filter((k) => lowerText.includes(k)).length;
  const negativeScore = SENTIMENT_NEGATIVE_KEYWORDS.filter((k) => lowerText.includes(k)).length;

  if (positiveScore > negativeScore) return 'positive';
  if (negativeScore > positiveScore) return 'negative';
  return 'neutral';
}

/**
 * Convert RSS item to XTweet format
 */
function itemToTweet(item: RSSItem): XTweet {
  const text = `${item.title}\n\n${item.description}`.substring(0, 280);
  const tickers = extractTickers(text);

  return {
    id: Buffer.from(item.link).toString('base64').substring(0, 20),
    text,
    created_at: new Date(item.pubDate).toISOString(),
    entities: {
      cashtags: tickers.map((tag, i) => ({
        start: i * 6,
        end: i * 6 + tag.length + 1,
        tag,
      })),
    },
    public_metrics: {
      like_count: Math.round(item.weight * 100), // Use weight as proxy for engagement
      retweet_count: 0,
      reply_count: 0,
      quote_count: 0,
    },
  };
}

/**
 * Fetch RSS feed with timeout
 */
async function fetchRSS(url: string, timeout: number = 10000): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MarketPredictor/1.0)',
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Fetch all RSS feeds and extract social/influencer posts
 */
export async function fetchAll(): Promise<XTweet[]> {
  const allTweets: XTweet[] = [];

  for (const source of RSS_SOURCES) {
    try {
      console.log(`[SocialRSS] Fetching ${source.name}...`);
      const xml = await fetchRSS(source.url);
      const items = parseRSS(xml, source.name, source.weight);

      // Filter for influencer-related content
      const influencerItems = items.filter(isInfluencerRelated);
      const tweets = influencerItems.map(itemToTweet);

      allTweets.push(...tweets);
      console.log(
        `[SocialRSS] ${source.name}: ${items.length} items, ${influencerItems.length} influencer-related`
      );
    } catch (error) {
      console.error(`[SocialRSS] Failed to fetch ${source.name}:`, error);
    }

    // Small delay between sources
    await new Promise((r) => setTimeout(r, 500));
  }

  // Deduplicate by ID
  const seen = new Set<string>();
  const unique = allTweets.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });

  console.log(`[SocialRSS] Total: ${unique.length} unique influencer-related posts`);
  return unique;
}

/**
 * Fetch all RSS feeds (no filtering)
 */
export async function fetchAllNews(): Promise<XTweet[]> {
  const allTweets: XTweet[] = [];

  for (const source of RSS_SOURCES) {
    try {
      const xml = await fetchRSS(source.url);
      const items = parseRSS(xml, source.name, source.weight);
      const tweets = items.slice(0, 20).map(itemToTweet); // Limit per source
      allTweets.push(...tweets);
    } catch (error) {
      console.error(`[SocialRSS] Failed to fetch ${source.name}:`, error);
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  return allTweets;
}

/**
 * Check if RSS feeds are available
 */
export async function isAvailable(): Promise<boolean> {
  try {
    // Try Yahoo Finance as test
    const xml = await fetchRSS(RSS_SOURCES[0].url, 5000);
    return xml.includes('<rss') || xml.includes('<channel');
  } catch {
    return false;
  }
}

// Export as namespace
export const socialRSS = {
  fetchAll,
  fetchAllNews,
  isAvailable,
  extractTickers,
  detectSentiment,
};
