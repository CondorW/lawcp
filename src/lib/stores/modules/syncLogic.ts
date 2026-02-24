import { pb } from '$lib/pocketbase';
import { browser } from '$app/environment';
import type { AppData, Task, Resource } from '$lib/types';

export const initPocketBaseSync = async (update: (fn: (s: AppData) => AppData) => void) => {
    if (!browser) return;

    if (pb.authStore.isValid && pb.authStore.model) {
        const user = pb.authStore.model;
        update(s => ({
            ...s,
            settings: { ...s.settings, myShortsign: user.shortsign || 'ME', isAuthenticated: true }
        }));
    }

    try {
        const users = await pb.collection('users').getFullList({
            fields: 'id,name,shortsign,email,teamLeader',
            sort: 'shortsign'
        });

        const resRecords = await pb.collection('resources').getFullList({ sort: '-created', expand: 'owner' });
        const resources = resRecords.map((r: any) => ({
            id: r.id, type: r.type, name: r.name, identifier: r.identifier, address: r.address,
            street: r.street, zip: r.zip, city: r.city, notes: r.notes, created: r.created,
            updated: r.updated, owner: r.owner, expand: r.expand
        }));

        const records = await pb.collection('tasks').getFullList({ sort: '-created', expand: 'owner' });
        const tasks = records.map((r: any) => ({
            id: r.id, title: r.title, status: r.status, matterRef: r.matterRef,
            dueDate: r.dueDate ? r.dueDate.substring(0, 10) : '', subtasks: r.subtasks || [],
            flaggedDate: r.flaggedDate ? r.flaggedDate.substring(0, 10) : null, priority: 'MEDIUM',
            createdAt: r.created, timeTracked: 0, dependencies: [], assignees: r.assignees || [],
            owner: r.owner, expand: r.expand
        }));

        update(s => ({ ...s, tasks: tasks as Task[], firmUsers: users, resources: resources as Resource[] }));
    } catch (e) {
        console.error("PB Load Error:", e);
    }

    // --- REALTIME SUBSCRIPTION: TASKS ---
    pb.collection('tasks').subscribe('*', async (e) => {
        const myId = pb.authStore.model?.id;

        if (e.action === 'delete') {
            update(s => ({ ...s, tasks: s.tasks.filter(t => t.id !== e.record.id) }));
            return;
        }

        if (e.action === 'create' || e.action === 'update') {
            try {
                const r = await pb.collection('tasks').getOne(e.record.id, { expand: 'owner' });
                const isOwner = r.owner === myId;
                const isAssignee = r.assignees?.includes(myId);
                const isTeamReview = r.expand?.owner?.teamLeader === myId && r.status === 'REVIEW';

                if (isOwner || isAssignee || isTeamReview) {
                    const updatedTask: Task = {
                        id: r.id, title: r.title, status: r.status as Task['status'], matterRef: r.matterRef,
                        dueDate: r.dueDate ? r.dueDate.substring(0, 10) : '', subtasks: r.subtasks || [],
                        flaggedDate: r.flaggedDate ? r.flaggedDate.substring(0, 10) : null, priority: 'MEDIUM',
                        createdAt: r.created, timeTracked: 0, dependencies: [], assignees: r.assignees || [],
                        owner: r.owner, expand: r.expand
                    };

                    update(s => {
                        const index = s.tasks.findIndex(t => t.id === r.id);
                        if (index !== -1) {
                            const newTasks = [...s.tasks];
                            newTasks[index] = updatedTask;
                            return { ...s, tasks: newTasks };
                        } else {
                            return { ...s, tasks: [updatedTask, ...s.tasks] };
                        }
                    });
                } else {
                    update(s => ({ ...s, tasks: s.tasks.filter(t => t.id !== r.id) }));
                }
            } catch (err) {
                update(s => ({ ...s, tasks: s.tasks.filter(t => t.id !== e.record.id) }));
            }
        }
    });

    // --- REALTIME SUBSCRIPTION: RESOURCES ---
    pb.collection('resources').subscribe('*', async (e) => {
        if (e.action === 'delete') {
            update(s => ({ ...s, resources: s.resources.filter(r => r.id !== e.record.id) }));
            return;
        }

        if (e.action === 'create' || e.action === 'update') {
            try {
                const r = await pb.collection('resources').getOne(e.record.id, { expand: 'owner' });
                const updatedRes: Resource = {
                    id: r.id, type: r.type as 'COMPANY' | 'PERSON', name: r.name, identifier: r.identifier,
                    address: r.address, street: r.street, zip: r.zip, city: r.city, notes: r.notes,
                    created: r.created, updated: r.updated, owner: r.owner, expand: r.expand
                };

                update(s => {
                    const index = s.resources.findIndex(res => res.id === r.id);
                    if (index !== -1) {
                        const newRes = [...s.resources];
                        newRes[index] = updatedRes;
                        return { ...s, resources: newRes };
                    } else {
                        return { ...s, resources: [updatedRes, ...s.resources] };
                    }
                });
            } catch (err) {
                update(s => ({ ...s, resources: s.resources.filter(r => r.id !== e.record.id) }));
            }
        }
    });

    // --- ADAPTIVE HEARTBEAT SYNC (Firewall-Buster) ---
    // Simuliert Echtzeit durch aggressives Polling (1s) bei Aktivität
    if (browser) {
        let lastSync = new Date().toISOString();
        let pollInterval: any;
        let isFastPolling = false;
        let idleTimer: any;

        // Die Sync-Funktion (Kernlogik inkl. Ghost-Buster)
        const runSync = async () => {
            const myId = pb.authStore.model?.id;
            if (!myId) return;

            try {
                // 1. Ghost-Buster: Nur die IDs laden, um gelöschte Tasks aus dem UI zu werfen (extrem leichtgewichtig)
                const serverIdsRecord = await pb.collection('tasks').getFullList({ fields: 'id' });
                const serverIds = new Set(serverIdsRecord.map((t: any) => t.id));

                // 2. Updates: Nur Tasks laden, die sich wirklich verändert haben
                const missedTasks = await pb.collection('tasks').getFullList({
                    filter: `updated > "${lastSync}"`,
                    expand: 'owner'
                });

                if (missedTasks.length > 0) {
                    lastSync = new Date().toISOString(); // Zeitstempel aktualisieren
                }

                // 3. Store updaten
                update(s => {
                    // Geister-Tasks entfernen (Tasks, deren ID auf dem Server nicht mehr existiert)
                    let newTasks = s.tasks.filter(t => serverIds.has(t.id));
                    let hasChanges = s.tasks.length !== newTasks.length;

                    if (missedTasks.length > 0) {
                        missedTasks.forEach((mt: any) => {
                            const index = newTasks.findIndex(t => t.id === mt.id);
                            
                            // Berechtigungs-Check
                            const isOwner = mt.owner === myId;
                            const isAssignee = mt.assignees?.includes(myId);
                            const isTeamReview = mt.expand?.owner?.teamLeader === myId && mt.status === 'REVIEW';

                            if (isOwner || isAssignee || isTeamReview) {
                                const taskObj: Task = {
                                    id: mt.id, title: mt.title, status: mt.status, matterRef: mt.matterRef,
                                    dueDate: mt.dueDate ? mt.dueDate.substring(0, 10) : '', subtasks: mt.subtasks || [],
                                    flaggedDate: mt.flaggedDate ? mt.flaggedDate.substring(0, 10) : null, priority: 'MEDIUM',
                                    createdAt: mt.created, timeTracked: 0, dependencies: [], assignees: mt.assignees || [],
                                    owner: mt.owner, expand: mt.expand
                                };

                                if (index !== -1) {
                                    // Nur updaten, wenn sich intern etwas geändert hat
                                    if (JSON.stringify(newTasks[index]) !== JSON.stringify(taskObj)) {
                                        newTasks[index] = taskObj;
                                        hasChanges = true;
                                    }
                                } else {
                                    newTasks.unshift(taskObj); // Neu hinzufügen
                                    hasChanges = true;
                                }
                            } else if (index !== -1) {
                                // Rechte verloren (z.B. Task wurde jemand anderem zugewiesen) -> Ausblenden
                                newTasks.splice(index, 1);
                                hasChanges = true;
                            }
                        });
                    }

                    return hasChanges ? { ...s, tasks: newTasks } : s;
                });
            } catch (e) {
                // Silent Error (verhindert Spam in der Konsole bei Netzwerk-Rucklern)
            }
        };

        // Polling-Geschwindigkeit steuern
        const setPolling = (fast: boolean) => {
            if (isFastPolling === fast) return;
            isFastPolling = fast;
            
            clearInterval(pollInterval);
            // Fast: 1000ms (Fühlt sich wie Realtime an) | Slow: 10000ms (Hintergrund)
            pollInterval = setInterval(runSync, fast ? 1000 : 10000);
        };

        // Aktivitäts-Tracker
        const onUserActivity = () => {
            setPolling(true); // Sofort auf schnell schalten
            clearTimeout(idleTimer);
            // Nach 30 Sekunden Inaktivität wieder runterfahren
            idleTimer = setTimeout(() => setPolling(false), 30000);
        };

        // Event Listeners für "Aufwachen"
        window.addEventListener('mousemove', onUserActivity);
        window.addEventListener('keydown', onUserActivity);
        window.addEventListener('click', onUserActivity);
        
        // Wenn Tab gewechselt wird: Sofort-Sync
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                runSync();
                onUserActivity();
            }
        });

        // Start initial
        onUserActivity();
    }
};