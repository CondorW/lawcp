import { pb } from '$lib/pocketbase';
import { parseTaskRecord } from '$lib/pocketbaseRecords';
import type { AppData, Task } from '$lib/types';

export type StoreUpdate = (update: (state: AppData) => AppData) => void;

export interface TaskMutation {
	apply: (task: Task) => Task;
	payload: (task: Task) => Record<string, unknown>;
}

interface QueueState {
	tail: Promise<void>;
	pending: number;
	generation: number;
}

const queues = new Map<string, QueueState>();
let generation = 0;

function replaceTask(state: AppData, task: Task): AppData {
	const index = state.tasks.findIndex((candidate) => candidate.id === task.id);
	if (index < 0) return { ...state, tasks: [task, ...state.tasks] };
	const tasks = [...state.tasks];
	tasks[index] = task;
	return { ...state, tasks };
}

async function readLatestTask(taskId: string): Promise<Task> {
	const record = await pb.collection('tasks').getOne(taskId, {
		expand: 'owner',
		requestKey: null,
		headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
	});
	return parseTaskRecord(record);
}

async function refreshTask(
	update: StoreUpdate,
	taskId: string,
	expectedGeneration: number
): Promise<void> {
	if (expectedGeneration !== generation || !pb.authStore.isValid) return;
	try {
		const task = await readLatestTask(taskId);
		if (expectedGeneration === generation) update((state) => replaceTask(state, task));
	} catch (error) {
		console.error(`Task ${taskId} konnte nach der Änderung nicht neu geladen werden:`, error);
	}
}

/**
 * Serializes nested JSON mutations per task and rebases every mutation on the
 * newest server record. This avoids PocketBase request cancellation and stale
 * client snapshots overwriting one another within the application session.
 */
export async function enqueueTaskMutation(
	update: StoreUpdate,
	taskId: string,
	mutation: TaskMutation
): Promise<void> {
	const queue = queues.get(taskId) ?? {
		tail: Promise.resolve(),
		pending: 0,
		generation
	};
	queues.set(taskId, queue);
	queue.pending += 1;

	// Keep the interface responsive while the persisted operation is rebased.
	update((state) => ({
		...state,
		tasks: state.tasks.map((task) => (task.id === taskId ? mutation.apply(task) : task))
	}));

	const operationGeneration = generation;
	const operation = queue.tail.then(async () => {
		if (operationGeneration !== generation || !pb.authStore.isValid) return;
		const latestTask = await readLatestTask(taskId);
		const nextTask = mutation.apply(latestTask);
		await pb.collection('tasks').update(taskId, mutation.payload(nextTask), {
			requestKey: null
		});
	});

	// A failed operation must not block later mutations for the same task.
	queue.tail = operation.catch(() => undefined);

	try {
		await operation;
	} catch (error) {
		console.error(`Task ${taskId} konnte nicht gespeichert werden:`, error);
	} finally {
		queue.pending -= 1;
		if (queue.pending === 0 && queues.get(taskId) === queue) {
			queues.delete(taskId);
			await refreshTask(update, taskId, operationGeneration);
		}
	}
}

export function hasPendingTaskMutation(taskId: string): boolean {
	return (queues.get(taskId)?.pending ?? 0) > 0;
}

export async function flushTaskMutations(taskId?: string): Promise<void> {
	if (taskId) {
		await queues.get(taskId)?.tail;
		return;
	}
	await Promise.all([...queues.values()].map((queue) => queue.tail));
}

export function resetTaskMutationQueue(): void {
	generation += 1;
	queues.clear();
}
