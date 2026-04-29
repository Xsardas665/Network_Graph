const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 9292;
const SCHEMAS_DIR = path.join(__dirname, 'schemas');

// Ensure schemas directory exists and migrate old data
if (!fs.existsSync(SCHEMAS_DIR)) {
    fs.mkdirSync(SCHEMAS_DIR, { recursive: true });
}

// Initial migration/setup
const files = fs.readdirSync(SCHEMAS_DIR);
if (files.length === 0) {
    const oldPath = path.join(__dirname, 'data.json');
    if (fs.existsSync(oldPath)) {
        fs.renameSync(oldPath, path.join(SCHEMAS_DIR, 'default.json'));
    } else {
        fs.writeFileSync(path.join(SCHEMAS_DIR, 'default.json'), JSON.stringify({ nodes: [], links: [] }, null, 2));
    }
}

app.use(cors());
app.use(express.json());

// Helpers
const getFilePath = (schemaId) => path.join(SCHEMAS_DIR, `${schemaId}.json`);

const readData = (schemaId) => {
    const filePath = getFilePath(schemaId);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath));
};

const writeData = (schemaId, data) => {
    fs.writeFileSync(getFilePath(schemaId), JSON.stringify(data, null, 2));
};

// --- SCHEMA MANAGEMENT ---

// List all schemas
app.get('/api/schemas', (req, res) => {
    const files = fs.readdirSync(SCHEMAS_DIR);
    const schemas = files
        .filter(f => f.endsWith('.json'))
        .map(f => {
            const id = f.replace('.json', '');
            // Prettify name: replace underscores with spaces and capitalize
            let name = id.replace(/_/g, ' ');
            // Special case for our manual rename
            if (id === 'grzybno_-_calosc') name = 'Grzybno - Całość';
            else name = name.replace(/\b\w/g, l => l.toUpperCase());
            
            return { id, name };
        });
    res.json(schemas);
});

// Create new schema
app.post('/api/schemas', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    
    const id = name.toLowerCase().replace(/\s+/g, '_');
    const filePath = getFilePath(id);
    
    if (fs.existsSync(filePath)) {
        return res.status(400).json({ error: 'Schema already exists' });
    }
    
    const newData = { nodes: [], links: [] };
    writeData(id, newData);
    res.status(201).json({ id, name });
});

// --- NETWORK DATA PER SCHEMA ---

app.get('/api/schemas/:schemaId/network', (req, res) => {
    const data = readData(req.params.schemaId);
    if (!data) return res.status(404).json({ error: 'Schema not found' });
    res.json(data);
});

app.post('/api/schemas/:schemaId/nodes', (req, res) => {
    const schemaId = req.params.schemaId;
    const data = readData(schemaId);
    if (!data) return res.status(404).json({ error: 'Schema not found' });

    const newNode = {
        id: `node_${Date.now()}`,
        name: req.body.name || 'New Node',
        type: req.body.type || 'Generic',
        parentId: req.body.parentId || null,
        interfaces: req.body.interfaces || [],
        ...req.body
    };
    data.nodes.push(newNode);
    writeData(schemaId, data);
    res.status(201).json(newNode);
});

app.post('/api/schemas/:schemaId/links', (req, res) => {
    const schemaId = req.params.schemaId;
    const data = readData(schemaId);
    if (!data) return res.status(404).json({ error: 'Schema not found' });

    const { source, target, sourceInterface, targetInterface, label, type } = req.body;
    if (!source || !target) return res.status(400).json({ error: 'Source and Target required' });

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
    writeData(schemaId, data);
    res.status(201).json(newLink);
});

app.delete('/api/schemas/:schemaId/nodes/:id', (req, res) => {
    const schemaId = req.params.schemaId;
    let data = readData(schemaId);
    if (!data) return res.status(404).json({ error: 'Schema not found' });

    const nodeId = req.params.id;
    data.nodes = data.nodes.filter(n => n.id !== nodeId);
    data.links = data.links.filter(l => l.source !== nodeId && l.target !== nodeId);
    
    writeData(schemaId, data);
    res.status(204).send();
});

app.put('/api/schemas/:schemaId/nodes/:id', (req, res) => {
    const schemaId = req.params.schemaId;
    const data = readData(schemaId);
    if (!data) return res.status(404).json({ error: 'Schema not found' });

    const nodeId = req.params.id;
    const nodeIndex = data.nodes.findIndex(n => n.id === nodeId);
    if (nodeIndex === -1) return res.status(404).json({ error: 'Node not found' });

    data.nodes[nodeIndex] = { ...data.nodes[nodeIndex], ...req.body, id: nodeId };
    writeData(schemaId, data);
    res.json(data.nodes[nodeIndex]);
});

app.delete('/api/schemas/:schemaId/links/:id', (req, res) => {
    const schemaId = req.params.schemaId;
    let data = readData(schemaId);
    if (!data) return res.status(404).json({ error: 'Schema not found' });

    data.links = data.links.filter(l => l.id !== req.params.id);
    writeData(schemaId, data);
    res.status(204).send();
});

app.put('/api/schemas/:schemaId/links/:id', (req, res) => {
    const schemaId = req.params.schemaId;
    const data = readData(schemaId);
    if (!data) return res.status(404).json({ error: 'Schema not found' });

    const linkId = req.params.id;
    const linkIndex = data.links.findIndex(l => l.id === linkId);
    if (linkIndex === -1) return res.status(404).json({ error: 'Link not found' });

    data.links[linkIndex] = { ...data.links[linkIndex], ...req.body, id: linkId };
    writeData(schemaId, data);
    res.json(data.links[linkIndex]);
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
