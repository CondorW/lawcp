import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import type { AppData, Task, Subtask, SubtaskType, Settings } from '$lib/types';
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
            localStorage.setItem('lawcp_resources', JSON.stringify(state.resources));
        }
        return state;
    };

    // --- 2. POCKETBASE SYNC (Für Tasks) ---
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
            // Kanzlei-Mitarbeiter laden (Befüllt die firmUsers)
            const users = await pb.collection('users').getFullList({
                fields: 'id,name,shortsign,email',
                sort: 'shortsign'
            });

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
            update(s => ({ ...s, tasks: tasks as Task[], firmUsers: users }));
        } catch (e) {
            console.error("PB Load Error:", e);
        }

        pb.collection('tasks').subscribe('*', async (e) => {
            const myId = pb.authStore.model?.id;

            // A) DELETE
            if (e.action === 'delete') {
                update(s => ({ ...s, tasks: s.tasks.filter(t => t.id !== e.record.id) }));
                return;
            }

            // B) CREATE / UPDATE
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
        }); // <-- WICHTIG: Subscription endet hier!

        // Background Verifier (Jetzt korrekt und sicher isoliert)
        if (browser) {
            setInterval(async () => {
                const myId = pb.authStore.model?.id || '';
                if (!myId) return;

                let currentTasks: Task[] = [];
                update(s => { 
                    currentTasks = s.tasks; 
                    return s; 
                });

                // FIX: Der Hausmeister darf keine Ausnahmen mehr machen!
                // Wir müssen JEDEN Task verifizieren, bei dem wir nicht der Ersteller (Owner) sind.
                const foreignTasks = currentTasks.filter(t => t.owner !== myId);

                for (const t of foreignTasks) {
                    try {
                        // Extrem ressourcenschonender Call: "Darf ich die ID noch sehen?"
                        await pb.collection('tasks').getOne(t.id, { fields: 'id' });
                    } catch (err: any) {
                        if (err.status === 404) {
                            // Rechte verloren -> Weg damit!
                            update(s => ({ ...s, tasks: s.tasks.filter(task => task.id !== t.id) }));
                        }
                    }
                }
            }, 5000); 
        }
    };

    return {
        subscribe,
        activeMatter: activeMatterStore,
        init,

        // --- APP LOGIC (Lokal via Module) ---
        toggleDarkMode: () => update(s => saveLocal(AppLogic.toggleDarkMode(s))),
        login: (sign: string) => update(s => saveLocal(AppLogic.login(s, sign))),
        addTeamMember: (n: string, s: string, c: string) => update(st => saveLocal(AppLogic.addTeamMember(st, n, s, c))),
        removeTeamMember: (id: string) => update(s => saveLocal(AppLogic.removeTeamMember(s, id))),
        setTeamLeader: (id: string) => update(s => saveLocal(AppLogic.setTeamLeader(s, id))),
        updateSettings: async (vals: Partial<Settings>) => {
            // 1. Lokal aktualisieren (für sofortiges UI Feedback)
            update(s => saveLocal(AppLogic.updateSettings(s, vals)));

            // 2. Wenn ein User eingeloggt ist -> in DB speichern
            if (pb.authStore.isValid && pb.authStore.model && vals.myShortsign) {
                try {
                    await pb.collection('users').update(pb.authStore.model.id, { shortsign: vals.myShortsign });
                    // Optional: Profil im AuthStore aktualisieren, damit es synchron bleibt
                    await pb.collection('users').authRefresh();
                } catch (e) {
                    console.error("Fehler beim Speichern des Kürzels:", e);
                }
            }
        },
        addResource: (res: any) => update(s => saveLocal(AppLogic.addResource(s, res))),
        deleteResource: (id: string) => update(s => saveLocal(AppLogic.deleteResource(s, id))),

        // --- POCKETBASE ACTIONS (Async) ---
        addTask: async (status: string, title: string, ref?: string, date?: string, assignedTo?: string) => {
            const userId = pb.authStore.model?.id;
            if (!userId) return;

            await pb.collection('tasks').create({
                title,
                status,
                matterRef: ref,
                dueDate: date || new Date().toISOString(),
                subtasks: [],
                owner: userId,
                // If 'assignedTo' is passed, use it. Otherwise, assign to self.
                assignees: assignedTo ? [assignedTo] : [userId]
            });
        },
        
        // NEU: Zuweisungs-Funktion (Delegation)
        assignTask: async (taskId: string, assigneeId: string) => {
            // Optimistic UI Update
            update(s => ({
                ...s,
                tasks: s.tasks.map(t => t.id === taskId ? { 
                    ...t, 
                    assignees: assigneeId ? [assigneeId] : [] 
                } : t)
            }));
            
            // Datenbank Update
            try {
                await pb.collection('tasks').update(taskId, { 
                    assignees: assigneeId ? [assigneeId] : [] 
                });
            } catch (e) {
                console.error("Assignment failed:", e);
            }
        },

        deleteTask: async (id: string) => {
            // 1. Optimistic Delete (Sofort entfernen)
            update(s => ({ ...s, tasks: s.tasks.filter(t => t.id !== id) }));
            // 2. An Datenbank senden
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

            // 1. Optimistic Update mit "Self-Cleaning"
            update(s => {
                const task = s.tasks.find(t => t.id === id);
                if (!task) return s;

                // CHECK: Bin ich nur Beobachter (Teamleiter) und verliere gerade die Rechte?
                // Logik: Ich bin NICHT Owner, NICHT Assignee, aber ich bin der Boss.
                const isOwner = task.owner === myId;
                const isAssignee = task.assignees?.includes(myId);
                const isTeamLeader = task.expand?.owner?.teamLeader === myId;

                // Wenn ich der Boss bin (und nicht Owner/Assignee) und der Task verlässt REVIEW...
                if (isTeamLeader && !isOwner && !isAssignee && status !== 'REVIEW') {
                    // ... dann muss er sofort weg!
                    return { ...s, tasks: s.tasks.filter(t => t.id !== id) };
                }

                // Normalfall: Status einfach ändern
                return { ...s, tasks: s.tasks.map(t => t.id === id ? { ...t, status: status as Task['status'] } : t) };
            });

            // 2. DB Update
            try {
                await pb.collection('tasks').update(id, { status });
            } catch (e) {
                console.error("Move failed:", e);
            }
        },

        // --- SUBTASKS ---
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
        exportData: () => { /* ... */ },
        importData: () => {
            alert("Import disabled");
            return false;
        }
    };
};

export const store = createStore();