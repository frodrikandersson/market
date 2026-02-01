import { newsProcessor } from './src/services/news-processor';

async function testNewsFetch() {
  try {
    console.log('Fetching news articles...\n');
    const result = await newsProcessor.fetchAndProcessNews();

    console.log('\n=== FETCH RESULT ===');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

testNewsFetch();
