import webdriver from 'selenium-webdriver';
import config from './lambdatest-config.js';

// Target URL
const TARGET_URL = process.env.TEST_URL || 'https://lankoping.se';

// Quick test devices
const quickTestDevices = [
  {
    'browserName': 'Chrome',
    'browserVersion': 'latest',
    'platform': 'Windows 11',
    'resolution': '1920x1080',
    'name': 'Chrome Win Quick Test',
  },
  {
    'browserName': 'Safari',
    'browserVersion': 'latest',
    'platform': 'macOS Ventura',
    'resolution': '1920x1080',
    'name': 'Safari Mac Quick Test',
  },
  {
    'browserName': 'Chrome',
    'browserVersion': 'latest',
    'platform': 'Windows 11',
    'resolution': '414x896',
    'name': 'iPhone Size Emulation',
  },
  {
    'browserName': 'Firefox',
    'browserVersion': 'latest',
    'platform': 'Windows 11',
    'resolution': '360x800',
    'name': 'Android Size Emulation',
  }
];

async function runQuickTest(capability, index) {
  const capabilities = {
    ...config.commonCapabilities,
    ...capability,
  };

  let driver;
  const testStart = Date.now();
  
  try {
    console.log(`[${index + 1}] Starting ${capability.name}...`);

    driver = new webdriver.Builder()
      .usingServer(`https://${config.user}:${config.key}@${config.gridURL}`)
      .withCapabilities(capabilities)
      .build();

    await driver.get(TARGET_URL);

    await driver.wait(function() {
      return driver.executeScript('return document.readyState').then(function(readyState) {
        return readyState === 'complete';
      });
    }, 30000);

    const title = await driver.getTitle();
    const loadTime = Date.now() - testStart;

    await driver.executeScript('lambda-status=passed');

    console.log(`[${index + 1}] ✅ ${capability.name} - ${loadTime}ms - "${title}"`);
    return { success: true, device: capability.name, loadTime, title };

  } catch (error) {
    const loadTime = Date.now() - testStart;
    
    if (driver) {
      try {
        await driver.executeScript('lambda-status=failed');
      } catch (e) {}
    }

    console.error(`[${index + 1}] ❌ ${capability.name} - ${error.message}`);
    return { success: false, device: capability.name, loadTime, error: error.message };
  } finally {
    if (driver) {
      await driver.quit().catch(() => {});
    }
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          LambdaTest Quick Test (4 devices)                ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  if (!config.user || !config.key) {
    console.error('❌ Error: LambdaTest credentials not found!');
    console.error('Please set environment variables:');
    console.error('  export LT_USERNAME="your_username"');
    console.error('  export LT_ACCESS_KEY="your_access_key"');
    console.error('\nGet credentials from: https://accounts.lambdatest.com/detail/profile');
    process.exit(1);
  }

  console.log(`🎯 Target URL: ${TARGET_URL}`);
  console.log(`📱 Testing: Chrome, Safari, iPhone 14, Galaxy S23`);
  console.log(`🎓 Plan: GitHub Student Pack (1 parallel)`);
  console.log(`📺 Dashboard: https://automation.lambdatest.com/timeline\n`);

  const results = [];
  
  // Run tests sequentially (GitHub Student Pack = 1 parallel)
  for (let i = 0; i < quickTestDevices.length; i++) {
    const result = await runQuickTest(quickTestDevices[i], i);
    results.push(result);
  }

  // Summary
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const avgLoadTime = results.reduce((sum, r) => sum + r.loadTime, 0) / results.length;

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    Test Summary                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\n📊 Total Tests:        ${results.length}`);
  console.log(`✅ Successful:         ${successful}`);
  console.log(`❌ Failed:             ${failed}`);
  console.log(`📈 Success Rate:       ${(successful / results.length * 100).toFixed(2)}%`);
  console.log(`⚡ Avg Load Time:      ${avgLoadTime.toFixed(2)}ms`);
  
  if (successful === results.length) {
    console.log('\n✅ All tests passed! Ready to run full test:');
    console.log('   npm run test:lambdatest\n');
  } else {
    console.log('\n⚠️  Some tests failed. Check configuration and credentials.\n');
  }
}

main().catch(console.error);
