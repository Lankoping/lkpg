import { createFileRoute } from '@tanstack/react-router'
import { getPerformanceTestHistory } from '../../server/functions/performance'
import { useState } from 'react'

export const Route = createFileRoute('/admin/performance')({
  loader: async () => {
    const tests = await getPerformanceTestHistory(30)
    return { tests }
  },
  component: PerformanceDashboard,
})

function PerformanceDashboard() {
  const { tests } = Route.useLoaderData()
  const [selectedTest, setSelectedTest] = useState<number | null>(null)
  const [isRunningTest, setIsRunningTest] = useState(false)

  const handleRunTest = async () => {
    if (!confirm('Run performance test now? This will take about 12-15 minutes.')) {
      return
    }

    setIsRunningTest(true)
    try {
      const response = await fetch('/api/performance-run')
      const result = await response.json()
      
      if (result.success) {
        alert(`Test started! Test ID: ${result.testId}\n\nRefresh this page after 12-15 minutes to see results.`)
        window.location.reload()
      } else {
        alert(`Test failed: ${result.error}`)
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    } finally {
      setIsRunningTest(false)
    }
  }

  const latestTest = tests[tests.length - 1]
  const avgSuccessRate = tests.length > 0
    ? tests.reduce((sum, t) => sum + t.successRate, 0) / tests.length
    : 0
  const avgLoadTime = tests.length > 0
    ? tests.reduce((sum, t) => sum + t.avgLoadTime, 0) / tests.length
    : 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#C04A2A] font-medium mb-2">
            LambdaTest Performance
          </p>
          <h1 className="font-display text-4xl tracking-wide text-[#F0E8D8]">
            Test Results
          </h1>
        </div>
        <button
          onClick={handleRunTest}
          disabled={isRunningTest}
          className="bg-[#C04A2A] hover:bg-[#C04A2A]/80 disabled:bg-[#C04A2A]/50 text-[#F0E8D8] px-6 py-3 rounded-sm text-sm uppercase tracking-wider transition-colors disabled:cursor-not-allowed"
        >
          {isRunningTest ? 'Running...' : 'Run Test Now'}
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#141210]/80 border border-[#C04A2A]/20 p-6 rounded-sm">
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#C04A2A] mb-2">
            Total Tests
          </p>
          <p className="text-3xl font-display text-[#F0E8D8]">{tests.length}</p>
        </div>

        <div className="bg-[#141210]/80 border border-[#C04A2A]/20 p-6 rounded-sm">
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#C04A2A] mb-2">
            Avg Success Rate
          </p>
          <p className="text-3xl font-display text-[#F0E8D8]">
            {avgSuccessRate.toFixed(1)}%
          </p>
        </div>

        <div className="bg-[#141210]/80 border border-[#C04A2A]/20 p-6 rounded-sm">
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#C04A2A] mb-2">
            Avg Load Time
          </p>
          <p className="text-3xl font-display text-[#F0E8D8]">
            {avgLoadTime.toFixed(0)}ms
          </p>
        </div>

        <div className="bg-[#141210]/80 border border-[#C04A2A]/20 p-6 rounded-sm">
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#C04A2A] mb-2">
            Latest Test
          </p>
          <p className="text-3xl font-display text-[#F0E8D8]">
            {latestTest?.status === 'completed' ? '✓' : latestTest?.status === 'running' ? '⟳' : '✗'}
          </p>
        </div>
      </div>

      {/* Latest Test Details */}
      {latestTest && (
        <div className="bg-[#141210]/80 border border-[#C04A2A]/20 p-6 rounded-sm">
          <h2 className="text-xl font-display text-[#F0E8D8] mb-4">Latest Test Results</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div>
              <p className="text-[#C04A2A] text-xs uppercase tracking-wider mb-1">Date</p>
              <p className="text-[#F0E8D8]">
                {new Date(latestTest.testDate).toLocaleDateString('sv-SE')}
              </p>
            </div>
            <div>
              <p className="text-[#C04A2A] text-xs uppercase tracking-wider mb-1">Total</p>
              <p className="text-[#F0E8D8]">{latestTest.totalTests}</p>
            </div>
            <div>
              <p className="text-[#C04A2A] text-xs uppercase tracking-wider mb-1">Success</p>
              <p className="text-green-400">{latestTest.successfulTests}</p>
            </div>
            <div>
              <p className="text-[#C04A2A] text-xs uppercase tracking-wider mb-1">Failed</p>
              <p className="text-red-400">{latestTest.failedTests}</p>
            </div>
            <div>
              <p className="text-[#C04A2A] text-xs uppercase tracking-wider mb-1">Avg Load</p>
              <p className="text-[#F0E8D8]">{latestTest.avgLoadTime.toFixed(0)}ms</p>
            </div>
          </div>

          {/* Performance Bar */}
          <div className="mt-4">
            <div className="h-2 bg-[#100E0C] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-[#C04A2A]"
                style={{ width: `${latestTest.successRate}%` }}
              />
            </div>
            <p className="text-xs text-[#F0E8D8]/70 mt-1">
              {latestTest.successRate.toFixed(1)}% Success Rate
            </p>
          </div>
        </div>
      )}

      {/* Test History Table */}
      <div className="bg-[#141210]/80 border border-[#C04A2A]/20 rounded-sm overflow-hidden">
        <div className="p-6 border-b border-[#C04A2A]/20">
          <h2 className="text-xl font-display text-[#F0E8D8]">Test History</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#100E0C]/50">
              <tr>
                <th className="text-left p-4 text-[10px] uppercase tracking-[0.28em] text-[#C04A2A]">
                  Date
                </th>
                <th className="text-left p-4 text-[10px] uppercase tracking-[0.28em] text-[#C04A2A]">
                  Status
                </th>
                <th className="text-left p-4 text-[10px] uppercase tracking-[0.28em] text-[#C04A2A]">
                  Total
                </th>
                <th className="text-left p-4 text-[10px] uppercase tracking-[0.28em] text-[#C04A2A]">
                  Success
                </th>
                <th className="text-left p-4 text-[10px] uppercase tracking-[0.28em] text-[#C04A2A]">
                  Failed
                </th>
                <th className="text-left p-4 text-[10px] uppercase tracking-[0.28em] text-[#C04A2A]">
                  Success Rate
                </th>
                <th className="text-left p-4 text-[10px] uppercase tracking-[0.28em] text-[#C04A2A]">
                  Avg Load
                </th>
                <th className="text-left p-4 text-[10px] uppercase tracking-[0.28em] text-[#C04A2A]">
                  Duration
                </th>
              </tr>
            </thead>
            <tbody>
              {tests.slice().reverse().map((test) => (
                <tr
                  key={test.id}
                  className="border-t border-[#C04A2A]/10 hover:bg-[#100E0C]/30 transition-colors"
                >
                  <td className="p-4 text-[#F0E8D8]">
                    {new Date(test.testDate).toLocaleString('sv-SE', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="p-4">
                    <span
                      className={`inline-flex items-center px-2 py-1 text-xs rounded-full ${
                        test.status === 'completed'
                          ? 'bg-green-500/20 text-green-400'
                          : test.status === 'running'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {test.status}
                    </span>
                  </td>
                  <td className="p-4 text-[#F0E8D8]">{test.totalTests}</td>
                  <td className="p-4 text-green-400">{test.successfulTests}</td>
                  <td className="p-4 text-red-400">{test.failedTests}</td>
                  <td className="p-4 text-[#F0E8D8]">
                    {test.successRate.toFixed(1)}%
                  </td>
                  <td className="p-4 text-[#F0E8D8]">
                    {test.avgLoadTime.toFixed(0)}ms
                  </td>
                  <td className="p-4 text-[#F0E8D8]">
                    {test.duration.toFixed(0)}s
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {tests.length === 0 && (
            <div className="p-12 text-center">
              <p className="text-[#F0E8D8]/50 text-sm">
                No performance tests run yet. Tests will run daily at 15:30.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Chart would go here - could add a simple line chart showing trends */}
      {tests.length > 1 && (
        <div className="bg-[#141210]/80 border border-[#C04A2A]/20 p-6 rounded-sm">
          <h2 className="text-xl font-display text-[#F0E8D8] mb-4">Performance Trend</h2>
          <div className="h-64 flex items-end justify-between gap-2">
            {tests.slice(-10).map((test, i) => {
              const height = (test.successRate / 100) * 100
              return (
                <div key={test.id} className="flex-1 flex flex-col items-center gap-2">
                  <div
                    className="w-full bg-gradient-to-t from-[#C04A2A] to-green-500 rounded-t transition-all hover:opacity-80"
                    style={{ height: `${height}%` }}
                    title={`${test.successRate.toFixed(1)}% - ${new Date(test.testDate).toLocaleDateString()}`}
                  />
                  <p className="text-[10px] text-[#F0E8D8]/50 transform -rotate-45 origin-top-left">
                    {new Date(test.testDate).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
