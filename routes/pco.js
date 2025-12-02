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

        // --- SERVICES ---
        let services = null;
        try {
            // Calculate date 9 months ago
            const nineMonthsAgo = new Date();
            nineMonthsAgo.setMonth(nineMonthsAgo.getMonth() - 9);
            const filterDate = nineMonthsAgo.toISOString().split('T')[0]; // Format: YYYY-MM-DD

            console.log(`Fetching Services data for person ${personId} since ${filterDate}`);

            // Get current teams
            const currentTeams = await fetchAllPages(`https://api.planningcenteronline.com/services/v2/people/${personId}/teams`);
            
            // Get plan_people (scheduling history) from past 9 months
            const planPeopleUrl = `https://api.planningcenteronline.com/services/v2/people/${personId}/plan_people?filter=after&filter=${filterDate}&order=-sort_date`;
            const planPeople = await fetchAllPages(planPeopleUrl);

            console.log(`Found ${currentTeams.length} current teams and ${planPeople.length} plan assignments since ${filterDate}`);

            // Map scheduling by team
            const schedulingByTeam = {};
            const teamIds = new Set();

            // Process all scheduling assignments
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
                    
                    // Store recent plan details
                    schedulingByTeam[teamId].recentPlans.push({
                        date: sortDate,
                        position: position,
                        status: assignment.attributes.status
                    });
                }
            }

            // Add team IDs from current teams (in case they haven't been scheduled recently)
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

            // Fetch team names and service types
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

            // Sort recent plans by date (most recent first)
            for (const teamId in schedulingByTeam) {
                schedulingByTeam[teamId].recentPlans.sort((a, b) => new Date(b.date) - new Date(a.date));
                // Keep only the 5 most recent
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

        res.json({ person, services, groups });

    } catch (error) {
        console.error('Top-level error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
