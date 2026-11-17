"use strict";
// Resurrection Backend Server
// Minimal HTTP server using Node.js built-in http module
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.server = void 0;
const http_1 = __importDefault(require("http"));
const url_1 = require("url");
const memoryStore_js_1 = require("./database/memoryStore.js");
const messages = __importStar(require("./api/messages.js"));
const agents = __importStar(require("./api/agents.js"));
const game = __importStar(require("./api/game.js"));
const PORT = process.env.PORT || 3000;
// Initialize default data
memoryStore_js_1.store.initializeDefaultData();
function parseJSON(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            }
            catch (e) {
                reject(e);
            }
        });
    });
}
function sendJSON(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}
function sendError(res, status, message) {
    sendJSON(res, status, { error: message });
}
async function handleRequest(req, res) {
    const parsedUrl = (0, url_1.parse)(req.url || '', true);
    const pathname = parsedUrl.pathname;
    const method = req.method || 'GET';
    try {
        if (pathname === '/api/health' && method === 'GET') {
            sendJSON(res, 200, { status: 'ok', timestamp: Date.now() });
            return;
        }
        if (pathname === '/api/messages' && method === 'GET') {
            sendJSON(res, 200, messages.getMessages());
            return;
        }
        if (pathname === '/api/messages' && method === 'POST') {
            const body = await parseJSON(req);
            const message = await messages.createMessage(body);
            sendJSON(res, 201, message);
            return;
        }
        if (pathname.startsWith('/api/messages/') && method === 'PUT' && pathname.endsWith('/reconstruct')) {
            const parts = pathname.split('/');
            const id = parts[3];
            const body = await parseJSON(req);
            const result = await messages.reconstructMessage(id, body.agentIds || ['archivist']);
            sendJSON(res, 200, result);
            return;
        }
        if (pathname.startsWith('/api/messages/') && method === 'GET') {
            const parts = pathname.split('/');
            const id = parts[3];
            const message = messages.getMessage(id);
            if (message) {
                sendJSON(res, 200, message);
            }
            else {
                sendError(res, 404, 'Message not found');
            }
            return;
        }
        if (pathname.startsWith('/api/threads/') && method === 'GET') {
            const parts = pathname.split('/');
            const threadId = parts[3];
            sendJSON(res, 200, messages.getThreadMessages(threadId));
            return;
        }
        if (pathname === '/api/agents' && method === 'GET') {
            sendJSON(res, 200, agents.getAgents());
            return;
        }
        if (pathname.startsWith('/api/agents/') && method === 'GET') {
            const parts = pathname.split('/');
            const id = parts[3];
            const agent = agents.getAgent(id);
            if (agent) {
                sendJSON(res, 200, agent);
            }
            else {
                sendError(res, 404, 'Agent not found');
            }
            return;
        }
        if (pathname.startsWith('/api/agents/') && method === 'POST' && pathname.includes('/query')) {
            const parts = pathname.split('/');
            const id = parts[3];
            const body = await parseJSON(req);
            const result = await agents.queryAgent(id, body.query || 'General inquiry', body.context);
            sendJSON(res, 200, result);
            return;
        }
        if (pathname === '/api/game/state' && method === 'GET') {
            sendJSON(res, 200, game.getGameState());
            return;
        }
        if (pathname === '/api/game/state' && method === 'PUT') {
            const body = await parseJSON(req);
            sendJSON(res, 200, game.updateGameState(body));
            return;
        }
        if (pathname === '/api/game/action' && method === 'POST') {
            const body = await parseJSON(req);
            const result = await game.performAction(body.actionType, body.targetId);
            sendJSON(res, 200, result);
            return;
        }
        if (pathname === '/api/game/ending' && method === 'GET') {
            sendJSON(res, 200, game.checkEnding());
            return;
        }
        sendError(res, 404, 'Not found');
    }
    catch (error) {
        sendError(res, 500, error.message || 'Internal error');
    }
}
const server = http_1.default.createServer(handleRequest);
exports.server = server;
server.listen(PORT, () => {
    console.log(`Resurrection Backend running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
});
//# sourceMappingURL=server.js.map