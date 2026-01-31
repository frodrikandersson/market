# Market Predictor

AI-powered stock market prediction web app featuring **two competing models**:

- **Fundamentals Model**: Analyzes traditional news sources (Reuters, Bloomberg, etc.)
- **Hype Model**: Analyzes social media sentiment from influential accounts (Elon Musk, Trump, etc.)

Track predictions with red/green accuracy indicators and see which model performs better!

![Market Predictor Dashboard](docs/images/dashboard-preview.png)

## Features

- **Dual AI Models**: Compare predictions from news-based vs social-media-based analysis
- **Real-time Tracking**: 50 large-cap companies across 5 sectors
- **Accuracy Metrics**: Red/green indicators show correct vs wrong predictions
- **Sector Heat Maps**: Visualize market sentiment by sector
- **Backtest Simulator**: Test model performance against historical data
- **Confidence Calibration**: Track if high-confidence predictions are actually more accurate

## Tech Stack

- **Frontend/Backend**: Next.js 15 (App Router)
- **Database**: PostgreSQL with Prisma ORM
- **AI/LLM**: Anthropic Claude API
- **News APIs**: NewsAPI.org + Finnhub
- **Stock Data**: Finnhub API
- **Styling**: Tailwind CSS + shadcn/ui (Financial Cyber Theme)
- **Deployment**: Railway

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- API keys for:
  - [Anthropic Claude](https://console.anthropic.com)
  - [Finnhub](https://finnhub.io)
  - [NewsAPI](https://newsapi.org)
  - [X/Twitter](https://developer.twitter.com) (optional, for Hype Model)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/frodrikandersson/market.git
   cd market
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your API keys and database URL
   ```

4. **Set up the database**
   ```bash
   # Generate Prisma client
   npm run db:generate

   # Push schema to database
   npm run db:push

   # Seed initial data (50 companies + influencer accounts)
   npm run db:seed
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
market/
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── components/       # React components
│   ├── lib/              # API clients & utilities
│   ├── services/         # Business logic
│   └── types/            # TypeScript types
├── prisma/
│   └── schema.prisma     # Database schema
├── docs/                 # Documentation
│   ├── ARCHITECTURE.md   # System design
│   ├── DATABASE.md       # Schema docs
│   ├── API.md            # Endpoint docs
│   └── MODELS.md         # Prediction logic
└── scripts/              # Utility scripts
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to database |
| `npm run db:migrate` | Run migrations |
| `npm run db:seed` | Seed companies & influencers |
| `npm run db:studio` | Open Prisma Studio |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | Claude API key |
| `FINNHUB_API_KEY` | Finnhub API key |
| `NEWSAPI_KEY` | NewsAPI key |
| `TWITTER_BEARER_TOKEN` | X API bearer token (optional) |
| `CRON_SECRET` | Secret for cron endpoints |

## Tracked Companies (50)

| Sector | Tickers |
|--------|---------|
| Technology | AAPL, MSFT, GOOGL, AMZN, META, NVDA, TSLA, AMD, INTC, CRM |
| Finance | JPM, BAC, WFC, GS, MS, V, MA, AXP, BLK, C |
| Healthcare | JNJ, UNH, PFE, MRK, ABBV, TMO, ABT, LLY, BMY, AMGN |
| Consumer | WMT, PG, KO, PEP, COST, MCD, NKE, SBUX, HD, TGT |
| Energy/Industrial | XOM, CVX, BA, CAT, GE, HON, UPS, MMM, LMT, RTX |

## Documentation

- [Architecture](docs/ARCHITECTURE.md) - System design and data flow
- [Database Schema](docs/DATABASE.md) - Entity relationships and queries
- [API Reference](docs/API.md) - Endpoint documentation
- [Prediction Models](docs/MODELS.md) - How predictions are generated

## Disclaimer

**This is not financial advice.** Predictions are for educational and entertainment purposes only. Past performance does not guarantee future results. Do not make investment decisions based on this tool.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

Built with [Next.js](https://nextjs.org/) and [Claude](https://anthropic.com)
