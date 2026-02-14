import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { v4 as uuidv4 } from 'uuid';
import { 
    AppDataSchema, TaskSchema, 
    type AppData, type Task, type Subtask, type Settings, type Resource, type SubtaskType 
} from '$lib/types';

export type { Task, Subtask, Settings, Resource, SubtaskType };

const STORAGE_KEY = 'associate-os-v5';

function recursiveUpdate(subtasks: Subtask[], targetId: string, fn: (s: Subtask) => Subtask): Subtask[] {
    return subtasks.map(s => {
        if (s.id === targetId) return fn(s);
        if (s.subtasks && s.subtasks.length > 0) {
            return { ...s, subtasks: recursiveUpdate(s.subtasks, targetId, fn) };
        }
        return s;
    });
}

function recursiveAdd(subtasks: Subtask[], parentId: string, newSub: Subtask): Subtask[] {
    return subtasks.map(s => {
        if (s.id === parentId) {
            return { ...s, subtasks: [...(s.subtasks || []), newSub] };
        }
        if (s.subtasks && s.subtasks.length > 0) {
            return { ...s, subtasks: recursiveAdd(s.subtasks, parentId, newSub) };
        }
        return s;
    });
}


const createStore = () => {
    // Initial State: Not authenticated by default
	let data: AppData = { 
        tasks: [], 
        settings: { myShortsign: 'ME', darkMode: true, isAuthenticated: true, team: [] }, 
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
        
        // --- AUTH ACTIONS ---
        login: (shortsign: string) => {
            update(state => {
                const newState = { 
                    ...state, 
                    settings: { ...state.settings, isAuthenticated: true, myShortsign: shortsign } 
                };
                saveToDisk(newState);
                return newState;
            });
        },

        logout: () => {
            update(state => {
                const newState = { 
                    ...state, 
                    settings: { ...state.settings, isAuthenticated: false } 
                };
                saveToDisk(newState);
                return newState;
            });
        },

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

        updateTaskRef: (id: string, ref: string) => {
            update(state => {
                const newTasks = state.tasks.map(t => t.id === id ? { ...t, matterRef: ref } : t);
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

        addSubtask: (taskId: string, title: string, type: SubtaskType = 'GENERIC', x = 400, y = 300) => {
            update(state => {
                const newTasks = state.tasks.map(t => {
                    if (t.id !== taskId) return t;
                    const newSub: Subtask = { 
                        id: uuidv4(), title, done: false, type, x, y, next: [], subtasks: [] 
                    };
                    return { ...t, subtasks: [...t.subtasks, newSub] };
                });
                const newState = { ...state, tasks: newTasks };
                saveToDisk(newState); 
                return newState;
            });
        },
        // NEU: Sub-Subtask hinzufügen
        addSubSubtask: (taskId: string, parentSubId: string, title: string) => {
             update(state => {
                const newTasks = state.tasks.map(t => {
                    if (t.id !== taskId) return t;
                    const newSub: Subtask = { 
                        id: uuidv4(), title, done: false, type: 'GENERIC', x:0, y:0, next: [], subtasks: [] 
                    };
                    // Rekursiv einfügen
                    return { ...t, subtasks: recursiveAdd(t.subtasks, parentSubId, newSub) };
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
                    // FIX: Rekursives Update
                    return { ...t, subtasks: recursiveUpdate(t.subtasks, subId, s => ({ ...s, title })) };
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
                    // FIX: Rekursives Toggle
                    return { ...t, subtasks: recursiveUpdate(t.subtasks, subtaskId, s => ({ ...s, done: !s.done })) };
                });
                const newState = { ...state, tasks: newTasks };
                saveToDisk(newState); 
                return newState;
            });
        },

        // --- RESOURCES & SETTINGS ---
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
                    return { 
                        ...t, 
                        subtasks: t.subtasks.map(sub => {
                            if (sub.id === sourceId) {
                                // FIX: Typ für 'n' explizit angeben
                                return { ...sub, next: sub.next.filter((n: string) => n !== targetId) };
                            } 
                            return sub;
                        }) 
                    };
                });
                const ns = { ...s, tasks };
                saveToDisk(ns); 
                return ns;
            });
        },
        

        // --- EXPORT/IMPORT ---
        importData: (jsonString: string) => {
            try {
                const parsed = JSON.parse(jsonString);
                if (!parsed.tasks || !parsed.settings) throw new Error("Format");
                update(state => {
                    saveToDisk(parsed);
                    if (browser) {
                        if (parsed.settings.darkMode) document.documentElement.classList.add('dark');
                        else document.documentElement.classList.remove('dark');
                    }
                    return parsed;
                });
                return true;
            } catch (e) { return false; }
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