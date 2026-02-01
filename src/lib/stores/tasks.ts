import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { v4 as uuidv4 } from 'uuid';
import { 
    AppDataSchema, TaskSchema, 
    type AppData, type Task, type Subtask, type Settings, type Resource, type SubtaskType 
} from '$lib/types';

// Re-Export für Komponenten, damit Imports einfach bleiben
export type { Task, Subtask, Settings, Resource, SubtaskType };

const STORAGE_KEY = 'associate-os-v5';

const createStore = () => {
    // Initial State
	let data: AppData = { 
        tasks: [], 
        settings: { myShortsign: 'ME', darkMode: false, team: [] },
        resources: []
    };
	
	if (browser) {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			try {
				const parsed = JSON.parse(stored);
                if (!Array.isArray(parsed)) {
                     const safe = AppDataSchema.safeParse(parsed);
                     if(safe.success) data = safe.data;
                     // Defaults auffüllen falls Felder fehlen
                     if(!data.resources) data.resources = [];
                }
			} catch (e) { console.error("Store Load Error", e); }
		}
	}

	const { subscribe, update, set } = writable<AppData>(data);

	const saveToDisk = (currentData: AppData) => {
		if (browser) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(currentData));
            if (currentData.settings.darkMode) document.documentElement.classList.add('dark');
            else document.documentElement.classList.remove('dark');
        }
	};

	return {
		subscribe,
        
        // --- CORE TASK ACTIONS ---
		addTask: (title: string, matterRef: string, dueDate: string) => {
			update(state => {
				const newTask: Task = {
					id: uuidv4(),
					title, 
                    matterRef: matterRef || '', 
                    dueDate, 
                    status: 'TODO', 
                    priority: 'MEDIUM', 
                    createdAt: new Date().toISOString(), 
                    timeTracked: 0, 
                    subtasks: [], 
                    dependencies: [], 
                    flaggedDate: null
				};
                const newState = { ...state, tasks: [newTask, ...state.tasks] };
				saveToDisk(newState); 
                return newState;
			});
		},

        updateTaskTitle: (id: string, title: string) => {
            update(state => {
                const newTasks = state.tasks.map(t => t.id === id ? { ...t, title } : t);
                const newState = { ...state, tasks: newTasks };
                saveToDisk(newState); 
                return newState;
            });
        },

		deleteTask: (id: string) => {
			update(state => {
                const newTasks = state.tasks.filter(t => t.id !== id);
                const newState = { ...state, tasks: newTasks };
                saveToDisk(newState); 
                return newState;
            });
		},

        moveTask: (id: string, status: Task['status']) => {
			update(state => {
                const newTasks = state.tasks.map(t => t.id === id ? { ...t, status } : t);
                const newState = { ...state, tasks: newTasks };
                saveToDisk(newState); 
                return newState;
            });
		},

        updateDate: (id: string, newDate: string) => {
             update(state => {
                const newTasks = state.tasks.map(t => t.id === id ? { ...t, dueDate: newDate } : t);
                const newState = { ...state, tasks: newTasks };
                saveToDisk(newState); 
                return newState;
            });
        },

        toggleFlag: (taskId: string, date: string | null) => {
             update(s => {
                const tasks = s.tasks.map(t => t.id === taskId ? { ...t, flaggedDate: date } : t);
                const ns = { ...s, tasks };
                saveToDisk(ns); 
                return ns;
            });
        },

        // --- SUBTASK ACTIONS ---
        
        addSubtask: (taskId: string, title: string, type: SubtaskType = 'GENERIC') => {
            update(state => {
                const newTasks = state.tasks.map(t => {
                    if (t.id !== taskId) return t;
                    const newSub: Subtask = { 
                        id: uuidv4(), 
                        title, 
                        done: false, 
                        type, 
                        x: Math.random() * 200, 
                        y: Math.random() * 200, 
                        next: [] 
                    };
                    return { ...t, subtasks: [...t.subtasks, newSub] };
                });
                const newState = { ...state, tasks: newTasks };
                saveToDisk(newState); 
                return newState;
            });
        },

        updateSubtaskTitle: (taskId: string, subId: string, title: string) => {
            update(state => {
                const newTasks = state.tasks.map(t => {
                    if (t.id !== taskId) return t;
                    return { 
                        ...t, 
                        subtasks: t.subtasks.map(s => s.id === subId ? { ...s, title } : s) 
                    };
                });
                const newState = { ...state, tasks: newTasks };
                saveToDisk(newState); 
                return newState;
            });
        },

        toggleSubtask: (taskId: string, subtaskId: string) => {
            update(state => {
                const newTasks = state.tasks.map(t => {
                    if (t.id !== taskId) return t;
                    return { 
                        ...t, 
                        subtasks: t.subtasks.map(s => s.id === subtaskId ? { ...s, done: !s.done } : s) 
                    };
                });
                const newState = { ...state, tasks: newTasks };
                saveToDisk(newState); 
                return newState;
            });
        },

        // --- RESOURCES & SETTINGS (Keep existing logic) ---
        addResource: (res: Omit<Resource, 'id'>) => {
            update(s => {
                const newRes = { ...res, id: uuidv4() };
                const ns = { ...s, resources: [...s.resources, newRes] };
                saveToDisk(ns); return ns;
            });
        },
        deleteResource: (id: string) => {
            update(s => {
                const ns = { ...s, resources: s.resources.filter(r => r.id !== id) };
                saveToDisk(ns); return ns;
            });
        },
        updateSettings: (newSettings: Settings) => {
            update(state => {
                const newState = { ...state, settings: newSettings };
                saveToDisk(newState); return newState;
            });
        },
        addTeamMember: (name: string, shortsign: string, color: string) => {
            update(state => {
                const newMember = { id: uuidv4(), name, shortsign, color, isLeader: false };
                const newSettings = { ...state.settings, team: [...state.settings.team, newMember] };
                saveToDisk({ ...state, settings: newSettings }); return { ...state, settings: newSettings };
            });
        },
        removeTeamMember: (id: string) => {
            update(state => {
                const newSettings = { ...state.settings, team: state.settings.team.filter(m => m.id !== id) };
                saveToDisk({ ...state, settings: newSettings }); return { ...state, settings: newSettings };
            });
        },
        setTeamLeader: (id: string) => {
            update(state => {
                const newTeam = state.settings.team.map(m => ({ ...m, isLeader: m.id === id }));
                const newSettings = { ...state.settings, team: newTeam };
                saveToDisk({ ...state, settings: newSettings }); return { ...state, settings: newSettings };
            });
        },
        toggleDarkMode: () => {
            update(state => {
                const newSettings = { ...state.settings, darkMode: !state.settings.darkMode };
                const newState = { ...state, settings: newSettings };
                saveToDisk(newState); return newState;
            });
        },

        // --- WORKFLOW HELPERS ---
        updateSubtaskPos: (taskId: string, subId: string, x: number, y: number) => {
            update(s => {
                const tasks = s.tasks.map(t => {
                    if (t.id !== taskId) return t;
                    return { ...t, subtasks: t.subtasks.map(sub => sub.id === subId ? { ...sub, x, y } : sub) };
                });
                const ns = { ...s, tasks };
                saveToDisk(ns); return ns;
            });
        },
        connectSubtasks: (taskId: string, sourceId: string, targetId: string) => {
             update(s => {
                const tasks = s.tasks.map(t => {
                    if (t.id !== taskId) return t;
                    return { ...t, subtasks: t.subtasks.map(sub => {
                            if (sub.id === sourceId) {
                                if (sub.next.includes(targetId)) return sub;
                                return { ...sub, next: [...sub.next, targetId] };
                            } return sub;
                        }) 
                    };
                });
                const ns = { ...s, tasks };
                saveToDisk(ns); return ns;
            });
        },
        disconnectSubtasks: (taskId: string, sourceId: string, targetId: string) => {
             update(s => {
                const tasks = s.tasks.map(t => {
                    if (t.id !== taskId) return t;
                    return { ...t, subtasks: t.subtasks.map(sub => {
                            if (sub.id === sourceId) {
                                return { ...sub, next: sub.next.filter(n => n !== targetId) };
                            } return sub;
                        }) 
                    };
                });
                const ns = { ...s, tasks };
                saveToDisk(ns); return ns;
            });
        },
        exportData: () => {
            if (!browser) return;
            const data = localStorage.getItem(STORAGE_KEY);
            if (!data) return;
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `lawcp_backup.json`;
            a.click();
            URL.revokeObjectURL(url);
        }
	};
};

export const store = createStore();