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
    showLoading('Fetching data from all PCO products...');
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

        // CHECK-INS
        if(data.checkIns && !data.checkIns.error){
            html += `<div class="section-title">✅ Check-Ins (Past 9 Months)</div>`;
            
            if (data.checkIns.dateRange) {
                html += `<div class="info-row"><em>Data from ${new Date(data.checkIns.dateRange.from).toLocaleDateString()} to ${new Date(data.checkIns.dateRange.to).toLocaleDateString()}</em></div>`;
            }
            
            html += `<div class="info-row"><strong>Total Check-Ins:</strong> ${data.checkIns.totalCheckIns}</div>`;
            
            const { checkInsByEvent } = data.checkIns;
            
            if(Object.keys(checkInsByEvent).length > 0){
                html += '<h4>Check-Ins by Event:</h4>';
                
                for(const eventId in checkInsByEvent){
                    const event = checkInsByEvent[eventId];
                    html += `<div class="checkin-item">
                             <strong>${event.eventName}</strong><br>
                             Total Check-Ins: ${event.count}<br>
                             First Check-In: ${event.firstCheckIn ? new Date(event.firstCheckIn).toLocaleDateString() : 'N/A'}<br>
                             Last Check-In: ${event.lastCheckIn ? new Date(event.lastCheckIn).toLocaleDateString() : 'N/A'}`;
                    
                    if (event.recentCheckIns && event.recentCheckIns.length > 0) {
                        html += '<br><strong>Recent Check-Ins:</strong><ul>';
                        for (const checkIn of event.recentCheckIns) {
                            html += `<li>${new Date(checkIn.date).toLocaleDateString()}</li>`;
                        }
                        html += '</ul>';
                    }
                    
                    html += '</div>';
                }
            } else {
                html += '<p>No check-ins found in past 9 months</p>';
            }
        } else if (data.checkIns?.error) {
            html += `<div class="section-title">✅ Check-Ins</div><p class="error-text">Error loading check-ins data: ${data.checkIns.error}</p>`;
        }

        // REGISTRATIONS
        if(data.registrations && !data.registrations.error){
            html += `<div class="section-title">📝 Event Registrations (Past 9 Months)</div>`;
            
            if (data.registrations.dateRange) {
                html += `<div class="info-row"><em>Data from ${new Date(data.registrations.dateRange.from).toLocaleDateString()} to ${new Date(data.registrations.dateRange.to).toLocaleDateString()}</em></div>`;
            }
            
            html += `<div class="info-row"><strong>Total Registrations:</strong> ${data.registrations.totalRegistrations}</div>`;
            
            if(data.registrations.registrationList?.length > 0){
                html += '<h4>Recent Registrations:</h4>';
                
                for(const reg of data.registrations.registrationList){
                    html += `<div class="registration-item">
                             <strong>${reg.eventName}</strong><br>
                             Date: ${new Date(reg.startsAt).toLocaleDateString()}
                             ${reg.allDayEvent ? ' (All Day)' : ` at ${new Date(reg.startsAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`}
                             </div>`;
                }
            } else {
                html += '<p>No registrations found in past 9 months</p>';
            }
        } else if (data.registrations?.error) {
            html += `<div class="section-title">📝 Registrations</div><p class="error-text">Error loading registrations data: ${data.registrations.error}</p>`;
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
