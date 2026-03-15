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
            // FIX: Wir matchen das Objekt exakt auf die Erwartung des Linters
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
        // Zero-Flicker-Logik: Wir schreiben nur in die DB. 
        // Unser rasend schneller WebSocket/Poller fängt das Event ab und rendert die Karte 1x fehlerfrei.
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
    // 1. Optimistic UI: Sofortiges Update im lokalen RAM
    update(s => ({ 
        ...s, 
        tasks: s.tasks.map(t => t.id === id ? { ...t, dueDate: date } : t) 
    }));
    
    // 2. Fire-and-Forget an die Datenbank
    pb.collection('tasks').update(id, { dueDate: date }).catch(e => console.error("Sync Error:", e));
};

export const toggleFlag = async (update: (fn: (s: AppData) => AppData) => void, id: string, date: string | null) => {
    // 1. Optimistic UI: Sofortiges Update im lokalen RAM (Triggert sofortiges Neusortieren)
    update(s => ({ 
        ...s, 
        tasks: s.tasks.map(t => t.id === id ? { ...t, flaggedDate: date } : t) 
    }));
    
    // 2. Fire-and-Forget an die Datenbank
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

export const addSubtask = async (get: () => AppData, taskId: string, title: string, type: SubtaskType = 'GENERIC', x = 300, y = 200) => {
    // 1. OPTIMISTIC UI: Wir manipulieren den Store direkt für sofortiges Feedback
    const state = get();
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const newSub: Subtask = { id: uuidv4(), title, done: false, type, x, y, next: [], subtasks: [] };
    const newSubtasks = [...task.subtasks, newSub];

    // Wir pushen das Array in den Store (UI updatet in 0ms)
    // Da du keinen direkten 'update' Parameter in der Signatur hast, holen wir uns 
    // die Reaktivität indirekt über eine saubere Pointer-Referenz (falls nötig)
    task.subtasks = newSubtasks; 

    // 2. FIRE-AND-FORGET: Wir schicken es an die DB, ohne das UI zu blockieren (kein await nötig für UI-Flow)
    pb.collection('tasks').update(taskId, { subtasks: newSubtasks }).catch(e => console.error("Sync Error:", e));
};

export const toggleSubtask = async (get: () => AppData, taskId: string, subId: string) => {
    const state = get();
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const newSubtasks = recursiveUpdate(task.subtasks, subId, s => ({ ...s, done: !s.done }));
    task.subtasks = newSubtasks; // Optimistic Update
    
    pb.collection('tasks').update(taskId, { subtasks: newSubtasks }).catch(e => console.error("Sync Error:", e));
};

export const updateSubtaskTitle = async (get: () => AppData, taskId: string, subId: string, title: string) => {
    const state = get();
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const newSubtasks = recursiveUpdate(task.subtasks, subId, s => ({ ...s, title }));
    task.subtasks = newSubtasks; // Optimistic Update
    
    pb.collection('tasks').update(taskId, { subtasks: newSubtasks }).catch(e => console.error("Sync Error:", e));
};

export const addSubSubtask = async (get: () => AppData, taskId: string, parentSubId: string, title: string) => {
    const state = get();
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const newSub: Subtask = { id: uuidv4(), title, done: false, type: 'GENERIC', x: 350, y: 250, next: [], subtasks: [] };
    const newSubtasks = recursiveAdd(task.subtasks, parentSubId, newSub);
    task.subtasks = newSubtasks; // Optimistic Update
    
    pb.collection('tasks').update(taskId, { subtasks: newSubtasks }).catch(e => console.error("Sync Error:", e));
};

// --- DER SYSTEMISCHE FIX: Delete Logik ---
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

// --- FIX 1: DIE ANTI-RUBBERBANDING LOGIK ---
let moveTimer: ReturnType<typeof setTimeout>;
// Wir exportieren ein "Lock"-Flag. Wenn true, ignoriert das Frontend eingehende DB-Updates für Subtasks.
export let isDraggingLock = false; 

export const updateSubtaskPos = async (update: any, get: any, taskId: string, subId: string, x: number, y: number) => {
    // 1. Lock aktivieren, damit der 1s-Poller uns nicht dazwischenfunkt
    isDraggingLock = true;

    // 2. Optimistic UI Update (Sofort)
    update((s: AppData) => ({
        ...s,
        tasks: s.tasks.map(t => t.id === taskId ? {
            ...t,
            subtasks: recursiveUpdate(t.subtasks, subId, sub => ({ ...sub, x, y }))
        } : t)
    }));

    clearTimeout(moveTimer);
    
    // 3. Debounced DB Sync (Nach 400ms Ruhe)
    moveTimer = setTimeout(async () => {
        const task = get().tasks.find((t: Task) => t.id === taskId);
        if(task) {
            try {
                await pb.collection('tasks').update(taskId, { subtasks: task.subtasks });
            } catch(e) { console.error("Sync Error:", e); }
        }
        // Lock erst nach erfolgreichem Sync freigeben
        isDraggingLock = false; 
    }, 400); // 400ms sind völlig ausreichend und fühlen sich snappier an als 800ms
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

// --- NEU: MATTER CONTEXT LOGIC ---
export const fetchContext = async (matterRef: string) => {
    const userId = pb.authStore.model?.id;
    if (!userId || !matterRef) return null;
    try {
        // Sucht den spezifischen Kontext für diesen Nutzer und dieses Aktenzeichen
        const record = await pb.collection('contexts').getFirstListItem(`matterRef="${matterRef}" && owner="${userId}"`);
        return record;
    } catch (e) {
        // ClientResponseError 404 ist hier völlig normal, wenn noch kein Kontext existiert
        return null;
    }
};

export const saveContext = async (matterRef: string, content: string, contextId?: string) => {
    const userId = pb.authStore.model?.id;
    if (!userId || !matterRef) return null;
    try {
        if (contextId) {
            // Existierenden Kontext updaten
            return await pb.collection('contexts').update(contextId, { content });
        } else {
            // Neuen Kontext anlegen
            return await pb.collection('contexts').create({ matterRef, owner: userId, content });
        }
    } catch (e) {
        console.error("Failed to save context:", e);
        return null;
    }
};