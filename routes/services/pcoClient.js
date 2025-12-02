// services/pcoClient.js
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const APP_ID = process.env.PCO_APP_ID;
const SECRET = process.env.PCO_SECRET;

if (!APP_ID || !SECRET) {
    console.error('ERROR: PCO_APP_ID or PCO_SECRET environment variables are not set');
    console.error('Available env vars:', Object.keys(process.env).filter(k => k.startsWith('PCO')));
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
    if (!res.ok) throw new Error(data?.errors?.[0]?.detail || 'PCO API Error');
    return data;
}

// Fetch all pages (pagination)
async function fetchAllPages(baseUrl) {
    let allData = [];
    let url = baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'per_page=100';
    while (url) {
        const data = await fetchFromPCO(url);
        allData = allData.concat(data.data || []);
        url = data.links?.next || null;
    }
    return allData;
}

module.exports = { fetchFromPCO, fetchAllPages };
