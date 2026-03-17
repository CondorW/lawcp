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
    const { subscribe, set, update } = writable<AppData>({
        tasks: [],
        settings: { myShortsign: 'ME', darkMode: true, isAuthenticated: false, team: [] },
        resources: [],
        matterNotes: [],
        firmUsers: []
    });

    const activeMatterStore = writable<string | null>(null);

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

    return {
        subscribe,
        activeMatter: activeMatterStore,
        
        init: () => SyncLogic.initPocketBaseSync(update),

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
            pb.authStore.clear();

            if (browser) {
                localStorage.removeItem('lawcp_settings');
                localStorage.removeItem('lawcp_resources');

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

                await goto('/login');
            }
        },

        addResource: (resData: Omit<Resource, 'id' | 'created' | 'updated' | 'owner' | 'expand'>) => DBLogic.addResource(update, resData),
        deleteResource: (id: string) => DBLogic.deleteResource(update, id),

        addTask: (status: string, title: string, ref?: string, date?: string, assignedTo?: string) => DBLogic.addTask(update, status, title, ref, date, assignedTo),
        assignTask: (taskId: string, assigneeId: string) => DBLogic.assignTask(update, taskId, assigneeId),
        deleteTask: (id: string) => DBLogic.deleteTask(update, id),
        
        // REFACTOR: update-Parameter durchschleifen für Optimistic UI
        updateTaskTitle: (id: string, title: string) => DBLogic.updateTaskTitle(update, id, title),
        updateTaskRef: (id: string, ref: string) => DBLogic.updateTaskRef(update, id, ref),
        
        updateDate: (id: string, date: string) => DBLogic.updateDate(update, id, date),
        toggleFlag: (id: string, date: string | null) => DBLogic.toggleFlag(update, id, date),
        moveTask: (id: string, status: string) => DBLogic.moveTask(update, id, status),

        addSubtask: (taskId: string, title: string, type: SubtaskType = 'GENERIC', x = 0, y = 0) => DBLogic.addSubtask(update, () => get({ subscribe }), taskId, title, type, x, y),
        toggleSubtask: (taskId: string, subId: string) => DBLogic.toggleSubtask(update, () => get({ subscribe }), taskId, subId),
        updateSubtaskTitle: (taskId: string, subId: string, title: string) => DBLogic.updateSubtaskTitle(update, () => get({ subscribe }), taskId, subId, title),
        addSubSubtask: (taskId: string, parentSubId: string, title: string) => DBLogic.addSubSubtask(update, () => get({ subscribe }), taskId, parentSubId, title),
        updateSubtaskPos: (taskId: string, subId: string, x: number, y: number) => DBLogic.updateSubtaskPos(update, () => get({ subscribe }), taskId, subId, x, y),
        connectSubtasks: (taskId: string, sourceId: string, targetId: string) => DBLogic.connectSubtasks(update, () => get({ subscribe }), taskId, sourceId, targetId),
        disconnectSubtasks: (taskId: string, sourceId: string, targetId: string) => DBLogic.disconnectSubtasks(update, () => get({ subscribe }), taskId, sourceId, targetId),
        deleteSubtask: (taskId: string, subtaskIdToDelete: string) => DBLogic.deleteSubtask(update, () => get({ subscribe }), taskId, subtaskIdToDelete),
        
        openMatterNotes: (ref: string) => activeMatterStore.set(ref),
        closeMatterNotes: () => activeMatterStore.set(null),
        updateMatterNote: async (ref: string, content: string) => console.log("Note Update:", ref),
        fetchContext: async (ref: string) => DBLogic.fetchContext(ref),
        saveContext: async (ref: string, content: string, contextId?: string) => DBLogic.saveContext(ref, content, contextId),
    };
};

export const store = createStore();