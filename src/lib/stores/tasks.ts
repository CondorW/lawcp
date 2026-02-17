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
        matterNotes: []
    });

    const activeMatterStore = writable<string | null>(null);

    // --- 1. LOCAL STORAGE SYNC (Nur für Settings & Resources) ---
    if (browser) {
        const storedSettings = localStorage.getItem('lawcp_settings');
        const storedResources = localStorage.getItem('lawcp_resources'); // Resources auch lokal

        update(s => ({
            ...s,
            settings: storedSettings ? { ...s.settings, ...JSON.parse(storedSettings) } : s.settings,
            resources: storedResources ? JSON.parse(storedResources) : s.resources
        }));
    }

    // Helper: Speichert Settings & Resources lokal
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

        try {
            const records = await pb.collection('tasks').getFullList({ sort: '-created' });
            const tasks = records.map((r: any) => ({
                id: r.id,
                title: r.title,
                status: r.status,
                matterRef: r.matterRef,
                dueDate: r.dueDate,
                subtasks: r.subtasks || [],
                flaggedDate: r.flaggedDate || null, // FIX: Feld laden
                priority: 'MEDIUM',
                createdAt: r.created,
                timeTracked: 0,
                dependencies: []
            }));
            update(s => ({ ...s, tasks: tasks as Task[] }));
        } catch (e) {
            console.error("PB Load Error:", e);
        }

        pb.collection('tasks').subscribe('*', (e) => {
            if (e.action === 'create' || e.action === 'update') {
                const r = e.record;
                update(s => {
                    const exists = s.tasks.find(t => t.id === r.id);
                    const updatedTask: Task = {
                        id: r.id,
                        title: r.title,
                        status: r.status,
                        matterRef: r.matterRef,
                        dueDate: r.dueDate,
                        subtasks: r.subtasks || [],
                        flaggedDate: r.flaggedDate || null,
                        priority: 'MEDIUM',
                        createdAt: r.created,
                        timeTracked: 0,
                        dependencies: []
                    };

                    if (exists) {
                        return { ...s, tasks: s.tasks.map(t => t.id === r.id ? updatedTask : t) };
                    } else {
                        return { ...s, tasks: [updatedTask, ...s.tasks] };
                    }
                });
            }
            if (e.action === 'delete') {
                update(s => ({ ...s, tasks: s.tasks.filter(t => t.id !== e.record.id) }));
            }
        });
    };

    return {
        subscribe,
        activeMatter: activeMatterStore,
        init,

        // --- APP LOGIC (Lokal via Module) ---
        toggleDarkMode: () => update(s => saveLocal(AppLogic.toggleDarkMode(s))),
        login: (sign: string) => update(s => saveLocal(AppLogic.login(s, sign))),
        addTeamMember: (n: string, s: string, c: string) => update(st => saveLocal(AppLogic.addTeamMember(st, n, s, c))),
        
        // FIX: Fehlende Settings-Funktionen hinzugefügt
        removeTeamMember: (id: string) => update(s => saveLocal(AppLogic.removeTeamMember(s, id))),
        setTeamLeader: (id: string) => update(s => saveLocal(AppLogic.setTeamLeader(s, id))),
        updateSettings: (vals: Partial<Settings>) => update(s => saveLocal(AppLogic.updateSettings(s, vals))),
        
        // FIX: Fehlende Resource-Funktionen hinzugefügt
        addResource: (res: any) => update(s => saveLocal(AppLogic.addResource(s, res))),
        deleteResource: (id: string) => update(s => saveLocal(AppLogic.deleteResource(s, id))),

        // --- POCKETBASE ACTIONS (Async) ---
        
        addTask: async (status: string, title: string, ref?: string, date?: string) => {
            await pb.collection('tasks').create({
                title, status, matterRef: ref,
                dueDate: date || new Date().toISOString(),
                subtasks: []
            });
        },

        deleteTask: async (id: string) => {
            await pb.collection('tasks').delete(id);
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
        
        // FIX: toggleFlag hinzugefügt
        toggleFlag: async (id: string, date: string | null) => {
            await pb.collection('tasks').update(id, { flaggedDate: date });
        },
        
        moveTask: async (id: string, status: string) => {
            await pb.collection('tasks').update(id, { status });
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
             // Optional: Hier könntest du eine Collection 'notes' in PB ansprechen
             console.log("Note Update:", ref);
        },
        
        exportData: () => { /* ... */ },
        importData: () => { alert("Import disabled"); return false; }
    };
};

export const store = createStore();