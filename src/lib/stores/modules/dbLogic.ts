import { pb } from '$lib/pocketbase';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import {
	addChildSubtask,
	findSubtask,
	indentSubtaskTree,
	outdentSubtaskTree,
	removeSubtask,
	sortSubtasksDeep,
	updateSubtask
} from '$lib/domain/subtasks';
import { belongsToLeader } from '$lib/domain/users';
import { parseResourceRecord, parseTaskRecord } from '$lib/pocketbaseRecords';
import { chatStore } from '$lib/stores/chat.svelte';
import {
	enqueueTaskMutation,
	flushTaskMutations,
	type StoreUpdate,
	type TaskMutation
} from '$lib/stores/modules/taskMutationQueue';
import {
	TaskStatusSchema,
	type AppData,
	type Resource,
	type ReviewState,
	type Subtask,
	type SubtaskType,
	type Task,
	type TaskPriority,
	type TimeLog
} from '$lib/types';

export type StoreRead = () => AppData;

export interface ContextRecord {
	id: string;
	content: string;
}

const ContextRecordSchema = z.object({ id: z.string(), content: z.string().default('') }).loose();

function generatePocketBaseId(): string {
	const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
	return Array.from({ length: 15 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function optimisticTaskMutation(
	update: StoreUpdate,
	taskId: string,
	apply: (task: Task) => Task,
	payload: (task: Task) => Record<string, unknown>
): Promise<void> {
	const mutation: TaskMutation = { apply, payload };
	return enqueueTaskMutation(update, taskId, mutation);
}

function mutateSubtasks(
	update: StoreUpdate,
	taskId: string,
	mutate: (subtasks: Subtask[]) => Subtask[]
): Promise<void> {
	return optimisticTaskMutation(
		update,
		taskId,
		(task) => ({ ...task, subtasks: sortSubtasksDeep(mutate(task.subtasks)) }),
		(task) => ({ subtasks: task.subtasks })
	);
}

function normalizeIsoDate(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) throw new Error(`Ungültiges Datum: ${value}`);
	return date.toISOString();
}

export async function addResource(
	update: StoreUpdate,
	resourceData: Omit<Resource, 'id' | 'created' | 'updated' | 'owner' | 'expand'>
): Promise<void> {
	const user = pb.authStore.model;
	if (!pb.authStore.isValid || !user?.id) return;

	const id = generatePocketBaseId();
	const timestamp = new Date().toISOString();
	const optimisticResource: Resource = {
		...resourceData,
		id,
		owner: user.id,
		created: timestamp,
		updated: timestamp,
		expand: {
			owner: {
				shortsign: typeof user.shortsign === 'string' ? user.shortsign : 'ME'
			}
		}
	};
	update((state) => ({ ...state, resources: [optimisticResource, ...state.resources] }));

	try {
		const record = await pb
			.collection('resources')
			.create({ ...resourceData, id, owner: user.id }, { expand: 'owner', requestKey: null });
		const savedResource = parseResourceRecord(record);
		update((state) => ({
			...state,
			resources: state.resources.map((resource) => (resource.id === id ? savedResource : resource))
		}));
	} catch (error) {
		console.error('Ressource konnte nicht erstellt werden:', error);
		update((state) => ({
			...state,
			resources: state.resources.filter((resource) => resource.id !== id)
		}));
	}
}

export async function deleteResource(update: StoreUpdate, id: string): Promise<void> {
	let removed: Resource | undefined;
	let originalIndex = -1;
	update((state) => {
		originalIndex = state.resources.findIndex((resource) => resource.id === id);
		removed = state.resources[originalIndex];
		return { ...state, resources: state.resources.filter((resource) => resource.id !== id) };
	});

	try {
		await pb.collection('resources').delete(id, { requestKey: null });
	} catch (error) {
		console.error('Ressource konnte nicht gelöscht werden:', error);
		if (removed) {
			update((state) => {
				const resources = [...state.resources];
				resources.splice(Math.max(0, originalIndex), 0, removed as Resource);
				return { ...state, resources };
			});
		}
	}
}

export async function addTask(
	update: StoreUpdate,
	statusInput: string,
	title: string,
	matterRef?: string,
	dueDate?: string,
	assignedTo?: string
): Promise<void> {
	const user = pb.authStore.model;
	const statusResult = TaskStatusSchema.safeParse(statusInput);
	if (!pb.authStore.isValid || !user?.id || !statusResult.success || !title.trim()) return;

	const id = generatePocketBaseId();
	const timestamp = new Date().toISOString();
	const task: Task = {
		id,
		title: title.trim(),
		status: statusResult.data,
		matterRef: matterRef?.trim() || undefined,
		dueDate: dueDate ?? timestamp,
		subtasks: [],
		owner: user.id,
		assignees: assignedTo ? [assignedTo] : [user.id],
		priority: 'MEDIUM',
		archived: false,
		createdAt: timestamp,
		updatedAt: timestamp,
		timeLogs: [],
		flaggedDate: null,
		expand: {
			owner: {
				shortsign: typeof user.shortsign === 'string' ? user.shortsign : 'ME',
				teamLeader: user.teamLeader
			}
		}
	};
	update((state) => ({ ...state, tasks: [task, ...state.tasks] }));

	try {
		const record = await pb.collection('tasks').create(
			{
				id,
				title: task.title,
				status: task.status,
				matterRef: task.matterRef,
				dueDate: task.dueDate,
				subtasks: [],
				owner: task.owner,
				assignees: task.assignees,
				priority: task.priority,
				archived: false,
				timeLogs: [],
				flaggedDate: null
			},
			{ expand: 'owner', requestKey: null }
		);
		const savedTask = parseTaskRecord(record);
		update((state) => ({
			...state,
			tasks: state.tasks.map((candidate) => (candidate.id === id ? savedTask : candidate))
		}));
	} catch (error) {
		console.error('Task konnte nicht erstellt werden:', error);
		update((state) => ({
			...state,
			tasks: state.tasks.filter((candidate) => candidate.id !== id)
		}));
	}
}

export function assignTask(update: StoreUpdate, taskId: string, assigneeId: string): Promise<void> {
	return optimisticTaskMutation(
		update,
		taskId,
		(task) => ({ ...task, assignees: assigneeId ? [assigneeId] : [] }),
		(task) => ({ assignees: task.assignees })
	);
}

export async function deleteTask(update: StoreUpdate, id: string): Promise<void> {
	let removed: Task | undefined;
	let originalIndex = -1;
	update((state) => {
		originalIndex = state.tasks.findIndex((task) => task.id === id);
		removed = state.tasks[originalIndex];
		return { ...state, tasks: state.tasks.filter((task) => task.id !== id) };
	});

	await flushTaskMutations(id);
	try {
		await pb.collection('tasks').delete(id, { requestKey: null });
	} catch (error) {
		console.error('Task konnte nicht gelöscht werden:', error);
		if (removed) {
			update((state) => {
				const tasks = [...state.tasks];
				tasks.splice(Math.max(0, originalIndex), 0, removed as Task);
				return { ...state, tasks };
			});
		}
	}
}

export function archiveTask(update: StoreUpdate, id: string, archived: boolean): Promise<void> {
	return optimisticTaskMutation(
		update,
		id,
		(task) => ({ ...task, archived }),
		(task) => ({ archived: task.archived })
	);
}

export function updateTaskTitle(update: StoreUpdate, id: string, title: string): Promise<void> {
	const normalizedTitle = title.trim();
	if (!normalizedTitle) return Promise.resolve();
	return optimisticTaskMutation(
		update,
		id,
		(task) => ({ ...task, title: normalizedTitle }),
		(task) => ({ title: task.title })
	);
}

export function updateTaskRef(update: StoreUpdate, id: string, matterRef: string): Promise<void> {
	const normalizedRef = matterRef.trim();
	return optimisticTaskMutation(
		update,
		id,
		(task) => ({ ...task, matterRef: normalizedRef || undefined }),
		(task) => ({ matterRef: task.matterRef ?? '' })
	);
}

export function updateTaskPriority(
	update: StoreUpdate,
	id: string,
	priority: TaskPriority
): Promise<void> {
	return optimisticTaskMutation(
		update,
		id,
		(task) => ({ ...task, priority }),
		(task) => ({ priority: task.priority })
	);
}

export function updateDate(update: StoreUpdate, id: string, dueDate: string): Promise<void> {
	return optimisticTaskMutation(
		update,
		id,
		(task) => ({ ...task, dueDate }),
		(task) => ({ dueDate: task.dueDate })
	);
}

export function toggleFlag(
	update: StoreUpdate,
	id: string,
	flaggedDate: string | null
): Promise<void> {
	return optimisticTaskMutation(
		update,
		id,
		(task) => ({ ...task, flaggedDate }),
		(task) => ({ flaggedDate: task.flaggedDate })
	);
}

export async function moveTask(
	update: StoreUpdate,
	id: string,
	statusInput: string
): Promise<void> {
	const statusResult = TaskStatusSchema.safeParse(statusInput);
	if (!statusResult.success) return;
	const status = statusResult.data;
	const userId = pb.authStore.model?.id ?? '';
	let removeAfterSave = false;

	update((state) => {
		const task = state.tasks.find((candidate) => candidate.id === id);
		if (!task) return state;
		removeAfterSave =
			belongsToLeader(task.expand?.owner?.teamLeader, userId) &&
			task.owner !== userId &&
			!task.assignees.includes(userId) &&
			status !== 'REVIEW';
		return state;
	});

	await optimisticTaskMutation(
		update,
		id,
		(task) => ({ ...task, status }),
		(task) => ({ status: task.status })
	);
	if (removeAfterSave) {
		update((state) => ({ ...state, tasks: state.tasks.filter((task) => task.id !== id) }));
	}
}

export function addSubtask(
	update: StoreUpdate,
	taskId: string,
	title: string,
	type: SubtaskType = 'GENERIC',
	x = 300,
	y = 200
): Promise<void> {
	const subtask: Subtask = {
		id: uuidv4(),
		title: title.trim(),
		done: false,
		archived: false,
		type,
		x,
		y,
		next: [],
		subtasks: []
	};
	return mutateSubtasks(update, taskId, (subtasks) => [...subtasks, subtask]);
}

export function toggleSubtask(
	update: StoreUpdate,
	taskId: string,
	subtaskId: string
): Promise<void> {
	return mutateSubtasks(update, taskId, (subtasks) =>
		updateSubtask(subtasks, subtaskId, (subtask) => {
			const done = !subtask.done;
			return { ...subtask, done, completedAt: done ? new Date().toISOString() : undefined };
		})
	);
}

export function archiveSubtask(
	update: StoreUpdate,
	taskId: string,
	subtaskId: string,
	archived: boolean
): Promise<void> {
	return mutateSubtasks(update, taskId, (subtasks) =>
		updateSubtask(subtasks, subtaskId, (subtask) => ({ ...subtask, archived }))
	);
}

export function updateSubtaskTitle(
	update: StoreUpdate,
	taskId: string,
	subtaskId: string,
	title: string
): Promise<void> {
	return mutateSubtasks(update, taskId, (subtasks) =>
		updateSubtask(subtasks, subtaskId, (subtask) => ({ ...subtask, title: title.trim() }))
	);
}

export function addSubSubtask(
	update: StoreUpdate,
	taskId: string,
	parentSubtaskId: string,
	title: string
): Promise<void> {
	const subtask: Subtask = {
		id: uuidv4(),
		title: title.trim(),
		done: false,
		archived: false,
		type: 'GENERIC',
		x: 350,
		y: 250,
		next: [],
		subtasks: []
	};
	return mutateSubtasks(update, taskId, (subtasks) =>
		addChildSubtask(subtasks, parentSubtaskId, subtask)
	);
}

export function deleteSubtask(
	update: StoreUpdate,
	taskId: string,
	subtaskId: string
): Promise<void> {
	return mutateSubtasks(update, taskId, (subtasks) => removeSubtask(subtasks, subtaskId));
}

export function updateSubtaskPos(
	update: StoreUpdate,
	taskId: string,
	subtaskId: string,
	x: number,
	y: number
): Promise<void> {
	return mutateSubtasks(update, taskId, (subtasks) =>
		updateSubtask(subtasks, subtaskId, (subtask) => ({ ...subtask, x, y }))
	);
}

export function connectSubtasks(
	update: StoreUpdate,
	taskId: string,
	sourceId: string,
	targetId: string
): Promise<void> {
	return mutateSubtasks(update, taskId, (subtasks) =>
		updateSubtask(subtasks, sourceId, (subtask) => ({
			...subtask,
			next: subtask.next.includes(targetId) ? subtask.next : [...subtask.next, targetId]
		}))
	);
}

export function disconnectSubtasks(
	update: StoreUpdate,
	taskId: string,
	sourceId: string,
	targetId: string
): Promise<void> {
	return mutateSubtasks(update, taskId, (subtasks) =>
		updateSubtask(subtasks, sourceId, (subtask) => ({
			...subtask,
			next: subtask.next.filter((id) => id !== targetId)
		}))
	);
}

export function indentSubtask(
	update: StoreUpdate,
	taskId: string,
	subtaskId: string
): Promise<void> {
	return mutateSubtasks(update, taskId, (subtasks) => indentSubtaskTree(subtasks, subtaskId));
}

export function outdentSubtask(
	update: StoreUpdate,
	taskId: string,
	subtaskId: string
): Promise<void> {
	return mutateSubtasks(update, taskId, (subtasks) => outdentSubtaskTree(subtasks, subtaskId));
}

export async function setSubtaskReviewState(
	update: StoreUpdate,
	read: StoreRead,
	taskId: string,
	subtaskId: string,
	state: ReviewState | null
): Promise<void> {
	const task = read().tasks.find((candidate) => candidate.id === taskId);
	const subtask = task ? findSubtask(task.subtasks, subtaskId) : null;

	await mutateSubtasks(update, taskId, (subtasks) =>
		updateSubtask(subtasks, subtaskId, (candidate) => ({ ...candidate, reviewState: state }))
	);

	if (state === 'REQUESTED' && task && subtask) {
		await chatStore.sendReviewPing(task.matterRef || task.title, subtask.title);
	}
}

export async function fetchContext(matterRef: string): Promise<ContextRecord | null> {
	const userId = pb.authStore.model?.id;
	if (!userId || !matterRef.trim()) return null;

	try {
		const record = await pb.collection('contexts').getFirstListItem(
			pb.filter('matterRef = {:matterRef} && owner = {:owner}', {
				matterRef: matterRef.trim(),
				owner: userId
			}),
			{ requestKey: null }
		);
		return ContextRecordSchema.parse(record);
	} catch (error) {
		if (typeof error === 'object' && error !== null && 'status' in error && error.status === 404) {
			return null;
		}
		console.error('Aktennotiz konnte nicht geladen werden:', error);
		throw error;
	}
}

export async function saveContext(
	matterRef: string,
	content: string,
	contextId?: string
): Promise<ContextRecord | null> {
	const userId = pb.authStore.model?.id;
	if (!userId || !matterRef.trim()) return null;

	try {
		const record = contextId
			? await pb.collection('contexts').update(contextId, { content }, { requestKey: null })
			: await pb
					.collection('contexts')
					.create({ matterRef: matterRef.trim(), owner: userId, content }, { requestKey: null });
		return ContextRecordSchema.parse(record);
	} catch (error) {
		console.error('Aktennotiz konnte nicht gespeichert werden:', error);
		return null;
	}
}

export function addTimeLog(
	update: StoreUpdate,
	taskId: string,
	minutes: number,
	note: string,
	date: string
): Promise<void> {
	const userId = pb.authStore.model?.id;
	if (!userId || !Number.isFinite(minutes) || minutes <= 0) return Promise.resolve();
	const timeLog: TimeLog = {
		id: uuidv4(),
		userId,
		date: normalizeIsoDate(date),
		minutes,
		note: note.trim() || undefined
	};
	return optimisticTaskMutation(
		update,
		taskId,
		(task) => ({ ...task, timeLogs: [...task.timeLogs, timeLog] }),
		(task) => ({ timeLogs: task.timeLogs })
	);
}

export function updateTimeLog(
	update: StoreUpdate,
	taskId: string,
	logId: string,
	minutes: number,
	note: string,
	date: string
): Promise<void> {
	if (!Number.isFinite(minutes) || minutes <= 0) return Promise.resolve();
	const normalizedDate = normalizeIsoDate(date);
	return optimisticTaskMutation(
		update,
		taskId,
		(task) => ({
			...task,
			timeLogs: task.timeLogs.map((log) =>
				log.id === logId
					? { ...log, minutes, note: note.trim() || undefined, date: normalizedDate }
					: log
			)
		}),
		(task) => ({ timeLogs: task.timeLogs })
	);
}

export function deleteTimeLog(update: StoreUpdate, taskId: string, logId: string): Promise<void> {
	return optimisticTaskMutation(
		update,
		taskId,
		(task) => ({ ...task, timeLogs: task.timeLogs.filter((log) => log.id !== logId) }),
		(task) => ({ timeLogs: task.timeLogs })
	);
}
