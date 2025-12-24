#!/bin/bash

echo "=========================================="
echo "Telegram Monitor Service - Setup & Run"
echo "=========================================="
echo ""

# Check if .env exists
ENV_FILE="backend/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "Creating .env file..."
    cat > "$ENV_FILE" << 'ENVEOF'
# Telegram API Configuration
TELEGRAM_API_ID=
TELEGRAM_API_HASH=
TELEGRAM_PHONE=

# Alert Channel
ALERT_CHANNEL_ID=

# Optional: Bot Token for alerts
TELEGRAM_BOT_TOKEN=

# Database
DATABASE_URL="file:./dev.db"

# Server
PORT=3000
ENVEOF
fi

echo "Please fill in your Telegram API credentials:"
echo "(Get them from https://my.telegram.org)"
echo ""

# Read current values
CURRENT_API_ID=$(grep "^TELEGRAM_API_ID=" "$ENV_FILE" | cut -d'=' -f2 | tr -d '"')
CURRENT_API_HASH=$(grep "^TELEGRAM_API_HASH=" "$ENV_FILE" | cut -d'=' -f2 | tr -d '"')
CURRENT_PHONE=$(grep "^TELEGRAM_PHONE=" "$ENV_FILE" | cut -d'=' -f2 | tr -d '"')
CURRENT_CHANNEL=$(grep "^ALERT_CHANNEL_ID=" "$ENV_FILE" | cut -d'=' -f2 | tr -d '"')

# Ask for API ID
if [ -z "$CURRENT_API_ID" ] || [ "$CURRENT_API_ID" = "12345" ] || [ "$CURRENT_API_ID" = "your_api_id_here" ]; then
    read -p "Enter TELEGRAM_API_ID: " API_ID
    if [ ! -z "$API_ID" ]; then
        sed -i.bak "s/^TELEGRAM_API_ID=.*/TELEGRAM_API_ID=$API_ID/" "$ENV_FILE"
    fi
else
    echo "TELEGRAM_API_ID: $CURRENT_API_ID (press Enter to keep)"
    read -p "Or enter new value: " API_ID
    if [ ! -z "$API_ID" ]; then
        sed -i.bak "s/^TELEGRAM_API_ID=.*/TELEGRAM_API_ID=$API_ID/" "$ENV_FILE"
    fi
fi

# Ask for API Hash
if [ -z "$CURRENT_API_HASH" ] || [ "$CURRENT_API_HASH" = "your_api_hash_here" ]; then
    read -p "Enter TELEGRAM_API_HASH: " API_HASH
    if [ ! -z "$API_HASH" ]; then
        sed -i.bak "s/^TELEGRAM_API_HASH=.*/TELEGRAM_API_HASH=$API_HASH/" "$ENV_FILE"
    fi
else
    echo "TELEGRAM_API_HASH: (hidden) (press Enter to keep)"
    read -p "Or enter new value: " API_HASH
    if [ ! -z "$API_HASH" ]; then
        sed -i.bak "s/^TELEGRAM_API_HASH=.*/TELEGRAM_API_HASH=$API_HASH/" "$ENV_FILE"
    fi
fi

# Ask for Phone
if [ -z "$CURRENT_PHONE" ] || [ "$CURRENT_PHONE" = "+1234567890" ]; then
    read -p "Enter TELEGRAM_PHONE (with +): " PHONE
    if [ ! -z "$PHONE" ]; then
        sed -i.bak "s|^TELEGRAM_PHONE=.*|TELEGRAM_PHONE=$PHONE|" "$ENV_FILE"
    fi
else
    echo "TELEGRAM_PHONE: $CURRENT_PHONE (press Enter to keep)"
    read -p "Or enter new value: " PHONE
    if [ ! -z "$PHONE" ]; then
        sed -i.bak "s|^TELEGRAM_PHONE=.*|TELEGRAM_PHONE=$PHONE|" "$ENV_FILE"
    fi
fi

# Ask for Alert Channel
if [ -z "$CURRENT_CHANNEL" ] || [ "$CURRENT_CHANNEL" = "@your_channel" ] || [ "$CURRENT_CHANNEL" = "your_channel_id_or_username" ]; then
    read -p "Enter ALERT_CHANNEL_ID (username with @ or ID): " CHANNEL
    if [ ! -z "$CHANNEL" ]; then
        sed -i.bak "s|^ALERT_CHANNEL_ID=.*|ALERT_CHANNEL_ID=$CHANNEL|" "$ENV_FILE"
    fi
else
    echo "ALERT_CHANNEL_ID: $CURRENT_CHANNEL (press Enter to keep)"
    read -p "Or enter new value: " CHANNEL
    if [ ! -z "$CHANNEL" ]; then
        sed -i.bak "s|^ALERT_CHANNEL_ID=.*|ALERT_CHANNEL_ID=$CHANNEL|" "$ENV_FILE"
    fi
fi

# Clean up backup file
rm -f "$ENV_FILE.bak"

echo ""
echo "=========================================="
echo "Starting services..."
echo "=========================================="
echo ""

# Start backend
echo "Starting backend server..."
cd backend
npm run dev > ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait for backend
sleep 3

# Check if backend is running
if ps -p $BACKEND_PID > /dev/null; then
    echo "✓ Backend started (PID: $BACKEND_PID)"
else
    echo "✗ Backend failed to start. Check backend.log"
    exit 1
fi

# Start frontend
echo "Starting frontend..."
cd frontend
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

sleep 2

# Check if frontend is running
if ps -p $FRONTEND_PID > /dev/null; then
    echo "✓ Frontend started (PID: $FRONTEND_PID)"
else
    echo "✗ Frontend failed to start. Check frontend.log"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

echo ""
echo "=========================================="
echo "Services are running!"
echo "=========================================="
echo ""
echo "Backend:  http://localhost:3000"
echo "Frontend: http://localhost:5173"
echo ""
echo "Logs:"
echo "  Backend:  tail -f backend.log"
echo "  Frontend: tail -f frontend.log"
echo ""
echo "To stop services:"
echo "  kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "Next steps:"
echo "1. Open http://localhost:5173 in your browser"
echo "2. Authorize Telegram (if not done):"
echo "   curl -X POST http://localhost:3000/api/auth/send-code"
echo "   curl -X POST http://localhost:3000/api/auth/verify -H 'Content-Type: application/json' -d '{\"code\":\"YOUR_CODE\"}'"
echo ""
echo "Press Ctrl+C to stop all services"
echo "=========================================="

# Wait for user interrupt
trap "echo ''; echo 'Stopping services...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait

