// server.js - Node.js Backend for PCO History Lookup
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all origins
app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static('public'));

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'PCO History Lookup API is running' });
});

// Proxy endpoint for Planning Center API
app.post('/api/pco-proxy', async (req, res) => {
    try {
        const { url, appId, secret } = req.body;

        if (!url || !appId || !secret) {
            return res.status(400).json({ 
                error: 'Missing required fields: url, appId, secret' 
            });
        }

        // Create Basic Auth header
        const credentials = Buffer.from(`${appId}:${secret}`).toString('base64');
        
        // Make request to Planning Center
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                error: 'Planning Center API error',
                details: data
            });
        }

        res.json(data);

    } catch (error) {
        console.error('Error proxying request:', error);
        res.status(500).json({ 
            error: 'Server error', 
            message: error.message 
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
