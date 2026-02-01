/**
 * DeepSeek API Client
 * ===================
 * Uses DeepSeek V3 for sentiment analysis and news processing.
 *
 * Advantages over Gemini:
 * - 10x cheaper ($0.14/M tokens vs Gemini's $1.25/M)
 * - Excellent reasoning capabilities
 * - Free tier available
 * - OpenAI-compatible API
 *
 * Usage:
 *   import { deepseek } from '@/lib/deepseek';
 *   const analysis = await deepseek.analyzeNewsArticle(title, content);
 */

import type { ClaudeNewsAnalysis, Sentiment } from '@/types';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';

// ===========================================
// Types
// ===========================================

interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface DeepSeekResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ===========================================
// API Functions
// ===========================================

/**
 * Call DeepSeek API (OpenAI-compatible)
 */
async function callDeepSeek(
  messages: DeepSeekMessage[],
  temperature: number = 0.3
): Promise<string> {
  if (!DEEPSEEK_API_KEY) {
    throw new Error('DEEPSEEK_API_KEY not configured');
  }

  try {
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        temperature,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DeepSeek API error: ${response.status} - ${error}`);
    }

    const data: DeepSeekResponse = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('[DeepSeek] API call failed:', error);
    throw error;
  }
}

// ===========================================
// News Analysis
// ===========================================

/**
 * Analyze a news article for company mentions and sentiment
 */
export async function analyzeNewsArticle(
  title: string,
  content: string
): Promise<ClaudeNewsAnalysis> {
  const systemPrompt = `You are a financial news analyst. Analyze news articles and extract:
1. A concise 2-3 sentence summary
2. All companies mentioned (with stock tickers if identifiable)
3. Sentiment for each company (positive/negative/neutral)
4. Confidence score (0-1) for each sentiment
5. Brief reason for the sentiment
6. Overall importance score (0-1)

Return ONLY valid JSON in this exact format:
{
  "summary": "Brief summary here",
  "importance": 0.75,
  "companies": [
    {
      "ticker": "AAPL",
      "name": "Apple Inc",
      "sentiment": "positive",
      "confidence": 0.85,
      "reason": "Strong iPhone sales in China"
    }
  ]
}

Rules:
- Only include companies explicitly mentioned
- Ticker must be a valid US stock symbol (or empty string if unknown)
- Sentiment must be exactly: "positive", "negative", or "neutral"
- Confidence must be 0-1 decimal
- If a company is mentioned but ticker is unknown, use ""
- Importance reflects how significant this news is for the overall market`;

  const userPrompt = `Analyze this financial news article:

Title: ${title}

Content: ${content.substring(0, 3000)}

Return the JSON analysis.`;

  try {
    const response = await callDeepSeek([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const analysis = JSON.parse(jsonMatch[0]);

    // Validate and return
    return {
      summary: analysis.summary || '',
      importance: Math.max(0, Math.min(1, analysis.importance || 0.5)),
      category: analysis.category || 'other',
      companies: (analysis.companies || []).map((c: any) => ({
        ticker: c.ticker || '',
        name: c.name || '',
        sentiment: ['positive', 'negative', 'neutral'].includes(c.sentiment)
          ? c.sentiment
          : 'neutral',
        confidence: Math.max(0, Math.min(1, c.confidence || 0.5)),
        reason: c.reason || '',
      })),
    };
  } catch (error) {
    console.error('[DeepSeek] Failed to analyze article:', title, error);

    // Return minimal analysis on error
    return {
      summary: title.substring(0, 200),
      importance: 0.5,
      category: 'other',
      companies: [],
    };
  }
}

/**
 * Analyze social media post sentiment
 */
export async function analyzeSocialPost(
  text: string,
  tickers: string[]
): Promise<Map<string, { sentiment: Sentiment; confidence: number; reason: string }>> {
  const systemPrompt = `You are a financial sentiment analyzer for social media posts.
Analyze the sentiment toward specific stock tickers mentioned in the post.

Return ONLY valid JSON in this format:
{
  "sentiments": {
    "TSLA": {
      "sentiment": "positive",
      "confidence": 0.9,
      "reason": "Mentions production ramp-up and strong demand"
    },
    "AAPL": {
      "sentiment": "neutral",
      "confidence": 0.6,
      "reason": "Mentioned in passing without strong opinion"
    }
  }
}

Rules:
- Sentiment must be exactly: "positive", "negative", or "neutral"
- Confidence must be 0-1 decimal
- Only analyze tickers that are mentioned in the post
- Consider emojis, slang, and context`;

  const userPrompt = `Analyze sentiment for these tickers: ${tickers.join(', ')}

Post: ${text.substring(0, 1000)}

Return the JSON analysis.`;

  try {
    const response = await callDeepSeek([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const analysis = JSON.parse(jsonMatch[0]);
    const result = new Map<string, { sentiment: Sentiment; confidence: number; reason: string }>();

    for (const ticker of tickers) {
      const tickerAnalysis = analysis.sentiments?.[ticker];
      if (tickerAnalysis) {
        result.set(ticker, {
          sentiment: ['positive', 'negative', 'neutral'].includes(tickerAnalysis.sentiment)
            ? tickerAnalysis.sentiment
            : 'neutral',
          confidence: Math.max(0, Math.min(1, tickerAnalysis.confidence || 0.5)),
          reason: tickerAnalysis.reason || '',
        });
      }
    }

    return result;
  } catch (error) {
    console.error('[DeepSeek] Failed to analyze social post:', error);

    // Return neutral sentiment on error
    const result = new Map<string, { sentiment: Sentiment; confidence: number; reason: string }>();
    tickers.forEach((ticker) => {
      result.set(ticker, {
        sentiment: 'neutral',
        confidence: 0.5,
        reason: 'Analysis failed',
      });
    });
    return result;
  }
}

/**
 * Batch analyze multiple articles (with rate limiting)
 */
export async function batchAnalyzeArticles(
  articles: Array<{ title: string; content: string }>,
  delayMs: number = 500
): Promise<ClaudeNewsAnalysis[]> {
  const results: ClaudeNewsAnalysis[] = [];

  for (const article of articles) {
    try {
      const analysis = await analyzeNewsArticle(article.title, article.content);
      results.push(analysis);

      // Rate limiting delay
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      console.error('[DeepSeek] Batch analysis error:', error);
      results.push({
        summary: article.title.substring(0, 200),
        importance: 0.5,
        category: 'other',
        companies: [],
      });
    }
  }

  return results;
}

/**
 * Check if DeepSeek API is available
 */
export async function isAvailable(): Promise<boolean> {
  if (!DEEPSEEK_API_KEY) {
    return false;
  }

  try {
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 5,
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get API usage statistics (if available)
 */
export async function getUsageStats(): Promise<{
  totalTokens: number;
  estimatedCost: number;
} | null> {
  // DeepSeek doesn't provide usage stats via API
  // You'd need to track this manually or check the dashboard
  return null;
}

// Export as namespace
export const deepseek = {
  analyzeNewsArticle,
  analyzeSocialPost,
  batchAnalyzeArticles,
  isAvailable,
  getUsageStats,
};
