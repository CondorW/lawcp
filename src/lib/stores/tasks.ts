import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { AppData, SubtaskType, Settings } from '$lib/types';

// Import modules
import * as TaskLogic from './modules/taskLogic';
import * as AppLogic from './modules/appLogic';

const createStore = () => {
	let data: AppData = { 
        tasks: [], 
        settings: { myShortsign: 'ME', darkMode: true, isAuthenticated: true, team: [] }, 
        resources: [],
        matterNotes: []
    };
	
    const activeMatterStore = writable<string | null>(null);
	const { subscribe, set, update } = writable<AppData>(data);

	if (browser) {
		const stored = localStorage.getItem('lawcp_data');
		if (stored) {
			try {
				const parsed = JSON.parse(stored);
                if (!parsed.matterNotes) parsed.matterNotes = [];
				set(parsed);
			} catch (e) { console.error('Load error', e); }
		}
	}

    // Helper to apply logic and save
    const apply = (fn: (s: AppData) => AppData) => {
        update(state => {
            const newState = fn(state);
            if (browser) localStorage.setItem('lawcp_data', JSON.stringify(newState));
            return newState;
        });
    };

	return {
		subscribe,
        activeMatter: activeMatterStore, 
        
        // --- APP / GENERAL ---
        openMatterNotes: (ref: string) => activeMatterStore.set(ref),
        closeMatterNotes: () => activeMatterStore.set(null),
        updateMatterNote: (ref: string, c: string) => apply(s => AppLogic.updateMatterNote(s, ref, c)),
        
        // --- SETTINGS & TEAM (Updated) ---
        toggleDarkMode: () => apply(s => AppLogic.toggleDarkMode(s)),
        login: (sign: string) => apply(s => AppLogic.login(s, sign)),
        addTeamMember: (n: string, s: string, c: string) => apply(st => AppLogic.addTeamMember(st, n, s, c)),
        
        // MISSING FUNCTIONS ADDED HERE:
        removeTeamMember: (id: string) => apply(s => AppLogic.removeTeamMember(s, id)),
        setTeamLeader: (id: string) => apply(s => AppLogic.setTeamLeader(s, id)),
        updateSettings: (vals: Partial<Settings>) => apply(s => AppLogic.updateSettings(s, vals)),
        
        // --- RESOURCES ---
        addResource: (res: any) => apply(s => AppLogic.addResource(s, res)),
        deleteResource: (id: string) => apply(s => AppLogic.deleteResource(s, id)),

        // --- TASKS ---
        addTask: (col: string, t: string) => apply(s => TaskLogic.addTask(s, col, t)),
        deleteTask: (id: string) => apply(s => TaskLogic.deleteTask(s, id)),
        moveTask: (id: string, stat: string) => apply(s => TaskLogic.moveTask(s, id, stat)),
        updateTaskTitle: (id: string, t: string) => apply(s => TaskLogic.updateTaskTitle(s, id, t)),
        updateTaskRef: (id: string, ref: string) => apply(s => TaskLogic.updateTaskRef(s, id, ref)),
        updateDate: (id: string, d: string) => apply(s => TaskLogic.updateDate(s, id, d)),
        toggleFlag: (id: string, d: string | null) => apply(s => TaskLogic.toggleFlag(s, id, d)),

        // --- SUBTASKS ---
        addSubtask: (tid: string, t: string, type: SubtaskType = 'GENERIC') => apply(s => TaskLogic.addSubtask(s, tid, t, type)),
        addSubSubtask: (tid: string, pid: string, t: string) => apply(s => TaskLogic.addSubSubtask(s, tid, pid, t)),
        toggleSubtask: (tid: string, sid: string) => apply(s => TaskLogic.toggleSubtask(s, tid, sid)),
        updateSubtaskTitle: (tid: string, sid: string, t: string) => apply(s => TaskLogic.updateSubtaskTitle(s, tid, sid, t)),

        // --- WORKFLOW ---
        updateSubtaskPos: (tid: string, sid: string, x: number, y: number) => apply(s => TaskLogic.updateSubtaskPos(s, tid, sid, x, y)),
        connectSubtasks: (tid: string, src: string, tgt: string) => apply(s => TaskLogic.connectSubtasks(s, tid, src, tgt)),
        disconnectSubtasks: (tid: string, src: string, tgt: string) => apply(s => TaskLogic.disconnectSubtasks(s, tid, src, tgt)),

        // --- IMPORT / EXPORT ---
        importData: (json: string) => {
            try {
                const parsed = JSON.parse(json);
                apply(s => ({ ...s, ...parsed }));
                return true;
            } catch { return false; }
        },
        exportData: () => {
            update(s => {
                const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `lawcp_backup_${new Date().toISOString().slice(0,10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
                return s;
            });
        }
	};
};

export const store = createStore();