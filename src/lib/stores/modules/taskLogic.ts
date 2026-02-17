import { v4 as uuidv4 } from 'uuid';
import { TaskSchema, type AppData, type Subtask, type SubtaskType } from '$lib/types';

// --- INTERNE HELPER ---
function recursiveUpdate(subtasks: Subtask[], targetId: string, fn: (s: Subtask) => Subtask): Subtask[] {
    return subtasks.map(s => {
        if (s.id === targetId) return fn(s);
        if (s.subtasks?.length) return { ...s, subtasks: recursiveUpdate(s.subtasks, targetId, fn) };
        return s;
    });
}

function recursiveAdd(subtasks: Subtask[], parentId: string, newSub: Subtask): Subtask[] {
    return subtasks.map(s => {
        if (s.id === parentId) return { ...s, subtasks: [...(s.subtasks || []), newSub] };
        if (s.subtasks?.length) return { ...s, subtasks: recursiveAdd(s.subtasks, parentId, newSub) };
        return s;
    });
}

// --- LOGIK FUNKTIONEN ---

export const addTask = (state: AppData, columnId: string, title: string, matterRef?: string, dueDate?: string) => {
    const newTask = TaskSchema.parse({
        id: uuidv4(),
        title,
        // Wenn String leer ist, undefined setzen, sonst den Wert
        matterRef: matterRef?.trim() || undefined, 
        // Wenn Datum fehlt, heute nehmen
        dueDate: dueDate || new Date().toISOString(),
        status: columnId as any,
        createdAt: new Date().toISOString(),
        subtasks: []
    });
    return { ...state, tasks: [...state.tasks, newTask] };
};

export const deleteTask = (state: AppData, id: string) => ({
    ...state, tasks: state.tasks.filter(t => t.id !== id)
});

export const updateTaskTitle = (state: AppData, id: string, title: string) => ({
    ...state, tasks: state.tasks.map(t => t.id === id ? { ...t, title } : t)
});

export const updateTaskRef = (state: AppData, id: string, ref: string) => ({
    ...state, tasks: state.tasks.map(t => t.id === id ? { ...t, matterRef: ref } : t)
});

export const moveTask = (state: AppData, id: string, status: string) => ({
    ...state, tasks: state.tasks.map(t => t.id === id ? { ...t, status: status as any } : t)
});

export const updateDate = (state: AppData, id: string, date: string) => ({
    ...state, tasks: state.tasks.map(t => t.id === id ? { ...t, dueDate: date } : t)
});

export const toggleFlag = (state: AppData, id: string, date: string | null) => ({
    ...state, tasks: state.tasks.map(t => t.id === id ? { ...t, flaggedDate: date } : t)
});

// --- SUBTASKS ---

export const addSubtask = (state: AppData, taskId: string, title: string, type: SubtaskType, x = 0, y = 0) => {
    return {
        ...state, tasks: state.tasks.map(t => {
            if (t.id !== taskId) return t;
            const newSub: Subtask = { id: uuidv4(), title, done: false, type, x, y, next: [], subtasks: [] };
            return { ...t, subtasks: [...t.subtasks, newSub] };
        })
    };
};

export const addSubSubtask = (state: AppData, taskId: string, parentSubId: string, title: string) => {
    return {
        ...state, tasks: state.tasks.map(t => {
            if (t.id !== taskId) return t;
            const newSub: Subtask = { id: uuidv4(), title, done: false, type: 'GENERIC', x: 0, y: 0, next: [], subtasks: [] };
            return { ...t, subtasks: recursiveAdd(t.subtasks, parentSubId, newSub) };
        })
    };
};

export const toggleSubtask = (state: AppData, taskId: string, subId: string) => ({
    ...state, tasks: state.tasks.map(t => t.id === taskId ? { ...t, subtasks: recursiveUpdate(t.subtasks, subId, s => ({ ...s, done: !s.done })) } : t)
});

export const updateSubtaskTitle = (state: AppData, taskId: string, subId: string, title: string) => ({
    ...state, tasks: state.tasks.map(t => t.id === taskId ? { ...t, subtasks: recursiveUpdate(t.subtasks, subId, s => ({ ...s, title })) } : t)
});

// --- WORKFLOW ---

export const updateSubtaskPos = (state: AppData, taskId: string, subId: string, x: number, y: number) => ({
    ...state, tasks: state.tasks.map(t => t.id === taskId ? { ...t, subtasks: t.subtasks.map(s => s.id === subId ? { ...s, x, y } : s) } : t)
});

export const connectSubtasks = (state: AppData, taskId: string, src: string, tgt: string) => ({
    ...state, tasks: state.tasks.map(t => t.id === taskId ? { 
        ...t, subtasks: t.subtasks.map(s => (s.id === src && !s.next.includes(tgt)) ? { ...s, next: [...s.next, tgt] } : s) 
    } : t)
});

export const disconnectSubtasks = (state: AppData, taskId: string, src: string, tgt: string) => ({
    ...state, tasks: state.tasks.map(t => t.id === taskId ? { 
        ...t, subtasks: t.subtasks.map(s => s.id === src ? { ...s, next: s.next.filter((n: string) => n !== tgt) } : s) 
    } : t)
});