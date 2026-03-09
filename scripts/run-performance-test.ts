import { runDailyPerformanceTest } from './src/server/functions/performance.js'

console.log('Starting scheduled performance test...')
console.log('Time:', new Date().toISOString())

runDailyPerformanceTest()
  .then((result) => {
    if (result.success) {
      console.log('✅ Performance test completed successfully!')
      console.log('Test ID:', result.testId)
      console.log('Summary:', result.summary)
      process.exit(0)
    } else {
      console.error('❌ Performance test failed:', result.error)
      process.exit(1)
    }
  })
  .catch((error) => {
    console.error('❌ Performance test error:', error)
    process.exit(1)
  })
