import webdriver from 'selenium-webdriver'
import { db } from '../db/index.js'
import { performanceTests, performanceTestResults } from '../db/schema.js'
import { eq } from 'drizzle-orm'

const LT_USERNAME = process.env.LT_USERNAME
const LT_ACCESS_KEY = process.env.LT_ACCESS_KEY
const TARGET_URL = process.env.TEST_URL || 'https://lankoping.se'
const GRID_URL = 'hub.lambdatest.com/wd/hub'

const TEST_PAGES = ['/', '/nyheter', '/blogs', '/team', '/privacy', '/rules']

// 20 device configurations for balanced testing (10 Desktop, 10 Real Mobile)
const DAILY_TEST_DEVICES = [
  // Desktop Computers (10)
  { browserName: 'Chrome', browserVersion: 'latest', platform: 'Windows 11', resolution: '1920x1080', name: 'Win 11 - Chrome' },
  { browserName: 'Firefox', browserVersion: 'latest', platform: 'Windows 11', resolution: '1920x1080', name: 'Win 11 - Firefox' },
  { browserName: 'MicrosoftEdge', browserVersion: 'latest', platform: 'Windows 11', resolution: '1920x1080', name: 'Win 11 - Edge' },
  { browserName: 'Chrome', browserVersion: 'latest', platform: 'Windows 10', resolution: '1920x1080', name: 'Win 10 - Chrome' },
  { browserName: 'Safari', browserVersion: 'latest', platform: 'macOS Ventura', resolution: '1920x1080', name: 'Mac Ventura - Safari' },
  { browserName: 'Chrome', browserVersion: 'latest', platform: 'macOS Sonoma', resolution: '1920x1080', name: 'Mac Sonoma - Chrome' },
  { browserName: 'Firefox', browserVersion: 'latest', platform: 'macOS Sonoma', resolution: '1920x1080', name: 'Mac Sonoma - Firefox' },
  { browserName: 'Chrome', browserVersion: 'latest', platform: 'macOS Monterey', resolution: '1920x1080', name: 'Mac Monterey - Chrome' },
  { browserName: 'MicrosoftEdge', browserVersion: 'latest', platform: 'macOS Sonoma', resolution: '1920x1080', name: 'Mac Sonoma - Edge' },
  { browserName: 'Chrome', browserVersion: 'latest', platform: 'Windows 11', resolution: '2560x1440', name: 'Win 11 - Chrome HighRes' },

  // Real Mobile Devices (10)
  { browserName: 'Chrome', platformName: 'Android', deviceName: 'Galaxy S23', platformVersion: '13', name: 'Android - Galaxy S23' },
  { browserName: 'Chrome', platformName: 'Android', deviceName: 'Galaxy S22 Ultra 5G', platformVersion: '12', name: 'Android - S22 Ultra' },
  { browserName: 'Chrome', platformName: 'Android', deviceName: 'Pixel 7', platformVersion: '13', name: 'Android - Pixel 7' },
  { browserName: 'Chrome', platformName: 'Android', deviceName: 'OnePlus 11', platformVersion: '13', name: 'Android - OnePlus 11' },
  { browserName: 'Chrome', platformName: 'Android', deviceName: 'Redmi Note 12', platformVersion: '13', name: 'Android - Redmi 12' },
  { browserName: 'Safari', platformName: 'iOS', deviceName: 'iPhone 15', platformVersion: '17', name: 'iOS - iPhone 15' },
  { browserName: 'Safari', platformName: 'iOS', deviceName: 'iPhone 14 Pro', platformVersion: '16', name: 'iOS - iPhone 14 Pro' },
  { browserName: 'Safari', platformName: 'iOS', deviceName: 'iPhone 13', platformVersion: '15', name: 'iOS - iPhone 13' },
  { browserName: 'Safari', platformName: 'iOS', deviceName: 'iPhone 12', platformVersion: '14', name: 'iOS - iPhone 12' },
  { browserName: 'Safari', platformName: 'iOS', deviceName: 'iPhone SE 2022', platformVersion: '15', name: 'iOS - iPhone SE' },
]

interface TestResult {
  device: string
  browser: string
  platform: string
  page: string
  success: boolean
  loadTime: number
  domContentLoaded?: number
  firstPaint?: number
  title?: string
  error?: string
}

async function runSingleTest(capability: any): Promise<TestResult> {
  const capabilities = {
    build: `Daily Performance Test - ${new Date().toISOString()}`,
    name: capability.name,
    project: 'Websida',
    w3c: true,
    plugin: 'node_js-node_js',
    video: true,
    network: true,
    console: true,
    visual: true,
    ...capability,
  }

  let driver
  const testStart = Date.now()
  const testPage = TEST_PAGES[Math.floor(Math.random() * TEST_PAGES.length)]
  const url = `${TARGET_URL}${testPage}`

  try {
    const hub = `https://${process.env.LT_USERNAME}:${process.env.LT_ACCESS_KEY}@hub.lambdatest.com/wd/hub`
    driver = new webdriver.Builder()
      .usingServer(hub)
      .withCapabilities(capabilities)
      .build()

    await driver.get(url)

    // Wait for the critical content to be interactive
    await driver.wait(
      function () {
        return driver
          .executeScript('return document.readyState')
          .then(function (readyState) {
            return readyState === 'complete'
          })
      },
      30000,
    )

    // Calculate Latency using Navigation Timing API for precision
    // If precision timing fails, we fallback to the Date.now() duration
    const perfData = await driver.executeScript(`
      const [entry] = performance.getEntriesByType('navigation');
      if (!entry) return null;
      return {
        loadTime: Math.round(entry.loadEventEnd - entry.startTime),
        domContentLoaded: Math.round(entry.domContentLoadedEventEnd - entry.startTime),
        firstPaint: Math.round(performance.getEntriesByType('paint').find(p => p.name === 'first-paint')?.startTime || 0)
      };
    `) as any;

    const title = await driver.getTitle()
    const loadTime = perfData?.loadTime || (Date.now() - testStart)

    await driver.executeScript('lambda-status=passed')

    return {
      device: capability.name,
      browser: capability.browserName,
      platform: capability.platform || capability.platformName,
      page: testPage,
      success: true,
      loadTime,
      domContentLoaded: perfData?.domContentLoaded,
      firstPaint: perfData?.firstPaint,
      title,
    }
  } catch (error: any) {
    const loadTime = Date.now() - testStart

    if (driver) {
      try {
        await driver.executeScript('lambda-status=failed')
      } catch {}
    }

    return {
      device: capability.name,
      browser: capability.browserName || 'Unknown',
      platform: capability.platform || 'Unknown',
      page: testPage,
      success: false,
      loadTime,
      error: error.message,
    }
  } finally {
    if (driver) {
      await driver.quit().catch(() => {})
    }
  }
}

export async function runDailyPerformanceTest() {
  if (!LT_USERNAME || !LT_ACCESS_KEY) {
    console.error('LambdaTest credentials not configured')
    return {
      success: false,
      error: 'LambdaTest credentials not configured',
    }
  }

  const startTime = Date.now()

  const [test] = await db
    .insert(performanceTests)
    .values({
      testDate: new Date(),
      totalTests: DAILY_TEST_DEVICES.length,
      successfulTests: 0,
      failedTests: 0,
      successRate: 0,
      avgLoadTime: 0,
      duration: 0,
      status: 'running',
    })
    .returning()

  const results: TestResult[] = []

  console.log(`Starting performance test Matrix (${DAILY_TEST_DEVICES.length} unique devices)...`)

  // Run tests with parallelism of 2 to stay within pack limits
  // but finish significantly faster than sequential runs.
  const batchSize = 2;
  for (let i = 0; i < DAILY_TEST_DEVICES.length; i += batchSize) {
    const batch = DAILY_TEST_DEVICES.slice(i, i + batchSize);
    console.log(`Executing device batch ${Math.floor(i/batchSize) + 1}...`);
    
    const batchPromises = batch.map(device => 
      runSingleTest(device).then(async (result) => {
        results.push(result);
        
        // Track progress in DB as results come back
        await db.insert(performanceTestResults).values({
          testId: test.id,
          deviceName: result.device,
          browserName: result.browser,
          platform: result.platform,
          page: result.page,
          loadTime: result.loadTime,
          domContentLoaded: result.domContentLoaded || null,
          firstPaint: result.firstPaint || null,
          success: result.success,
          error: result.error || null,
          pageTitle: result.title || null,
        });

        console.log(`OK ${result.device} - ${result.success ? 'Pass' : 'Fail'} - ${result.loadTime}ms - ${result.page}`);
        return result;
      }).catch(err => {
        console.error(`Batch fatal error check: ${err.message}`);
        return null;
      })
    );

    await Promise.all(batchPromises);
    
    // Minor throttle between batches to avoid session overlap errors
    if (i + batchSize < DAILY_TEST_DEVICES.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  const duration = (Date.now() - startTime) / 1000
  const successfulTests = results.filter((r) => r.success).length
  const failedTests = results.filter((r) => !r.success).length
  const successRate = (successfulTests / results.length) * 100
  const avgLoadTime = results.reduce((sum, r) => sum + r.loadTime, 0) / results.length
  const loadTimes = results.map((r) => r.loadTime)
  const minLoadTime = Math.min(...loadTimes)
  const maxLoadTime = Math.max(...loadTimes)

  await db
    .update(performanceTests)
    .set({
      successfulTests,
      failedTests,
      successRate,
      avgLoadTime,
      minLoadTime,
      maxLoadTime,
      duration,
      status: 'completed',
      results: results,
    })
    .where(eq(performanceTests.id, test.id))

  console.log('Daily performance test completed')
  console.log(`Total: ${results.length} | Success: ${successfulTests} | Failed: ${failedTests}`)
  console.log(`Success Rate: ${successRate.toFixed(2)}% | Avg Load Time: ${avgLoadTime.toFixed(2)}ms`)

  return {
    success: true,
    testId: test.id,
    summary: {
      total: results.length,
      successful: successfulTests,
      failed: failedTests,
      successRate,
      avgLoadTime,
      duration,
    },
  }
}

export async function getPerformanceTestHistory(limit = 30) {
  const tests = await db
    .select()
    .from(performanceTests)
    .orderBy(performanceTests.testDate)
    .limit(limit)

  return tests
}

export async function getPerformanceTestDetails(testId: number) {
  const [test] = await db
    .select()
    .from(performanceTests)
    .where(eq(performanceTests.id, testId))

  if (!test) {
    return null
  }

  const results = await db
    .select()
    .from(performanceTestResults)
    .where(eq(performanceTestResults.testId, testId))

  return {
    ...test,
    results,
  }
}