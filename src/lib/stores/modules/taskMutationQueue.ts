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

	if (index < 0) {
		return {
			...state,
			tasks: [task, ...state.tasks]
		};
	}

	const tasks = [...state.tasks];
	tasks[index] = task;

	return {
		...state,
		tasks
	};
}

async function readLatestTask(taskId: string): Promise<Task> {
	const record = await pb.collection('tasks').getOne(taskId, {
		expand: 'owner',
		requestKey: null,
		headers: {
			'Cache-Control': 'no-cache, no-store, must-revalidate'
		}
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

		// Eine neue lokale Änderung darf nicht durch den Refresh überschrieben werden.
		if (expectedGeneration === generation && !hasPendingTaskMutation(taskId)) {
			update((state) => replaceTask(state, task));
		}
	} catch (error) {
		console.error(`Task ${taskId} konnte nach der Änderung nicht neu geladen werden:`, error);
	}
}

/**
 * Serialisiert Änderungen pro Task und basiert jede Änderung auf dem neuesten
 * PocketBase-Datensatz. Dadurch überschreiben parallele JSON-Änderungen einander
 * innerhalb derselben Anwendungssitzung nicht.
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

	// Das UI reagiert sofort, während die persistierte Änderung vorbereitet wird.
	update((state) => ({
		...state,
		tasks: state.tasks.map((task) => (task.id === taskId ? mutation.apply(task) : task))
	}));

	const operationGeneration = generation;

	const operation = queue.tail.then(async (): Promise<Task | null> => {
		if (operationGeneration !== generation || !pb.authStore.isValid) {
			return null;
		}

		const latestTask = await readLatestTask(taskId);
		const nextTask = mutation.apply(latestTask);

		const savedRecord = await pb.collection('tasks').update(taskId, mutation.payload(nextTask), {
			expand: 'owner',
			requestKey: null
		});

		// Die PATCH-Antwort enthält den tatsächlich gespeicherten Datensatz.
		return parseTaskRecord(savedRecord);
	});

	// Eine fehlgeschlagene Operation darf spätere Änderungen nicht blockieren.
	queue.tail = operation.then(
		() => undefined,
		() => undefined
	);

	let persistedTask: Task | null = null;

	try {
		persistedTask = await operation;
	} catch (error) {
		console.error(`Task ${taskId} konnte nicht gespeichert werden:`, error);
	} finally {
		queue.pending -= 1;

		if (queue.pending === 0 && queues.get(taskId) === queue) {
			const savedTask = persistedTask;

			if (savedTask && operationGeneration === generation) {
				// Kein Folge-GET: Die PATCH-Antwort ist bereits der autoritative Stand.
				update((state) => replaceTask(state, savedTask));
			} else {
				// Nur bei Fehlern oder abgebrochenen Sessions ist ein Refresh notwendig.
				await refreshTask(update, taskId, operationGeneration);
			}

			if (queue.pending === 0 && queues.get(taskId) === queue) {
				queues.delete(taskId);
			}
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