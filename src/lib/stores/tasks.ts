// src/lib/stores/tasks.ts
import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

// --- Subtask Schema ---
const SubtaskSchema = z.object({
    id: z.string(),
    title: z.string(),
    done: z.boolean().default(false)
});

// --- Task Schema Update ---
export const TaskSchema = z.object({
	id: z.string(),
	title: z.string().min(1, "Titel fehlt"),
	matterRef: z.string().optional(),
	dueDate: z.string(),
	status: z.enum(['TODO', 'WAITING', 'REVIEW', 'DONE']),
	priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
	createdAt: z.string(),
    timeTracked: z.number().default(0),
    // NEU: Subtasks Array (Standard leer)
    subtasks: z.array(SubtaskSchema).default([])
});

export type Task = z.infer<typeof TaskSchema>;
export type Subtask = z.infer<typeof SubtaskSchema>;

const STORAGE_KEY = 'associate-os-v1';
const SNAPSHOT_KEY = 'associate-os-snapshots';

const createTasksStore = () => {
	let initialData: Task[] = [];
	
	if (browser) {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			try {
				const parsed = JSON.parse(stored);
				initialData = z.array(TaskSchema).parse(parsed);
			} catch (e) {
				console.error("Datenbank korrupt", e);
			}
		}
	}

	const { subscribe, update, set } = writable<Task[]>(initialData);

	const saveToDisk = (data: Task[]) => {
		if (browser) localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
	};

	return {
		subscribe,
		
		addTask: (title: string, matterRef: string, dueDate: string, priority: Task['priority'] = 'MEDIUM') => {
			update(tasks => {
				const newTask: Task = {
					id: uuidv4(),
					title,
					matterRef: matterRef || 'General',
					dueDate,
					status: 'TODO',
					priority,
					createdAt: new Date().toISOString(),
                    timeTracked: 0,
                    subtasks: []
				};
				const newTx = [newTask, ...tasks];
				saveToDisk(newTx);
				return newTx;
			});
		},

        // NEU: Subtask hinzufügen
        addSubtask: (taskId: string, title: string) => {
            update(tasks => {
                const newTx = tasks.map(t => {
                    if (t.id !== taskId) return t;
                    return {
                        ...t,
                        subtasks: [...t.subtasks, { id: uuidv4(), title, done: false }]
                    };
                });
                saveToDisk(newTx);
                return newTx;
            });
        },

        // NEU: Subtask abhaken
        toggleSubtask: (taskId: string, subtaskId: string) => {
            update(tasks => {
                const newTx = tasks.map(t => {
                    if (t.id !== taskId) return t;
                    return {
                        ...t,
                        subtasks: t.subtasks.map(s => s.id === subtaskId ? { ...s, done: !s.done } : s)
                    };
                });
                saveToDisk(newTx);
                return newTx;
            });
        },

        // Datum Update
        updateDate: (id: string, newDate: string) => {
            update(tasks => {
                const newTx = tasks.map(t => t.id === id ? { ...t, dueDate: newDate } : t);
                saveToDisk(newTx);
                return newTx;
            });
        },

		moveTask: (id: string, status: Task['status']) => {
			update(tasks => {
				const newTx = tasks.map(t => t.id === id ? { ...t, status } : t);
				saveToDisk(newTx);
				return newTx;
			});
		},

		deleteTask: (id: string) => {
			update(tasks => {
				const newTx = tasks.filter(t => t.id !== id);
				saveToDisk(newTx);
				return newTx;
			});
		},
        
        // --- BACKUP FEATURES ---
        exportData: () => {
            if (!browser) return;
            const data = localStorage.getItem(STORAGE_KEY);
            if (!data) return;
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `lawcp_backup_${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        },

        createSnapshot: (name: string) => {
            if (!browser) return;
            const currentData = localStorage.getItem(STORAGE_KEY);
            if (!currentData) return;
            const snapshotsRaw = localStorage.getItem(SNAPSHOT_KEY);
            const snapshots = snapshotsRaw ? JSON.parse(snapshotsRaw) : {};
            const timestamp = new Date().toLocaleString('de-DE');
            const key = name ? `${timestamp} - ${name}` : timestamp;
            snapshots[key] = JSON.parse(currentData);
            localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshots));
        },

        getSnapshots: (): string[] => {
            if (!browser) return [];
            const snapshotsRaw = localStorage.getItem(SNAPSHOT_KEY);
            if (!snapshotsRaw) return [];
            return Object.keys(JSON.parse(snapshotsRaw)).reverse();
        },

        restoreSnapshot: (key: string) => {
            if (!browser) return;
            const snapshotsRaw = localStorage.getItem(SNAPSHOT_KEY);
            if (!snapshotsRaw) return;
            const snapshots = JSON.parse(snapshotsRaw);
            if (snapshots[key]) {
                try {
                    const validData = z.array(TaskSchema).parse(snapshots[key]);
                    set(validData);
                    saveToDisk(validData);
                } catch(e) {
                    alert("Backup beschädigt!");
                }
            }
        }
	};
};

export const taskStore = createTasksStore();