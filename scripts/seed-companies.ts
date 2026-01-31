/**
 * Seed Companies Script
 * =====================
 * Seeds the database with the initial 50 companies across 5 sectors.
 *
 * Usage:
 *   npm run db:seed
 *   # or
 *   npx tsx scripts/seed-companies.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Prisma v7 requires a driver adapter
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// MVP Company List - 50 companies across 5 sectors
const companies = [
  // Technology (10)
  { ticker: 'AAPL', name: 'Apple Inc.', sector: 'Technology', industry: 'Consumer Electronics' },
  { ticker: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology', industry: 'Software' },
  { ticker: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology', industry: 'Internet Services' },
  { ticker: 'AMZN', name: 'Amazon.com Inc.', sector: 'Technology', industry: 'E-Commerce' },
  { ticker: 'META', name: 'Meta Platforms Inc.', sector: 'Technology', industry: 'Social Media' },
  { ticker: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology', industry: 'Semiconductors' },
  { ticker: 'TSLA', name: 'Tesla, Inc.', sector: 'Technology', industry: 'Electric Vehicles' },
  { ticker: 'AMD', name: 'Advanced Micro Devices', sector: 'Technology', industry: 'Semiconductors' },
  { ticker: 'INTC', name: 'Intel Corporation', sector: 'Technology', industry: 'Semiconductors' },
  { ticker: 'CRM', name: 'Salesforce, Inc.', sector: 'Technology', industry: 'Software' },

  // Finance (10)
  { ticker: 'JPM', name: 'JPMorgan Chase & Co.', sector: 'Finance', industry: 'Banking' },
  { ticker: 'BAC', name: 'Bank of America Corp', sector: 'Finance', industry: 'Banking' },
  { ticker: 'WFC', name: 'Wells Fargo & Co.', sector: 'Finance', industry: 'Banking' },
  { ticker: 'GS', name: 'Goldman Sachs Group', sector: 'Finance', industry: 'Investment Banking' },
  { ticker: 'MS', name: 'Morgan Stanley', sector: 'Finance', industry: 'Investment Banking' },
  { ticker: 'V', name: 'Visa Inc.', sector: 'Finance', industry: 'Payment Processing' },
  { ticker: 'MA', name: 'Mastercard Inc.', sector: 'Finance', industry: 'Payment Processing' },
  { ticker: 'AXP', name: 'American Express Co.', sector: 'Finance', industry: 'Financial Services' },
  { ticker: 'BLK', name: 'BlackRock Inc.', sector: 'Finance', industry: 'Asset Management' },
  { ticker: 'C', name: 'Citigroup Inc.', sector: 'Finance', industry: 'Banking' },

  // Healthcare (10)
  { ticker: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare', industry: 'Pharmaceuticals' },
  { ticker: 'UNH', name: 'UnitedHealth Group', sector: 'Healthcare', industry: 'Health Insurance' },
  { ticker: 'PFE', name: 'Pfizer Inc.', sector: 'Healthcare', industry: 'Pharmaceuticals' },
  { ticker: 'MRK', name: 'Merck & Co.', sector: 'Healthcare', industry: 'Pharmaceuticals' },
  { ticker: 'ABBV', name: 'AbbVie Inc.', sector: 'Healthcare', industry: 'Pharmaceuticals' },
  { ticker: 'TMO', name: 'Thermo Fisher Scientific', sector: 'Healthcare', industry: 'Life Sciences' },
  { ticker: 'ABT', name: 'Abbott Laboratories', sector: 'Healthcare', industry: 'Medical Devices' },
  { ticker: 'LLY', name: 'Eli Lilly and Company', sector: 'Healthcare', industry: 'Pharmaceuticals' },
  { ticker: 'BMY', name: 'Bristol-Myers Squibb', sector: 'Healthcare', industry: 'Pharmaceuticals' },
  { ticker: 'AMGN', name: 'Amgen Inc.', sector: 'Healthcare', industry: 'Biotechnology' },

  // Consumer (10)
  { ticker: 'WMT', name: 'Walmart Inc.', sector: 'Consumer', industry: 'Retail' },
  { ticker: 'PG', name: 'Procter & Gamble Co.', sector: 'Consumer', industry: 'Consumer Goods' },
  { ticker: 'KO', name: 'Coca-Cola Company', sector: 'Consumer', industry: 'Beverages' },
  { ticker: 'PEP', name: 'PepsiCo Inc.', sector: 'Consumer', industry: 'Beverages' },
  { ticker: 'COST', name: 'Costco Wholesale Corp', sector: 'Consumer', industry: 'Retail' },
  { ticker: 'MCD', name: "McDonald's Corporation", sector: 'Consumer', industry: 'Restaurants' },
  { ticker: 'NKE', name: 'Nike Inc.', sector: 'Consumer', industry: 'Apparel' },
  { ticker: 'SBUX', name: 'Starbucks Corporation', sector: 'Consumer', industry: 'Restaurants' },
  { ticker: 'HD', name: 'Home Depot Inc.', sector: 'Consumer', industry: 'Retail' },
  { ticker: 'TGT', name: 'Target Corporation', sector: 'Consumer', industry: 'Retail' },

  // Energy/Industrial (10)
  { ticker: 'XOM', name: 'Exxon Mobil Corporation', sector: 'Energy', industry: 'Oil & Gas' },
  { ticker: 'CVX', name: 'Chevron Corporation', sector: 'Energy', industry: 'Oil & Gas' },
  { ticker: 'BA', name: 'Boeing Company', sector: 'Industrial', industry: 'Aerospace' },
  { ticker: 'CAT', name: 'Caterpillar Inc.', sector: 'Industrial', industry: 'Machinery' },
  { ticker: 'GE', name: 'General Electric Co.', sector: 'Industrial', industry: 'Conglomerate' },
  { ticker: 'HON', name: 'Honeywell International', sector: 'Industrial', industry: 'Conglomerate' },
  { ticker: 'UPS', name: 'United Parcel Service', sector: 'Industrial', industry: 'Logistics' },
  { ticker: 'MMM', name: '3M Company', sector: 'Industrial', industry: 'Conglomerate' },
  { ticker: 'LMT', name: 'Lockheed Martin Corp', sector: 'Industrial', industry: 'Defense' },
  { ticker: 'RTX', name: 'RTX Corporation', sector: 'Industrial', industry: 'Aerospace & Defense' },
];

// Influential accounts for the Hype Model
const influencers = [
  // Tech
  { platform: 'twitter', handle: 'elonmusk', name: 'Elon Musk', weight: 1.5 },
  { platform: 'twitter', handle: 'satlonarayana', name: 'Satya Nadella', weight: 1.0 },
  { platform: 'twitter', handle: 'tim_cook', name: 'Tim Cook', weight: 1.0 },

  // Politics/Economy
  { platform: 'truthsocial', handle: 'realDonaldTrump', name: 'Donald Trump', weight: 1.5 },
  { platform: 'twitter', handle: 'POTUS', name: 'President of the United States', weight: 1.2 },

  // Finance
  { platform: 'twitter', handle: 'jimcramer', name: 'Jim Cramer', weight: 0.8 },
  { platform: 'twitter', handle: 'unusual_whales', name: 'Unusual Whales', weight: 0.9 },
  { platform: 'twitter', handle: 'chaikinadamm', name: 'Adam Khoo', weight: 0.7 },

  // Crypto-adjacent (often moves tech stocks)
  { platform: 'twitter', handle: 'michael_saylor', name: 'Michael Saylor', weight: 1.0 },
  { platform: 'twitter', handle: 'CathieDWood', name: 'Cathie Wood', weight: 1.1 },
];

async function main() {
  console.log('🌱 Starting database seed...\n');

  // Seed companies
  console.log('📊 Seeding companies...');
  let companiesCreated = 0;
  let companiesSkipped = 0;

  for (const company of companies) {
    try {
      await prisma.company.upsert({
        where: { ticker: company.ticker },
        update: {
          name: company.name,
          sector: company.sector,
          industry: company.industry,
        },
        create: {
          ticker: company.ticker,
          name: company.name,
          sector: company.sector,
          industry: company.industry,
          isActive: true,
        },
      });
      companiesCreated++;
      console.log(`  ✓ ${company.ticker} - ${company.name}`);
    } catch (error) {
      companiesSkipped++;
      console.log(`  ✗ ${company.ticker} - Error: ${error}`);
    }
  }

  console.log(`\n  Companies: ${companiesCreated} created/updated, ${companiesSkipped} skipped\n`);

  // Seed influential accounts
  console.log('👤 Seeding influential accounts...');
  let accountsCreated = 0;
  let accountsSkipped = 0;

  for (const influencer of influencers) {
    try {
      await prisma.influentialAccount.upsert({
        where: {
          platform_handle: {
            platform: influencer.platform,
            handle: influencer.handle,
          },
        },
        update: {
          name: influencer.name,
          weight: influencer.weight,
        },
        create: {
          platform: influencer.platform,
          handle: influencer.handle,
          name: influencer.name,
          weight: influencer.weight,
          isActive: true,
        },
      });
      accountsCreated++;
      console.log(`  ✓ @${influencer.handle} (${influencer.platform}) - ${influencer.name}`);
    } catch (error) {
      accountsSkipped++;
      console.log(`  ✗ @${influencer.handle} - Error: ${error}`);
    }
  }

  console.log(`\n  Accounts: ${accountsCreated} created/updated, ${accountsSkipped} skipped\n`);

  // Summary
  const totalCompanies = await prisma.company.count();
  const totalAccounts = await prisma.influentialAccount.count();

  console.log('✅ Seed completed!');
  console.log(`   Total companies in database: ${totalCompanies}`);
  console.log(`   Total influential accounts: ${totalAccounts}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
