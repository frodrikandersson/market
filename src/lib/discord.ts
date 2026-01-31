/**
 * Discord Webhook Client
 * ======================
 * Sends notifications to Discord for high-confidence predictions.
 *
 * Setup:
 * 1. Create a webhook in your Discord server (Server Settings > Integrations > Webhooks)
 * 2. Copy the webhook URL
 * 3. Add to .env: DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
 *
 * Usage:
 *   import { discord } from '@/lib/discord';
 *   await discord.sendPredictionAlert({ ... });
 */

interface PredictionAlert {
  ticker: string;
  companyName: string;
  modelType: 'fundamentals' | 'hype';
  direction: 'up' | 'down';
  confidence: number;
  newsImpactScore?: number;
  socialImpactScore?: number;
  topSources?: string[];
}

interface SentimentAlert {
  sentiment: 'extreme_greed' | 'bullish' | 'bearish' | 'extreme_fear';
  score: number;
  totalPosts: number;
  topBullish?: { ticker: string; mentions: number }[];
  topBearish?: { ticker: string; mentions: number }[];
}

interface DiscordEmbed {
  title: string;
  description?: string;
  color: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string;
}

interface DiscordMessage {
  content?: string;
  embeds?: DiscordEmbed[];
  username?: string;
  avatar_url?: string;
}

const COLORS = {
  green: 0x00ff88,
  red: 0xff3366,
  yellow: 0xffcc00,
  cyan: 0x00f0ff,
  purple: 0x7b61ff,
};

/**
 * Check if Discord webhook is configured
 */
function isConfigured(): boolean {
  return !!process.env.DISCORD_WEBHOOK_URL;
}

/**
 * Send a message to Discord
 */
async function sendMessage(message: DiscordMessage): Promise<boolean> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log('[Discord] Webhook not configured, skipping notification');
    return false;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...message,
        username: message.username || 'Market Predictor',
        avatar_url: message.avatar_url || 'https://i.imgur.com/4M34hi2.png',
      }),
    });

    if (!response.ok) {
      console.error('[Discord] Failed to send message:', response.status, response.statusText);
      return false;
    }

    console.log('[Discord] Message sent successfully');
    return true;
  } catch (error) {
    console.error('[Discord] Error sending message:', error);
    return false;
  }
}

/**
 * Send a high-confidence prediction alert
 */
async function sendPredictionAlert(alert: PredictionAlert): Promise<boolean> {
  const isUp = alert.direction === 'up';
  const confidencePercent = (alert.confidence * 100).toFixed(0);

  const embed: DiscordEmbed = {
    title: `${isUp ? '📈' : '📉'} ${alert.ticker} - ${alert.direction.toUpperCase()} Prediction`,
    description: `**${alert.companyName}**\n\nThe **${alert.modelType === 'hype' ? 'Hype Model' : 'Fundamentals Model'}** predicts this stock will go **${alert.direction}** with **${confidencePercent}% confidence**.`,
    color: isUp ? COLORS.green : COLORS.red,
    fields: [],
    footer: { text: 'Market Predictor | Not financial advice' },
    timestamp: new Date().toISOString(),
  };

  // Add impact scores if available
  if (alert.newsImpactScore !== undefined) {
    embed.fields!.push({
      name: 'News Impact',
      value: `${alert.newsImpactScore > 0 ? '+' : ''}${alert.newsImpactScore.toFixed(2)}`,
      inline: true,
    });
  }

  if (alert.socialImpactScore !== undefined) {
    embed.fields!.push({
      name: 'Social Impact',
      value: `${alert.socialImpactScore > 0 ? '+' : ''}${alert.socialImpactScore.toFixed(2)}`,
      inline: true,
    });
  }

  embed.fields!.push({
    name: 'Confidence',
    value: `${confidencePercent}%`,
    inline: true,
  });

  // Add sources if available
  if (alert.topSources && alert.topSources.length > 0) {
    embed.fields!.push({
      name: 'Data Sources',
      value: alert.topSources.join(', '),
      inline: false,
    });
  }

  return sendMessage({ embeds: [embed] });
}

/**
 * Send multiple high-confidence predictions as a batch
 */
async function sendPredictionBatch(alerts: PredictionAlert[]): Promise<boolean> {
  if (alerts.length === 0) return true;

  const embeds: DiscordEmbed[] = alerts.slice(0, 10).map((alert) => {
    const isUp = alert.direction === 'up';
    const confidencePercent = (alert.confidence * 100).toFixed(0);

    return {
      title: `${isUp ? '📈' : '📉'} ${alert.ticker}`,
      description: `**${alert.direction.toUpperCase()}** @ ${confidencePercent}% confidence`,
      color: isUp ? COLORS.green : COLORS.red,
      fields: [
        {
          name: 'Model',
          value: alert.modelType === 'hype' ? 'Hype' : 'Fundamentals',
          inline: true,
        },
      ],
    };
  });

  return sendMessage({
    content: `**🚨 ${alerts.length} High-Confidence Predictions**`,
    embeds,
  });
}

/**
 * Send a Reddit sentiment alert
 */
async function sendSentimentAlert(alert: SentimentAlert): Promise<boolean> {
  const sentimentLabels = {
    extreme_greed: { emoji: '🟢', label: 'EXTREME GREED', color: COLORS.green },
    bullish: { emoji: '📈', label: 'BULLISH', color: COLORS.green },
    bearish: { emoji: '📉', label: 'BEARISH', color: COLORS.red },
    extreme_fear: { emoji: '🔴', label: 'EXTREME FEAR', color: COLORS.red },
  };

  const { emoji, label, color } = sentimentLabels[alert.sentiment];

  const embed: DiscordEmbed = {
    title: `${emoji} Reddit Sentiment: ${label}`,
    description: `Overall sentiment score: **${(alert.score * 100).toFixed(0)}%**\n\nBased on ${alert.totalPosts} posts in the last 24 hours.`,
    color,
    fields: [],
    footer: { text: 'Market Predictor | Reddit Sentiment Analysis' },
    timestamp: new Date().toISOString(),
  };

  if (alert.topBullish && alert.topBullish.length > 0) {
    embed.fields!.push({
      name: '🟢 Most Bullish',
      value: alert.topBullish.map((t) => `$${t.ticker} (${t.mentions})`).join(', '),
      inline: true,
    });
  }

  if (alert.topBearish && alert.topBearish.length > 0) {
    embed.fields!.push({
      name: '🔴 Most Bearish',
      value: alert.topBearish.map((t) => `$${t.ticker} (${t.mentions})`).join(', '),
      inline: true,
    });
  }

  return sendMessage({ embeds: [embed] });
}

/**
 * Send a daily summary
 */
async function sendDailySummary(summary: {
  fundamentalsAccuracy: number;
  hypeAccuracy: number;
  totalPredictions: number;
  correctPredictions: number;
  topPerformers: { ticker: string; gain: number }[];
  worstPerformers: { ticker: string; loss: number }[];
}): Promise<boolean> {
  const embed: DiscordEmbed = {
    title: '📊 Daily Performance Summary',
    color: COLORS.cyan,
    fields: [
      {
        name: 'Fundamentals Accuracy',
        value: `${summary.fundamentalsAccuracy.toFixed(1)}%`,
        inline: true,
      },
      {
        name: 'Hype Model Accuracy',
        value: `${summary.hypeAccuracy.toFixed(1)}%`,
        inline: true,
      },
      {
        name: 'Predictions Today',
        value: `${summary.correctPredictions}/${summary.totalPredictions} correct`,
        inline: true,
      },
    ],
    footer: { text: 'Market Predictor | Daily Report' },
    timestamp: new Date().toISOString(),
  };

  if (summary.topPerformers.length > 0) {
    embed.fields!.push({
      name: '🏆 Top Performers',
      value: summary.topPerformers.map((t) => `$${t.ticker} +${t.gain.toFixed(1)}%`).join('\n'),
      inline: true,
    });
  }

  if (summary.worstPerformers.length > 0) {
    embed.fields!.push({
      name: '📉 Worst Performers',
      value: summary.worstPerformers.map((t) => `$${t.ticker} ${t.loss.toFixed(1)}%`).join('\n'),
      inline: true,
    });
  }

  return sendMessage({ embeds: [embed] });
}

/**
 * Send a test message to verify webhook configuration
 */
async function sendTestMessage(): Promise<boolean> {
  return sendMessage({
    embeds: [
      {
        title: '✅ Discord Webhook Connected!',
        description: 'Your Market Predictor is now connected to Discord. You will receive notifications for high-confidence predictions.',
        color: COLORS.cyan,
        footer: { text: 'Market Predictor' },
        timestamp: new Date().toISOString(),
      },
    ],
  });
}

// Export as namespace
export const discord = {
  isConfigured,
  sendMessage,
  sendPredictionAlert,
  sendPredictionBatch,
  sendSentimentAlert,
  sendDailySummary,
  sendTestMessage,
};
