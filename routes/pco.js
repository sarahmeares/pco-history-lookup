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
        let services = [];
        try {
            const servicePersonData = await fetchFromPCO(`https://api.planningcenteronline.com/services/v2/people/${personId}`);
            const currentTeams = await fetchAllPages(`https://api.planningcenteronline.com/services/v2/people/${personId}/teams`);
            const planPeople = await fetchAllPages(`https://api.planningcenteronline.com/services/v2/people/${personId}/plan_people`);

            // Map scheduling by team
            const schedulingByTeam = {};
            const teamIds = new Set();

            for (const assignment of planPeople) {
                const teamId = assignment.relationships?.team?.data?.id;
                if (!teamId) continue;
                teamIds.add(teamId);
                if (!schedulingByTeam[teamId]) {
                    schedulingByTeam[teamId] = { positions: new Set(), count: 0, firstScheduled: null, lastScheduled: null };
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
                } catch {}
            }

            services = { currentTeams, schedulingByTeam };
        } catch {
            services = null;
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
                    groupsMap[groupId] = { name: groupData.data.attributes.name, archived_at: groupData.data.attributes.archived_at };
                } catch {}
            }

            for (const membership of memberships) {
                const groupId = membership.relationships?.group?.data?.id;
                const groupInfo = groupsMap[groupId] || { name: 'Unknown Group', archived_at: null };
                const memData = { name: groupInfo.name, role: membership.attributes.role || 'Member', joined: membership.attributes.joined_at, removed: groupInfo.archived_at };
                groupInfo.archived_at ? groups.removed.push(memData) : groups.active.push(memData);
            }
        } catch {
            groups = null;
        }

        res.json({ person, services, groups });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
