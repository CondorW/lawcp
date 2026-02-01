import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

// --- Types & Schemas ---

const TeamMemberSchema = z.object({
    id: z.string(),
    name: z.string(),
    shortsign: z.string(),
    email: z.string().optional(),
    color: z.string().default('bg-slate-200 text-slate-700'),
    isLeader: z.boolean().default(false) // NEU: Team Leader Flag
});

const SettingsSchema = z.object({
    myShortsign: z.string().default('ME'),
    darkMode: z.boolean().default(false), // NEU: Dark Mode
    team: z.array(TeamMemberSchema).default([])
});

const SubtaskTypeSchema = z.enum(['GENERIC', 'DOCUMENT', 'RESEARCH', 'EMAIL']);

const SubtaskSchema = z.object({
    id: z.string(),
    title: z.string(),
    done: z.boolean().default(false),
    type: SubtaskTypeSchema.default('GENERIC'),
    payload: z.string().optional()
});

export const TaskSchema = z.object({
	id: z.string(),
	title: z.string().min(1, "Titel fehlt"),
	matterRef: z.string().optional(),
	dueDate: z.string(),
	status: z.enum(['TODO', 'WAITING', 'REVIEW', 'DONE']),
	priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
	createdAt: z.string(),
    timeTracked: z.number().default(0),
    subtasks: z.array(SubtaskSchema).default([])
});

const AppDataSchema = z.object({
    tasks: z.array(TaskSchema),
    settings: SettingsSchema
});

export type Task = z.infer<typeof TaskSchema>;
export type Subtask = z.infer<typeof SubtaskSchema>;
export type SubtaskType = z.infer<typeof SubtaskTypeSchema>;
export type TeamMember = z.infer<typeof TeamMemberSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type AppData = z.infer<typeof AppDataSchema>;

const STORAGE_KEY = 'associate-os-v3';

const createStore = () => {
	let data: AppData = { 
        tasks: [], 
        settings: { myShortsign: 'ME', darkMode: false, team: [] } 
    };
	
	if (browser) {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			try {
				const parsed = JSON.parse(stored);
                // Migration Check wäre hier gut, wir parsen einfach strikt
                if (!Array.isArray(parsed)) {
                    data = AppDataSchema.parse(parsed);
                }
			} catch (e) {
				console.error("Store Load Error", e);
			}
		}
	}

	const { subscribe, update, set } = writable<AppData>(data);

	const saveToDisk = (currentData: AppData) => {
		if (browser) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(currentData));
            // Dark Mode Sync
            if (currentData.settings.darkMode) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        }
	};

	return {
		subscribe,
        
        // --- SETTINGS ---
        updateSettings: (newSettings: Settings) => {
            update(state => {
                const newState = { ...state, settings: newSettings };
                saveToDisk(newState);
                return newState;
            });
        },
        
        addTeamMember: (name: string, shortsign: string, color: string) => {
            update(state => {
                const newMember: TeamMember = { id: uuidv4(), name, shortsign, color, isLeader: false };
                const newSettings = { ...state.settings, team: [...state.settings.team, newMember] };
                saveToDisk({ ...state, settings: newSettings });
                return { ...state, settings: newSettings };
            });
        },

        removeTeamMember: (id: string) => {
            update(state => {
                const newSettings = { ...state.settings, team: state.settings.team.filter(m => m.id !== id) };
                saveToDisk({ ...state, settings: newSettings });
                return { ...state, settings: newSettings };
            });
        },

        setTeamLeader: (id: string) => {
            update(state => {
                const newTeam = state.settings.team.map(m => ({ ...m, isLeader: m.id === id }));
                const newSettings = { ...state.settings, team: newTeam };
                saveToDisk({ ...state, settings: newSettings });
                return { ...state, settings: newSettings };
            });
        },

        toggleDarkMode: () => {
            update(state => {
                const newSettings = { ...state.settings, darkMode: !state.settings.darkMode };
                saveToDisk({ ...state, settings: newSettings });
                return { ...state, settings: newSettings };
            });
        },

        // --- TASKS ---
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
                    subtasks: []
				};
                const newState = { ...state, tasks: [newTask, ...state.tasks] };
				saveToDisk(newState);
				return newState;
			});
		},

        updateTaskTitle: (id: string, title: string) => {
            update(state => {
                const newTasks = state.tasks.map(t => t.id === id ? { ...t, title } : t);
                saveToDisk({ ...state, tasks: newTasks });
                return { ...state, tasks: newTasks };
            });
        },

        addSubtask: (taskId: string, title: string, type: SubtaskType = 'GENERIC') => {
            update(state => {
                const newTasks = state.tasks.map(t => {
                    if (t.id !== taskId) return t;
                    const newSub: Subtask = { id: uuidv4(), title, done: false, type };
                    return { ...t, subtasks: [...t.subtasks, newSub] };
                });
                saveToDisk({ ...state, tasks: newTasks });
                return { ...state, tasks: newTasks };
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
                saveToDisk({ ...state, tasks: newTasks });
                return { ...state, tasks: newTasks };
            });
        },

        toggleSubtask: (taskId: string, subtaskId: string) => {
            update(state => {
                const newTasks = state.tasks.map(t => {
                    if (t.id !== taskId) return t;
                    return { ...t, subtasks: t.subtasks.map(s => s.id === subtaskId ? { ...s, done: !s.done } : s) };
                });
                saveToDisk({ ...state, tasks: newTasks });
                return { ...state, tasks: newTasks };
            });
        },
        
        updateDate: (id: string, newDate: string) => {
             update(state => {
                const newTasks = state.tasks.map(t => t.id === id ? { ...t, dueDate: newDate } : t);
                saveToDisk({ ...state, tasks: newTasks });
                return { ...state, tasks: newTasks };
            });
        },

		moveTask: (id: string, status: Task['status']) => {
			update(state => {
                const newTasks = state.tasks.map(t => t.id === id ? { ...t, status } : t);
                saveToDisk({ ...state, tasks: newTasks });
                return { ...state, tasks: newTasks };
            });
		},

		deleteTask: (id: string) => {
			update(state => {
                const newTasks = state.tasks.filter(t => t.id !== id);
                saveToDisk({ ...state, tasks: newTasks });
                return { ...state, tasks: newTasks };
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