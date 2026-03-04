import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { pb } from '$lib/pocketbase';
import { goto } from '$app/navigation';
import type { AppData, Settings, Resource, SubtaskType } from '$lib/types';

// --- MODULE IMPORTS ---
import * as AppLogic from '$lib/stores/modules/appLogic';
import * as DBLogic from '$lib/stores/modules/dbLogic';
import * as SyncLogic from '$lib/stores/modules/syncLogic';

const createStore = () => {
    // Initialer State
    const { subscribe, set, update } = writable<AppData>({
        tasks: [],
        settings: { myShortsign: 'ME', darkMode: true, isAuthenticated: false, team: [] },
        resources: [],
        matterNotes: [],
        firmUsers: []
    });

    const activeMatterStore = writable<string | null>(null);

    // --- LOCAL STORAGE SYNC ---
    if (browser) {
        const storedSettings = localStorage.getItem('lawcp_settings');
        update(s => ({
            ...s,
            settings: storedSettings ? { ...s.settings, ...JSON.parse(storedSettings) } : s.settings
        }));
    }

    const saveLocal = (state: AppData) => {
        if (browser) {
            localStorage.setItem('lawcp_settings', JSON.stringify(state.settings));
        }
        return state;
    };

    // --- 3. RETURN STATEMENT (API SURFACE) ---
    return {
        subscribe,
        activeMatter: activeMatterStore,
        
        // Lagert das Initialisieren und die Realtime-Sockets aus
        init: () => SyncLogic.initPocketBaseSync(update),

        // --- LOKALE APP LOGIC ---
        toggleDarkMode: () => update(s => saveLocal(AppLogic.toggleDarkMode(s))),
        login: (sign: string) => update(s => saveLocal(AppLogic.login(s, sign))),
        addTeamMember: (n: string, s: string, c: string) => update(st => saveLocal(AppLogic.addTeamMember(st, n, s, c))),
        removeTeamMember: (id: string) => update(s => saveLocal(AppLogic.removeTeamMember(s, id))),
        setTeamLeader: (id: string) => update(s => saveLocal(AppLogic.setTeamLeader(s, id))),
        
        updateSettings: async (vals: Partial<Settings>) => {
            update(s => saveLocal(AppLogic.updateSettings(s, vals)));
            if (pb.authStore.isValid && pb.authStore.model && vals.myShortsign) {
                try {
                    await pb.collection('users').update(pb.authStore.model.id, { shortsign: vals.myShortsign });
                    await pb.collection('users').authRefresh();
                } catch (e) { console.error(e); }
            }
        },

        logout: async () => {
            // 1. Session in der Datenbank / SDK killen
            pb.authStore.clear();

            if (browser) {
                // 2. Physischen Speicher hart bereinigen
                localStorage.removeItem('lawcp_settings');
                localStorage.removeItem('lawcp_resources');

                // 3. Den laufenden Store leeren (verhindert Daten-Lecks im RAM)
                update(s => ({
                    ...s,
                    tasks: [],
                    resources: [],
                    settings: { 
                        myShortsign: 'ME', 
                        darkMode: s.settings.darkMode, 
                        isAuthenticated: false, 
                        team: [] 
                    }
                }));

                // 4. SvelteKit-interner Router für den Redirect (kein harter Page-Reload nötig)
                await goto('/login');
            }
        },

        // --- POCKETBASE ACTIONS: RESOURCES ---
        addResource: (resData: Omit<Resource, 'id' | 'created' | 'updated' | 'owner' | 'expand'>) => DBLogic.addResource(update, resData),
        deleteResource: (id: string) => DBLogic.deleteResource(update, id),

        // --- POCKETBASE ACTIONS: TASKS ---
        addTask: (status: string, title: string, ref?: string, date?: string, assignedTo?: string) => DBLogic.addTask(update, status, title, ref, date, assignedTo),        assignTask: (taskId: string, assigneeId: string) => DBLogic.assignTask(update, taskId, assigneeId),
        deleteTask: (id: string) => DBLogic.deleteTask(update, id),
        updateTaskTitle: (id: string, title: string) => DBLogic.updateTaskTitle(id, title),
        updateTaskRef: (id: string, ref: string) => DBLogic.updateTaskRef(id, ref),
        updateDate: (id: string, date: string) => DBLogic.updateDate(id, date),
        toggleFlag: (id: string, date: string | null) => DBLogic.toggleFlag(id, date),
        moveTask: (id: string, status: string) => DBLogic.moveTask(update, id, status),

        // --- SUBTASKS ---
        addSubtask: (taskId: string, title: string, type: SubtaskType = 'GENERIC', x = 0, y = 0) => DBLogic.addSubtask(() => get({ subscribe }), taskId, title, type, x, y),
        toggleSubtask: (taskId: string, subId: string) => DBLogic.toggleSubtask(() => get({ subscribe }), taskId, subId),
        updateSubtaskTitle: (taskId: string, subId: string, title: string) => DBLogic.updateSubtaskTitle(() => get({ subscribe }), taskId, subId, title),
        addSubSubtask: (taskId: string, parentSubId: string, title: string) => DBLogic.addSubSubtask(() => get({ subscribe }), taskId, parentSubId, title),
        updateSubtaskPos: (taskId: string, subId: string, x: number, y: number) => DBLogic.updateSubtaskPos(update, () => get({ subscribe }), taskId, subId, x, y),
        connectSubtasks: (taskId: string, sourceId: string, targetId: string) => DBLogic.connectSubtasks(update, () => get({ subscribe }), taskId, sourceId, targetId),
        disconnectSubtasks: (taskId: string, sourceId: string, targetId: string) => DBLogic.disconnectSubtasks(update, () => get({ subscribe }), taskId, sourceId, targetId),
        deleteSubtask: (taskId: string, subtaskIdToDelete: string) => DBLogic.deleteSubtask(update, get, taskId, subtaskIdToDelete),
        // --- EXTRAS ---
        openMatterNotes: (ref: string) => activeMatterStore.set(ref),
        closeMatterNotes: () => activeMatterStore.set(null),
        updateMatterNote: async (ref: string, content: string) => console.log("Note Update:", ref),
        exportData: () => { alert("Import disabled"); return false; },
        importData: () => { alert("Import disabled"); return false; }
    };
};

export const store = createStore();