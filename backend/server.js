const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 9292;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(express.json());

// Helper to read data
const readData = () => {
    if (!fs.existsSync(DATA_FILE)) {
        return { nodes: [], links: [] };
    }
    const data = fs.readFileSync(DATA_FILE);
    return JSON.parse(data);
};

// Helper to write data
const writeData = (data) => {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
};

// GET all data
app.get('/api/network', (name, res) => {
    const data = readData();
    res.json(data);
});

// POST new node
app.post('/api/nodes', (req, res) => {
    const data = readData();
    const newNode = {
        id: `node_${Date.now()}`,
        name: req.body.name || 'New Node',
        type: req.body.type || 'Generic',
        parentId: req.body.parentId || null,
        interfaces: req.body.interfaces || [],
        ...req.body
    };
    data.nodes.push(newNode);
    writeData(data);
    res.status(201).json(newNode);
});

// POST new link
app.post('/api/links', (req, res) => {
    const data = readData();
    const { source, target, sourceInterface, targetInterface, label, type } = req.body;
    
    // Basic validation
    if (!source || !target) {
        return res.status(400).json({ error: 'Source and Target are required' });
    }

    const newLink = {
        id: `link_${Date.now()}`,
        source,
        target,
        sourceInterface: sourceInterface || null,
        targetInterface: targetInterface || null,
        label: label || 'Connection',
        type: type || 'RJ45 cat6'
    };
    data.links.push(newLink);
    writeData(data);
    res.status(201).json(newLink);
});

// DELETE node
app.delete('/api/nodes/:id', (req, res) => {
    let data = readData();
    const nodeId = req.params.id;
    
    // Remove node
    data.nodes = data.nodes.filter(n => n.id !== nodeId);
    // Remove associated links
    data.links = data.links.filter(l => l.source !== nodeId && l.target !== nodeId);
    
    writeData(data);
    res.status(204).send();
});

// UPDATE node
app.put('/api/nodes/:id', (req, res) => {
    const data = readData();
    const nodeId = req.params.id;
    const nodeIndex = data.nodes.findIndex(n => n.id === nodeId);

    if (nodeIndex === -1) {
        return res.status(404).json({ error: 'Node not found' });
    }

    // Merge existing node with new data, ensuring ID remains the same
    data.nodes[nodeIndex] = {
        ...data.nodes[nodeIndex],
        ...req.body,
        id: nodeId // Immutable ID
    };

    writeData(data);
    res.json(data.nodes[nodeIndex]);
});

// DELETE link
app.delete('/api/links/:id', (req, res) => {
    let data = readData();
    const linkId = req.params.id;
    
    data.links = data.links.filter(l => l.id !== linkId);
    
    writeData(data);
    res.status(204).send();
});

// UPDATE link
app.put('/api/links/:id', (req, res) => {
    const data = readData();
    const linkId = req.params.id;
    const linkIndex = data.links.findIndex(l => l.id === linkId);

    if (linkIndex === -1) {
        return res.status(404).json({ error: 'Link not found' });
    }

    data.links[linkIndex] = {
        ...data.links[linkIndex],
        ...req.body,
        id: linkId
    };

    writeData(data);
    res.json(data.links[linkIndex]);
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
