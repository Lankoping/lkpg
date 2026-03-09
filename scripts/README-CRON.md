# Daily Performance Test Setup

This directory contains scripts for running automated performance tests.

## Files

- `run-performance-test.ts` - Node script that runs the LambdaTest performance test
- `daily-performance-cron.sh` - Shell script that loads environment and runs the test

## Setup Cron Job

To schedule tests to run daily at 15:30:

### Option 1: Using crontab (Linux/Mac)

```bash
# Edit crontab
crontab -e

# Add this line (runs at 15:30 every day)
30 15 * * * /workspaces/Websida/scripts/daily-performance-cron.sh
```

### Option 2: Using systemd timer (Linux)

Create `/etc/systemd/system/performance-test.service`:
```ini
[Unit]
Description=Daily Performance Test

[Service]
Type=oneshot
ExecStart=/workspaces/Websida/scripts/daily-performance-cron.sh
User=codespace
WorkingDirectory=/workspaces/Websida
```

Create `/etc/systemd/system/performance-test.timer`:
```ini
[Unit]
Description=Daily Performance Test Timer

[Timer]
OnCalendar=*-*-* 15:30:00
Persistent=true

[Install]
WantedBy=timers.target
```

Enable and start:
```bash
sudo systemctl enable performance-test.timer
sudo systemctl start performance-test.timer
```

### Option 3: Using Docker/Production

Add to your docker-compose.yml:
```yaml
services:
  cron:
    build: .
    command: sh -c "echo '30 15 * * * /app/scripts/daily-performance-cron.sh' | crontab - && crond -f"
    environment:
      - LT_USERNAME=${LT_USERNAME}
      - LT_ACCESS_KEY=${LT_ACCESS_KEY}
      - DATABASE_URL=${DATABASE_URL}
```

### Option 4: Manual Run

You can also run tests manually:

```bash
# Run performance test now
npm run test:performance

# Or directly
node --loader tsx scripts/run-performance-test.ts
```

## Monitoring

- Check logs: `tail -f /var/log/performance-tests.log`
- View results: Visit `/admin/performance` in your browser
- LambdaTest dashboard: https://automation.lambdatest.com/timeline

## Environment Variables Required

Make sure these are set:
- `LT_USERNAME` - Your LambdaTest username
- `LT_ACCESS_KEY` - Your LambdaTest access key
- `TEST_URL` - URL to test (defaults to https://lankoping.se)
- `DATABASE_URL` - PostgreSQL connection string

## Test Configuration

The daily test runs 25 device/browser combinations:
- 8 Chrome on Windows
- 5 Firefox on Windows  
- 4 Edge on Windows
- 4 Safari on macOS
- 4 Mobile viewport emulations

Tests are run sequentially (1 parallel with GitHub Student Pack).
Estimated duration: ~12-15 minutes per run.
