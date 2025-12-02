const API_URL = '/api/pco/proxy';

function showLoading(message) {
    const loading = document.getElementById('loading');
    loading.style.display = 'block';
    loading.textContent = '🔍 ' + message;
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

function showError(msg) {
    const err = document.getElementById('error');
    err.textContent = msg;
    err.style.display = 'block';
}

function hideError() {
    const err = document.getElementById('error');
    err.style.display = 'none';
}

async function fetchWithProxy(url) {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
    });

    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Request failed');
    }

    return response.json();
}

async function lookupPerson() {
    const personId = document.getElementById('personId').value.trim();
    if (!personId) { alert('Please enter a Person ID'); return; }

    document.getElementById('lookupBtn').disabled = true;
    showLoading('Fetching person data...');
    hideError();
    document.getElementById('results').innerHTML = '';

    try {
        const personData = await fetchWithProxy(`https://api.planningcenteronline.com/people/v2/people/${personId}`);
        const name = personData.data.attributes.name;
        const createdAt = new Date(personData.data.attributes.created_at).toLocaleDateString();

        const html = `
            <div class="section-title">👤 Person Info</div>
            <div class="info-row"><strong>Name:</strong> ${name}</div>
            <div class="info-row"><strong>Person ID:</strong> ${personId}</div>
            <div class="info-row"><strong>Created:</strong> ${createdAt}</div>
        `;

        document.getElementById('results').innerHTML = html;
    } catch (error) {
        showError('Error: ' + error.message);
    } finally {
        hideLoading();
        document.getElementById('lookupBtn').disabled = false;
    }
}
