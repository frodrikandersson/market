import { NextResponse } from 'next/server';
import { discord } from '@/lib/discord';

export async function POST() {
  if (!discord.isConfigured()) {
    return NextResponse.json(
      { success: false, error: 'Discord webhook not configured. Add DISCORD_WEBHOOK_URL to .env' },
      { status: 400 }
    );
  }

  try {
    const sent = await discord.sendTestMessage();

    if (sent) {
      return NextResponse.json({ success: true, message: 'Test message sent to Discord!' });
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to send message' },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
