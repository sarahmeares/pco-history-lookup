// routes/pco.js
const express = require('express');
const router = express.Router();
const { fetchFromPCO, fetchAllPages } = require('./services/pcoClient');

router.post('/lookup-person', async (req, res) => {
    try {
        const { personId } = req.body;
        if (!personId) return res.status(400).json({ error: 'Missing personId' });

        // --- PEOPLE ---
        const personData = await fetchFromPCO(`https://api.planningcenteronline.com/people/v2/people/${personId}`);
        const person = {
            id: personId,
            name: personData.data.attributes.name,
            createdAt: personData.data.attributes.created_at
        };

        // Calculate date 9 months ago for filtering
        const nineMonthsAgo = new Date();
        nineMonthsAgo.setMonth(nineMonthsAgo.getMonth() - 9);
        const filterDate = nineMonthsAgo.toISOString().split('T')[0];

        // --- SERVICES ---
        let services = null;
        try {
            console.log(`Fetching Services data for person ${personId} since ${filterDate}`);

            const currentTeams = await fetchAllPages(`https://api.planningcenteronline.com/services/v2/people/${personId}/teams`);
            const planPeopleUrl = `https://api.planningcenteronline.com/services/v2/people/${personId}/plan_people?filter=after&filter=${filterDate}&order=-sort_date`;
            const planPeople = await fetchAllPages(planPeopleUrl);

            console.log(`Found ${currentTeams.length} current teams and ${planPeople.length} plan assignments since ${filterDate}`);

            const schedulingByTeam = {};
            const teamIds = new Set();

            for (const assignment of planPeople) {
                const teamId = assignment.relationships?.team?.data?.id;
                if (!teamId) continue;
                
                teamIds.add(teamId);
                
                if (!schedulingByTeam[teamId]) {
                    schedulingByTeam[teamId] = { 
                        positions: new Set(), 
                        count: 0, 
                        firstScheduled: null, 
                        lastScheduled: null,
                        recentPlans: []
                    };
                }
                
                const position = assignment.attributes.team_position_name || assignment.attributes.status || 'Scheduled';
                schedulingByTeam[teamId].positions.add(position);
                schedulingByTeam[teamId].count++;

                const sortDate = assignment.attributes.sort_date || assignment.attributes.created_at;
                if (sortDate) {
                    if (!schedulingByTeam[teamId].firstScheduled || sortDate < schedulingByTeam[teamId].firstScheduled) {
                        schedulingByTeam[teamId].firstScheduled = sortDate;
                    }
                    if (!schedulingByTeam[teamId].lastScheduled || sortDate > schedulingByTeam[teamId].lastScheduled) {
                        schedulingByTeam[teamId].lastScheduled = sortDate;
                    }
                    
                    schedulingByTeam[teamId].recentPlans.push({
                        date: sortDate,
                        position: position,
                        status: assignment.attributes.status
                    });
                }
            }

            for (const team of currentTeams) {
                teamIds.add(team.id);
                if (!schedulingByTeam[team.id]) {
                    schedulingByTeam[team.id] = { 
                        positions: new Set(), 
                        count: 0, 
                        firstScheduled: null, 
                        lastScheduled: null,
                        recentPlans: []
                    };
                }
            }

            for (const teamId of teamIds) {
                try {
                    const teamData = await fetchFromPCO(`https://api.planningcenteronline.com/services/v2/teams/${teamId}`);
                    schedulingByTeam[teamId].teamName = teamData.data.attributes.name;
                    
                    const serviceTypeId = teamData.data.relationships?.service_type?.data?.id;
                    if (serviceTypeId) {
                        const stData = await fetchFromPCO(`https://api.planningcenteronline.com/services/v2/service_types/${serviceTypeId}`);
                        schedulingByTeam[teamId].serviceType = stData.data.attributes.name;
                    }
                } catch (err) {
                    console.error(`Error fetching team ${teamId}:`, err.message);
                }
            }

            for (const teamId in schedulingByTeam) {
                schedulingByTeam[teamId].recentPlans.sort((a, b) => new Date(b.date) - new Date(a.date));
                schedulingByTeam[teamId].recentPlans = schedulingByTeam[teamId].recentPlans.slice(0, 5);
            }

            services = { 
                currentTeams, 
                schedulingByTeam,
                dateRange: {
                    from: filterDate,
                    to: new Date().toISOString().split('T')[0]
                }
            };

        } catch (err) {
            console.error('Error fetching Services data:', err);
            services = { error: err.message };
        }

        // --- CHECK-INS ---
        let checkIns = null;
        try {
            console.log(`Fetching Check-Ins data for person ${personId} since ${filterDate}`);
            
            // Get all check-ins for this person in the past 9 months
            const checkInsUrl = `https://api.planningcenteronline.com/check-ins/v2/people/${personId}/check_ins?where[created_at][gte]=${filterDate}&order=-created_at`;
            const allCheckIns = await fetchAllPages(checkInsUrl);
            
            console.log(`Found ${allCheckIns.length} check-ins since ${filterDate}`);

            // Group by event
            const checkInsByEvent = {};
            const eventIds = new Set();
            
            for (const checkIn of allCheckIns) {
                const eventId = checkIn.relationships?.event?.data?.id;
                if (!eventId) continue;
                
                eventIds.add(eventId);
                
                if (!checkInsByEvent[eventId]) {
                    checkInsByEvent[eventId] = {
                        count: 0,
                        firstCheckIn: null,
                        lastCheckIn: null,
                        recentCheckIns: []
                    };
                }
                
                checkInsByEvent[eventId].count++;
                const checkInDate = checkIn.attributes.created_at;
                
                if (checkInDate) {
                    if (!checkInsByEvent[eventId].firstCheckIn || checkInDate < checkInsByEvent[eventId].firstCheckIn) {
                        checkInsByEvent[eventId].firstCheckIn = checkInDate;
                    }
                    if (!checkInsByEvent[eventId].lastCheckIn || checkInDate > checkInsByEvent[eventId].lastCheckIn) {
                        checkInsByEvent[eventId].lastCheckIn = checkInDate;
                    }
                    
                    checkInsByEvent[eventId].recentCheckIns.push({
                        date: checkInDate,
                        kind: checkIn.attributes.kind
                    });
                }
            }
            
            // Fetch event names
            for (const eventId of eventIds) {
                try {
                    const eventData = await fetchFromPCO(`https://api.planningcenteronline.com/check-ins/v2/events/${eventId}`);
                    checkInsByEvent[eventId].eventName = eventData.data.attributes.name;
                } catch (err) {
                    console.error(`Error fetching event ${eventId}:`, err.message);
                    checkInsByEvent[eventId].eventName = 'Unknown Event';
                }
            }
            
            // Sort recent check-ins
            for (const eventId in checkInsByEvent) {
                checkInsByEvent[eventId].recentCheckIns.sort((a, b) => new Date(b.date) - new Date(a.date));
                checkInsByEvent[eventId].recentCheckIns = checkInsByEvent[eventId].recentCheckIns.slice(0, 5);
            }
            
            checkIns = {
                totalCheckIns: allCheckIns.length,
                checkInsByEvent,
                dateRange: {
                    from: filterDate,
                    to: new Date().toISOString().split('T')[0]
                }
            };
            
        } catch (err) {
            console.error('Error fetching Check-Ins data:', err);
            checkIns = { error: err.message };
        }

        // --- REGISTRATIONS ---
        let registrations = null;
        try {
            console.log(`Fetching Registrations data for person ${personId} since ${filterDate}`);
            
            // Get all registrations for this person in the past 9 months
            const registrationsUrl = `https://api.planningcenteronline.com/calendar/v2/people/${personId}/event_instances?filter=future,past&where[starts_at][gte]=${filterDate}&order=-starts_at`;
            const allRegistrations = await fetchAllPages(registrationsUrl);
            
            console.log(`Found ${allRegistrations.length} registrations since ${filterDate}`);

            const registrationList = [];
            
            for (const reg of allRegistrations) {
                const eventData = {
                    eventName: reg.attributes.name || 'Unknown Event',
                    startsAt: reg.attributes.starts_at,
                    endsAt: reg.attributes.ends_at,
                    allDayEvent: reg.attributes.all_day_event
                };
                
                registrationList.push(eventData);
            }
            
            // Sort by date (most recent first)
            registrationList.sort((a, b) => new Date(b.startsAt) - new Date(a.startsAt));
            
            registrations = {
                totalRegistrations: allRegistrations.length,
                registrationList: registrationList.slice(0, 20), // Keep top 20
                dateRange: {
                    from: filterDate,
                    to: new Date().toISOString().split('T')[0]
                }
            };
            
        } catch (err) {
            console.error('Error fetching Registrations data:', err);
            registrations = { error: err.message };
        }

        // --- GROUPS ---
        let groups = { active: [], removed: [] };
        try {
            const memberships = await fetchAllPages(`https://api.planningcenteronline.com/groups/v2/people/${personId}/memberships`);
            const groupIds = [...new Set(memberships.map(m => m.relationships?.group?.data?.id).filter(Boolean))];

            const groupsMap = {};
            for (const groupId of groupIds) {
                try {
                    const groupData = await fetchFromPCO(`https://api.planningcenteronline.com/groups/v2/groups/${groupId}`);
                    groupsMap[groupId] = { 
                        name: groupData.data.attributes.name, 
                        archived_at: groupData.data.attributes.archived_at 
                    };
                } catch (err) {
                    console.error(`Error fetching group ${groupId}:`, err.message);
                }
            }

            for (const membership of memberships) {
                const groupId = membership.relationships?.group?.data?.id;
                const groupInfo = groupsMap[groupId] || { name: 'Unknown Group', archived_at: null };
                const memData = { 
                    name: groupInfo.name, 
                    role: membership.attributes.role || 'Member', 
                    joined: membership.attributes.joined_at, 
                    removed: groupInfo.archived_at 
                };
                groupInfo.archived_at ? groups.removed.push(memData) : groups.active.push(memData);
            }
        } catch (err) {
            console.error('Error fetching Groups data:', err);
            groups = { error: err.message };
        }

        res.json({ person, services, checkIns, registrations, groups });

    } catch (error) {
        console.error('Top-level error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
