#!/bin/bash

# Daily Performance Test Runner
# Runs LambdaTest performance tests at 15:30 every day

# Load environment variables
if [ -f /workspaces/Websida/.env ]; then
  export $(cat /workspaces/Websida/.env | grep -v '^#' | xargs)
fi

if [ -f /workspaces/Websida/.env.lambdatest ]; then
  export $(cat /workspaces/Websida/.env.lambdatest | grep -v '^#' | xargs)
fi

# Change to project directory
cd /workspaces/Websida

# Run the performance test
echo "Starting daily performance test at $(date)"
node --loader tsx scripts/run-performance-test.ts

# Log the result
if [ $? -eq 0 ]; then
  echo "Performance test completed successfully at $(date)" >> /var/log/performance-tests.log
else
  echo "Performance test failed at $(date)" >> /var/log/performance-tests.log
fi
