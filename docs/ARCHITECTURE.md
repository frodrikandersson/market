# Market Predictor - System Architecture

This document describes the overall architecture of the Market Predictor application.

## Overview

Market Predictor is a stock market prediction web app featuring **two competing AI models**:

1. **Fundamentals Model**: Based on traditional news sources (Reuters, Bloomberg, etc.)
2. **Hype Model**: Based on social media sentiment from influential accounts (Elon Musk, Trump, etc.)

The app displays predictions with red/green accuracy indicators and compares model performance over time.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend/Backend | Next.js 16 (App Router) |
| Database | PostgreSQL with Prisma ORM |
| AI/LLM (Testing) | Google Gemini API (free tier) |
| AI/LLM (Production) | Anthropic Claude API |
| News APIs | NewsAPI.org + Finnhub |
| Social APIs | X/Twitter API v2 |
| Stock Data | Finnhub API |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Deployment | Railway |

### AI Provider Configuration

The app supports multiple AI providers through a unified interface:

- **Gemini** (default): Best for testing due to generous free tier (60 req/min, 1500/day)
- **Claude**: Higher quality, recommended for production

Set the provider via environment variable:
```bash
AI_PROVIDER=gemini  # Default - for testing
AI_PROVIDER=claude  # For production
```

## Directory Structure

```
market/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # Home - Dashboard
│   │   ├── layout.tsx          # Root layout
│   │   ├── globals.css         # Global styles
│   │   ├── stock/[ticker]/     # Stock detail page
│   │   ├── performance/        # Model performance
│   │   ├── sectors/            # Sector heat map
│   │   ├── backtest/           # Backtest simulator
│   │   └── api/                # API routes
│   │       ├── cron/           # Scheduled jobs
│   │       ├── news/           # News endpoints
│   │       ├── social/         # Social endpoints
│   │       ├── stocks/         # Stock endpoints
│   │       └── predictions/    # Prediction endpoints
│   ├── lib/                    # Shared utilities
│   │   ├── db.ts               # Prisma client singleton
│   │   ├── utils.ts            # Utility functions
│   │   ├── ai.ts               # Unified AI client (switches providers)
│   │   ├── gemini.ts           # Google Gemini API client (testing)
│   │   ├── claude.ts           # Anthropic Claude API client (production)
│   │   ├── finnhub.ts          # Finnhub API client
│   │   ├── newsapi.ts          # NewsAPI client
│   │   ├── twitter.ts          # X/Twitter client
│   │   └── scoring.ts          # Impact scoring
│   ├── services/               # Business logic
│   │   ├── news-processor.ts   # News processing
│   │   ├── social-processor.ts # Social processing
│   │   ├── predictor.ts        # Prediction engine
│   │   └── evaluator.ts        # Accuracy tracking
│   ├── components/             # React components
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── StockCard.tsx
│   │   ├── SectorHeatMap.tsx
│   │   └── ...
│   └── types/                  # TypeScript types
│       └── index.ts
├── prisma/
│   └── schema.prisma           # Database schema
├── docs/                       # Documentation
│   ├── ARCHITECTURE.md         # This file
│   ├── DATABASE.md             # Schema docs
│   ├── API.md                  # Endpoint docs
│   └── MODELS.md               # Prediction logic
├── scripts/
│   ├── seed-companies.ts       # Seed companies
│   └── seed-influencers.ts     # Seed social accounts
└── package.json
```

## Data Flow

```
┌─────────────────┐     ┌─────────────────┐
│   NewsAPI.org   │     │   Finnhub API   │
└────────┬────────┘     └────────┬────────┘
         │                       │
         ▼                       ▼
┌─────────────────────────────────────────┐
│           News Fetcher (Cron)            │
│         (Every 30 minutes)               │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│         News Processor                   │
│  • Summarize with Claude                 │
│  • Extract companies                     │
│  • Determine sentiment                   │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│           PostgreSQL Database            │
│  • Companies                             │
│  • NewsArticles                          │
│  • NewsImpacts                           │
│  • Predictions                           │
└────────────────┬────────────────────────┘
                 │
    ┌────────────┴────────────┐
    │                         │
    ▼                         ▼
┌───────────────┐     ┌───────────────┐
│ Fundamentals  │     │  Hype Model   │
│    Model      │     │  (Social)     │
└───────┬───────┘     └───────┬───────┘
        │                     │
        └──────────┬──────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│           Prediction Engine             │
│  • Generate daily predictions           │
│  • Calculate confidence scores          │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│              Evaluator                   │
│  • Compare to actual prices             │
│  • Track accuracy                        │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│           Web Dashboard                  │
│  • Today's predictions                   │
│  • Red/green accuracy                    │
│  • Model comparison                      │
└─────────────────────────────────────────┘
```

## Cron Jobs Schedule

| Job | Endpoint | Schedule | Description |
|-----|----------|----------|-------------|
| Full Pipeline | `/api/cron/full-pipeline` | Every 30 min | Runs all steps below in sequence |
| Fetch News | `/api/cron/fetch-news` | Every 30 min | Fetch news from NewsAPI + Finnhub |
| Fetch Social | `/api/cron/fetch-social` | Every 30 min | Fetch posts from tracked accounts |
| Run Predictions | `/api/cron/run-predictions` | Daily 5 PM ET | Generate predictions + evaluate |

### Cron Endpoint URLs

All cron endpoints require authentication via query parameter or header:

```bash
# Using query parameter
curl "https://your-app.railway.app/api/cron/full-pipeline?secret=YOUR_CRON_SECRET"

# Using Authorization header
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
     "https://your-app.railway.app/api/cron/full-pipeline"
```

### Railway Cron Setup

Add these cron jobs in Railway dashboard or use an external service:

```
# Every 30 minutes during market hours (9 AM - 5 PM ET, Mon-Fri)
*/30 9-17 * * 1-5  curl -X POST "https://your-app.railway.app/api/cron/full-pipeline?secret=$CRON_SECRET"

# Daily prediction run at 5 PM ET
0 17 * * 1-5       curl -X POST "https://your-app.railway.app/api/cron/run-predictions?secret=$CRON_SECRET"
```

## Key Components

### 1. News Processor (`src/services/news-processor.ts`)
- Fetches articles from NewsAPI and Finnhub
- Deduplicates by URL
- Sends to Claude for analysis
- Extracts affected companies
- Calculates impact scores

### 2. Social Processor (`src/services/social-processor.ts`)
- Fetches tweets from influential accounts
- Analyzes sentiment with Claude
- Maps mentions to companies
- Calculates social impact scores

### 3. Predictor (`src/services/predictor.ts`)
- Aggregates news/social impact scores
- Calculates price momentum and volatility
- Generates predictions for both models
- Stores predictions with confidence scores

### 4. Evaluator (`src/services/evaluator.ts`)
- Compares predictions to actual price changes
- Updates wasCorrect flag
- Calculates accuracy metrics

## Impact Score Formula

```
impact_score = sentiment × importance × source_reliability × recency_decay

Where:
- sentiment: -1 (negative) to +1 (positive)
- importance: 0-1 (event significance)
- source_reliability: 0-1 (Reuters > random blog)
- recency_decay: exp(-hours_old / 24)
```

## Environment Variables

See `.env.example` for the full list. Key variables:

- `DATABASE_URL` - PostgreSQL connection string
- `ANTHROPIC_API_KEY` - Claude API key
- `FINNHUB_API_KEY` - Finnhub API key
- `NEWSAPI_KEY` - NewsAPI key
- `TWITTER_BEARER_TOKEN` - X API bearer token
- `CRON_SECRET` - Secret for securing cron endpoints

## Deployment

The app is designed to deploy on Railway:

1. Create a new project on Railway
2. Add PostgreSQL database
3. Connect GitHub repository
4. Set environment variables
5. Deploy

Railway will automatically:
- Build the Next.js app
- Run database migrations
- Set up the PostgreSQL connection

For cron jobs, use Railway's cron feature or an external service like cron-job.org.
