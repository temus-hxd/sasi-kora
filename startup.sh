#!/bin/bash

# SASI-KORA Startup Script
# Starts the Node.js Emotion Engine Server

echo "🚀 SASI-KORA Starting..."
echo "=========================================="

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down services..."
    # Kill any Node processes running our server
    pkill -f "node.*server.js" 2>/dev/null || true
    pkill -f "node.*SASI-KORA" 2>/dev/null || true
    # Also kill processes on our ports
    lsof -ti:$MAIN_PORT | xargs kill -9 2>/dev/null || true
    echo "✅ Cleanup complete"
    exit 0
}

# Port configuration - using high ports unlikely to conflict on Mac
MAIN_PORT=8888
# Reserve these ports for future services if needed
RESERVE_PORT_1=9876
RESERVE_PORT_2=54321

# Trap Ctrl+C and cleanup (after MAIN_PORT is defined)
trap cleanup SIGINT SIGTERM

echo "🔫 Killing processes on ports $MAIN_PORT, $RESERVE_PORT_1, and $RESERVE_PORT_2..."

# Kill any processes using these ports
lsof -ti:$MAIN_PORT | xargs kill -9 2>/dev/null || true
lsof -ti:$RESERVE_PORT_1 | xargs kill -9 2>/dev/null || true
lsof -ti:$RESERVE_PORT_2 | xargs kill -9 2>/dev/null || true

# Also kill any Node.js processes running our server
pkill -f "node.*server.js" 2>/dev/null || true
pkill -f "node.*SASI-KORA" 2>/dev/null || true

# Wait a moment for processes to clean up
sleep 2

echo "✅ Ports cleared"
echo ""

# Load environment variables
echo "📋 Loading environment variables..."
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
    echo "✅ Environment loaded"
else
    echo "❌ Warning: .env file not found"
    echo "   Make sure you have a .env file with GROQ_API_KEY and other required variables"
fi
echo ""

# Set PORT environment variable if not already set
export PORT=${PORT:-$MAIN_PORT}

# ============================================
# Check Node.js dependencies
# ============================================
echo "📦 Checking Node.js dependencies..."
if [ ! -d "node_modules" ]; then
    echo "  → Installing Node.js dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "  ❌ Failed to install dependencies!"
        exit 1
    fi
    echo "  ✅ Dependencies installed"
else
    echo "  ✅ Dependencies already installed"
fi
echo ""

# ============================================
# Start SASI-KORA Server (Node.js)
# ============================================
echo "🎭 Starting SASI-KORA Emotion Engine Server..."
echo "  📡 Server: http://localhost:$PORT"
echo "  🎯 Chat UI: http://localhost:$PORT"
echo "  🔊 Health: http://localhost:$PORT/api/health"
echo ""
echo "=========================================="
echo "✨ Service is running!"
echo ""
echo "Press Ctrl+C to stop the service"
echo "=========================================="
echo ""

# Run the Node.js application (foreground)
npm start

