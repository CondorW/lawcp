import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import type { AppData, Task, Subtask, SubtaskType, Settings, Resource } from '$lib/types';
import { v4 as uuidv4 } from 'uuid';

// MODULE IMPORTS
import * as AppLogic from '$lib/stores/modules/appLogic';
import { recursiveAdd, recursiveUpdate } from '$lib/utils';
import { pb } from '$lib/pocketbase';

const createStore = () => {
    // Initialer State
    const { subscribe, set, update } = writable<AppData>({
        tasks: [],
        settings: { myShortsign: 'ME', darkMode: true, isAuthenticated: false, team: [] },
        resources: [],
        matterNotes: [],
        firmUsers: [] // Wichtig für die UI-Delegation über die Kürzel-Buttons
    });

    const activeMatterStore = writable<string | null>(null);

    // --- 1. LOCAL STORAGE SYNC (Nur für Settings & Resources) ---
    if (browser) {
        const storedSettings = localStorage.getItem('lawcp_settings');
        const storedResources = localStorage.getItem('lawcp_resources');

        update(s => ({
            ...s,
            settings: storedSettings ? { ...s.settings, ...JSON.parse(storedSettings) } : s.settings,
            resources: storedResources ? JSON.parse(storedResources) : s.resources
        }));
    }

    const saveLocal = (state: AppData) => {
        if (browser) {
            localStorage.setItem('lawcp_settings', JSON.stringify(state.settings));
        }
        return state;
    };

    // --- 2. POCKETBASE SYNC (Für Tasks & Ressources) ---
    const init = async () => {
        if (!browser) return;

        if (pb.authStore.isValid && pb.authStore.model) {
            const user = pb.authStore.model;
            update(s => ({
                ...s,
                settings: {
                    ...s.settings,
                    myShortsign: user.shortsign || 'ME', 
                    isAuthenticated: true
                }
            }));
        }
        
        try {
            // A. Kanzlei-Mitarbeiter laden
            const users = await pb.collection('users').getFullList({
                fields: 'id,name,shortsign,email',
                sort: 'shortsign'
            });

            // B. Ressourcen laden (NEU)
            const resRecords = await pb.collection('resources').getFullList({ sort: '-created' });
            const resources = resRecords.map((r: any) => ({
                id: r.id,
                type: r.type,
                name: r.name,
                identifier: r.identifier,
                address: r.address,
                notes: r.notes,
                created: r.created,
                updated: r.updated
            }));

            // C. Tasks laden
            const records = await pb.collection('tasks').getFullList({ sort: '-created', expand: 'owner' });
            const tasks = records.map((r: any) => ({
                id: r.id,
                title: r.title,
                status: r.status,
                matterRef: r.matterRef,
                dueDate: r.dueDate ? r.dueDate.substring(0, 10) : '',
                subtasks: r.subtasks || [],
                flaggedDate: r.flaggedDate ? r.flaggedDate.substring(0, 10) : null,
                priority: 'MEDIUM',
                createdAt: r.created,
                timeTracked: 0,
                dependencies: [],
                assignees: r.assignees || [], 
                owner: r.owner,               
                expand: r.expand
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
                            id: r.id,
                            title: r.title,
                            status: r.status as Task['status'],
                            matterRef: r.matterRef,
                            dueDate: r.dueDate ? r.dueDate.substring(0, 10) : '',
                            subtasks: r.subtasks || [],
                            flaggedDate: r.flaggedDate ? r.flaggedDate.substring(0, 10) : null,
                            priority: 'MEDIUM',
                            createdAt: r.created,
                            timeTracked: 0,
                            dependencies: [],
                            assignees: r.assignees || [],
                            owner: r.owner,
                            expand: r.expand
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

        // --- REALTIME SUBSCRIPTION: RESOURCES (NEU) ---
        pb.collection('resources').subscribe('*', (e) => {
            if (e.action === 'delete') {
                update(s => ({ ...s, resources: s.resources.filter(r => r.id !== e.record.id) }));
                return;
            }

            if (e.action === 'create' || e.action === 'update') {
                const r = e.record;
                const updatedRes: Resource = {
                    id: r.id,
                    type: r.type as 'COMPANY' | 'PERSON',
                    name: r.name,
                    identifier: r.identifier,
                    address: r.address,
                    notes: r.notes,
                    created: r.created,
                    updated: r.updated
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
            }
        });

        // Background Verifier für Tasks
        if (browser) {
            setInterval(async () => {
                const myId = pb.authStore.model?.id || '';
                if (!myId) return;

                let currentTasks: Task[] = [];
                update(s => { 
                    currentTasks = s.tasks; 
                    return s; 
                });

                const foreignTasks = currentTasks.filter(t => t.owner !== myId);

                for (const t of foreignTasks) {
                    try {
                        await pb.collection('tasks').getOne(t.id, { fields: 'id' });
                    } catch (err: any) {
                        if (err.status === 404) {
                            update(s => ({ ...s, tasks: s.tasks.filter(task => task.id !== t.id) }));
                        }
                    }
                }
            }, 5000); 
        }
    };

    // --- 3. RETURN STATEMENT (API SURFACE DES STORES) ---
    // Hier definieren wir alle Funktionen, die das UI aufrufen darf.
    // Prinzip: Erst lokaler Store-Update (Optimistic UI für Null-Latenz),
    //          danach asynchroner Sync mit PocketBase.
    return {
        subscribe,
        activeMatter: activeMatterStore,
        init,

        // --- LOKALE APP LOGIC ---
        // Steuert UI-Zustände, die nicht in die Cloud müssen
        toggleDarkMode: () => update(s => saveLocal(AppLogic.toggleDarkMode(s))),
        login: (sign: string) => update(s => saveLocal(AppLogic.login(s, sign))),
        addTeamMember: (n: string, s: string, c: string) => update(st => saveLocal(AppLogic.addTeamMember(st, n, s, c))),
        removeTeamMember: (id: string) => update(s => saveLocal(AppLogic.removeTeamMember(s, id))),
        setTeamLeader: (id: string) => update(s => saveLocal(AppLogic.setTeamLeader(s, id))),
        
        // --- SETTINGS ---
        updateSettings: async (vals: Partial<Settings>) => {
            // 1. Sofortiges UI Feedback (lokal)
            update(s => saveLocal(AppLogic.updateSettings(s, vals)));
            // 2. Kanzlei-Kürzel in der Datenbank sichern, falls sich der User ändert
            if (pb.authStore.isValid && pb.authStore.model && vals.myShortsign) {
                try {
                    await pb.collection('users').update(pb.authStore.model.id, { shortsign: vals.myShortsign });
                    await pb.collection('users').authRefresh();
                } catch (e) {
                    console.error("Fehler beim Speichern des Kürzels:", e);
                }
            }
        },

        // --- POCKETBASE ACTIONS: RESOURCES ---
        // Zentralisierte Wissensdatenbank der Kanzlei
        addResource: async (resData: Omit<Resource, 'id' | 'created' | 'updated'>) => {
            try {
                // Keine Optimistic UI hier nötig: Die Realtime-Subscription (oben) 
                // fängt das 'create' Event ab und befüllt das Array inkl. korrekter ID/Datum von der DB.
                await pb.collection('resources').create(resData);
            } catch (e) {
                console.error("Failed to add resource:", e);
            }
        },
        deleteResource: async (id: string) => {
            // Optimistic Delete: Sofort aus der Liste entfernen, damit das UI nicht hängt
            update(s => ({ ...s, resources: s.resources.filter(r => r.id !== id) }));
            try {
                await pb.collection('resources').delete(id);
            } catch (e) {
                console.error("Failed to delete resource:", e);
            }
        },

        // --- POCKETBASE ACTIONS: TASKS ---
        addTask: async (status: string, title: string, ref?: string, date?: string, assignedTo?: string) => {
            const userId = pb.authStore.model?.id;
            if (!userId) return;

            // Erstellt den Task. Die Realtime-Subscription sorgt für die Anzeige.
            await pb.collection('tasks').create({
                title,
                status,
                matterRef: ref,
                dueDate: date || new Date().toISOString(),
                subtasks: [],
                owner: userId,
                // Wenn kein Assignee übergeben wurde, gehört der Task exklusiv mir (Privater Sandkasten)
                assignees: assignedTo ? [assignedTo] : [userId]
            });
        },
        assignTask: async (taskId: string, assigneeId: string) => {
            // Optimistic UI: Delegations-Kürzel sofort im UI aktualisieren
            update(s => ({
                ...s,
                tasks: s.tasks.map(t => t.id === taskId ? { 
                    ...t, 
                    assignees: assigneeId ? [assigneeId] : [] 
                } : t)
            }));
            // DB Update: Überträgt die Sichtbarkeitsrechte an den Mitarbeiter
            try {
                await pb.collection('tasks').update(taskId, { assignees: assigneeId ? [assigneeId] : [] });
            } catch (e) {
                console.error("Assignment failed:", e);
            }
        },
        deleteTask: async (id: string) => {
            // Optimistic Delete
            update(s => ({ ...s, tasks: s.tasks.filter(t => t.id !== id) }));
            try {
                await pb.collection('tasks').delete(id);
            } catch (e) {
                console.error("Delete failed:", e);
            }
        },
        updateTaskTitle: async (id: string, title: string) => {
            await pb.collection('tasks').update(id, { title });
        },
        updateTaskRef: async (id: string, ref: string) => {
            await pb.collection('tasks').update(id, { matterRef: ref });
        },
        updateDate: async (id: string, date: string) => {
            await pb.collection('tasks').update(id, { dueDate: date });
        },
        toggleFlag: async (id: string, date: string | null) => {
            await pb.collection('tasks').update(id, { flaggedDate: date });
        },
        moveTask: async (id: string, status: string) => {
            const myId = pb.authStore.model?.id || '';

            // Optimistic Move mit "Self-Cleaning" Mechanismus
            update(s => {
                const task = s.tasks.find(t => t.id === id);
                if (!task) return s;

                const isOwner = task.owner === myId;
                const isAssignee = task.assignees?.includes(myId);
                const isTeamLeader = task.expand?.owner?.teamLeader === myId;

                // PRIVACY GUARD: Wenn ich als Teamleiter einen Task aus dem "REVIEW" ziehe, 
                // verliere ich gem. API Rules die Leserechte. Ich werfe den Task daher 
                // proaktiv aus meinem lokalen Array, bevor mich die DB aussperrt.
                if (isTeamLeader && !isOwner && !isAssignee && status !== 'REVIEW') {
                    return { ...s, tasks: s.tasks.filter(t => t.id !== id) };
                }
                
                // Normales Update: Status für das Drag & Drop aktualisieren
                return { ...s, tasks: s.tasks.map(t => t.id === id ? { ...t, status: status as Task['status'] } : t) };
            });

            // Status an die Datenbank funken
            try {
                await pb.collection('tasks').update(id, { status });
            } catch (e) {
                console.error("Move failed:", e);
            }
        },

        // --- SUBTASKS (Private Checklisten) ---
        // Alle Subtask-Funktionen laden erst den aktuellen Zustand, pushen die neue
        // Information in das Array und überschreiben dann das gesamte Subtask-Feld in PB.
        addSubtask: async (taskId: string, title: string, type: SubtaskType = 'GENERIC') => {
            const state = get({ subscribe });
            const task = state.tasks.find(t => t.id === taskId);
            if (!task) return;

            const newSub: Subtask = { id: uuidv4(), title, done: false, type, x:0, y:0, next: [], subtasks: [] };
            const newSubtasks = [...task.subtasks, newSub];

            await pb.collection('tasks').update(taskId, { subtasks: newSubtasks });
        },
        toggleSubtask: async (taskId: string, subId: string) => {
            const state = get({ subscribe });
            const task = state.tasks.find(t => t.id === taskId);
            if (!task) return;

            const newSubtasks = recursiveUpdate(task.subtasks, subId, s => ({ ...s, done: !s.done }));
            await pb.collection('tasks').update(taskId, { subtasks: newSubtasks });
        },
        updateSubtaskTitle: async (taskId: string, subId: string, title: string) => {
            const state = get({ subscribe });
            const task = state.tasks.find(t => t.id === taskId);
            if (!task) return;

            const newSubtasks = recursiveUpdate(task.subtasks, subId, s => ({ ...s, title }));
            await pb.collection('tasks').update(taskId, { subtasks: newSubtasks });
        },
        addSubSubtask: async (taskId: string, parentSubId: string, title: string) => {
            const state = get({ subscribe });
            const task = state.tasks.find(t => t.id === taskId);
            if (!task) return;

            const newSub: Subtask = { id: uuidv4(), title, done: false, type: 'GENERIC', x:0, y:0, next: [], subtasks: [] };
            const newSubtasks = recursiveAdd(task.subtasks, parentSubId, newSub);
            await pb.collection('tasks').update(taskId, { subtasks: newSubtasks });
        },

        // --- EXTRAS ---
        openMatterNotes: (ref: string) => activeMatterStore.set(ref),
        closeMatterNotes: () => activeMatterStore.set(null),
        updateMatterNote: async (ref: string, content: string) => {
            console.log("Note Update:", ref);
        },
        exportData: () => { /* Placeholder für zukünftige Kanzlei-Exporte */ },
        importData: () => {
            alert("Import disabled");
            return false;
        }
    };
};

export const store = createStore();