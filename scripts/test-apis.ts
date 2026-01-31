/**
 * API Test Script
 * ================
 * Tests all API connections to verify configuration.
 *
 * Usage:
 *   npx tsx scripts/test-apis.ts
 */

import 'dotenv/config';

// Colors for console output
const green = '\x1b[32m';
const red = '\x1b[31m';
const yellow = '\x1b[33m';
const cyan = '\x1b[36m';
const reset = '\x1b[0m';

async function testDatabase() {
  console.log(`\n${cyan}📦 Testing Database Connection...${reset}`);

  try {
    const { PrismaClient } = await import('@prisma/client');
    const { PrismaPg } = await import('@prisma/adapter-pg');

    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    const prisma = new PrismaClient({ adapter });

    const companyCount = await prisma.company.count();
    const accountCount = await prisma.influentialAccount.count();

    console.log(`${green}  ✓ Database connected!${reset}`);
    console.log(`    Companies: ${companyCount}`);
    console.log(`    Influencers: ${accountCount}`);

    await prisma.$disconnect();
    return true;
  } catch (error) {
    console.log(`${red}  ✗ Database connection failed${reset}`);
    console.log(`    Error: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

async function testGemini() {
  console.log(`\n${cyan}🤖 Testing Gemini API...${reset}`);

  if (!process.env.GEMINI_API_KEY) {
    console.log(`${yellow}  ⚠ GEMINI_API_KEY not set - skipping${reset}`);
    return false;
  }

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const result = await model.generateContent('Respond with only: "API connection successful"');
    const response = result.response.text();

    console.log(`${green}  ✓ Gemini API connected!${reset}`);
    console.log(`    Response: ${response.trim()}`);
    return true;
  } catch (error) {
    console.log(`${red}  ✗ Gemini API failed${reset}`);
    console.log(`    Error: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

async function testFinnhub() {
  console.log(`\n${cyan}📈 Testing Finnhub API...${reset}`);

  if (!process.env.FINNHUB_API_KEY) {
    console.log(`${yellow}  ⚠ FINNHUB_API_KEY not set - skipping${reset}`);
    return false;
  }

  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=AAPL&token=${process.env.FINNHUB_API_KEY}`
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.c === 0 && data.h === 0) {
      throw new Error('Invalid API key or rate limited');
    }

    console.log(`${green}  ✓ Finnhub API connected!${reset}`);
    console.log(`    AAPL Price: $${data.c.toFixed(2)}`);
    console.log(`    Change: ${data.dp >= 0 ? '+' : ''}${data.dp.toFixed(2)}%`);
    return true;
  } catch (error) {
    console.log(`${red}  ✗ Finnhub API failed${reset}`);
    console.log(`    Error: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

async function testNewsAnalysis() {
  console.log(`\n${cyan}📰 Testing News Analysis (Gemini)...${reset}`);

  if (!process.env.GEMINI_API_KEY) {
    console.log(`${yellow}  ⚠ GEMINI_API_KEY not set - skipping${reset}`);
    return false;
  }

  try {
    const { gemini } = await import('../src/lib/gemini');

    const testArticle = {
      title: 'Apple Reports Record iPhone Sales in Q4',
      content: 'Apple Inc. announced today that iPhone sales exceeded expectations in the fourth quarter, driven by strong demand for the iPhone 15 Pro models. Revenue increased 12% year-over-year, beating analyst estimates. CEO Tim Cook expressed optimism about the upcoming holiday season.'
    };

    const analysis = await gemini.analyzeNewsArticle(testArticle.title, testArticle.content);

    console.log(`${green}  ✓ News analysis working!${reset}`);
    console.log(`    Summary: ${analysis.summary.substring(0, 80)}...`);
    console.log(`    Companies found: ${analysis.companies.map(c => c.ticker).join(', ') || 'none'}`);
    console.log(`    Category: ${analysis.category}`);
    console.log(`    Importance: ${(analysis.importance * 100).toFixed(0)}%`);
    return true;
  } catch (error) {
    console.log(`${red}  ✗ News analysis failed${reset}`);
    console.log(`    Error: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

async function main() {
  console.log(`${cyan}╔════════════════════════════════════════╗${reset}`);
  console.log(`${cyan}║    Market Predictor - API Test Suite   ║${reset}`);
  console.log(`${cyan}╚════════════════════════════════════════╝${reset}`);

  const results = {
    database: await testDatabase(),
    gemini: await testGemini(),
    finnhub: await testFinnhub(),
    newsAnalysis: await testNewsAnalysis(),
  };

  console.log(`\n${cyan}════════════════════════════════════════${reset}`);
  console.log(`${cyan}Summary:${reset}`);
  console.log(`  Database:     ${results.database ? `${green}✓ Pass${reset}` : `${red}✗ Fail${reset}`}`);
  console.log(`  Gemini:       ${results.gemini ? `${green}✓ Pass${reset}` : `${yellow}⚠ Skipped${reset}`}`);
  console.log(`  Finnhub:      ${results.finnhub ? `${green}✓ Pass${reset}` : `${yellow}⚠ Skipped${reset}`}`);
  console.log(`  News Analysis: ${results.newsAnalysis ? `${green}✓ Pass${reset}` : `${yellow}⚠ Skipped${reset}`}`);

  const allPassed = Object.values(results).every(r => r);
  const anyPassed = Object.values(results).some(r => r);

  console.log(`\n${allPassed ? green : anyPassed ? yellow : red}${
    allPassed ? '✅ All tests passed!' :
    anyPassed ? '⚠️  Some tests skipped or failed' :
    '❌ All tests failed'
  }${reset}\n`);
}

main().catch(console.error);
