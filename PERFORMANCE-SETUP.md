# Performance Testing Setup Guide

## ✅ What's Been Set Up

Your site now has automated performance testing with LambdaTest running inside your Node.js container!

### Features Added:

1. **📊 Admin Dashboard** - `/admin/performance`
   - View all test results
   - Success rates and trends
   - Performance metrics over time
   - **"Run Test Now" button** for manual testing

2. **🤖 Automated Testing** - Runs 25 devices daily
   - 8 Chrome (Windows)
   - 5 Firefox (Windows)
   - 4 Edge (Windows) 
   - 4 Safari (macOS)
   - 4 Mobile viewports

3. **📅 Daily Schedule** - Tests run at 15:30 every day via node-cron
   - Runs inside your container (no system cron needed!)
   - Starts automatically when server starts

4. **💾 Database Storage** - All results saved to PostgreSQL

## Quick Start

### 1. Environment Variables

All credentials are now in your main `.env` file:

```bash
# LambdaTest Credentials (GitHub Student Pack)
LT_USERNAME=mcanimations056
LT_ACCESS_KEY=LT_4L5tDgWvIdKNOKxSTQ4SCa5xcuiqhHYXtSFbKGOBNB7BuFq
TEST_URL=https://lankoping.se
MAX_PARALLEL=1
```

✅ **Already configured!** No action needed.

### 2. Automatic Startup

The cron job starts automatically when your server starts. You'll see:

```
╔════════════════════════════════════════════════════════════╗
║          🚀 Lankoping.se Server Starting...              ║
╚════════════════════════════════════════════════════════════╝

🕐 Performance test cron job initialized
📅 Scheduled to run daily at 15:30
✅ Performance test cron job started
⏭️  Next test at: 2026-03-09 15:30:00
```

### 3. View Dashboard

Visit: **https://lankoping.se/admin/performance**

You'll see:
- Total tests run
- Average success rate  
- Average load time
- Latest test results
- History of all tests
- Performance trend chart
- **"Run Test Now" button**

### 4. Run Test Manually

Two ways to run a test:

**Option A: From Admin Dashboard**
- Go to `/admin/performance`
- Click "Run Test Now" button
- Wait 12-15 minutes
- Refresh page to see results

**Option B: From Command Line**
```bash
npm run test:performance
```

## How It Works

### Container Integration

The cron job runs inside your Node.js container using `node-cron`:

- **Starts**: When your server starts (dev or production)
- **Runs**: Every day at 15:30 (Europe/Stockholm timezone)
- **Logs**: Output to console (visible in Docker logs)
- **No System Dependencies**: Works in any container/environment

### Server Initialization

When your server starts, it:
1. Imports `src/server/init.ts`
2. Starts the cron scheduler
3. Schedules daily tests at 15:30
4. Logs next run time

### Production Deployment

In production (Docker), the cron job starts automatically. No additional setup needed!

Your Dockerfile runs the server, and the cron job initializes on startup.

## Test Results Structure

### Database Tables:

**performance_tests** - Summary of each test run
- Total tests, success/failure counts
- Average load time, min/max times
- Duration, status
- Full results JSON

**performance_test_results** - Individual test details
- Device name, browser, platform
- Page tested, load time
- Performance metrics (DOM load, first paint)
- Success/failure status

## Monitoring

### Check Test Status:

```bash
# View server logs (includes cron output)
docker logs lankoping-web

# Or in development:
npm run dev
# Watch console for cron messages
```

### View on LambdaTest:
- Live dashboard: https://automation.lambdatest.com/timeline
- Video recordings of each test
- Network logs and console errors

## Customizing Tests

### Change Number of Devices:

Edit `src/server/functions/performance.ts`:

```typescript
// Change from 25 to any number
const DAILY_TEST_DEVICES = [
  // Add or remove device configurations
]
```

### Change Test Pages:

```typescript
const TEST_PAGES = [
  '/',
  '/nyheter', 
  '/blogs',
  // Add more pages to test
]
```

### Change Schedule:

Edit `src/server/functions/cron.ts`:

```typescript
// Change '30 15 * * *' to different time
cron.schedule('30 15 * * *', async () => {
  // ...
})
```

Examples:
- `0 9 * * *` - 9:00 AM daily
- `0 */6 * * *` - Every 6 hours
- `0 0 * * 1` - Weekly on Monday
- `*/30 * * * *` - Every 30 minutes

### Change Timezone:

```typescript
cron.schedule('30 15 * * *', async () => {
  // ...
}, {
  timezone: "Europe/Stockholm"  // Change this
})
```

## Manual API Endpoint

You can also trigger tests via API:

```bash
curl http://localhost:3000/api/performance/run
```

Returns:
```json
{
  "success": true,
  "testId": 123,
  "summary": {
    "total": 25,
    "successful": 24,
    "failed": 1,
    "successRate": 96,
    "avgLoadTime": 1234.5,
    "duration": 890
  }
}
```

## Docker Logs

View cron job output in Docker:

```bash
# Follow logs
docker logs -f lankoping-web

# View last 100 lines
docker logs --tail 100 lankoping-web
```

You'll see:
- Cron initialization
- Next scheduled run time
- Test start/end messages
- Results summary

## Tips

1. **Cost-Free**: GitHub Student Pack gives 1 year unlimited testing
2. **Sequential**: Tests run 1 at a time (takes ~12-15 minutes)
3. **Storage**: Test results are kept forever in your database
4. **Trends**: Charts show performance trends over time
5. **Alerts**: Add email notifications by extending the performance function

## Next Steps

1. ✅ Set up cron job for daily testing
2. ✅ Check `/admin/performance` after first test runs
3. ✅ Monitor trends and optimize slow pages
4. ✅ Share results with your team

## Troubleshooting

### Tests Not Running?
- Check LambdaTest credentials in `.env.lambdatest`
- Verify cron job is set up: `crontab -l`
- Check logs: `tail -f /tmp/performance-tests.log`

### No Data in Dashboard?
- Run a manual test first: `npm run test:performance`
- Check database connection
- Verify migrations ran: `npx drizzle-kit push`

### Tests Failing?
- Check if site is accessible: `curl https://lankoping.se`
- View LambdaTest dashboard for error details
- Check individual test errors in admin dashboard

## Support

- LambdaTest Docs: https://www.lambdatest.com/support/docs/
- Cron Setup: See `scripts/README-CRON.md`
- Issues: Check admin dashboard for detailed error logs
