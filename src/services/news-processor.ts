/**
 * News Processor Service
 * ======================
 * Handles fetching, processing, and storing news articles.
 * Integrates with NewsAPI, Finnhub, and Gemini for analysis.
 *
 * Usage:
 *   import { newsProcessor } from '@/services/news-processor';
 *   const result = await newsProcessor.fetchAndProcessNews();
 */

import { db } from '@/lib/db';
import { newsapi } from '@/lib/newsapi';
import { finnhub } from '@/lib/finnhub';
import { rss } from '@/lib/rss';
import { secEdgar } from '@/lib/sec-edgar';
import { earnings } from '@/lib/earnings';
import { youtube } from '@/lib/youtube';
import { deepseek } from '@/lib/deepseek';
import { gemini } from '@/lib/gemini';
import { companyDiscovery } from '@/services/company-discovery';
import type {
  NewsAPIArticle,
  FinnhubNewsArticle,
  ClaudeNewsAnalysis,
  EventCategory,
} from '@/types';

// ===========================================
// Types
// ===========================================

interface ProcessedArticle {
  sourceId: string;
  externalId: string | null;
  title: string;
  content: string | null;
  summary: string | null;
  url: string;
  imageUrl: string | null;
  author: string | null;
  publishedAt: Date;
  analysis: ClaudeNewsAnalysis | null;
}

interface NewsProcessorResult {
  articlesFound: number;
  articlesSaved: number;
  articlesProcessed: number;
  eventsCreated: number;
  impactsCreated: number;
  companiesDiscovered: number;
  errors: string[];
}

// ===========================================
// Helper Functions
// ===========================================

/**
 * Convert NewsAPI article to our format
 */
function normalizeNewsAPIArticle(article: NewsAPIArticle): ProcessedArticle {
  return {
    sourceId: 'newsapi',
    externalId: null,
    title: article.title,
    content: article.content || article.description,
    summary: null,
    url: article.url,
    imageUrl: article.urlToImage,
    author: article.author,
    publishedAt: new Date(article.publishedAt),
    analysis: null,
  };
}

/**
 * Convert Finnhub article to our format
 */
function normalizeFinnhubArticle(article: FinnhubNewsArticle): ProcessedArticle {
  return {
    sourceId: 'finnhub',
    externalId: article.id.toString(),
    title: article.headline,
    content: article.summary,
    summary: null,
    url: article.url,
    imageUrl: article.image || null,
    author: null,
    publishedAt: new Date(article.datetime * 1000),
    analysis: null,
  };
}

/**
 * Convert RSS article to our format
 */
function normalizeRSSArticle(article: NewsAPIArticle): ProcessedArticle {
  return {
    sourceId: 'rss',
    externalId: null,
    title: article.title,
    content: article.content || article.description,
    summary: null,
    url: article.url,
    imageUrl: article.urlToImage,
    author: article.author,
    publishedAt: new Date(article.publishedAt),
    analysis: null,
  };
}

/**
 * Convert SEC filing to our format
 */
function normalizeSECArticle(article: NewsAPIArticle): ProcessedArticle {
  return {
    sourceId: 'sec-edgar',
    externalId: null,
    title: article.title,
    content: article.content || article.description,
    summary: null,
    url: article.url,
    imageUrl: article.urlToImage,
    author: article.author || 'SEC',
    publishedAt: new Date(article.publishedAt),
    analysis: null,
  };
}

/**
 * Convert earnings report to our format
 */
function normalizeEarningsArticle(article: NewsAPIArticle): ProcessedArticle {
  return {
    sourceId: 'earnings',
    externalId: null,
    title: article.title,
    content: article.content || article.description,
    summary: null,
    url: article.url,
    imageUrl: article.urlToImage,
    author: article.author || 'Earnings Calendar',
    publishedAt: new Date(article.publishedAt),
    analysis: null,
  };
}

/**
 * Convert YouTube video to our format
 */
function normalizeYouTubeArticle(article: NewsAPIArticle): ProcessedArticle {
  return {
    sourceId: 'youtube',
    externalId: null,
    title: article.title,
    content: article.content || article.description,
    summary: null,
    url: article.url,
    imageUrl: article.urlToImage,
    author: article.author || 'YouTube',
    publishedAt: new Date(article.publishedAt),
    analysis: null,
  };
}

/**
 * Deduplicate articles by URL
 */
function deduplicateArticles(articles: ProcessedArticle[]): ProcessedArticle[] {
  const seen = new Set<string>();
  return articles.filter((article) => {
    // Normalize URL by removing trailing slashes and query params
    const normalizedUrl = article.url.split('?')[0].replace(/\/$/, '');
    if (seen.has(normalizedUrl)) {
      return false;
    }
    seen.add(normalizedUrl);
    return true;
  });
}

/**
 * Get date string N days ago in YYYY-MM-DD format
 */
function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

// ===========================================
// Main Functions
// ===========================================

/**
 * Fetch news from all sources
 */
export async function fetchAllNews(): Promise<ProcessedArticle[]> {
  const articles: ProcessedArticle[] = [];
  const today = getTodayDate();
  const yesterday = getDateDaysAgo(1);

  // Fetch from NewsAPI - business headlines
  try {
    const newsApiArticles = await newsapi.getTopHeadlines({
      category: 'business',
      country: 'us',
      pageSize: 50,
    });
    articles.push(...newsApiArticles.map(normalizeNewsAPIArticle));
    console.log(`[NewsAPI] Fetched ${newsApiArticles.length} headlines`);
  } catch (error) {
    console.error('[NewsAPI] Failed to fetch headlines:', error);
  }

  // Fetch from NewsAPI - technology headlines
  try {
    const techArticles = await newsapi.getTopHeadlines({
      category: 'technology',
      country: 'us',
      pageSize: 30,
    });
    articles.push(...techArticles.map(normalizeNewsAPIArticle));
    console.log(`[NewsAPI] Fetched ${techArticles.length} tech headlines`);
  } catch (error) {
    console.error('[NewsAPI] Failed to fetch tech headlines:', error);
  }

  // Fetch from Finnhub - general market news
  try {
    const finnhubArticles = await finnhub.getMarketNews('general');
    articles.push(...finnhubArticles.slice(0, 50).map(normalizeFinnhubArticle));
    console.log(`[Finnhub] Fetched ${finnhubArticles.length} market news`);
  } catch (error) {
    console.error('[Finnhub] Failed to fetch market news:', error);
  }

  // Fetch company-specific news for top companies
  const topTickers = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META'];
  for (const ticker of topTickers) {
    try {
      const companyNews = await finnhub.getCompanyNews(ticker, yesterday, today);
      articles.push(...companyNews.slice(0, 10).map(normalizeFinnhubArticle));
      console.log(`[Finnhub] Fetched ${companyNews.length} news for ${ticker}`);
      // Small delay to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`[Finnhub] Failed to fetch news for ${ticker}:`, error);
    }
  }

  // Fetch from RSS feeds (unlimited, no API rate limits!)
  try {
    console.log('[RSS] Starting feed fetch...');
    const rssArticles = await rss.fetchAllFeeds();
    articles.push(...rssArticles.map(normalizeRSSArticle));
    console.log(`[RSS] Fetched ${rssArticles.length} articles from all feeds`);
  } catch (error) {
    console.error('[RSS] Failed to fetch RSS feeds:', error);
  }

  // Fetch from SEC EDGAR (8-K material events + Form 4 insider trading)
  try {
    console.log('[SEC] Fetching recent filings...');
    const secFilings = await secEdgar.getAllRecentFilings(50);
    articles.push(...secFilings.map(normalizeSECArticle));
    console.log(`[SEC] Fetched ${secFilings.length} filings (8-K + Form 4)`);
  } catch (error) {
    console.error('[SEC] Failed to fetch SEC filings:', error);
  }

  // Fetch earnings reports (recent + upcoming)
  try {
    console.log('[Earnings] Fetching earnings calendar...');
    const earningsData = await earnings.getAllEarnings();
    articles.push(...earningsData.map(normalizeEarningsArticle));
    console.log(`[Earnings] Fetched ${earningsData.length} earnings reports`);
  } catch (error) {
    console.error('[Earnings] Failed to fetch earnings data:', error);
  }

  // Fetch YouTube financial content (optional - requires API key)
  try {
    if (process.env.YOUTUBE_API_KEY) {
      console.log('[YouTube] Fetching market news videos...');
      const youtubeVideos = await youtube.getTodaysMarketNews();
      articles.push(...youtubeVideos.map(normalizeYouTubeArticle));
      console.log(`[YouTube] Fetched ${youtubeVideos.length} videos`);
    } else {
      console.log('[YouTube] Skipped - no API key configured (optional)');
    }
  } catch (error) {
    console.error('[YouTube] Failed to fetch videos:', error);
  }

  // Deduplicate
  const uniqueArticles = deduplicateArticles(articles);
  console.log(`[Total] ${articles.length} articles fetched, ${uniqueArticles.length} unique`);

  return uniqueArticles;
}

/**
 * Save articles to database (skip existing ones)
 */
export async function saveArticles(
  articles: ProcessedArticle[]
): Promise<{ saved: number; skipped: number }> {
  let saved = 0;
  let skipped = 0;

  for (const article of articles) {
    try {
      // Check if article already exists
      const existing = await db.newsArticle.findFirst({
        where: {
          OR: [
            { url: article.url },
            { sourceId: article.sourceId, externalId: article.externalId },
          ],
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Save new article
      await db.newsArticle.create({
        data: {
          sourceId: article.sourceId,
          externalId: article.externalId,
          title: article.title,
          content: article.content,
          url: article.url,
          imageUrl: article.imageUrl,
          author: article.author,
          publishedAt: article.publishedAt,
          processed: false,
        },
      });
      saved++;
    } catch (error) {
      console.error(`[DB] Failed to save article: ${article.title}`, error);
    }
  }

  console.log(`[DB] Saved ${saved} new articles, skipped ${skipped} existing`);
  return { saved, skipped };
}

/**
 * Process unprocessed articles with AI
 */
export async function processUnprocessedArticles(
  limit: number = 20
): Promise<{ processed: number; impacts: number; companiesDiscovered: number }> {
  // Get unprocessed articles
  const articles = await db.newsArticle.findMany({
    where: { processed: false },
    orderBy: { publishedAt: 'desc' },
    take: limit,
  });

  console.log(`[AI] Processing ${articles.length} unprocessed articles`);

  let processed = 0;
  let impacts = 0;
  let companiesDiscovered = 0;

  // Get all company tickers for matching (will be updated as we discover)
  const companies = await db.company.findMany({
    where: { isActive: true },
    select: { id: true, ticker: true, name: true },
  });
  const tickerToCompany = new Map(companies.map((c) => [c.ticker, c]));

  for (const article of articles) {
    try {
      // Analyze with AI (prefer DeepSeek if available, fall back to Gemini)
      let analysis;
      if (process.env.DEEPSEEK_API_KEY) {
        try {
          analysis = await deepseek.analyzeNewsArticle(
            article.title,
            article.content || article.title
          );
        } catch (deepseekError) {
          console.log('[AI] DeepSeek failed, falling back to Gemini:', deepseekError);
          analysis = await gemini.analyzeNewsArticle(
            article.title,
            article.content || article.title
          );
        }
      } else {
        analysis = await gemini.analyzeNewsArticle(
          article.title,
          article.content || article.title
        );
      }

      // Update article with summary
      await db.newsArticle.update({
        where: { id: article.id },
        data: {
          summary: analysis.summary,
          processed: true,
        },
      });

      // Create impacts for mentioned companies (auto-discover if not found)
      for (const company of analysis.companies) {
        let matchedCompany = tickerToCompany.get(company.ticker);

        // Auto-discover company if not in database
        if (!matchedCompany && company.ticker) {
          console.log(`[Discovery] Attempting to discover: ${company.ticker}`);
          const discovered = await companyDiscovery.discoverCompany(company.ticker);
          if (discovered) {
            matchedCompany = { id: discovered.id, ticker: discovered.ticker, name: discovered.name };
            tickerToCompany.set(discovered.ticker, matchedCompany);
            if (discovered.isNew) {
              companiesDiscovered++;
              console.log(`[Discovery] Added new company: ${discovered.ticker} - ${discovered.name}`);
            }
          }
        }

        if (matchedCompany) {
          await db.newsImpact.create({
            data: {
              companyId: matchedCompany.id,
              articleId: article.id,
              sentiment: company.sentiment,
              confidence: company.confidence,
              impactScore: calculateImpactScore(
                company.sentiment,
                company.confidence,
                analysis.importance
              ),
              reason: company.reason,
            },
          });
          impacts++;
        }
      }

      processed++;
      console.log(`[AI] Processed: ${article.title.substring(0, 50)}...`);

      // Small delay to respect rate limits
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`[AI] Failed to process: ${article.title}`, error);
      // Mark as processed to avoid retrying bad articles
      await db.newsArticle.update({
        where: { id: article.id },
        data: { processed: true },
      });
    }
  }

  console.log(`[AI] Processed ${processed} articles, created ${impacts} impacts, discovered ${companiesDiscovered} new companies`);
  return { processed, impacts, companiesDiscovered };
}

/**
 * Calculate impact score based on sentiment, confidence, and importance
 */
function calculateImpactScore(
  sentiment: string,
  confidence: number,
  importance: number
): number {
  const sentimentMultiplier =
    sentiment === 'positive' ? 1 : sentiment === 'negative' ? -1 : 0;
  return sentimentMultiplier * confidence * importance;
}

/**
 * Cluster recent articles into events
 */
export async function clusterIntoEvents(hoursBack: number = 24): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setHours(cutoffDate.getHours() - hoursBack);

  // Get unassigned articles from the last N hours
  const articles = await db.newsArticle.findMany({
    where: {
      eventId: null,
      processed: true,
      publishedAt: { gte: cutoffDate },
    },
    orderBy: { publishedAt: 'desc' },
    take: 50,
  });

  if (articles.length === 0) {
    console.log('[Events] No unassigned articles to cluster');
    return 0;
  }

  // Simple clustering: group by similar titles using Gemini
  // For MVP, we'll create one event per important article
  // TODO: Implement proper clustering with embeddings

  let eventsCreated = 0;
  const importantArticles = articles.filter((a) => a.summary);

  // Take top 10 most important articles and create events
  const topArticles = importantArticles.slice(0, 10);

  for (const article of topArticles) {
    try {
      // Create event from single article for now
      const event = await db.newsEvent.create({
        data: {
          summary: article.summary || article.title,
          category: 'other', // Will be updated by summarizeEvent
          importance: 0.5,
        },
      });

      // Assign article to event
      await db.newsArticle.update({
        where: { id: article.id },
        data: { eventId: event.id },
      });

      // Copy impacts to event level
      await db.newsImpact.updateMany({
        where: { articleId: article.id },
        data: { eventId: event.id },
      });

      eventsCreated++;
    } catch (error) {
      console.error(`[Events] Failed to create event for: ${article.title}`, error);
    }
  }

  console.log(`[Events] Created ${eventsCreated} events`);
  return eventsCreated;
}

/**
 * Full news processing pipeline
 */
export async function fetchAndProcessNews(): Promise<NewsProcessorResult> {
  const result: NewsProcessorResult = {
    articlesFound: 0,
    articlesSaved: 0,
    articlesProcessed: 0,
    eventsCreated: 0,
    impactsCreated: 0,
    companiesDiscovered: 0,
    errors: [],
  };

  try {
    // Step 1: Fetch news from all sources
    console.log('\n=== Step 1: Fetching News ===');
    const articles = await fetchAllNews();
    result.articlesFound = articles.length;

    // Step 2: Save to database
    console.log('\n=== Step 2: Saving to Database ===');
    const { saved } = await saveArticles(articles);
    result.articlesSaved = saved;

    // Step 3: Process with AI (includes auto-discovery)
    console.log('\n=== Step 3: AI Processing + Company Discovery ===');
    const { processed, impacts, companiesDiscovered } = await processUnprocessedArticles(500);
    result.articlesProcessed = processed;
    result.impactsCreated = impacts;
    result.companiesDiscovered = companiesDiscovered;

    // Step 4: Cluster into events
    console.log('\n=== Step 4: Event Clustering ===');
    const eventsCreated = await clusterIntoEvents(24);
    result.eventsCreated = eventsCreated;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.errors.push(errorMessage);
    console.error('[Pipeline] Error:', errorMessage);
  }

  return result;
}

/**
 * Get top news events for dashboard
 */
export async function getTopNewsEvents(limit: number = 10) {
  const events = await db.newsEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      articles: {
        take: 3,
        orderBy: { publishedAt: 'desc' },
      },
      impacts: {
        include: {
          company: true,
        },
      },
    },
  });

  return events.map((event) => ({
    id: event.id,
    summary: event.summary,
    category: event.category as EventCategory,
    importance: event.importance,
    createdAt: event.createdAt,
    articleCount: event.articles.length,
    affectedCompanies: event.impacts.map((i) => ({
      ticker: i.company.ticker,
      name: i.company.name,
      sentiment: i.sentiment,
      impactScore: i.impactScore,
    })),
  }));
}

// Export as namespace
export const newsProcessor = {
  fetchAllNews,
  saveArticles,
  processUnprocessedArticles,
  clusterIntoEvents,
  fetchAndProcessNews,
  getTopNewsEvents,
};
