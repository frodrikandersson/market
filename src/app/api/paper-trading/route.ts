import { NextResponse } from 'next/server';
import { paperTrading } from '@/services/paper-trading';

// GET /api/paper-trading - Get portfolio data
export async function GET() {
  try {
    const portfolioId = await paperTrading.getOrCreatePortfolio();
    const portfolio = await paperTrading.getPortfolio(portfolioId);
    const trades = await paperTrading.getTradeHistory(portfolioId, 20);
    const metrics = await paperTrading.getPerformanceMetrics(portfolioId);

    return NextResponse.json({
      success: true,
      portfolio,
      recentTrades: trades,
      metrics,
    });
  } catch (error) {
    console.error('[API] Paper trading error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch portfolio' },
      { status: 500 }
    );
  }
}

// POST /api/paper-trading - Execute a trade
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { ticker, type, shares, predictionId, modelType, note } = body;

    if (!ticker || !type || !shares) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: ticker, type, shares' },
        { status: 400 }
      );
    }

    if (!['buy', 'sell'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Type must be "buy" or "sell"' },
        { status: 400 }
      );
    }

    const portfolioId = await paperTrading.getOrCreatePortfolio();
    const result = await paperTrading.executeTrade({
      portfolioId,
      ticker: ticker.toUpperCase(),
      type,
      shares: Number(shares),
      predictionId,
      modelType,
      note,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Trade execution error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to execute trade' },
      { status: 500 }
    );
  }
}

// DELETE /api/paper-trading - Reset portfolio
export async function DELETE() {
  try {
    const portfolioId = await paperTrading.getOrCreatePortfolio();
    await paperTrading.resetPortfolio(portfolioId);

    return NextResponse.json({
      success: true,
      message: 'Portfolio reset successfully',
    });
  } catch (error) {
    console.error('[API] Portfolio reset error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reset portfolio' },
      { status: 500 }
    );
  }
}
