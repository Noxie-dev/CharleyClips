#!/bin/bash

echo "🧪 Quick CLI and Headless Test"
echo "=============================="

# Function to check if app is running
check_app_running() {
    if clipboard-history status &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# Function to wait for app to be ready
wait_for_app() {
    echo "⏳ Waiting for app to be ready..."
    for i in {1..20}; do
        if check_app_running; then
            echo "✅ App is ready!"
            return 0
        fi
        sleep 0.5
    done
    echo "❌ App failed to start within 10 seconds"
    return 1
}

# Test 1: Start in headless mode
echo "1️⃣  Testing headless mode startup..."
clipboard-history start --headless

if ! wait_for_app; then
    echo "❌ Failed to start in headless mode"
    exit 1
fi

# Test 2: Check status
echo "2️⃣  Testing status command..."
clipboard-history status

# Test 3: Add items
echo "3️⃣  Testing add command..."
clipboard-history add "Test item 1: Hello World"
clipboard-history add "Test item 2: https://example.com"
clipboard-history add "Test item 3: function test() { return true; }"

# Test 4: List items
echo "4️⃣  Testing list command..."
clipboard-history list --limit 3

# Test 5: Search
echo "5️⃣  Testing search command..."
echo "Searching for 'test':"
clipboard-history search "test"

# Test 6: Final status
echo "6️⃣  Final status check..."
clipboard-history status

# Test 7: Cleanup
echo "7️⃣  Cleaning up..."
clipboard-history stop

echo ""
echo "🎉 Quick test completed!"
echo "If all commands above worked without errors, your CLI and headless setup is working correctly."
