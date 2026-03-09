import cron from 'node-cron'
import { runDailyPerformanceTest } from './performance.js'

let isRunning = false

export function startPerformanceCron() {
  // Schedule performance tests to run at 15:30 (3:30 PM) every day
  // Cron format: minute hour day month weekday
  // 30 15 * * * = At 15:30 every day
  
  console.log('🕐 Performance test cron job initialized')
  console.log('📅 Scheduled to run daily at 15:30')
  
  cron.schedule('30 15 * * *', async () => {
    if (isRunning) {
      console.log('⚠️  Performance test already running, skipping...')
      return
    }

    try {
      isRunning = true
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('🚀 Starting scheduled performance test')
      console.log('⏰ Time:', new Date().toLocaleString('sv-SE'))
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

      const result = await runDailyPerformanceTest()

      if (result.success) {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log('✅ Performance test completed successfully!')
        console.log('📊 Test ID:', result.testId)
        console.log('📈 Success Rate:', `${result.summary.successRate.toFixed(1)}%`)
        console.log('⚡ Avg Load Time:', `${result.summary.avgLoadTime.toFixed(0)}ms`)
        console.log('⏱️  Duration:', `${result.summary.duration.toFixed(0)}s`)
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
      } else {
        console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.error('❌ Performance test failed:', result.error)
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
      }
    } catch (error) {
      console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.error('❌ Performance test error:', error)
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    } finally {
      isRunning = false
    }
  }, {
    scheduled: true,
    timezone: "Europe/Stockholm"
  })

  console.log('✅ Performance test cron job started')
  
  // Log next run time
  const nextRun = getNextRunTime()
  console.log(`⏭️  Next test at: ${nextRun.toLocaleString('sv-SE')}\n`)
}

// Function to manually trigger a test (useful for testing)
export async function runPerformanceTestManually() {
  if (isRunning) {
    return {
      success: false,
      error: 'Test is already running'
    }
  }

  try {
    isRunning = true
    console.log('🔧 Manual performance test triggered')
    const result = await runDailyPerformanceTest()
    return result
  } finally {
    isRunning = false
  }
}

// Helper to calculate next run time
function getNextRunTime(): Date {
  const now = new Date()
  const next = new Date()
  next.setHours(15, 30, 0, 0)
  
  // If it's past 15:30 today, schedule for tomorrow
  if (now.getHours() > 15 || (now.getHours() === 15 && now.getMinutes() >= 30)) {
    next.setDate(next.getDate() + 1)
  }
  
  return next
}

// Verify cron expression is valid
export function validateCronSchedule(): boolean {
  return cron.validate('30 15 * * *')
}
