// LambdaTest Configuration for Performance Testing
// Free plan: 6 concurrent sessions (better than BrowserStack!)

const config = {
  // LambdaTest credentials (set via environment variables)
  user: process.env.LT_USERNAME,
  key: process.env.LT_ACCESS_KEY,
  
  // Hub URL
  hubUrl: `https://${process.env.LT_USERNAME}:${process.env.LT_ACCESS_KEY}@hub.lambdatest.com/wd/hub`,
  
  // Grid capabilities
  gridURL: 'hub.lambdatest.com/wd/hub',
  
  // Parallel sessions (GitHub Student Pack = 1 concurrent)
  maxParallel: parseInt(process.env.MAX_PARALLEL || '1'),
  
  // Common capabilities for all tests
  commonCapabilities: {
    'build': `Websida Performance Test - ${new Date().toISOString()}`,
    'name': 'Websida Load Test',
    'project': 'Websida',
    'w3c': true,
    'plugin': 'node_js-node_js',
    'video': true,
    'network': true,
    'console': true,
    'visual': true,
  },

  // 250 device and browser combinations
  capabilities: [
    // Windows Chrome (60 tests)
    ...Array(60).fill(null).map((_, i) => ({
      'browserName': 'Chrome',
      'browserVersion': 'latest',
      'platform': 'Windows 11',
      'resolution': '1920x1080',
      'name': `Chrome Win ${i + 1}`,
    })),
    
    // Windows Firefox (35 tests)
    ...Array(35).fill(null).map((_, i) => ({
      'browserName': 'Firefox',
      'browserVersion': 'latest',
      'platform': 'Windows 11',
      'resolution': '1920x1080',
      'name': `Firefox Win ${i + 1}`,
    })),
    
    // Windows Edge (25 tests)
    ...Array(25).fill(null).map((_, i) => ({
      'browserName': 'MicrosoftEdge',
      'browserVersion': 'latest',
      'platform': 'Windows 11',
      'resolution': '1920x1080',
      'name': `Edge Win ${i + 1}`,
    })),
    
    // macOS Safari (30 tests)
    ...Array(30).fill(null).map((_, i) => ({
      'browserName': 'Safari',
      'browserVersion': 'latest',
      'platform': 'macOS Ventura',
      'resolution': '1920x1080',
      'name': `Safari Mac ${i + 1}`,
    })),
    
    // macOS Chrome (20 tests)
    ...Array(20).fill(null).map((_, i) => ({
      'browserName': 'Chrome',
      'browserVersion': 'latest',
      'platform': 'macOS Ventura',
      'resolution': '1920x1080',
      'name': `Chrome Mac ${i + 1}`,
    })),
    
    // iPhone Emulation (30 tests)
    ...Array(30).fill(null).map((_, i) => ({
      'browserName': 'Chrome',
      'browserVersion': 'latest',
      'platform': 'Windows 11',
      'resolution': '414x896',
      'name': `iPhone Emulation ${i + 1}`,
    })),
    
    // Samsung Galaxy Emulation (25 tests)
    ...Array(25).fill(null).map((_, i) => ({
      'browserName': 'Chrome',
      'browserVersion': 'latest',
      'platform': 'Windows 11',
      'resolution': '360x800',
      'name': `Galaxy Emulation ${i + 1}`,
    })),
    
    // Pixel Emulation (15 tests)
    ...Array(15).fill(null).map((_, i) => ({
      'browserName': 'Chrome',
      'browserVersion': 'latest',
      'platform': 'Windows 11',
      'resolution': '412x915',
      'name': `Pixel Emulation ${i + 1}`,
    })),
    
    // Tablet Emulation (10 tests)
    ...Array(10).fill(null).map((_, i) => ({
      'browserName': 'Chrome',
      'browserVersion': 'latest',
      'platform': 'Windows 11',
      'resolution': '1024x1366',
      'name': `Tablet Emulation ${i + 1}`,
    }))
  ]
};

export default config;
