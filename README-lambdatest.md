# LambdaTest Performance Test

Test your website with 250 device simulations using LambdaTest.

## Why LambdaTest?

✅ **GitHub Student Pack** - 1 year free access  
✅ **Real devices** for mobile testing  
✅ **Live video recording** of all tests  
✅ **Unlimited test minutes** during your subscription  
✅ **Better than BrowserStack** trial experience  

## Your Plan Benefits

🎓 **GitHub Student Pack Includes:**
- ⚡ 1 parallel session (sequential testing)
- 📱 Real device testing
- 🎥 Video recording
- 📊 Network logs & console logs
- 🔄 Unlimited test minutes for 1 year
- 📈 Advanced analytics

With 1 parallel session, 250 tests will take approximately **2-2.5 hours** (running sequentially).

## Quick Setup

### 1. Get Your LambdaTest Credentials

1. Sign up at [LambdaTest](https://www.lambdatest.com/) (FREE forever)
2. Go to [Profile Settings](https://accounts.lambdatest.com/detail/profile)
3. Copy your Username and Access Key

### 2. Set Environment Variables

```bash
export LT_USERNAME="your_username"
export LT_ACCESS_KEY="your_access_key"
export TEST_URL="https://lankoping.se"
```

### 3. Run Quick Test (Recommended First)

Test with 4 devices to verify setup:

```bash
npm run test:lambdatest:quick
```

This tests: Chrome, Safari, iPhone 14, Samsung Galaxy S23

### 4. Run Full Performance Test

```bash
npm run test:lambdatest
```

## What Gets Tested

**250 device simulations across:**
- ✅ 60 Chrome Desktop (Windows 11)
- ✅ 35 Firefox Desktop (Windows 11)
- ✅ 25 Edge Desktop (Windows 11)
- ✅ 30 Safari Desktop (macOS Ventura)
- ✅ 20 Chrome Desktop (macOS Ventura)
- ✅ 30 iPhones (iPhone 14, real devices)
- ✅ 25 Samsung Galaxy (S23, real devices)
- ✅ 15 Google Pixel (Pixel 7, real devices)
- ✅ 10 iPads (iPad Pro, real devices)

**Pages tested randomly:**
- Homepage (/)
- News (/nyheter)
- Blogs (/blogs)
- Team (/team)
- Privacy (/privacy)
- Rules (/rules)

## Performance Metrics Collected

- ⏱️ Total load time
- 📄 DOM content loaded time
- 🎨 First paint time
- ✅ Success/failure rate
- 📊 Page titles (verification)
- 🌐 Network performance
- 💻 Console logs

## Live Results Dashboard

Watch tests in real-time:
🔗 **https://automation.lambdatest.com/timeline**

Features:
- 🎥 Live video of each test session
- 📸 Automatic screenshots
- 📊 Network HAR logs
- 🐛 Console logs and errors
- 📈 Performance metrics
- 🔄 Test replays

## LambdaTest vs BrowserStack

| Feature | LambdaTest (Student) | BrowserStack (Trial) |
|---------|---------------------|----------------------|
| Parallel Sessions | 1 | 1 |
| Test Duration | **Unlimited for 1 year** | 100 min/month |
| Real Devices | ✅ Yes | Limited |
| Video Recording | ✅ Yes | ✅ Yes |
| Network Logs | ✅ Yes | ✅ Yes |
| Price | **FREE with Student Pack** | Trial only |
| Access Period | **1 Year** | 30 days |

## Tips for Best Results
GitHub Student Pack**: Free 1-year access (renew with student status)
2. **Speed**: 250 tests complete in ~2-2.5 hours (sequential execution)
3. **Real Devices**: Mobile tests run on actual devices, not emulators
4. **Debugging**: Full video recordings and logs for every test
5. **Run Overnight**: Consider running the full test during off-hours
6. **Quick Test First**: Always run the quick test (30 seconds) to verify setup
5. **No Credit Card**: Required to sign up but free plan is permanent

## Test on Localhost

To test your local development server:

1. Install LambdaTest Tunnel:
   ```bash
   npm install -g @lambdatest/node-tunnel
   ```

2. Start tunnel:
   ```bash
   LT tunnel --user YOUR_USERNAME --key YOUR_ACCESS_KEY
   ```

3. Update TEST_URL:
   ```bash
   export TEST_URL="http://localhost:3000"
   ```

## Customization

Edit **lambdatest-config.js** to:
- Change device combinations
- Add/remove specific browsers
- Modify parallel session count
- Adjust test parameters

Edit **lambdatest-test.js** to:
- Change test pages
- Modify test logic
- Add custom metrics
- Adjust timeouts

## Support

- 📚 [Documentation](https://www.lambdatest.com/support/docs/)
- 💬 [24/7 Chat Support](https://www.lambdatest.com/support)
- 🎥 [Video Tutorials](https://www.youtube.com/c/LambdaTest)
- 🐛 [Issue Tracker](https://github.com/LambdaTest/LT-appium-nodejs)
