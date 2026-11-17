# Resurrection — Deployment Guide

## Single-Origin Deployment (Recommended for Local Testing)

The combined server serves both the API and static frontend files on the same origin, avoiding CORS issues and proxy blocks.

### Prerequisites
- Node.js 18+ (tested with 22.23.4)
- No npm packages required (uses built-in Node.js modules)

### Quick Start

```bash
cd /projects/sandbox/resurrection-usenet/combined-server
node server.js
```

This will start the server on port 3000:
- Game UI: http://localhost:3000
- API Health: http://localhost:3000/api/health

### Production Deployment

The combined server can be deployed to any Node.js hosting environment:

#### Using systemd (Linux)
```bash
# Copy the combined-server directory to your server
sudo cp -r /path/to/resurrection-usenet/combined-server /opt/resurrection

# Create systemd service
sudo tee /etc/systemd/system/resurrection.service > /dev/null <<'EOF'
[Unit]
Description=Resurrection - The Internet Remembers the Dead
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/resurrection
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=PORT=80

[Install]
WantedBy=multi-user.target
EOF

# Start the service
sudo systemctl daemon-reload
sudo systemctl enable resurrection
sudo systemctl start resurrection
```

#### Using Docker
```bash
# Create Dockerfile
cat > Dockerfile <<'EOF'
FROM node:22-alpine
WORKDIR /app
COPY combined-server/server.js .
COPY frontend ./frontend
EXPOSE 3000
CMD ["node", "server.js"]
EOF

# Build and run
docker build -t resurrection .
docker run -p 3000:3000 resurrection
```

#### Using PM2
```bash
npm install -g pm2
cd combined-server
pm2 start server.js --name resurrection
pm2 save
pm2 startup
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Server port |

## API Endpoints

All endpoints are available under `/api/`:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/messages` | List all messages |
| POST | `/api/messages` | Create new message |
| GET | `/api/messages/:id` | Get message by ID |
| PUT | `/api/messages/:id/reconstruct` | Reconstruct degraded message |
| GET | `/api/threads/:threadId` | Get thread messages |
| GET | `/api/agents` | List all agents |
| GET | `/api/agents/:id` | Get agent details |
| POST | `/api/agents/:id/query` | Query agent |
| GET | `/api/game/state` | Get game state |
| PUT | `/api/game/state` | Update game state |
| POST | `/api/game/action` | Perform player action |
| GET | `/api/game/ending` | Check current ending |

## Browser Compatibility

The game works in any modern browser:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Testing the Game

1. Open http://localhost:3000 in your browser
2. You should see the retro terminal UI with:
   - Header with game title and status
   - Left sidebar with message threads
   - Main content area for message display
   - Agent panel on the right
   - Footer with action buttons

3. Gameplay actions:
   - Click on threads to read messages
   - Query agents to learn more about the mystery
   - Reconstruct degraded messages to restore clarity
   - Use credits wisely to reach the desired ending

## Architecture

```
┌────────────────────────────────────────────────────────┐
│                    Combined Server                     │
│                                                        │
│  ┌─────────────────┐      ┌──────────────────────┐    │
│  │  API Endpoints  │      │   Static Files       │    │
│  │  /api/*         │      │   /index.html        │    │
│  │  /messages/*    │      │   /styles/terminal   │    │
│  │  /agents/*      │      │   /src/main.jsx      │    │
│  │  /game/*        │      │   /public/*          │    │
│  └────────┬────────┘      └──────────────────────┘    │
│           │                                            │
│  ┌────────▼────────┐                                   │
│  │   In-Memory     │                                   │
│  │   Storage       │                                   │
│  │  - Messages     │                                   │
│  │  - Agents       │                                   │
│  │  - Game State   │                                   │
│  └─────────────────┘                                   │
└────────────────────────────────────────────────────────┘
```

## Troubleshooting

### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000
# Or on Windows
netstat -ano | findstr :3000

# Change port in server.js
# Set environment variable
PORT=3001 node server.js
```

### Module Not Found
The server uses only built-in Node.js modules. If you see errors:
```bash
# Verify Node.js version
node --version
# Should be v18 or higher
```

### Files Not Loading
Check file permissions:
```bash
ls -la frontend/
# Ensure files are readable
chmod -R a+r frontend/
```

## Security Notes

- The server serves static files from the `frontend/` directory
- Path traversal protection prevents accessing files outside the frontend directory
- For production, consider adding rate limiting and input validation

## Next Steps

1. Deploy to your hosting provider
2. Test in multiple browsers
3. Monitor server logs for errors
4. Consider adding HTTPS for production

## Support

For issues or questions:
- Check the API documentation in `API.md`
- Review the technical spec in `.kiro/steering/technical-architecture.md`
- See `CONTRIBUTING.md` for development guidelines
