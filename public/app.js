const API_URL = '/api/pco/lookup-person';

function showLoading(msg) { const l = document.getElementById('loading'); l.style.display='block'; l.textContent='🔍 '+msg; }
function hideLoading(){ document.getElementById('loading').style.display='none'; }
function showError(msg){ const e=document.getElementById('error'); e.textContent=msg; e.style.display='block'; }
function hideError(){ document.getElementById('error').style.display='none'; }

async function lookupPerson() {
    const personId = document.getElementById('personId').value.trim();
    if(!personId){ alert('Please enter Person ID'); return; }

    document.getElementById('lookupBtn').disabled = true;
    showLoading('Fetching data...');
    hideError();
    document.getElementById('results').innerHTML = '';

    try {
        const response = await fetch(API_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({personId}) });
        if(!response.ok){ const errData=await response.json(); throw new Error(errData.error||'Request failed'); }
        const data = await response.json();

        let html = `<div class="section-title">👤 Person Info</div>
                    <div class="info-row"><strong>Name:</strong> ${data.person.name}</div>
                    <div class="info-row"><strong>ID:</strong> ${data.person.id}</div>
                    <div class="info-row"><strong>Created:</strong> ${new Date(data.person.createdAt).toLocaleDateString()}</div>`;

        // SERVICES
        if(data.services){
            html += `<div class="section-title">📋 Services</div>`;
            const { currentTeams, schedulingByTeam } = data.services;

            if(currentTeams?.length){
                html += '<h4>Current Teams:</h4>';
                for(const team of currentTeams){
                    const sched = schedulingByTeam[team.id] || {};
                    html += `<div class="team-item"><strong>${team.attributes.name}</strong><br>
                             Service Type: ${sched.serviceType||'Unknown'}<br>
                             Positions: ${sched.positions ? Array.from(sched.positions).join(', ') : 'N/A'}<br>
                             Times Scheduled: ${sched.count||0}<br>
                             Last Scheduled: ${sched.lastScheduled ? new Date(sched.lastScheduled).toLocaleDateString() : 'N/A'}</div>`;
                }
            } else html += '<p>No current teams</p>';
        }

        // GROUPS
        if(data.groups){
            html += `<div class="section-title">👥 Groups</div>`;
            if(data.groups.active?.length){
                html += '<h4>Active Groups:</h4>';
                for(const g of data.groups.active){
                    html += `<div class="group-item">${g.name} (Role: ${g.role}) Start: ${new Date(g.joined).toLocaleDateString()}</div>`;
                }
            }
            if(data.groups.removed?.length){
                html += '<h4>Previous Groups:</h4>';
                for(const g of data.groups.removed){
                    html += `<div class="group-item">${g.name} (Role: ${g.role}) Start: ${new Date(g.joined).toLocaleDateString()} Removal: ${new Date(g.removed).toLocaleDateString()}</div>`;
                }
            }
        }

        document.getElementById('results').innerHTML = html;

    } catch(err){ showError('Error: '+err.message); }
    finally{ hideLoading(); document.getElementById('lookupBtn').disabled=false; }
}
