/**
 * RSS Feed Parser
 * ===============
 * Fetches and parses RSS/Atom feeds from financial news sources.
 * No API keys required - RSS is free and unlimited!
 *
 * Benefits:
 * - Unlimited requests (no rate limits)
 * - Real-time news updates
 * - Diverse sources beyond NewsAPI
 *
 * Usage:
 *   import { rss } from '@/lib/rss';
 *   const articles = await rss.fetchAllFeeds();
 */

import type { NewsAPIArticle } from '@/types';

// ===========================================
// RSS Feed Sources Configuration
// ===========================================

export const RSS_FEEDS = {
  // Major Financial News
  yahooFinance: {
    name: 'Yahoo Finance',
    url: 'https://finance.yahoo.com/news/rssindex',
    category: 'financial',
    weight: 0.8,
  },
  cnbc: {
    name: 'CNBC Top News',
    url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html',
    category: 'financial',
    weight: 0.9,
  },
  marketWatch: {
    name: 'MarketWatch Top Stories',
    url: 'https://www.marketwatch.com/rss/topstories',
    category: 'financial',
    weight: 0.85,
  },
  investingCom: {
    name: 'Investing.com News',
    url: 'https://www.investing.com/rss/news.rss',
    category: 'financial',
    weight: 0.8,
  },

  // Stock-Focused News
  benzinga: {
    name: 'Benzinga',
    url: 'https://www.benzinga.com/feed',
    category: 'stocks',
    weight: 0.75,
  },
  seekingAlpha: {
    name: 'Seeking Alpha Market Currents',
    url: 'https://seekingalpha.com/market_currents.xml',
    category: 'stocks',
    weight: 0.8,
  },

  // Reddit Finance RSS (Public)
  redditStocks: {
    name: 'Reddit r/stocks',
    url: 'https://www.reddit.com/r/stocks/.rss',
    category: 'social',
    weight: 0.7,
  },
  redditWSB: {
    name: 'Reddit r/wallstreetbets',
    url: 'https://www.reddit.com/r/wallstreetbets/.rss',
    category: 'social',
    weight: 0.75,
  },
  redditInvesting: {
    name: 'Reddit r/investing',
    url: 'https://www.reddit.com/r/investing/.rss',
    category: 'social',
    weight: 0.65,
  },

  // Alternative Data
  tradingView: {
    name: 'TradingView Ideas',
    url: 'https://www.tradingview.com/feed/',
    category: 'analysis',
    weight: 0.7,
  },

  // Crypto/Tech (impacts tech stocks)
  coinDesk: {
    name: 'CoinDesk',
    url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
    category: 'crypto',
    weight: 0.7,
  },
  techCrunch: {
    name: 'TechCrunch',
    url: 'https://techcrunch.com/feed/',
    category: 'tech',
    weight: 0.75,
  },
} as const;

export type RSSFeedName = keyof typeof RSS_FEEDS;

// ===========================================
// Types
// ===========================================

interface RSSItem {
  title: string;
  link: string;
  description?: string;
  content?: string;
  pubDate?: string;
  author?: string;
  category?: string[];
}

// ===========================================
// RSS Parsing Functions
// ===========================================

/**
 * Fetch and parse an RSS feed
 */
async function fetchFeed(feedUrl: string, feedName: string): Promise<NewsAPIArticle[]> {
  try {
    console.log(`[RSS] Fetching ${feedName}...`);

    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'MarketPredictor/1.0',
        Accept: 'application/rss+xml, application/xml, text/xml',
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const xmlText = await response.text();
    const articles = parseRSS(xmlText, feedName);

    console.log(`[RSS] ${feedName}: Found ${articles.length} articles`);
    return articles;
  } catch (error) {
    console.error(`[RSS] Error fetching ${feedName}:`, error);
    return [];
  }
}

/**
 * Parse RSS/Atom XML to extract articles
 */
function parseRSS(xmlText: string, sourceName: string): NewsAPIArticle[] {
  const articles: NewsAPIArticle[] = [];

  try {
    // Extract all <item> or <entry> elements (RSS vs Atom)
    const itemRegex = /<(?:item|entry)>([\s\S]*?)<\/(?:item|entry)>/gi;
    const items = xmlText.match(itemRegex) || [];

    for (const itemXml of items) {
      const article = parseRSSItem(itemXml, sourceName);
      if (article) {
        articles.push(article);
      }
    }
  } catch (error) {
    console.error(`[RSS] Error parsing ${sourceName}:`, error);
  }

  return articles;
}

/**
 * Parse a single RSS item
 */
function parseRSSItem(itemXml: string, sourceName: string): NewsAPIArticle | null {
  try {
    // Helper to extract content between XML tags
    const extractTag = (tag: string): string | null => {
      // Try CDATA first
      const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i');
      const cdataMatch = itemXml.match(cdataRegex);
      if (cdataMatch) return cdataMatch[1].trim();

      // Try regular tag
      const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
      const match = itemXml.match(regex);
      return match ? match[1].trim() : null;
    };

    const title = extractTag('title');
    const link = extractTag('link') || extractTag('guid');
    const description = extractTag('description') || extractTag('summary');
    const content = extractTag('content:encoded') || extractTag('content') || description;
    const pubDate = extractTag('pubDate') || extractTag('published') || extractTag('updated');
    const author = extractTag('author') || extractTag('dc:creator');

    if (!title || !link) {
      return null; // Skip items without title or link
    }

    // Clean HTML tags from description/content
    const cleanText = (text: string | null): string => {
      if (!text) return '';
      return text
        .replace(/<[^>]+>/g, '') // Remove HTML tags
        .replace(/&[a-z]+;/gi, ' ') // Remove HTML entities
        .trim()
        .substring(0, 5000); // Limit length
    };

    return {
      source: {
        id: sourceName.toLowerCase().replace(/\s+/g, '-'),
        name: sourceName,
      },
      author: author || sourceName,
      title: cleanText(title),
      description: cleanText(description),
      url: link,
      urlToImage: null,
      publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      content: cleanText(content),
    };
  } catch (error) {
    console.error('[RSS] Error parsing RSS item:', error);
    return null;
  }
}

// ===========================================
// Public API
// ===========================================

/**
 * Fetch articles from a specific RSS feed
 */
export async function fetchSingleFeed(feedKey: RSSFeedName): Promise<NewsAPIArticle[]> {
  const feed = RSS_FEEDS[feedKey];
  return fetchFeed(feed.url, feed.name);
}

/**
 * Fetch articles from all RSS feeds
 */
export async function fetchAllFeeds(): Promise<NewsAPIArticle[]> {
  const allArticles: NewsAPIArticle[] = [];
  const feedKeys = Object.keys(RSS_FEEDS) as RSSFeedName[];

  console.log(`[RSS] Fetching from ${feedKeys.length} RSS feeds...`);

  // Fetch feeds in batches to avoid overwhelming the system
  const batchSize = 3;
  for (let i = 0; i < feedKeys.length; i += batchSize) {
    const batch = feedKeys.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((key) => fetchSingleFeed(key))
    );

    for (const articles of batchResults) {
      allArticles.push(...articles);
    }

    // Small delay between batches
    if (i + batchSize < feedKeys.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  console.log(`[RSS] Total articles fetched: ${allArticles.length}`);

  // Remove duplicates by URL
  const uniqueArticles = deduplicateByUrl(allArticles);
  console.log(`[RSS] Unique articles after deduplication: ${uniqueArticles.length}`);

  return uniqueArticles;
}

/**
 * Fetch articles from specific categories
 */
export async function fetchByCategory(
  category: 'financial' | 'stocks' | 'social' | 'analysis' | 'crypto' | 'tech'
): Promise<NewsAPIArticle[]> {
  const allArticles: NewsAPIArticle[] = [];
  const feedKeys = Object.keys(RSS_FEEDS) as RSSFeedName[];

  const categoryFeeds = feedKeys.filter((key) => RSS_FEEDS[key].category === category);

  console.log(`[RSS] Fetching ${categoryFeeds.length} feeds for category: ${category}`);

  for (const key of categoryFeeds) {
    const articles = await fetchSingleFeed(key);
    allArticles.push(...articles);

    // Rate limit between feeds
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  return deduplicateByUrl(allArticles);
}

/**
 * Get feed information
 */
export function getFeedInfo(feedKey: RSSFeedName) {
  return RSS_FEEDS[feedKey];
}

/**
 * Get all feed names
 */
export function getAllFeedNames(): string[] {
  return Object.values(RSS_FEEDS).map((feed) => feed.name);
}

/**
 * Remove duplicate articles by URL
 */
function deduplicateByUrl(articles: NewsAPIArticle[]): NewsAPIArticle[] {
  const seen = new Set<string>();
  return articles.filter((article) => {
    if (seen.has(article.url)) {
      return false;
    }
    seen.add(article.url);
    return true;
  });
}

/**
 * Check if RSS parsing is available
 */
export async function isAvailable(): Promise<boolean> {
  try {
    // Test with a reliable feed
    const articles = await fetchFeed(RSS_FEEDS.marketWatch.url, 'Test');
    return articles.length > 0;
  } catch {
    return false;
  }
}

// Export as namespace
export const rss = {
  fetchSingleFeed,
  fetchAllFeeds,
  fetchByCategory,
  getFeedInfo,
  getAllFeedNames,
  isAvailable,
  RSS_FEEDS,
};
