/**
 * NewsAPI Client
 * ==============
 * Client for interacting with NewsAPI.org.
 * Provides access to news articles from 150,000+ sources.
 *
 * API Documentation: https://newsapi.org/docs
 * Rate Limits: 100 requests/day (free tier)
 *
 * Usage:
 *   import { newsapi } from '@/lib/newsapi';
 *   const articles = await newsapi.searchNews('Apple stock');
 */

import type { NewsAPIArticle, NewsAPIResponse } from '@/types';

const NEWSAPI_BASE_URL = 'https://newsapi.org/v2';

/**
 * Get NewsAPI key from environment
 */
function getApiKey(): string {
  const apiKey = process.env.NEWSAPI_KEY;
  if (!apiKey) {
    throw new Error('NEWSAPI_KEY environment variable is not set');
  }
  return apiKey;
}

/**
 * Make a request to NewsAPI
 */
async function fetchNewsAPI(
  endpoint: string,
  params: Record<string, string> = {}
): Promise<NewsAPIResponse> {
  const url = new URL(`${NEWSAPI_BASE_URL}${endpoint}`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    headers: {
      'X-Api-Key': getApiKey(),
      'Content-Type': 'application/json',
    },
    next: { revalidate: 300 }, // Cache for 5 minutes
  });

  const data: NewsAPIResponse = await response.json();

  if (data.status === 'error') {
    throw new Error(`NewsAPI error: ${data.code} - ${data.message}`);
  }

  return data;
}

/**
 * Search for news articles
 *
 * @param query - Search keywords (supports AND, OR, NOT operators)
 * @param options - Additional search options
 *
 * @example
 * const articles = await newsapi.searchNews('Apple stock', {
 *   from: '2024-01-01',
 *   sortBy: 'publishedAt'
 * });
 */
export async function searchNews(
  query: string,
  options: {
    from?: string; // YYYY-MM-DD
    to?: string; // YYYY-MM-DD
    sortBy?: 'relevancy' | 'popularity' | 'publishedAt';
    language?: string;
    domains?: string; // Comma-separated domains
    pageSize?: number; // Max 100
    page?: number;
  } = {}
): Promise<NewsAPIArticle[]> {
  const params: Record<string, string> = {
    q: query,
    language: options.language || 'en',
    pageSize: (options.pageSize || 20).toString(),
    sortBy: options.sortBy || 'publishedAt',
  };

  if (options.from) params.from = options.from;
  if (options.to) params.to = options.to;
  if (options.domains) params.domains = options.domains;
  if (options.page) params.page = options.page.toString();

  const response = await fetchNewsAPI('/everything', params);
  return response.articles;
}

/**
 * Get top headlines
 *
 * @param options - Search options
 *
 * @example
 * const headlines = await newsapi.getTopHeadlines({
 *   category: 'business',
 *   country: 'us'
 * });
 */
export async function getTopHeadlines(
  options: {
    category?: 'business' | 'technology' | 'general' | 'health' | 'science';
    country?: string;
    query?: string;
    pageSize?: number;
  } = {}
): Promise<NewsAPIArticle[]> {
  const params: Record<string, string> = {
    pageSize: (options.pageSize || 20).toString(),
  };

  if (options.category) params.category = options.category;
  if (options.country) params.country = options.country;
  if (options.query) params.q = options.query;

  const response = await fetchNewsAPI('/top-headlines', params);
  return response.articles;
}

/**
 * Get business news from reliable sources
 */
export async function getBusinessNews(options: {
  from?: string;
  to?: string;
  pageSize?: number;
} = {}): Promise<NewsAPIArticle[]> {
  // Expanded reliable financial news sources (7 → 27 domains)
  const reliableDomains = [
    // Original Core Financial News
    'reuters.com',
    'bloomberg.com',
    'wsj.com',
    'cnbc.com',
    'marketwatch.com',
    'ft.com',
    'barrons.com',

    // Additional Financial News
    'seekingalpha.com',
    'benzinga.com',
    'investors.com',          // Investor's Business Daily
    'fool.com',               // Motley Fool
    'morningstar.com',
    'thestreet.com',
    'investopedia.com',

    // Tech/Business News
    'techcrunch.com',
    'theverge.com',
    'arstechnica.com',
    'wired.com',
    'businessinsider.com',
    'forbes.com',
    'fortune.com',

    // Economic News
    'economist.com',

    // Crypto/Tech Finance (impacts tech stocks)
    'coindesk.com',
    'cointelegraph.com',
    'decrypt.co',
  ].join(',');

  return searchNews('stock OR market OR earnings OR trading OR IPO OR acquisition OR dividend', {
    domains: reliableDomains,
    from: options.from,
    to: options.to,
    pageSize: options.pageSize || 100, // Increased from 50 to 100
    sortBy: 'publishedAt',
  });
}

/**
 * Search for news about specific companies
 *
 * @param tickers - Array of stock tickers to search for
 */
export async function getCompanyNews(
  tickers: string[],
  options: {
    from?: string;
    to?: string;
    pageSize?: number;
  } = {}
): Promise<NewsAPIArticle[]> {
  // Build query with company tickers
  const query = tickers.map((t) => `"${t}"`).join(' OR ');

  return searchNews(query, {
    ...options,
    sortBy: 'publishedAt',
  });
}

/**
 * Get date string for N days ago
 */
export function getDateNDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

/**
 * Get today's date string
 */
export function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Filter articles to remove duplicates by URL
 */
export function deduplicateArticles(articles: NewsAPIArticle[]): NewsAPIArticle[] {
  const seen = new Set<string>();
  return articles.filter((article) => {
    if (seen.has(article.url)) {
      return false;
    }
    seen.add(article.url);
    return true;
  });
}

// Export as namespace for cleaner imports
export const newsapi = {
  searchNews,
  getTopHeadlines,
  getBusinessNews,
  getCompanyNews,
  getDateNDaysAgo,
  getTodayDate,
  deduplicateArticles,
};
