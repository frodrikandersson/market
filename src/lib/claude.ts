/**
 * Anthropic Claude API Client
 * ===========================
 * Client for interacting with Claude AI for news analysis and sentiment.
 * Used for summarization, entity extraction, and sentiment analysis.
 *
 * API Documentation: https://docs.anthropic.com/en/api/messages
 *
 * Usage:
 *   import { claude } from '@/lib/claude';
 *   const analysis = await claude.analyzeNewsArticle(articleText);
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  ClaudeNewsAnalysis,
  ClaudeSocialAnalysis,
  Sentiment,
  EventCategory,
} from '@/types';

// Initialize client (will use ANTHROPIC_API_KEY from environment)
const anthropic = new Anthropic();

// Model to use for analysis
const MODEL = 'claude-sonnet-4-5-20250514';

/**
 * Analyze a news article for stock market impact
 *
 * @param title - Article headline
 * @param content - Article body text
 * @returns Analysis with summary, affected companies, and sentiment
 *
 * @example
 * const analysis = await claude.analyzeNewsArticle(
 *   'Apple Vision Pro sales exceed expectations',
 *   'Apple Inc. reported strong sales of its Vision Pro headset...'
 * );
 */
export async function analyzeNewsArticle(
  title: string,
  content: string
): Promise<ClaudeNewsAnalysis> {
  const prompt = `Analyze this news article for stock market impact.

ARTICLE TITLE: ${title}

ARTICLE CONTENT:
${content}

Provide your analysis in the following JSON format (and ONLY JSON, no other text):
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

Guidelines:
- Only include publicly traded companies
- Use standard US ticker symbols
- Sentiment must be: positive, negative, or neutral
- Confidence should be 0-1 (how sure you are about the sentiment)
- Importance should be 0-1 (how significant is this news for the market)
- Category should describe the type of news event
- If no companies are clearly affected, return an empty companies array`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  // Extract text from response
  const textContent = response.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  // Parse JSON response
  try {
    const analysis = JSON.parse(textContent.text) as ClaudeNewsAnalysis;
    return analysis;
  } catch {
    console.error('Failed to parse Claude response:', textContent.text);
    throw new Error('Failed to parse Claude response as JSON');
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
  const prompt = `Analyze this social media post from ${authorName} for stock market relevance.

POST CONTENT:
${content}

Provide your analysis in the following JSON format (and ONLY JSON, no other text):
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
- If no companies are mentioned, return empty companies array`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const textContent = response.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  try {
    const analysis = JSON.parse(textContent.text) as ClaudeSocialAnalysis;
    return analysis;
  } catch {
    console.error('Failed to parse Claude response:', textContent.text);
    throw new Error('Failed to parse Claude response as JSON');
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
  // Process in parallel with rate limiting
  const results: ClaudeNewsAnalysis[] = [];

  for (const article of articles) {
    try {
      const analysis = await analyzeNewsArticle(article.title, article.content);
      results.push(analysis);
    } catch (error) {
      console.error('Failed to analyze article:', article.title, error);
      // Continue with other articles
    }

    // Small delay to avoid rate limiting
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
  const articleList = articles
    .map((a, i) => `${i + 1}. ${a.title}${a.summary ? `\n   ${a.summary}` : ''}`)
    .join('\n');

  const prompt = `These articles are about the same news event. Create a single unified summary.

ARTICLES:
${articleList}

Respond with JSON only:
{
  "summary": "2-3 sentence summary of the overall event",
  "category": "earnings|regulation|merger_acquisition|product|macro|disaster|legal|executive|other",
  "importance": 0.75
}`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const textContent = response.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  return JSON.parse(textContent.text);
}

/**
 * Extract company tickers from text
 */
export async function extractTickers(text: string): Promise<string[]> {
  const prompt = `Extract all stock ticker symbols mentioned in this text. Include both explicit tickers (like $AAPL) and company names that should be mapped to tickers.

TEXT:
${text}

Respond with a JSON array of uppercase ticker symbols only:
["AAPL", "MSFT", "GOOGL"]

If no tickers are found, respond with: []`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const textContent = response.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    return [];
  }

  try {
    return JSON.parse(textContent.text) as string[];
  } catch {
    return [];
  }
}

/**
 * Determine overall sentiment from multiple sentiment values
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
export const claude = {
  analyzeNewsArticle,
  analyzeSocialPost,
  analyzeArticlesBatch,
  summarizeEvent,
  extractTickers,
  aggregateSentiment,
};
