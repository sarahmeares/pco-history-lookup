// routes/pco.js
const express = require('express');
const router = express.Router();
const { fetchFromPCO } = require('../services/pcoClient');

// Proxy endpoint
router.post('/proxy', async (req, res) => {
    try {
        const { url } = req.body;

        if (!url || !url.startsWith('https://api.planningcenteronline.com/')) {
            return res.status(400).json({ error: 'Invalid or missing URL' });
        }

        const data = await fetchFromPCO(url);
        res.json(data);

    } catch (error) {
        console.error('PCO Proxy Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
