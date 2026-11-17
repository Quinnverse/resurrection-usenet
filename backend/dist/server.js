"use strict";
// Resurrection Backend Server
// Express server with in-memory database
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
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const messages = __importStar(require("./api/messages.js"));
const agents = __importStar(require("./api/agents.js"));
const game = __importStar(require("./api/game.js"));
const app = (0, express_1.default)();
exports.app = app;
const PORT = process.env.PORT || 3000;
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Routes
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});
app.get('/api/messages', messages.getMessages);
app.get('/api/messages/:id', messages.getMessage);
app.get('/api/threads/:threadId', messages.getThreadMessages);
app.post('/api/messages', messages.createMessage);
app.put('/api/messages/:id/reconstruct', messages.reconstructMessage);
app.get('/api/agents', agents.getAgents);
app.get('/api/agents/:id', agents.getAgent);
app.post('/api/agents/:id/query', agents.queryAgent);
app.get('/api/game/state', game.getGameState);
app.put('/api/game/state', game.updateGameState);
app.post('/api/game/action', game.performAction);
app.get('/api/game/ending', game.checkEnding);
// Initialize default data
const memoryStore_js_1 = require("./database/memoryStore.js");
memoryStore_js_1.store.initializeDefaultData();
// Start server
app.listen(PORT, () => {
    console.log(`Resurrection Backend running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
});
//# sourceMappingURL=server.js.map