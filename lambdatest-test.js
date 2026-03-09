import webdriver from 'selenium-webdriver';
import config from './lambdatest-config.js';

// Target URL
const TARGET_URL = process.env.TEST_URL || 'https://lankoping.se';

// Pages to test
const TEST_PAGES = [
  '/',
  '/nyheter',
  '/blogs',
  '/team',
  '/privacy',
  '/rules'
];

// Performance metrics tracker
class PerformanceMetrics {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
  }

  addResult(result) {
    this.results.push(result);
  }

  getSummary() {
    const successful = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const avgLoadTime = this.results
      .filter(r => r.loadTime)
      .reduce((sum, r) => sum + r.loadTime, 0) / (this.results.length || 1);
    
    return {
      total: this.results.length,
      successful,
      failed,
      successRate: (successful / (this.results.length || 1) * 100).toFixed(2),
      avgLoadTime: avgLoadTime.toFixed(2),
      duration: ((Date.now() - this.startTime) / 1000).toFixed(2)
    };
  }

  printProgress() {
    const summary = this.getSummary();
    process.stdout.write(`\r📊 Progress: ${summary.total}/250 | ✓ ${summary.successful} | ✗ ${summary.failed} | Avg: ${summary.avgLoadTime}ms`);
  }
}

const metrics = new PerformanceMetrics();

// Run a single test on a device
async function runTest(capability, index) {
  const capabilities = {
    ...config.commonCapabilities,
    ...capability,
  };

  let driver;
  const testStart = Date.now();
  
  try {
    // Create WebDriver instance
    driver = new webdriver.Builder()
      .usingServer(`https://${config.user}:${config.key}@${config.gridURL}`)
      .withCapabilities(capabilities)
      .build();

    // Random page selection
    const testPage = TEST_PAGES[Math.floor(Math.random() * TEST_PAGES.length)];
    const url = `${TARGET_URL}${testPage}`;

    // Navigate to page
    await driver.get(url);

    // Wait for page to load
    await driver.wait(function() {
      return driver.executeScript('return document.readyState').then(function(readyState) {
        return readyState === 'complete';
      });
    }, 30000);

    // Get page title
    const title = await driver.getTitle();
    
    // Collect performance metrics
    const perfData = await driver.executeScript(`
      const perfData = window.performance.getEntriesByType('navigation')[0];
      return {
        loadTime: perfData ? perfData.loadEventEnd - perfData.fetchStart : 0,
        domContentLoaded: perfData ? perfData.domContentLoadedEventEnd - perfData.fetchStart : 0,
        firstPaint: performance.getEntriesByType('paint').find(p => p.name === 'first-paint')?.startTime || 0
      };
    `);

    const loadTime = Date.now() - testStart;

    // Mark test as passed in LambdaTest
    await driver.executeScript('lambda-status=passed');

    metrics.addResult({
      device: capability.name,
      page: testPage,
      success: true,
      loadTime,
      title,
      ...perfData
    });

  } catch (error) {
    const loadTime = Date.now() - testStart;
    
    if (driver) {
      try {
        await driver.executeScript('lambda-status=failed');
      } catch (e) {}
    }

    metrics.addResult({
      device: capability.name,
      success: false,
      loadTime,
      error: error.message
    });
  } finally {
    if (driver) {
      await driver.quit().catch(() => {});
    }
    metrics.printProgress();
  }
}

// Main execution
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        LambdaTest Performance Test - 250 Devices          ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  if (!config.user || !config.key) {
    console.error('❌ Error: LambdaTest credentials not found!');
    console.error('Please set environment variables:');
    console.error('  export LT_USERNAME="your_username"');
    console.error('  export LT_ACCESS_KEY="your_access_key"');
    console.error('\nGet credentials from: https://accounts.lambdatest.com/detail/profile');
    process.exit(1);
  }

  console.log(`🎯 Target URL:     ${TARGET_URL}`);
  console.log(`📱 Total devices:  ${config.capabilities.length}`);
  console.log(`⚡ Parallel tests:  ${config.maxParallel} (GitHub Student Pack)`);
  console.log(`⏱️  Est. duration:  ~${Math.ceil(config.capabilities.length / config.maxParallel * 30 / 60)} minutes (tests run sequentially)\n`);
  console.log(`🎓 GitHub Student Benefit: 1 Year Access`);
  console.log(`📺 Live dashboard: https://automation.lambdatest.com/timeline\n`);

  // Run tests in batches
  const capabilities = config.capabilities;
  const batchSize = config.maxParallel;

  for (let i = 0; i < capabilities.length; i += batchSize) {
    const batch = capabilities.slice(i, i + batchSize);
    
    await Promise.allSettled(
      batch.map((cap, idx) => runTest(cap, i + idx))
    );

    // Small pause between batches
    if (i + batchSize < capabilities.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Print final summary
  console.log('\n\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    Test Summary                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  const summary = metrics.getSummary();
  console.log(`\n📊 Total Tests:        ${summary.total}`);
  console.log(`✅ Successful:         ${summary.successful}`);
  console.log(`❌ Failed:             ${summary.failed}`);
  console.log(`📈 Success Rate:       ${summary.successRate}%`);
  console.log(`⚡ Avg Load Time:      ${summary.avgLoadTime}ms`);
  console.log(`⏱️  Total Duration:     ${summary.duration}s (${(summary.duration / 60).toFixed(1)} minutes)`);
  console.log('\n📺 View detailed results: https://automation.lambdatest.com/timeline\n');
}

main().catch(console.error);
