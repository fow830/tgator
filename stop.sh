#!/bin/bash

echo "Stopping services..."

# Stop backend
if [ -f backend.pid ]; then
    BACKEND_PID=$(cat backend.pid)
    kill $BACKEND_PID 2>/dev/null && echo "✓ Backend stopped" || echo "Backend already stopped"
    rm -f backend.pid
fi

# Stop frontend
if [ -f frontend.pid ]; then
    FRONTEND_PID=$(cat frontend.pid)
    kill $FRONTEND_PID 2>/dev/null && echo "✓ Frontend stopped" || echo "Frontend already stopped"
    rm -f frontend.pid
fi

# Also try to kill by process name
pkill -f "node.*server.js" 2>/dev/null
pkill -f "vite" 2>/dev/null

echo "Done!"

