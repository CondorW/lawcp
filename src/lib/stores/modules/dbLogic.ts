import { pb } from '$lib/pocketbase';
import { v4 as uuidv4 } from 'uuid';
import type { AppData, Task, SubtaskType, Resource, Subtask } from '$lib/types';
import { recursiveAdd, recursiveUpdate } from '$lib/utils';

// --- RESOURCES ---
export const addResource = async (update: any, resData: Omit<Resource, 'id' | 'created' | 'updated' | 'owner' | 'expand'>) => {
    const userModel = pb.authStore.model;
    const userId = userModel?.id;
    
    if (!userId || !userModel) return;

    const tempId = 'temp-res-' + Date.now();

    update((s: AppData) => {
        const newRes: Resource = {
            ...resData,
            id: tempId,
            owner: userId,
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            expand: {
                owner: {
                    shortsign: userModel.shortsign || 'ME'
                } as any 
            }
        };
        return { ...s, resources: [newRes, ...s.resources] };
    });

    try {
        const record = await pb.collection('resources').create(
            { ...resData, owner: userId },
            { expand: 'owner' } 
        );

        update((s: AppData) => ({
            ...s,
            resources: s.resources.map(r => r.id === tempId ? { 
                ...r, 
                id: record.id,
                expand: record.expand 
            } : r)
        }));
    } catch (e) {
        console.error("Failed to add resource:", e);
        update((s: AppData) => ({ ...s, resources: s.resources.filter(r => r.id !== tempId) }));
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

// --- TASKS ---
export const addTask = async (update: any, status: string, title: string, ref?: string, date?: string, assignedTo?: string) => {
    const userId = pb.authStore.model?.id;
    if (!userId) return;

    const dueDate = date || new Date().toISOString();

    try {
        await pb.collection('tasks').create({ 
            title, 
            status, 
            matterRef: ref, 
            dueDate, 
            subtasks: [], 
            owner: userId, 
            assignees: assignedTo ? [assignedTo] : [userId] 
        });
    } catch (e) { 
        console.error("Task creation failed:", e); 
    }
};

export const assignTask = async (update: (fn: (s: AppData) => AppData) => void, taskId: string, assigneeId: string) => {
    update(s => ({ ...s, tasks: s.tasks.map(t => t.id === taskId ? { ...t, assignees: assigneeId ? [assigneeId] : [] } : t) }));
    try {
        await pb.collection('tasks').update(taskId, { assignees: assigneeId ? [assigneeId] : [] });
    } catch (e) {
        console.error("Assignment failed:", e);
    }
};

export const deleteTask = async (update: (fn: (s: AppData) => AppData) => void, id: string) => {
    update(s => ({ ...s, tasks: s.tasks.filter(t => t.id !== id) }));
    try {
        await pb.collection('tasks').delete(id);
    } catch (e) {
        console.error("Delete failed:", e);
    }
};

export const updateTaskTitle = async (id: string, title: string) => pb.collection('tasks').update(id, { title });
export const updateTaskRef = async (id: string, ref: string) => pb.collection('tasks').update(id, { matterRef: ref });
export const updateDate = async (update: (fn: (s: AppData) => AppData) => void, id: string, date: string) => {
    update(s => ({ 
        ...s, 
        tasks: s.tasks.map(t => t.id === id ? { ...t, dueDate: date } : t) 
    }));
    pb.collection('tasks').update(id, { dueDate: date }).catch(e => console.error("Sync Error:", e));
};

export const toggleFlag = async (update: (fn: (s: AppData) => AppData) => void, id: string, date: string | null) => {
    update(s => ({ 
        ...s, 
        tasks: s.tasks.map(t => t.id === id ? { ...t, flaggedDate: date } : t) 
    }));
    pb.collection('tasks').update(id, { flaggedDate: date }).catch(e => console.error("Sync Error:", e));
};

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
    try {
        await pb.collection('tasks').update(id, { status });
    } catch (e) {
        console.error("Move failed:", e);
    }
};

// ============================================================================
// --- REFACTORED SUBTASK FUNCTIONS ---
// Implemented declarative array mapping within Svelte's `update` function 
// to guarantee Optimistic UI re-rendering without page refresh.
// ============================================================================

/**
 * Fügt einen neuen Subtask hinzu.
 * REFACTOR: Nutzt Sveltes update() zur immutablen Array-Erweiterung statt Pointer-Mutation.
 */
export const addSubtask = async (update: any, get: any, taskId: string, title: string, type: SubtaskType = 'GENERIC', x = 300, y = 200) => {
    const newSub: Subtask = { id: uuidv4(), title, done: false, type, x, y, next: [], subtasks: [] };
    
    // 1. Optimistic UI: Sofortiges Neuschreiben des State-Objekts für Svelte
    update((s: AppData) => ({
        ...s,
        tasks: s.tasks.map(t => t.id === taskId ? {
            ...t,
            subtasks: [...t.subtasks, newSub]
        } : t)
    }));

    // 2. Fire-and-Forget DB Sync (ohne die UI zu blockieren)
    const task = get().tasks.find((t: Task) => t.id === taskId);
    if (task) {
        pb.collection('tasks').update(taskId, { subtasks: task.subtasks }).catch(e => console.error("Sync Error:", e));
    }
};

/**
 * Schaltet den "Erledigt"-Status eines Subtasks um.
 * REFACTOR: Nutzt Sveltes update() + recursiveUpdate, um den Status tief im Array immutabel zu flippen.
 */
export const toggleSubtask = async (update: any, get: any, taskId: string, subId: string) => {
    // 1. Optimistic UI
    update((s: AppData) => ({
        ...s,
        tasks: s.tasks.map(t => t.id === taskId ? {
            ...t,
            subtasks: recursiveUpdate(t.subtasks, subId, sub => ({ ...sub, done: !sub.done }))
        } : t)
    }));

    // 2. Fire-and-Forget DB Sync
    const task = get().tasks.find((t: Task) => t.id === taskId);
    if (task) {
        pb.collection('tasks').update(taskId, { subtasks: task.subtasks }).catch(e => console.error("Sync Error:", e));
    }
};

/**
 * Aktualisiert den Text/Titel eines Subtasks.
 * REFACTOR: Nutzt Sveltes update() + recursiveUpdate, um den String immutabel auszutauschen.
 */
export const updateSubtaskTitle = async (update: any, get: any, taskId: string, subId: string, title: string) => {
    // 1. Optimistic UI
    update((s: AppData) => ({
        ...s,
        tasks: s.tasks.map(t => t.id === taskId ? {
            ...t,
            subtasks: recursiveUpdate(t.subtasks, subId, sub => ({ ...sub, title }))
        } : t)
    }));

    // 2. Fire-and-Forget DB Sync
    const task = get().tasks.find((t: Task) => t.id === taskId);
    if (task) {
        pb.collection('tasks').update(taskId, { subtasks: task.subtasks }).catch(e => console.error("Sync Error:", e));
    }
};

/**
 * Fügt einem bestehenden Subtask ein Kind-Element (Sub-Subtask) hinzu.
 * REFACTOR: Nutzt Sveltes update() + recursiveAdd, um die verschachtelte Struktur korrekt aufzubauen.
 */
export const addSubSubtask = async (update: any, get: any, taskId: string, parentSubId: string, title: string) => {
    const newSub: Subtask = { id: uuidv4(), title, done: false, type: 'GENERIC', x: 350, y: 250, next: [], subtasks: [] };
    
    // 1. Optimistic UI
    update((s: AppData) => ({
        ...s,
        tasks: s.tasks.map(t => t.id === taskId ? {
            ...t,
            subtasks: recursiveAdd(t.subtasks, parentSubId, newSub)
        } : t)
    }));

    // 2. Fire-and-Forget DB Sync
    const task = get().tasks.find((t: Task) => t.id === taskId);
    if (task) {
        pb.collection('tasks').update(taskId, { subtasks: task.subtasks }).catch(e => console.error("Sync Error:", e));
    }
};

export const deleteSubtask = async (update: any, get: any, taskId: string, subtaskIdToDelete: string) => {
    const deepClean = (nodes: any): Subtask[] => {
        if (!Array.isArray(nodes)) return [];
        return nodes
            .filter(n => n && typeof n === 'object' && n.id !== subtaskIdToDelete)
            .map(n => ({
                ...n,
                next: Array.isArray(n.next) ? n.next.filter((id: string) => id !== subtaskIdToDelete) : [],
                subtasks: deepClean(n.subtasks)
            }));
    };

    let payloadToSync: Subtask[] | null = null;

    update((s: AppData) => {
        const task = s.tasks.find(t => t.id === taskId);
        if (!task) return s;
        payloadToSync = deepClean(task.subtasks);
        return { ...s, tasks: s.tasks.map(t => t.id === taskId ? { ...t, subtasks: payloadToSync } : t ) };
    });

    if (payloadToSync !== null) {
        pb.collection('tasks').update(taskId, { subtasks: payloadToSync }).catch(e => console.error("Sync Error:", e));
    }
};

let moveTimer: ReturnType<typeof setTimeout>;
export let isDraggingLock = false; 

export const updateSubtaskPos = async (update: any, get: any, taskId: string, subId: string, x: number, y: number) => {
    isDraggingLock = true;

    update((s: AppData) => ({
        ...s,
        tasks: s.tasks.map(t => t.id === taskId ? {
            ...t,
            subtasks: recursiveUpdate(t.subtasks, subId, sub => ({ ...sub, x, y }))
        } : t)
    }));

    clearTimeout(moveTimer);
    
    moveTimer = setTimeout(async () => {
        const task = get().tasks.find((t: Task) => t.id === taskId);
        if(task) {
            try {
                await pb.collection('tasks').update(taskId, { subtasks: task.subtasks });
            } catch(e) { console.error("Sync Error:", e); }
        }
        isDraggingLock = false; 
    }, 400); 
};

export const connectSubtasks = async (update: any, get: any, taskId: string, sourceId: string, targetId: string) => {
    update((s: AppData) => ({
        ...s,
        tasks: s.tasks.map(t => t.id === taskId ? {
            ...t,
            subtasks: recursiveUpdate(t.subtasks, sourceId, sub => ({ ...sub, next: [...new Set([...sub.next, targetId])] }))
        } : t)
    }));
    const task = get().tasks.find((t: Task) => t.id === taskId);
    if(task) pb.collection('tasks').update(taskId, { subtasks: task.subtasks }).catch(e => console.error(e));
};

export const disconnectSubtasks = async (update: any, get: any, taskId: string, sourceId: string, targetId: string) => {
    update((s: AppData) => ({
        ...s,
        tasks: s.tasks.map(t => t.id === taskId ? {
            ...t,
            subtasks: recursiveUpdate(t.subtasks, sourceId, sub => ({ ...sub, next: sub.next.filter((id: string) => id !== targetId) }))
        } : t)
    }));
    const task = get().tasks.find((t: Task) => t.id === taskId);
    if(task) pb.collection('tasks').update(taskId, { subtasks: task.subtasks }).catch(e => console.error(e));
};

export const fetchContext = async (matterRef: string) => {
    const userId = pb.authStore.model?.id;
    if (!userId || !matterRef) return null;
    try {
        const record = await pb.collection('contexts').getFirstListItem(`matterRef="${matterRef}" && owner="${userId}"`);
        return record;
    } catch (e) {
        return null;
    }
};

export const saveContext = async (matterRef: string, content: string, contextId?: string) => {
    const userId = pb.authStore.model?.id;
    if (!userId || !matterRef) return null;
    try {
        if (contextId) {
            return await pb.collection('contexts').update(contextId, { content });
        } else {
            return await pb.collection('contexts').create({ matterRef, owner: userId, content });
        }
    } catch (e) {
        console.error("Failed to save context:", e);
        return null;
    }
};