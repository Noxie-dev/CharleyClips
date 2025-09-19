#!/bin/bash

echo "🚀 Setting up Clipboard History Pro CLI and Headless Features"
echo "============================================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Install main project dependencies
echo "📦 Installing main project dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install main project dependencies"
    exit 1
fi

# Install React app dependencies
echo "📦 Installing React app dependencies..."
cd clipboard-pro
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install React app dependencies"
    exit 1
fi

# Build React app
echo "🔨 Building React app..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Failed to build React app"
    exit 1
fi

cd ..

# Make CLI executable
echo "🔧 Making CLI executable..."
chmod +x cli.js

# Install CLI globally (optional)
echo "🌐 Installing CLI globally..."
npm install -g .

if [ $? -eq 0 ]; then
    echo "✅ CLI installed globally as 'clipboard-history'"
else
    echo "⚠️  Global installation failed. You can still use: node cli.js [command]"
fi

echo ""
echo "🎉 Setup complete! You can now test the CLI and headless features."
echo ""
echo "Quick start:"
echo "  clipboard-history start --headless    # Start in headless mode"
echo "  clipboard-history status              # Check if running"
echo "  clipboard-history add \"test item\"     # Add an item"
echo "  clipboard-history list                # List items"
echo "  clipboard-history stop                # Stop the app"
echo ""
echo "For detailed testing instructions, see: CLI_TESTING_GUIDE.md"
