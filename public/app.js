const API_URL = '/api/pco/lookup-person';

function showLoading(msg) { 
    const l = document.getElementById('loading'); 
    l.style.display='block'; 
    l.textContent='🔍 '+msg; 
}

function hideLoading(){ 
    document.getElementById('loading').style.display='none'; 
}

function showError(msg){ 
    const e=document.getElementById('error'); 
    e.textContent=msg; 
    e.style.display='block'; 
}

function hideError(){ 
    document.getElementById('error').style.display='none'; 
}

async function lookupPerson() {
    const personId = document.getElementById('personId').value.trim();
    if(!personId){ alert('Please enter Person ID'); return; }
    
    document.getElementById('lookupBtn').disabled = true;
    showLoading('Fetching data...');
    hideError();
    document.getElementById('results').innerHTML = '';
    
    try {
        const response = await fetch(API_URL, { 
            method:'POST', 
            headers:{'Content-Type':'application/json'}, 
            body: JSON.stringify({personId}) 
        });
        
        if(!response.ok){ 
            const errData=await response.json(); 
            throw new Error(errData.error||'Request failed'); 
        }
        
        const data = await response.json();
        
        let html = `<div class="section-title">👤 Person Info</div>
                    <div class="info-row"><strong>Name:</strong> ${data.person.name}</div>
                    <div class="info-row"><strong>ID:</strong> ${data.person.id}</div>
                    <div class="info-row"><strong>Created:</strong> ${new Date(data.person.createdAt).toLocaleDateString()}</div>`;
        
        // SERVICES
        if(data.services && !data.services.error){
            html += `<div class="section-title">📋 Services (Past 9 Months)</div>`;
            
            if (data.services.dateRange) {
                html += `<div class="info-row"><em>Data from ${new Date(data.services.dateRange.from).toLocaleDateString()} to ${new Date(data.services.dateRange.to).toLocaleDateString()}</em></div>`;
            }
            
            const { currentTeams, schedulingByTeam } = data.services;
            
            if(currentTeams?.length){
                html += '<h4>Current Teams:</h4>';
                
                for(const team of currentTeams){
                    const sched = schedulingByTeam[team.id] || {};
                    html += `<div class="team-item">
                             <strong>${team.attributes.name}</strong><br>
                             Service Type: ${sched.serviceType || 'Unknown'}<br>
                             Positions: ${sched.positions ? Array.from(sched.positions).join(', ') : 'N/A'}<br>
                             Times Scheduled (9mo): ${sched.count || 0}<br>
                             Last Scheduled: ${sched.lastScheduled ? new Date(sched.lastScheduled).toLocaleDateString() : 'Not scheduled in past 9 months'}`;
                    
                    // Show recent plans
                    if (sched.recentPlans && sched.recentPlans.length > 0) {
                        html += '<br><strong>Recent Schedule:</strong><ul>';
                        for (const plan of sched.recentPlans) {
                            html += `<li>${new Date(plan.date).toLocaleDateString()} - ${plan.position} (${plan.status})</li>`;
                        }
                        html += '</ul>';
                    }
                    
                    html += '</div>';
                }
            } else {
                html += '<p>No current teams</p>';
            }
            
            // Show teams they were scheduled on but not currently on
            const currentTeamIds = new Set(currentTeams.map(t => t.id));
            const pastTeamIds = Object.keys(schedulingByTeam).filter(id => !currentTeamIds.has(id));
            
            if (pastTeamIds.length > 0) {
                html += '<h4>Previously Scheduled Teams (not currently on team):</h4>';
                for (const teamId of pastTeamIds) {
                    const sched = schedulingByTeam[teamId];
                    html += `<div class="team-item inactive">
                             <strong>${sched.teamName || 'Unknown Team'}</strong><br>
                             Service Type: ${sched.serviceType || 'Unknown'}<br>
                             Last Scheduled: ${sched.lastScheduled ? new Date(sched.lastScheduled).toLocaleDateString() : 'N/A'}
                             </div>`;
                }
            }
        } else if (data.services?.error) {
            html += `<div class="section-title">📋 Services</div><p class="error-text">Error loading services data: ${data.services.error}</p>`;
        }
        
        // GROUPS
        if(data.groups && !data.groups.error){
            html += `<div class="section-title">👥 Groups</div>`;
            
            if(data.groups.active?.length){
                html += '<h4>Active Groups:</h4>';
                for(const g of data.groups.active){
                    html += `<div class="group-item">${g.name} (Role: ${g.role})<br>Joined: ${new Date(g.joined).toLocaleDateString()}</div>`;
                }
            }
            
            if(data.groups.removed?.length){
                html += '<h4>Previous Groups:</h4>';
                for(const g of data.groups.removed){
                    html += `<div class="group-item inactive">${g.name} (Role: ${g.role})<br>Joined: ${new Date(g.joined).toLocaleDateString()} - Removed: ${new Date(g.removed).toLocaleDateString()}</div>`;
                }
            }
            
            if (!data.groups.active?.length && !data.groups.removed?.length) {
                html += '<p>No group memberships found</p>';
            }
        } else if (data.groups?.error) {
            html += `<div class="section-title">👥 Groups</div><p class="error-text">Error loading groups data: ${data.groups.error}</p>`;
        }
        
        document.getElementById('results').innerHTML = html;
        
    } catch(err){ 
        showError('Error: '+err.message); 
    } finally { 
        hideLoading(); 
        document.getElementById('lookupBtn').disabled=false; 
    }
}
