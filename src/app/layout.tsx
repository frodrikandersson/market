import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Market Predictor | AI-Powered Stock Predictions',
  description:
    'Stock market prediction web app featuring dual AI models - Hype Model (social media sentiment) vs Fundamentals Model (traditional news). Track predictions with red/green accuracy indicators.',
  keywords: [
    'stock market',
    'predictions',
    'AI',
    'machine learning',
    'sentiment analysis',
    'trading',
    'finance',
  ],
  authors: [{ name: 'frodrikandersson' }],
  openGraph: {
    title: 'Market Predictor',
    description: 'AI-Powered Stock Market Predictions',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background antialiased">
        {/* Grid background pattern */}
        <div className="fixed inset-0 bg-grid pointer-events-none opacity-50" />

        {/* Main content */}
        <div className="relative z-10">
          {children}
        </div>
      </body>
    </html>
  );
}
