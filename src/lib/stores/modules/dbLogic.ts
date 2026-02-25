import { pb } from '$lib/pocketbase';
import { v4 as uuidv4 } from 'uuid';
import type { AppData, Task, SubtaskType, Resource, Subtask } from '$lib/types';
import { recursiveAdd, recursiveUpdate } from '$lib/utils';

// --- RESOURCES ---
export const addResource = async (resData: Omit<Resource, 'id' | 'created' | 'updated' | 'owner' | 'expand'>) => {
    const userId = pb.authStore.model?.id;
    if (!userId) return;
    try {
        await pb.collection('resources').create({ ...resData, owner: userId });
    } catch (e) {
        console.error("Failed to add resource:", e);
    }
};

export const deleteResource = async (update: (fn: (s: AppData) => AppData) => void, id: string) => {
    update(s => ({ ...s, resources: s.resources.filter(r => r.id !== id) }));
    try {
        await pb.collection('resources').delete(id);
    } catch (e) {
        console.error("Failed to delete resource:", e);
    }
};

export const addTask = async (update: any, status: string, title: string, ref?: string, date?: string, assignedTo?: string) => {
    const userId = pb.authStore.model?.id;
    if (!userId) return;

    const dueDate = date || new Date().toISOString();
    const tempId = 'temp-' + Date.now(); // Temporäre ID, bis PB die echte liefert

    // 1. OPTIMISTIC UI: Sofort in den lokalen Store pushen (0ms Latenz)
    update((s: AppData) => {
        const newTask: Task = {
            id: tempId,
            title,
            status: status as Task['status'],
            matterRef: ref,
            dueDate: dueDate.substring(0, 10),
            subtasks: [],
            flaggedDate: null,
            priority: 'MEDIUM',
            createdAt: new Date().toISOString(),
            timeTracked: 0,
            dependencies: [],
            assignees: assignedTo ? [assignedTo] : [userId],
            owner: userId
        };
        return { ...s, tasks: [newTask, ...s.tasks] };
    });

    // 2. Im Hintergrund an die Datenbank senden
    try {
        const record = await pb.collection('tasks').create({
            title, status, matterRef: ref, dueDate,
            subtasks: [], owner: userId, assignees: assignedTo ? [assignedTo] : [userId]
        });

        // 3. Temporäre ID mit der echten Datenbank-ID überschreiben
        update((s: AppData) => ({
            ...s,
            tasks: s.tasks.map(t => t.id === tempId ? { ...t, id: record.id } : t)
        }));
    } catch (e) {
        console.error("Task creation failed:", e);
        // Bei Fehler den Task wieder aus dem UI löschen (Rollback)
        update((s: AppData) => ({ ...s, tasks: s.tasks.filter(t => t.id !== tempId) }));
    }
};

export const assignTask = async (update: (fn: (s: AppData) => AppData) => void, taskId: string, assigneeId: string) => {
    update(s => ({
        ...s,
        tasks: s.tasks.map(t => t.id === taskId ? { ...t, assignees: assigneeId ? [assigneeId] : [] } : t)
    }));
    try {
        await pb.collection('tasks').update(taskId, { assignees: assigneeId ? [assigneeId] : [] });
    } catch (e) {
        console.error("Assignment failed:", e);
    }
};

export const deleteTask = async (update: (fn: (s: AppData) => AppData) => void, id: string) => {
    update(s => ({ ...s, tasks: s.tasks.filter(t => t.id !== id) }));
    try { await pb.collection('tasks').delete(id); } catch (e) { console.error("Delete failed:", e); }
};

export const updateTaskTitle = async (id: string, title: string) => pb.collection('tasks').update(id, { title });
export const updateTaskRef = async (id: string, ref: string) => pb.collection('tasks').update(id, { matterRef: ref });
export const updateDate = async (id: string, date: string) => pb.collection('tasks').update(id, { dueDate: date });
export const toggleFlag = async (id: string, date: string | null) => pb.collection('tasks').update(id, { flaggedDate: date });

export const moveTask = async (update: (fn: (s: AppData) => AppData) => void, id: string, status: string) => {
    const myId = pb.authStore.model?.id || '';
    update(s => {
        const task = s.tasks.find(t => t.id === id);
        if (!task) return s;

        const isOwner = task.owner === myId;
        const isAssignee = task.assignees?.includes(myId);
        const isTeamLeader = task.expand?.owner?.teamLeader === myId;

        if (isTeamLeader && !isOwner && !isAssignee && status !== 'REVIEW') {
            return { ...s, tasks: s.tasks.filter(t => t.id !== id) };
        }
        return { ...s, tasks: s.tasks.map(t => t.id === id ? { ...t, status: status as Task['status'] } : t) };
    });

    try { await pb.collection('tasks').update(id, { status }); } catch (e) { console.error("Move failed:", e); }
};

// --- SUBTASKS ---
export const addSubtask = async (get: () => AppData, taskId: string, title: string, type: SubtaskType = 'GENERIC', x = 300, y = 200) => {
    const state = get();
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const newSub: Subtask = { id: uuidv4(), title, done: false, type, x, y, next: [], subtasks: [] };
    const newSubtasks = [...task.subtasks, newSub];
    await pb.collection('tasks').update(taskId, { subtasks: newSubtasks });
};

export const toggleSubtask = async (get: () => AppData, taskId: string, subId: string) => {
    // ... (unverändert) ...
    const state = get();
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const newSubtasks = recursiveUpdate(task.subtasks, subId, s => ({ ...s, done: !s.done }));
    await pb.collection('tasks').update(taskId, { subtasks: newSubtasks });
};

export const updateSubtaskTitle = async (get: () => AppData, taskId: string, subId: string, title: string) => {
    // ... (unverändert) ...
    const state = get();
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const newSubtasks = recursiveUpdate(task.subtasks, subId, s => ({ ...s, title }));
    await pb.collection('tasks').update(taskId, { subtasks: newSubtasks });
};

export const addSubSubtask = async (get: () => AppData, taskId: string, parentSubId: string, title: string) => {
    const state = get();
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    // FIX: Auch Sub-Subtasks bekommen einen zentrierten Standard-Spawnpunkt
    const newSub: Subtask = { id: uuidv4(), title, done: false, type: 'GENERIC', x: 350, y: 250, next: [], subtasks: [] };
    const newSubtasks = recursiveAdd(task.subtasks, parentSubId, newSub);
    await pb.collection('tasks').update(taskId, { subtasks: newSubtasks });
};
let moveTimer: ReturnType<typeof setTimeout>;

export const updateSubtaskPos = async (update: any, get: any, taskId: string, subId: string, x: number, y: number) => {
    // 1. Optimistic Update für flüssiges 60 FPS Dragging
    update((s: AppData) => ({
        ...s,
        tasks: s.tasks.map(t => t.id === taskId ? {
            ...t,
            subtasks: recursiveUpdate(t.subtasks, subId, sub => ({ ...sub, x, y }))
        } : t)
    }));

    // 2. Debounce: Erst wenn die Maus 800ms stillsteht, an die Datenbank senden
    clearTimeout(moveTimer);
    moveTimer = setTimeout(async () => {
        const task = get().tasks.find((t: Task) => t.id === taskId);
        if(task) await pb.collection('tasks').update(taskId, { subtasks: task.subtasks });
    }, 800);
};

export const connectSubtasks = async (update: any, get: any, taskId: string, sourceId: string, targetId: string) => {
    update((s: AppData) => ({
        ...s,
        tasks: s.tasks.map(t => t.id === taskId ? {
            ...t,
            subtasks: recursiveUpdate(t.subtasks, sourceId, sub => ({
                ...sub,
                next: [...new Set([...sub.next, targetId])]
            }))
        } : t)
    }));
    const task = get().tasks.find((t: Task) => t.id === taskId);
    if(task) await pb.collection('tasks').update(taskId, { subtasks: task.subtasks });
};

export const disconnectSubtasks = async (update: any, get: any, taskId: string, sourceId: string, targetId: string) => {
    update((s: AppData) => ({
        ...s,
        tasks: s.tasks.map(t => t.id === taskId ? {
            ...t,
            subtasks: recursiveUpdate(t.subtasks, sourceId, sub => ({
                ...sub,
                next: sub.next.filter((id: string) => id !== targetId)
            }))
        } : t)
    }));
    const task = get().tasks.find((t: Task) => t.id === taskId);
    if(task) await pb.collection('tasks').update(taskId, { subtasks: task.subtasks });
};