// services/pcoClient.js
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const APP_ID = process.env.PCO_APP_ID;
const SECRET = process.env.PCO_SECRET;

if (!APP_ID || !SECRET) {
    console.error('ERROR: PCO_APP_ID or PCO_SECRET not set in .env');
    process.exit(1);
}

const authHeader = 'Basic ' + Buffer.from(`${APP_ID}:${SECRET}`).toString('base64');

async function fetchFromPCO(url) {
    const res = await fetch(url, {
        headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
        }
    });

    const data = await res.json();

    if (!res.ok) {
        throw new Error(data?.errors?.[0]?.detail || 'PCO API Error');
    }

    return data;
}

module.exports = { fetchFromPCO };
