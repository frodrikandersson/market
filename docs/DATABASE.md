# Market Predictor - Database Schema

This document describes the PostgreSQL database schema managed by Prisma.

## Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   Company   │───────│  StockPrice │       │  NewsEvent  │
└─────────────┘       └─────────────┘       └─────────────┘
      │                                           │
      │                                           │
      ├───────────────────┐                       │
      │                   │                       │
      ▼                   ▼                       ▼
┌─────────────┐    ┌─────────────┐       ┌─────────────┐
│ Prediction  │    │  NewsImpact │◄──────│ NewsArticle │
└─────────────┘    └─────────────┘       └─────────────┘
      │                   │
      │                   │
      │            ┌──────┴──────┐
      │            │             │
      │            ▼             ▼
      │    ┌─────────────┐ ┌───────────────────┐
      │    │SocialMention│ │InfluentialAccount │
      │    └─────────────┘ └───────────────────┘
      │            │             │
      │            │             │
      │            ▼             ▼
      │    ┌─────────────┐
      └───▶│ SocialPost  │
           └─────────────┘
```

## Models

### Company
Tracks publicly traded companies being monitored.

| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key (cuid) |
| ticker | String | Stock ticker symbol (unique) |
| name | String | Company name |
| sector | String? | Business sector |
| industry | String? | Specific industry |
| marketCap | Float? | Market cap in USD |
| isActive | Boolean | Whether actively tracking |
| createdAt | DateTime | When added |
| updatedAt | DateTime | Last updated |

**Relations:**
- `stockPrices` → StockPrice[]
- `newsImpacts` → NewsImpact[]
- `predictions` → Prediction[]
- `socialMentions` → SocialMention[]

### StockPrice
Daily OHLCV price data for each company.

| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key |
| companyId | String | FK to Company |
| date | DateTime | Trading date |
| open | Float | Opening price |
| high | Float | High price |
| low | Float | Low price |
| close | Float | Closing price |
| volume | BigInt | Trading volume |
| createdAt | DateTime | When fetched |

**Unique Constraint:** `[companyId, date]`

### NewsArticle
Individual news articles from various sources.

| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key |
| sourceId | String | Source (newsapi, finnhub) |
| externalId | String? | Original article ID |
| title | String | Headline |
| content | String? | Full article text |
| summary | String? | AI-generated summary |
| url | String | Article URL |
| imageUrl | String? | Thumbnail |
| author | String? | Author name |
| publishedAt | DateTime | Publication time |
| fetchedAt | DateTime | When we fetched it |
| processed | Boolean | Has been analyzed |
| eventId | String? | FK to NewsEvent |

**Unique Constraint:** `[sourceId, url]`

### NewsEvent
Clustered group of related articles about the same event.

| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key |
| summary | String | Event summary |
| category | String | Event type |
| importance | Float | Importance score (0-1) |
| createdAt | DateTime | When created |

**Categories:**
- earnings
- regulation
- merger_acquisition
- product
- macro
- disaster
- legal
- executive
- other

### NewsImpact
Tracks how news affects specific companies.

| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key |
| companyId | String | FK to Company |
| articleId | String? | FK to NewsArticle |
| eventId | String? | FK to NewsEvent |
| sentiment | String | positive/negative/neutral |
| confidence | Float | Confidence (0-1) |
| impactScore | Float | Calculated score |
| reason | String? | Explanation |
| createdAt | DateTime | When created |

### InfluentialAccount
Social media accounts to monitor for the Hype Model.

| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key |
| platform | String | twitter, truthsocial |
| handle | String | @username |
| name | String | Display name |
| userId | String? | Platform user ID |
| weight | Float | Influence weight |
| isActive | Boolean | Whether active |
| createdAt | DateTime | When added |
| updatedAt | DateTime | Last updated |

**Unique Constraint:** `[platform, handle]`

### SocialPost
Individual posts from influential accounts.

| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key |
| accountId | String | FK to InfluentialAccount |
| externalId | String | Platform post ID |
| content | String | Post text |
| sentiment | String? | positive/negative/neutral |
| impactScore | Float? | Calculated score |
| metrics | Json? | Engagement metrics |
| publishedAt | DateTime | When posted |
| fetchedAt | DateTime | When we fetched |
| processed | Boolean | Has been analyzed |

**Unique Constraint:** `[accountId, externalId]`

### SocialMention
Company mentions in social posts.

| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key |
| postId | String | FK to SocialPost |
| companyId | String | FK to Company |
| sentiment | String | positive/negative/neutral |
| confidence | Float | Confidence (0-1) |
| createdAt | DateTime | When created |

**Unique Constraint:** `[postId, companyId]`

### Prediction
Stores predictions from both models.

| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key |
| companyId | String | FK to Company |
| predictionDate | DateTime | When made |
| targetDate | DateTime | Date predicted |
| modelType | String | fundamentals or hype |
| predictedDirection | String | up or down |
| confidence | Float | Confidence (0-1) |
| newsImpactScore | Float? | News score |
| socialImpactScore | Float? | Social score |
| priceVolatility | Float? | Recent volatility |
| priceMomentum | Float? | Price trend |
| actualDirection | String? | up/down/flat |
| actualChange | Float? | % change |
| wasCorrect | Boolean? | Was correct? |
| createdAt | DateTime | When created |
| evaluatedAt | DateTime? | When evaluated |

**Unique Constraint:** `[companyId, targetDate, modelType]`

### CronJob
Tracks scheduled job executions.

| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key |
| name | String | Job name |
| status | String | running/completed/failed |
| startedAt | DateTime | When started |
| completedAt | DateTime? | When finished |
| error | String? | Error message |
| metadata | Json? | Additional data |

### SystemConfig
System-wide configuration key-value store.

| Field | Type | Description |
|-------|------|-------------|
| key | String | Primary key |
| value | String | Config value |
| updatedAt | DateTime | Last updated |

## Common Queries

### Get companies with latest predictions
```sql
SELECT c.*, p.*
FROM "Company" c
LEFT JOIN "Prediction" p ON p."companyId" = c.id
WHERE p."targetDate" = CURRENT_DATE
  AND p."modelType" = 'fundamentals'
ORDER BY p.confidence DESC;
```

### Calculate model accuracy
```sql
SELECT
  "modelType",
  COUNT(*) as total,
  SUM(CASE WHEN "wasCorrect" THEN 1 ELSE 0 END) as correct,
  ROUND(100.0 * SUM(CASE WHEN "wasCorrect" THEN 1 ELSE 0 END) / COUNT(*), 2) as accuracy
FROM "Prediction"
WHERE "wasCorrect" IS NOT NULL
GROUP BY "modelType";
```

### Get recent news impacts for a company
```sql
SELECT ni.*, na.title, na."publishedAt"
FROM "NewsImpact" ni
JOIN "NewsArticle" na ON na.id = ni."articleId"
WHERE ni."companyId" = 'company_id'
ORDER BY na."publishedAt" DESC
LIMIT 10;
```

## Indexes

The schema includes indexes for:
- Company: sector, isActive
- StockPrice: date
- NewsArticle: publishedAt, processed
- NewsEvent: category, createdAt
- NewsImpact: companyId, createdAt
- InfluentialAccount: platform, isActive
- SocialPost: publishedAt, processed
- SocialMention: companyId
- Prediction: modelType, targetDate, wasCorrect
- CronJob: name, startedAt

## Migrations

To apply schema changes:

```bash
# Development - create and apply migration
npm run db:migrate

# Production - apply pending migrations
npx prisma migrate deploy

# Generate Prisma client after schema changes
npm run db:generate
```
