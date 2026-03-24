import { pb } from '$lib/pocketbase';
import { v4 as uuidv4 } from 'uuid';
import type { AppData, Task, SubtaskType, Resource, Subtask } from '$lib/types';
import { recursiveAdd, recursiveUpdate } from '$lib/utils';

// --- HELPER: Deterministic Identity ---
const generatePbId = () => {
	const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
	let result = '';
	for (let i = 0; i < 15; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
	return result;
};

// --- HELPER: Deep Sort Subtasks (Undone first, stable) ---
export const sortSubtasksDeep = (nodes: Subtask[]): Subtask[] => {
	if (!Array.isArray(nodes)) return [];
	const cloned = [...nodes];
	cloned.forEach((n, i) => {
		if (n.subtasks && n.subtasks.length > 0) {
			cloned[i] = { ...n, subtasks: sortSubtasksDeep(n.subtasks) };
		}
	});
	// Stable Sort: Offene vor Erledigten, dann REQUESTED ganz nach oben, REVISION danach
	return cloned.sort((a, b) => {
		if (a.done !== b.done) return Number(a.done) - Number(b.done);
		
		const aReq = a.reviewState === 'REQUESTED' ? 1 : 0;
		const bReq = b.reviewState === 'REQUESTED' ? 1 : 0;
		if (aReq !== bReq) return bReq - aReq;

		const aRev = a.reviewState === 'REVISION' ? 1 : 0;
		const bRev = b.reviewState === 'REVISION' ? 1 : 0;
		if (aRev !== bRev) return bRev - aRev;

		return 0;
	});
};

// --- RESOURCES ---
export const addResource = async (update: any, resData: Omit<Resource, 'id' | 'created' | 'updated' | 'owner' | 'expand'>) => {
	const userModel = pb.authStore.model;
	const userId = userModel?.id;
	if (!userId || !userModel) return;

	const finalId = generatePbId();

	update((s: AppData) => {
		const newRes: Resource = {
			...resData,
			id: finalId,
			owner: userId,
			created: new Date().toISOString(),
			updated: new Date().toISOString(),
			expand: { owner: { shortsign: userModel.shortsign || 'ME' } as any }
		};
		return { ...s, resources: [newRes, ...s.resources] };
	});

	try {
		const record = await pb.collection('resources').create(
			{ ...resData, id: finalId, owner: userId },
			{ expand: 'owner' }
		);
		update((s: AppData) => ({
			...s,
			resources: s.resources.map((r) => (r.id === finalId ? { ...r, expand: record.expand } : r))
		}));
	} catch (e) {
		console.error('Failed to add resource:', e);
		update((s: AppData) => ({ ...s, resources: s.resources.filter((r) => r.id !== finalId) }));
	}
};

export const deleteResource = async (update: (fn: (s: AppData) => AppData) => void, id: string) => {
	update((s) => ({ ...s, resources: s.resources.filter((r) => r.id !== id) }));
	try {
		await pb.collection('resources').delete(id);
	} catch (e) {
		console.error('Failed to delete resource:', e);
	}
};

// --- TASKS ---
export const addTask = async (update: any, status: string, title: string, ref?: string, date?: string, assignedTo?: string) => {
	const userModel = pb.authStore.model;
	const userId = userModel?.id;
	if (!userId) return;

	const dueDate = date || new Date().toISOString();
	const finalId = generatePbId();

	update((s: AppData) => {
		const newTask: Task = {
			id: finalId, title, status: status as Task['status'], matterRef: ref, dueDate, subtasks: [], owner: userId, assignees: assignedTo ? [assignedTo] : [userId], priority: 'MEDIUM', createdAt: new Date().toISOString(), timeTracked: 0, dependencies: [], flaggedDate: null,
			expand: { owner: { shortsign: userModel.shortsign || 'ME' } as any }
		};
		return { ...s, tasks: [newTask, ...s.tasks] };
	});

	try {
		await pb.collection('tasks').create({
			id: finalId, title, status, matterRef: ref, dueDate, subtasks: [], owner: userId, assignees: assignedTo ? [assignedTo] : [userId], priority: 'MEDIUM', timeTracked: 0, dependencies: [], flaggedDate: null
		});
	} catch (e) {
		console.error('Task creation failed:', e);
		update((s: AppData) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== finalId) }));
	}
};

export const assignTask = async (update: (fn: (s: AppData) => AppData) => void, taskId: string, assigneeId: string) => {
	update((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, assignees: assigneeId ? [assigneeId] : [] } : t)) }));
	pb.collection('tasks').update(taskId, { assignees: assigneeId ? [assigneeId] : [] }).catch((e) => console.error(e));
};

export const deleteTask = async (update: (fn: (s: AppData) => AppData) => void, id: string) => {
	update((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }));
	pb.collection('tasks').delete(id).catch((e) => console.error(e));
};

export const updateTaskTitle = async (update: any, id: string, title: string) => {
	update((s: AppData) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, title } : t)) }));
	pb.collection('tasks').update(id, { title }).catch((e) => console.error(e));
};

export const updateTaskRef = async (update: any, id: string, ref: string) => {
	update((s: AppData) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, matterRef: ref } : t)) }));
	pb.collection('tasks').update(id, { matterRef: ref }).catch((e) => console.error(e));
};

export const updateDate = async (update: (fn: (s: AppData) => AppData) => void, id: string, date: string) => {
	update((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, dueDate: date } : t)) }));
	pb.collection('tasks').update(id, { dueDate: date }).catch((e) => console.error(e));
};

export const toggleFlag = async (update: (fn: (s: AppData) => AppData) => void, id: string, date: string | null) => {
	update((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, flaggedDate: date } : t)) }));
	pb.collection('tasks').update(id, { flaggedDate: date }).catch((e) => console.error(e));
};

export const moveTask = async (update: (fn: (s: AppData) => AppData) => void, id: string, status: string) => {
	const myId = pb.authStore.model?.id || '';
	update((s) => {
		const task = s.tasks.find((t) => t.id === id);
		if (!task) return s;
		const isOwner = task.owner === myId;
		const isAssignee = task.assignees?.includes(myId);
		const isTeamLeader = task.expand?.owner?.teamLeader === myId;

		if (isTeamLeader && !isOwner && !isAssignee && status !== 'REVIEW') {
			return { ...s, tasks: s.tasks.filter((t) => t.id !== id) };
		}
		return { ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, status: status as Task['status'] } : t)) };
	});
	pb.collection('tasks').update(id, { status }).catch((e) => console.error(e));
};

export const addSubtask = async (update: any, get: any, taskId: string, title: string, type: SubtaskType = 'GENERIC', x = 300, y = 200) => {
	const newSub: Subtask = { id: uuidv4(), title, done: false, type, x, y, next: [], subtasks: [] };
	update((s: AppData) => ({
		...s,
		tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, subtasks: sortSubtasksDeep([...t.subtasks, newSub]) } : t))
	}));
	const task = get().tasks.find((t: Task) => t.id === taskId);
	if (task) pb.collection('tasks').update(taskId, { subtasks: task.subtasks }).catch((e) => console.error(e));
};

export const toggleSubtask = async (update: any, get: any, taskId: string, subId: string) => {
	update((s: AppData) => ({
		...s,
		tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, subtasks: sortSubtasksDeep(recursiveUpdate(t.subtasks, subId, (sub) => ({ ...sub, done: !sub.done }))) } : t))
	}));
	const task = get().tasks.find((t: Task) => t.id === taskId);
	if (task) pb.collection('tasks').update(taskId, { subtasks: task.subtasks }).catch((e) => console.error(e));
};

export const updateSubtaskTitle = async (update: any, get: any, taskId: string, subId: string, title: string) => {
	update((s: AppData) => ({
		...s,
		tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, subtasks: recursiveUpdate(t.subtasks, subId, (sub) => ({ ...sub, title })) } : t))
	}));
	const task = get().tasks.find((t: Task) => t.id === taskId);
	if (task) pb.collection('tasks').update(taskId, { subtasks: task.subtasks }).catch((e) => console.error(e));
};

export const addSubSubtask = async (update: any, get: any, taskId: string, parentSubId: string, title: string) => {
	const newSub: Subtask = { id: uuidv4(), title, done: false, type: 'GENERIC', x: 350, y: 250, next: [], subtasks: [] };
	update((s: AppData) => ({
		...s,
		tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, subtasks: sortSubtasksDeep(recursiveAdd(t.subtasks, parentSubId, newSub)) } : t))
	}));
	const task = get().tasks.find((t: Task) => t.id === taskId);
	if (task) pb.collection('tasks').update(taskId, { subtasks: task.subtasks }).catch((e) => console.error(e));
};

export const deleteSubtask = async (update: any, get: any, taskId: string, subtaskIdToDelete: string) => {
	const deepClean = (nodes: any): Subtask[] => {
		if (!Array.isArray(nodes)) return [];
		return nodes
			.filter((n) => n && typeof n === 'object' && n.id !== subtaskIdToDelete)
			.map((n) => ({
				...n,
				next: Array.isArray(n.next) ? n.next.filter((id: string) => id !== subtaskIdToDelete) : [],
				subtasks: deepClean(n.subtasks)
			}));
	};

	let payloadToSync: Subtask[] | null = null;
	update((s: AppData) => {
		const task = s.tasks.find((t) => t.id === taskId);
		if (!task) return s;
		payloadToSync = sortSubtasksDeep(deepClean(task.subtasks));
		return { ...s, tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, subtasks: payloadToSync } : t)) };
	});

	if (payloadToSync !== null) pb.collection('tasks').update(taskId, { subtasks: payloadToSync }).catch((e) => console.error(e));
};

let moveTimer: ReturnType<typeof setTimeout>;
export let isDraggingLock = false;

export const updateSubtaskPos = async (update: any, get: any, taskId: string, subId: string, x: number, y: number) => {
	isDraggingLock = true;
	update((s: AppData) => ({
		...s,
		tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, subtasks: recursiveUpdate(t.subtasks, subId, (sub) => ({ ...sub, x, y })) } : t))
	}));
	clearTimeout(moveTimer);
	moveTimer = setTimeout(async () => {
		const task = get().tasks.find((t: Task) => t.id === taskId);
		if (task) pb.collection('tasks').update(taskId, { subtasks: task.subtasks }).catch((e) => console.error(e));
		isDraggingLock = false;
	}, 400);
};

export const connectSubtasks = async (update: any, get: any, taskId: string, sourceId: string, targetId: string) => {
	update((s: AppData) => ({
		...s,
		tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, subtasks: recursiveUpdate(t.subtasks, sourceId, (sub) => ({ ...sub, next: [...new Set([...sub.next, targetId])] })) } : t))
	}));
	const task = get().tasks.find((t: Task) => t.id === taskId);
	if (task) pb.collection('tasks').update(taskId, { subtasks: task.subtasks }).catch((e) => console.error(e));
};

export const disconnectSubtasks = async (update: any, get: any, taskId: string, sourceId: string, targetId: string) => {
	update((s: AppData) => ({
		...s,
		tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, subtasks: recursiveUpdate(t.subtasks, sourceId, (sub) => ({ ...sub, next: sub.next.filter((id: string) => id !== targetId) })) } : t))
	}));
	const task = get().tasks.find((t: Task) => t.id === taskId);
	if (task) pb.collection('tasks').update(taskId, { subtasks: task.subtasks }).catch((e) => console.error(e));
};

export const indentSubtask = async (update: any, get: any, taskId: string, subId: string) => {
	let hasChanged = false;
	update((s: AppData) => {
		const tasks = s.tasks.map((t) => {
			if (t.id !== taskId) return t;
			let newSubtasks = JSON.parse(JSON.stringify(t.subtasks));
			const indent = (nodes: Subtask[]): boolean => {
				for (let i = 0; i < nodes.length; i++) {
					if (nodes[i].id === subId) {
						if (i > 0) {
							const target = nodes.splice(i, 1)[0];
							if (!nodes[i - 1].subtasks) nodes[i - 1].subtasks = [];
							nodes[i - 1].subtasks.push(target);
							hasChanged = true;
							return true;
						}
						return false;
					}
					if (nodes[i].subtasks && indent(nodes[i].subtasks)) return true;
				}
				return false;
			};
			indent(newSubtasks);
			return { ...t, subtasks: sortSubtasksDeep(newSubtasks) };
		});
		return { ...s, tasks };
	});
	if (hasChanged) {
		const task = get().tasks.find((t: Task) => t.id === taskId);
		if (task) pb.collection('tasks').update(taskId, { subtasks: task.subtasks }).catch((e) => console.error(e));
	}
};

export const outdentSubtask = async (update: any, get: any, taskId: string, subId: string) => {
	let hasChanged = false;
	update((s: AppData) => {
		const tasks = s.tasks.map((t) => {
			if (t.id !== taskId) return t;
			let newSubtasks = JSON.parse(JSON.stringify(t.subtasks));
			const outdent = (nodes: Subtask[], parentArr: Subtask[] | null, parentIndex: number): boolean => {
				for (let i = 0; i < nodes.length; i++) {
					if (nodes[i].id === subId) {
						if (parentArr) {
							const target = nodes.splice(i, 1)[0];
							parentArr.splice(parentIndex + 1, 0, target);
							hasChanged = true;
							return true;
						}
						return false;
					}
					if (nodes[i].subtasks && outdent(nodes[i].subtasks, nodes, i)) return true;
				}
				return false;
			};
			outdent(newSubtasks, null, -1);
			return { ...t, subtasks: sortSubtasksDeep(newSubtasks) };
		});
		return { ...s, tasks };
	});
	if (hasChanged) {
		const task = get().tasks.find((t: Task) => t.id === taskId);
		if (task) pb.collection('tasks').update(taskId, { subtasks: task.subtasks }).catch((e) => console.error(e));
	}
};

export const setSubtaskReviewState = async (update: any, get: any, taskId: string, subId: string, state: 'REQUESTED' | 'APPROVED' | 'REVISION' | null) => {
	update((s: AppData) => ({
		...s,
		tasks: s.tasks.map((t) => (t.id === taskId ? { 
			...t, 
			subtasks: sortSubtasksDeep(recursiveUpdate(t.subtasks, subId, (sub) => ({ ...sub, reviewState: state }))) 
		} : t))
	}));
	const task = get().tasks.find((t: Task) => t.id === taskId);
	if (task) pb.collection('tasks').update(taskId, { subtasks: task.subtasks }).catch((e) => console.error(e));
};

export const fetchContext = async (matterRef: string) => {
	const userId = pb.authStore.model?.id;
	if (!userId || !matterRef) return null;
	try {
		return await pb.collection('contexts').getFirstListItem(`matterRef="${matterRef}" && owner="${userId}"`);
	} catch (e) {
		return null;
	}
};

export const saveContext = async (matterRef: string, content: string, contextId?: string) => {
	const userId = pb.authStore.model?.id;
	if (!userId || !matterRef) return null;
	try {
		if (contextId) return await pb.collection('contexts').update(contextId, { content });
		else return await pb.collection('contexts').create({ matterRef, owner: userId, content });
	} catch (e) {
		console.error('Failed to save context:', e);
		return null;
	}
};