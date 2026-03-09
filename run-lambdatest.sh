#!/bin/bash

echo "╔════════════════════════════════════════════════════════════╗"
echo "║          LambdaTest Performance Test - Setup              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if credentials are already set
if [ ! -z "$LT_USERNAME" ] && [ ! -z "$LT_ACCESS_KEY" ]; then
    echo "✅ LambdaTest credentials found!"
    echo "   Username: $LT_USERNAME"
    echo ""
else
    echo "📋 LambdaTest credentials not found."
    echo ""
    echo "� GitHub Student Pack: 1 Year FREE Access"
    echo ""
    echo "Get your credentials:"
    echo "   1. Sign up (FREE): https://www.lambdatest.com/"
    echo "   2. Get credentials: https://accounts.lambdatest.com/detail/profile"
    echo ""
    read -p "Enter your LambdaTest Username: " username
    read -p "Enter your LambdaTest Access Key: " accesskey
    echo ""
    
    export LT_USERNAME="$username"
    export LT_ACCESS_KEY="$accesskey"
    
    # Save to .env file
    echo "" >> .env
    echo "# LambdaTest Credentials" >> .env
    echo "LT_USERNAME=$username" >> .env
    echo "LT_ACCESS_KEY=$accesskey" >> .env
    
    echo "✅ Credentials saved to .env file"
    echo ""
fi

# Set test URL
if [ -z "$TEST_URL" ]; then
    export TEST_URL="https://lankoping.se"
    echo "TEST_URL=https://lankoping.se" >> .env
fi

echo "🎯 Test URL: $TEST_URL"
echo ""

# Ask which test to run
echo "Which test would you like to run?"
echo ""
echo "1) Quick Test (4 devices, ~2 minutes)"
echo "   - Tests: Chrome, Safari, iPhone, Samsung Galaxy"
echo "   - Runs sequentially with GitHub Student Pack"
echo "   - Good for verifying setup"
echo ""
echo "2) Full Performance Test (250 devices, ~2-2.5 hours)"
echo "   - Complete performance test across all platforms"
echo "   - Sequential execution (1 parallel with Student Pack)"
echo "   - Tests all major browsers and devices"
echo "   - Recommended to run during off-hours"
echo ""
read -p "Enter your choice (1 or 2): " choice

case $choice in
    1)
        echo ""
        echo "🚀 Starting Quick Test..."
        echo "📺 Watch live: https://automation.lambdatest.com/timeline"
        echo ""
        npm run test:lambdatest:quick
        ;;
    2)
        echo "⏱️  With 1 parallel session, this will take ~2-2.5 hours"
        echo "💡 Tip: Consider running this during off-hours or overnight
        echo "⚡ With 6 parallel sessions, this will take ~25-30 minutes"
        echo "📺 Watch live: https://automation.lambdatest.com/timeline"
        echo ""
        read -p "Continue? (y/n): " confirm
        if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
            echo ""
            echo "🚀 Starting Full Performance Test (250 devices)..."
            echo ""
            npm run test:lambdatest
        else
            echo "Test cancelled."
        fi
        ;;
    *)
        echo "Invalid choice. Please run the script again."
        exit 1
        ;;
esac
