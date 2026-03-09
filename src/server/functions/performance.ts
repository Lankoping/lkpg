import webdriver from 'selenium-webdriver'
import { db } from '../db/index.js'
import { performanceTests, performanceTestResults } from '../db/schema.js'

const LT_USERNAME = process.env.LT_USERNAME
const LT_ACCESS_KEY = process.env.LT_ACCESS_KEY
const TARGET_URL = process.env.TEST_URL || 'https://lankoping.se'
const GRID_URL = 'hub.lambdatest.com/wd/hub'

const TEST_PAGES = ['/', '/nyheter', '/blogs', '/team', '/privacy', '/rules']

// 25 device configurations for daily testing
const DAILY_TEST_DEVICES = [
  // Chrome Windows (8)
  ...Array(8).fill(null).map((_, i) => ({
    browserName: 'Chrome',
    browserVersion: 'latest',
    platform: 'Windows 11',
    resolution: '1920x1080',
    name: `Chrome Win ${i + 1}`,
  })),
  // Firefox Windows (5)
  ...Array(5).fill(null).map((_, i) => ({
    browserName: 'Firefox',
    browserVersion: 'latest',
    platform: 'Windows 11',
    resolution: '1920x1080',
    name: `Firefox Win ${i + 1}`,
  })),
  // Edge Windows (4)
  ...Array(4).fill(null).map((_, i) => ({
    browserName: 'MicrosoftEdge',
    browserVersion: 'latest',
    platform: 'Windows 11',
    resolution: '1920x1080',
    name: `Edge Win ${i + 1}`,
  })),
  // Safari macOS (4)
  ...Array(4).fill(null).map((_, i) => ({
    browserName: 'Safari',
    browserVersion: 'latest',
    platform: 'macOS Ventura',
    resolution: '1920x1080',
    name: `Safari Mac ${i + 1}`,
  })),
  // Mobile emulation (4)
  ...Array(4).fill(null).map((_, i) => ({
    browserName: 'Chrome',
    browserVersion: 'latest',
    platform: 'Windows 11',
    resolution: '414x896',
    name: `Mobile Emulation ${i + 1}`,
  })),
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
    driver = new webdriver.Builder()
      .usingServer(`https://${LT_USERNAME}:${LT_ACCESS_KEY}@${GRID_URL}`)
      .withCapabilities(capabilities)
      .build()

    await driver.get(url)

    await driver.wait(
      function () {
        return driver
          .executeScript('return document.readyState')
          .then(function (readyState) {
            return readyState === 'complete'
          })
      },
      30000
    )

    const title = await driver.getTitle()

    const perfData = await driver.executeScript(`
      const perfData = window.performance.getEntriesByType('navigation')[0];
      return {
        loadTime: perfData ? perfData.loadEventEnd - perfData.fetchStart : 0,
        domContentLoaded: perfData ? perfData.domContentLoadedEventEnd - perfData.fetchStart : 0,
        firstPaint: performance.getEntriesByType('paint').find(p => p.name === 'first-paint')?.startTime || 0
      };
    `)

    const loadTime = Date.now() - testStart

    await driver.executeScript('lambda-status=passed')

    return {
      device: capability.name,
      browser: capability.browserName,
      platform: capability.platform,
      page: testPage,
      success: true,
      loadTime,
      domContentLoaded: perfData.domContentLoaded,
      firstPaint: perfData.firstPaint,
      title,
    }
  } catch (error: any) {
    const loadTime = Date.now() - testStart

    if (driver) {
      try {
        await driver.executeScript('lambda-status=failed')
      } catch (e) {}
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

  // Create test record
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

  console.log(`Starting daily performance test (${DAILY_TEST_DEVICES.length} devices)...`)

  // Run tests sequentially (GitHub Student Pack = 1 parallel)
  for (const device of DAILY_TEST_DEVICES) {
    try {
      const result = await runSingleTest(device)
      results.push(result)

      // Save individual result to database
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
      })

      console.log(
        `✓ ${result.device} - ${result.success ? 'Pass' : 'Fail'} - ${result.loadTime}ms`
      )
    } catch (error) {
      console.error(`Error testing ${device.name}:`, error)
    }
  }

  const duration = (Date.now() - startTime) / 1000
  const successfulTests = results.filter((r) => r.success).length
  const failedTests = results.filter((r) => !r.success).length
  const successRate = (successfulTests / results.length) * 100
  const avgLoadTime =
    results.reduce((sum, r) => sum + r.loadTime, 0) / results.length
  const loadTimes = results.map((r) => r.loadTime)
  const minLoadTime = Math.min(...loadTimes)
  const maxLoadTime = Math.max(...loadTimes)

  // Update test record with final results
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
    .where({ id: test.id })

  console.log(`\nDaily performance test completed!`)
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
    .where({ id: testId })

  if (!test) {
    return null
  }

  const results = await db
    .select()
    .from(performanceTestResults)
    .where({ testId })

  return {
    ...test,
    results,
  }
}
