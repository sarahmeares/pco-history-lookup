// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const pcoRoutes = require('./routes/pco');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'PCO History Lookup API is running' });
});

// PCO API routes
app.use('/api/pco', pcoRoutes);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
