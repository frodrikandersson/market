import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enable experimental features for better performance
  experimental: {
    // Enable server actions
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Image optimization domains (for news images)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // Environment variables available to the browser
  env: {
    NEXT_PUBLIC_APP_NAME: 'Market Predictor',
  },
};

export default nextConfig;
