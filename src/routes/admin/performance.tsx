import { createFileRoute, Link } from '@tanstack/react-router'
import {
  getPerformanceTestHistoryFn,
  type SerializablePerformanceHistoryEntry,
  getPerformanceTestDetailsFn,
} from '../../server/functions/performance'
import { useState, useMemo } from 'react'
import { 
  ChevronRight, 
  Monitor, 
  Smartphone, 
  Globe, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  TrendingUp,
  Zap,
  Shield,
  Search,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/admin/performance')({
  loader: async () => {
    const tests = (await getPerformanceTestHistoryFn({
      data: 30,
    })) as SerializablePerformanceHistoryEntry[]

    return { tests }
  },
  component: PerformanceDashboard,
})

function PerformanceDashboard() {
  const { tests } = Route.useLoaderData()
  const [selectedTest, setSelectedTest] = useState<number | null>(null)
  const [testDetails, setTestDetails] = useState<any>(null)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [isRunningTest, setIsRunningTest] = useState(false)

  const handleRunTest = async () => {
    if (!confirm('Run performance test now? This will take about 12-15 minutes.')) {
      return
    }

    setIsRunningTest(true)
    try {
      const response = await fetch('/performance-run')
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

  const handleViewDetails = async (testId: number) => {
    setSelectedTest(testId)
    setIsLoadingDetails(true)
    try {
      const details = await getPerformanceTestDetailsFn({ data: testId })
      setTestDetails(details)
    } catch (error) {
      console.error('Error fetching details:', error)
    } finally {
      setIsLoadingDetails(false)
    }
  }

  const sortedTests = useMemo(() => [...tests].reverse(), [tests])
  const latestTest = sortedTests[0]
  
  const avgSuccessRate = tests.length > 0
    ? tests.reduce((sum, t) => sum + t.successRate, 0) / tests.length
    : 0
  const avgLoadTime = tests.length > 0
    ? tests.reduce((sum, t) => sum + t.avgLoadTime, 0) / tests.length
    : 0

  // Advanced statistics
  const stats = useMemo(() => {
    if (tests.length === 0) return null
    
    const successful = tests.filter(t => t.status === 'completed')
    if (successful.length === 0) return null

    const lastTwo = successful.slice(-2)
    const trend = lastTwo.length === 2 
      ? lastTwo[1].successRate - lastTwo[0].successRate
      : 0

    return { trend }
  }, [tests])

  return (
    <div className="space-y-10 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Globe className="size-3 text-[#C04A2A]" />
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#C04A2A] font-medium">
            LambdaTest Performance
          </p>
          </div>
          <h1 className="font-display text-5xl tracking-wide text-[#F0E8D8]">
            Test Results
          </h1>
          <p className="text-[#F0E8D8]/50 text-sm mt-2 max-w-xl font-light">
            Comprehensive analytics and real-device monitoring across multiple browsers and platforms.
          </p>
        </div>
        <button
          onClick={handleRunTest}
          disabled={isRunningTest}
          className="bg-[#C04A2A] hover:bg-[#C04A2A]/80 disabled:bg-[#C04A2A]/40 text-[#F0E8D8] px-8 py-4 rounded-sm text-[11px] font-bold uppercase tracking-[0.2em] transition-all disabled:cursor-not-allowed flex items-center gap-3 shadow-[0_0_20px_rgba(192,74,42,0.2)] hover:shadow-[0_0_30px_rgba(192,74,42,0.4)]"
        >
          {isRunningTest ? (
            <>
              <div className="size-3 border-2 border-[#F0E8D8]/30 border-t-[#F0E8D8] rounded-full animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Zap className="size-3 fill-current" />
              Launch Global Test
            </>
          )}
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Executions', value: tests.length, icon: Globe },
          { 
            label: 'Avg Success Rate', 
            value: `${avgSuccessRate.toFixed(1)}%`, 
            icon: Shield,
            trend: stats?.trend
          },
          { label: 'Avg Latency', value: `${avgLoadTime.toFixed(0)}ms`, icon: Clock },
          { 
            label: 'Availability', 
            value: latestTest?.status === 'completed' ? 'Healthy' : latestTest?.status === 'running' ? 'Active' : 'Offline',
            icon: Zap,
            color: latestTest?.status === 'completed' ? 'text-green-400' : 'text-yellow-400'
          },
        ].map((stat, i) => (
          <div key={i} className="bg-[#141210]/60 border border-[#C04A2A]/10 p-6 rounded-sm relative overflow-hidden group hover:border-[#C04A2A]/30 transition-all">
            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <stat.icon className="size-24 text-[#C04A2A]" />
            </div>
            <div className="flex items-center gap-2 mb-4">
              <stat.icon className="size-3 text-[#C04A2A]" />
              <p className="text-[10px] uppercase tracking-[0.28em] text-[#C04A2A]/80 font-bold">
                {stat.label}
              </p>
            </div>
            <div className="flex items-baseline gap-3">
              <p className={stat.color ? `text-4xl font-display ${stat.color}` : "text-4xl font-display text-[#F0E8D8]"}>
                {stat.value}
              </p>
              {stat.trend !== undefined && stat.trend !== 0 && (
                <span className={stat.trend > 0 ? "text-[10px] flex items-center bg-black/20 px-1.5 py-0.5 rounded-full text-green-400" : "text-[10px] flex items-center bg-black/20 px-1.5 py-0.5 rounded-full text-red-400"}>
                  {stat.trend > 0 ? <ArrowUpRight className="size-2 mr-0.5" /> : <ArrowDownRight className="size-2 mr-0.5" />}
                  {Math.abs(stat.trend).toFixed(1)}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Test History Table */}
      <div className="bg-[#141210]/40 border border-[#C04A2A]/10 rounded-sm overflow-hidden backdrop-blur-sm">
        <div className="p-8 border-b border-[#C04A2A]/10 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#C04A2A]/10 rounded-full">
              <TrendingUp className="size-4 text-[#C04A2A]" />
            </div>
            <h2 className="text-2xl font-display text-[#F0E8D8]">Execution History</h2>
          </div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#F0E8D8]/30 font-bold bg-[#100E0C]/50 px-4 py-2 rounded-full border border-[#C04A2A]/5">
            <Search className="size-3" />
            Last 30 Runs
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-[#100E0C]/40 border-b border-[#C04A2A]/10">
              <TableRow>
                <TableHead className="p-6 text-[10px] uppercase tracking-[0.25em] text-[#C04A2A] font-bold">Trace ID</TableHead>
                <TableHead className="p-6 text-[10px] uppercase tracking-[0.25em] text-[#C04A2A] font-bold">Execution Date</TableHead>
                <TableHead className="p-6 text-[10px] uppercase tracking-[0.25em] text-[#C04A2A] font-bold">Condition</TableHead>
                <TableHead className="p-6 text-[10px] uppercase tracking-[0.25em] text-[#C04A2A] font-bold">Quality</TableHead>
                <TableHead className="p-6 text-[10px] uppercase tracking-[0.25em] text-[#C04A2A] font-bold">Latency</TableHead>
                <TableHead className="p-6 text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTests.map((test) => (
                <TableRow
                  key={test.id}
                  className="border-b border-[#C04A2A]/5 hover:bg-[#C04A2A]/5 transition-all group/row"
                >
                  <TableCell className="p-6 font-mono text-xs text-[#F0E8D8]/50">
                    #{test.id.toString().padStart(4, '0')}
                  </TableCell>
                  <TableCell className="p-6">
                    <div className="text-sm text-[#F0E8D8] font-medium">
                      {new Date(test.testDate).toLocaleDateString('sv-SE', {
                        month: 'short', day: 'numeric'
                      })}
                    </div>
                    <div className="text-[10px] text-[#F0E8D8]/30 uppercase tracking-widest mt-1">
                      {new Date(test.testDate).toLocaleTimeString('sv-SE', {
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </div>
                  </TableCell>
                  <TableCell className="p-6">
                    <div className="flex items-center gap-2">
                      {test.status === 'completed' ? (
                        <CheckCircle2 className="size-3 text-green-500" />
                      ) : test.status === 'running' ? (
                        <div className="size-3 border-2 border-[#C04A2A]/30 border-t-[#C04A2A] rounded-full animate-spin" />
                      ) : (
                        <XCircle className="size-3 text-red-500" />
                      )}
                      <span className={test.status === 'completed' ? "text-[10px] uppercase tracking-widest font-bold text-green-500/80" : test.status === 'running' ? "text-[10px] uppercase tracking-widest font-bold text-yellow-500/80" : "text-[10px] uppercase tracking-widest font-bold text-red-500/80"}>
                        {test.status}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 w-24 h-1 bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className={test.successRate > 90 ? "bg-green-500 h-full transition-all duration-1000" : test.successRate > 70 ? "bg-yellow-500 h-full transition-all duration-1000" : "bg-red-500 h-full transition-all duration-1000"}
                          style={{ width: `${test.successRate}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-[#F0E8D8]">
                        {test.successRate.toFixed(1)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="p-6">
                    <div className="flex items-center gap-2">
                      <Clock className="size-3 text-[#F0E8D8]/20" />
                      <span className="text-sm text-[#F0E8D8]">{test.avgLoadTime.toFixed(0)}ms</span>
                    </div>
                  </TableCell>
                  <TableCell className="p-6 text-right">
                    <button 
                      onClick={() => handleViewDetails(test.id)}
                      className="p-2 hover:bg-[#C04A2A] hover:text-white rounded-sm transition-all opacity-0 group-hover/row:opacity-100"
                    >
                      <ChevronRight className="size-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {tests.length === 0 && (
            <div className="p-12 text-center text-[#F0E8D8]/50">
              No tests have been run yet.
            </div>
          )}
        </div>
      </div>

      {/* Analytics Trend */}
      {tests.length > 1 && (
        <div className="bg-[#141210]/20 border border-[#C04A2A]/10 p-8 rounded-sm">
          <div className="flex items-center gap-3 mb-10">
             <TrendingUp className="size-4 text-[#C04A2A]" />
             <h2 className="text-2xl font-display text-[#F0E8D8]">Analytics Trend</h2>
          </div>
          <div className="h-48 flex items-end gap-1.5">
            {tests.slice(-20).map((test) => {
              const h = Math.max(5, (test.successRate / 100) * 100)
              return (
                <div 
                  key={test.id} 
                  className="flex-1 group/bar relative"
                  style={{ height: '100%' }}
                >
                  <div 
                    className={test.successRate > 90 ? "absolute bottom-0 w-full transition-all duration-500 rounded-t-[1px] bg-[#C04A2A]" : test.successRate > 70 ? "absolute bottom-0 w-full transition-all duration-500 rounded-t-[1px] bg-[#C04A2A]/60" : "absolute bottom-0 w-full transition-all duration-500 rounded-t-[1px] bg-[#C04A2A]/20"}
                    style={{ height: `${h}%` }}
                  />
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-[#C04A2A] text-white text-[9px] px-2 py-1 rounded-sm opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none">
                    {test.successRate.toFixed(1)}% availability
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex justify-between mt-4 text-[9px] uppercase tracking-[0.2em] text-[#F0E8D8]/20 font-bold">
            <span>{new Date(tests[Math.max(0, tests.length-20)].testDate).toLocaleDateString()}</span>
            <span>Timeline (Last 20 scans)</span>
            <span>{new Date(tests[tests.length-1].testDate).toLocaleDateString()}</span>
          </div>
        </div>
      )}

      {/* Test Details Dialog */}
      <Dialog open={selectedTest !== null} onOpenChange={(open) => !open && setSelectedTest(null)}>
        <DialogContent className="max-w-4xl bg-[#100E0C] border-[#C04A2A]/20 text-[#F0E8D8] p-0 overflow-hidden outline-none">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#C04A2A08_1px,transparent_1px),linear-gradient(to_bottom,#C04A2A08_1px,transparent_1px)] bg-[size:2rem_2rem] pointer-events-none" />
          
          <DialogHeader className="p-8 border-b border-[#C04A2A]/10 bg-[#141210]/50">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-[#C04A2A] font-bold">Trace Detail</p>
                  <Badge variant="outline" className="text-[9px] border-[#C04A2A]/30 text-[#C04A2A]">
                    ID: {selectedTest}
                  </Badge>
                </div>
                <DialogTitle className="text-4xl font-display tracking-wide">
                  {testDetails ? new Date(testDetails.testDate).toLocaleString('sv-SE') : 'Loading execution...'}
                </DialogTitle>
              </div>
            </div>
          </DialogHeader>

          <div className="p-8 max-h-[70vh] overflow-y-auto">
            {isLoadingDetails ? (
              <div className="py-20 flex flex-col items-center gap-4">
                <div className="size-8 border-3 border-[#C04A2A]/20 border-t-[#C04A2A] rounded-full animate-spin" />
                <p className="text-[10px] uppercase tracking-widest text-[#F0E8D8]/30">Analyzing device payloads...</p>
              </div>
            ) : testDetails ? (
              <div className="space-y-10">
                {/* Device Comparison Insights */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Best Performer */}
                  {testDetails.results?.some((r: any) => r.success) && (
                    <div className="p-6 bg-green-500/5 border border-green-500/20 rounded-sm">
                      <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="size-3 text-green-400" />
                        <p className="text-[10px] uppercase tracking-widest text-green-400 font-bold">Fastest Response</p>
                      </div>
                      <div className="flex justify-between items-end">
                        {(() => {
                          const validResults = testDetails.results.filter((r: any) => r.success);
                          const best = [...validResults].sort((a: any, b: any) => a.loadTime - b.loadTime)[0];
                          if (!best) return null;
                          return (
                            <>
                              <div>
                                <p className="text-xl font-display">{best.deviceName}</p>
                                <p className="text-[10px] text-[#F0E8D8]/40 uppercase tracking-tighter mt-1">
                                  {best.browserName} • {best.platform}
                                </p>
                              </div>
                              <p className="text-2xl font-mono text-green-400">{best.loadTime}ms</p>
                            </>
                          )
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Worst Performer */}
                  {testDetails.results?.some((r: any) => r.success) && (
                    <div className="p-6 bg-red-500/5 border border-red-500/20 rounded-sm">
                      <div className="flex items-center gap-2 mb-4">
                        <AlertTriangle className="size-3 text-red-400" />
                        <p className="text-[10px] uppercase tracking-widest text-red-400 font-bold">Slowest Response</p>
                      </div>
                      <div className="flex justify-between items-end">
                        {(() => {
                           const validResults = testDetails.results.filter((r: any) => r.success);
                           const worst = [...validResults].sort((a: any, b: any) => b.loadTime - a.loadTime)[0];
                          if (!worst) return null;
                          return (
                            <>
                              <div>
                                <p className="text-xl font-display">{worst.deviceName}</p>
                                <p className="text-[10px] text-[#F0E8D8]/40 uppercase tracking-tighter mt-1">
                                  {worst.browserName} • {worst.platform}
                                </p>
                              </div>
                              <p className="text-2xl font-mono text-red-400">{worst.loadTime}ms</p>
                            </>
                          )
                        })()}
                      </div>
                    </div>
                  )}
                </div>

                {/* Raw Device Logs */}
                <div className="space-y-4">
                   <h3 className="text-[10px] uppercase tracking-[0.3em] text-[#C04A2A] font-bold pl-1">Matrix Logs</h3>
                   <div className="border border-[#C04A2A]/10 rounded-sm overflow-hidden">
                    <Table>
                      <TableHeader className="bg-white/5">
                        <TableRow>
                          <TableHead className="text-[9px] uppercase tracking-widest font-bold">Device</TableHead>
                          <TableHead className="text-[9px] uppercase tracking-widest font-bold">Platform</TableHead>
                          <TableHead className="text-[9px] uppercase tracking-widest font-bold text-center">Status</TableHead>
                          <TableHead className="text-[9px] uppercase tracking-widest font-bold text-right">LCP</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {testDetails.results?.map((res: any, idx: number) => (
                          <TableRow key={idx} className="border-b border-white/5 last:border-0">
                            <TableCell className="text-xs">
                              <div className="flex items-center gap-2">
                                {res.deviceName.includes('Mobile') ? <Smartphone className="size-3 text-[#F0E8D8]/30" /> : <Monitor className="size-3 text-[#F0E8D8]/30" />}
                                <span>{res.deviceName}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-[10px] text-[#F0E8D8]/40 uppercase tracking-tight">{res.platform}</TableCell>
                            <TableCell className="text-center">
                              <div className="flex justify-center">
                                {res.success ? <CheckCircle2 className="size-3 text-green-500/50" /> : <XCircle className="size-3 text-red-500/50" />}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {res.success ? `${res.loadTime}ms` : <span className="text-red-900">FAIL</span>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                   </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-20 text-[#F0E8D8]/30">Failed to recover trace details.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

