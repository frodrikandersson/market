/**
 * Google Gemini API Client
 * ========================
 * Client for interacting with Google's Gemini AI for news analysis and sentiment.
 * Used for summarization, entity extraction, and sentiment analysis.
 *
 * This is the PRIMARY AI client for testing due to Gemini's generous free tier.
 * Claude client is kept for future production use.
 *
 * API Documentation: https://ai.google.dev/docs
 * Free Tier: 60 requests/minute, 1500 requests/day
 *
 * Usage:
 *   import { gemini } from '@/lib/gemini';
 *   const analysis = await gemini.analyzeNewsArticle(title, content);
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  ClaudeNewsAnalysis,
  ClaudeSocialAnalysis,
  Sentiment,
  EventCategory,
} from '@/types';

// Note: We reuse the same types as Claude for consistency
// The response format is identical

/**
 * Get Gemini API key from environment
 */
function getApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }
  return apiKey;
}

// Initialize client lazily to avoid errors when API key is not set
let genAI: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(getApiKey());
  }
  return genAI;
}

// Model to use - Gemini 2.0 Flash for fast, free AI analysis
const MODEL_NAME = 'gemini-2.0-flash';

/**
 * Analyze a news article for stock market impact
 *
 * @param title - Article headline
 * @param content - Article body text
 * @returns Analysis with summary, affected companies, and sentiment
 *
 * @example
 * const analysis = await gemini.analyzeNewsArticle(
 *   'Apple Vision Pro sales exceed expectations',
 *   'Apple Inc. reported strong sales of its Vision Pro headset...'
 * );
 */
export async function analyzeNewsArticle(
  title: string,
  content: string
): Promise<ClaudeNewsAnalysis> {
  const model = getClient().getGenerativeModel({ model: MODEL_NAME });

  const prompt = `Analyze this news article for stock market impact. Be critical and realistic about sentiment.

ARTICLE TITLE: ${title}

ARTICLE CONTENT:
${content}

Provide your analysis in the following JSON format (and ONLY JSON, no other text, no markdown code blocks):
{
  "summary": "2-3 sentence summary of the key points",
  "companies": [
    {
      "ticker": "AAPL",
      "name": "Apple Inc.",
      "sentiment": "positive",
      "confidence": 0.85,
      "reason": "Brief explanation of why this sentiment"
    }
  ],
  "category": "earnings|regulation|merger_acquisition|product|macro|disaster|legal|executive|other",
  "importance": 0.75
}

CRITICAL SENTIMENT GUIDELINES:
- NEGATIVE sentiment for: layoffs, losses, missed earnings, lawsuits, scandals, SEC investigations, product failures, recalls, data breaches, executive departures, downgrades, price target cuts, declining revenue, competitive losses, regulatory fines
- POSITIVE sentiment for: beat earnings, new products, partnerships, acquisitions, upgrades, price target raises, growth, market share gains, positive guidance
- NEUTRAL sentiment for: routine announcements, mixed results, unchanged outlook

Other guidelines:
- Only include publicly traded companies with US ticker symbols
- Confidence 0-1 (certainty of sentiment analysis)
- Importance 0-1 (market significance - high for earnings, M&A, major news)
- If no companies clearly affected, return empty companies array
- Return ONLY valid JSON, no explanations or markdown`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();

  // Clean up the response - remove markdown code blocks if present
  let cleanedText = text.trim();
  if (cleanedText.startsWith('```json')) {
    cleanedText = cleanedText.slice(7);
  } else if (cleanedText.startsWith('```')) {
    cleanedText = cleanedText.slice(3);
  }
  if (cleanedText.endsWith('```')) {
    cleanedText = cleanedText.slice(0, -3);
  }
  cleanedText = cleanedText.trim();

  try {
    const analysis = JSON.parse(cleanedText) as ClaudeNewsAnalysis;
    return analysis;
  } catch {
    console.error('Failed to parse Gemini response:', text);
    throw new Error('Failed to parse Gemini response as JSON');
  }
}

/**
 * Analyze a social media post for stock mentions and sentiment
 *
 * @param content - Post text
 * @param authorName - Name of the poster (for context)
 * @returns Analysis with mentioned companies and sentiment
 */
export async function analyzeSocialPost(
  content: string,
  authorName: string
): Promise<ClaudeSocialAnalysis> {
  const model = getClient().getGenerativeModel({ model: MODEL_NAME });

  const prompt = `Analyze this social media post from ${authorName} for stock market relevance.

POST CONTENT:
${content}

Provide your analysis in the following JSON format (and ONLY JSON, no other text, no markdown code blocks):
{
  "companies": [
    {
      "ticker": "TSLA",
      "sentiment": "positive",
      "confidence": 0.8
    }
  ],
  "overallSentiment": "positive|negative|neutral",
  "marketImpact": "high|medium|low"
}

Guidelines:
- Look for company names, stock tickers (including $CASHTAGS)
- Consider the author's influence (${authorName})
- High impact = likely to move the stock price
- Only include companies that are clearly referenced
- If no companies are mentioned, return empty companies array
- Return ONLY valid JSON, no explanations or markdown`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();

  // Clean up the response
  let cleanedText = text.trim();
  if (cleanedText.startsWith('```json')) {
    cleanedText = cleanedText.slice(7);
  } else if (cleanedText.startsWith('```')) {
    cleanedText = cleanedText.slice(3);
  }
  if (cleanedText.endsWith('```')) {
    cleanedText = cleanedText.slice(0, -3);
  }
  cleanedText = cleanedText.trim();

  try {
    const analysis = JSON.parse(cleanedText) as ClaudeSocialAnalysis;
    return analysis;
  } catch {
    console.error('Failed to parse Gemini response:', text);
    throw new Error('Failed to parse Gemini response as JSON');
  }
}

/**
 * Batch analyze multiple articles (more efficient)
 *
 * @param articles - Array of articles to analyze
 * @returns Array of analyses
 */
export async function analyzeArticlesBatch(
  articles: Array<{ title: string; content: string }>
): Promise<ClaudeNewsAnalysis[]> {
  const results: ClaudeNewsAnalysis[] = [];

  for (const article of articles) {
    try {
      const analysis = await analyzeNewsArticle(article.title, article.content);
      results.push(analysis);
    } catch (error) {
      console.error('Failed to analyze article:', article.title, error);
      // Continue with other articles
    }

    // Small delay to respect rate limits (60 req/min = 1 per second max)
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return results;
}

/**
 * Summarize multiple articles into a single event summary
 */
export async function summarizeEvent(
  articles: Array<{ title: string; summary?: string }>
): Promise<{
  summary: string;
  category: EventCategory;
  importance: number;
}> {
  const model = getClient().getGenerativeModel({ model: MODEL_NAME });

  const articleList = articles
    .map((a, i) => `${i + 1}. ${a.title}${a.summary ? `\n   ${a.summary}` : ''}`)
    .join('\n');

  const prompt = `These articles are about the same news event. Create a single unified summary.

ARTICLES:
${articleList}

Respond with JSON only (no markdown code blocks):
{
  "summary": "2-3 sentence summary of the overall event",
  "category": "earnings|regulation|merger_acquisition|product|macro|disaster|legal|executive|other",
  "importance": 0.75
}`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();

  // Clean up the response
  let cleanedText = text.trim();
  if (cleanedText.startsWith('```json')) {
    cleanedText = cleanedText.slice(7);
  } else if (cleanedText.startsWith('```')) {
    cleanedText = cleanedText.slice(3);
  }
  if (cleanedText.endsWith('```')) {
    cleanedText = cleanedText.slice(0, -3);
  }
  cleanedText = cleanedText.trim();

  return JSON.parse(cleanedText);
}

/**
 * Extract company tickers from text
 */
export async function extractTickers(text: string): Promise<string[]> {
  const model = getClient().getGenerativeModel({ model: MODEL_NAME });

  const prompt = `Extract all stock ticker symbols mentioned in this text. Include both explicit tickers (like $AAPL) and company names that should be mapped to tickers.

TEXT:
${text}

Respond with a JSON array of uppercase ticker symbols only (no markdown code blocks):
["AAPL", "MSFT", "GOOGL"]

If no tickers are found, respond with: []`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  const responseText = response.text();

  // Clean up the response
  let cleanedText = responseText.trim();
  if (cleanedText.startsWith('```json')) {
    cleanedText = cleanedText.slice(7);
  } else if (cleanedText.startsWith('```')) {
    cleanedText = cleanedText.slice(3);
  }
  if (cleanedText.endsWith('```')) {
    cleanedText = cleanedText.slice(0, -3);
  }
  cleanedText = cleanedText.trim();

  try {
    return JSON.parse(cleanedText) as string[];
  } catch {
    return [];
  }
}

/**
 * Determine overall sentiment from multiple sentiment values
 * (Same logic as Claude client - shared utility)
 */
export function aggregateSentiment(
  sentiments: Array<{ sentiment: Sentiment; confidence: number }>
): { sentiment: Sentiment; confidence: number } {
  if (sentiments.length === 0) {
    return { sentiment: 'neutral', confidence: 0 };
  }

  const weights = sentiments.reduce(
    (acc, s) => {
      const value = s.sentiment === 'positive' ? 1 : s.sentiment === 'negative' ? -1 : 0;
      acc.sum += value * s.confidence;
      acc.totalConfidence += s.confidence;
      return acc;
    },
    { sum: 0, totalConfidence: 0 }
  );

  const avgValue = weights.sum / weights.totalConfidence;
  const avgConfidence = weights.totalConfidence / sentiments.length;

  let sentiment: Sentiment;
  if (avgValue > 0.2) sentiment = 'positive';
  else if (avgValue < -0.2) sentiment = 'negative';
  else sentiment = 'neutral';

  return { sentiment, confidence: avgConfidence };
}

// Export as namespace for cleaner imports
export const gemini = {
  analyzeNewsArticle,
  analyzeSocialPost,
  analyzeArticlesBatch,
  summarizeEvent,
  extractTickers,
  aggregateSentiment,
};
