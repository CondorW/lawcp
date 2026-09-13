import { browser } from '$app/environment';
import { belongsToLeader } from '$lib/domain/users';
import { pb } from '$lib/pocketbase';
import {
	parseFirmUserRecord,
	parseRecordList,
	parseResourceRecord,
	parseTaskRecord
} from '$lib/pocketbaseRecords';
import { hasPendingTaskMutation, type StoreUpdate } from './taskMutationQueue';
import type { AppData, Resource, Task } from '$lib/types';

type Cleanup = () => void;

interface SyncSession {
	userId: string;
	disposed: boolean;
	cleanups: Cleanup[];
	lastServerTime: string;
	syncing: boolean;
	ready: Promise<void>;
}

let activeSession: SyncSession | null = null;

function isActive(session: SyncSession): boolean {
	return activeSession === session && !session.disposed && pb.authStore.isValid;
}

function canViewTask(task: Task, userId: string): boolean {
	return (
		task.owner === userId ||
		task.assignees.includes(userId) ||
		belongsToLeader(task.expand?.owner?.teamLeader, userId)
	);
}

function mergeTasks(currentTasks: Task[], serverTasks: Task[]): Task[] {
	const currentById = new Map(currentTasks.map((task) => [task.id, task]));
	const merged = serverTasks.map((task) =>
		hasPendingTaskMutation(task.id) ? (currentById.get(task.id) ?? task) : task
	);
	const serverIds = new Set(serverTasks.map((task) => task.id));

	for (const task of currentTasks) {
		if (!serverIds.has(task.id) && hasPendingTaskMutation(task.id)) merged.unshift(task);
	}
	return merged;
}

function upsertTask(state: AppData, task: Task): AppData {
	if (hasPendingTaskMutation(task.id)) return state;
	const index = state.tasks.findIndex((candidate) => candidate.id === task.id);
	if (index < 0) return { ...state, tasks: [task, ...state.tasks] };
	const tasks = [...state.tasks];
	tasks[index] = task;
	return { ...state, tasks };
}

function upsertResource(state: AppData, resource: Resource): AppData {
	const index = state.resources.findIndex((candidate) => candidate.id === resource.id);
	if (index < 0) return { ...state, resources: [resource, ...state.resources] };
	const resources = [...state.resources];
	resources[index] = resource;
	return { ...state, resources };
}

async function forceFullSync(update: StoreUpdate, session: SyncSession): Promise<void> {
	if (!isActive(session) || session.syncing) return;
	session.syncing = true;

	try {
		const [userRecords, resourceRecords, taskRecords] = await Promise.all([
			pb.collection('users').getFullList({
				fields: 'id,name,shortsign,email,teamLeader',
				sort: 'shortsign',
				requestKey: null
			}),
			pb.collection('resources').getFullList({
				sort: '-created',
				expand: 'owner',
				requestKey: null
			}),
			pb.collection('tasks').getFullList({
				sort: '-created',
				expand: 'owner',
				requestKey: null
			})
		]);
		if (!isActive(session)) return;

		const firmUsers = parseRecordList(userRecords, parseFirmUserRecord, 'users');
		const resources = parseRecordList(resourceRecords, parseResourceRecord, 'resources');
		const tasks = parseRecordList(taskRecords, parseTaskRecord, 'tasks').filter((task) =>
			canViewTask(task, session.userId)
		);
		session.lastServerTime = tasks.reduce(
			(latest, task) => (task.updatedAt && task.updatedAt > latest ? task.updatedAt : latest),
			session.lastServerTime
		);

		update((state) => ({
			...state,
			tasks: mergeTasks(state.tasks, tasks),
			firmUsers,
			resources
		}));
	} catch (error) {
		if (isActive(session)) console.error('PocketBase-Synchronisierung fehlgeschlagen:', error);
	} finally {
		session.syncing = false;
	}
}

async function subscribeToTasks(update: StoreUpdate, session: SyncSession): Promise<void> {
	const unsubscribe = await pb.collection('tasks').subscribe('*', async (event) => {
		if (!isActive(session)) return;
		if (event.action === 'delete') {
			update((state) => ({
				...state,
				tasks: state.tasks.filter((task) => task.id !== event.record.id)
			}));
			return;
		}

		if (hasPendingTaskMutation(event.record.id)) return;
		try {
			const record = await pb.collection('tasks').getOne(event.record.id, {
				expand: 'owner',
				requestKey: null
			});
			if (!isActive(session)) return;
			const task = parseTaskRecord(record);
			session.lastServerTime = task.updatedAt ?? session.lastServerTime;
			update((state) =>
				canViewTask(task, session.userId)
					? upsertTask(state, task)
					: { ...state, tasks: state.tasks.filter((candidate) => candidate.id !== task.id) }
			);
		} catch (error) {
			if (isActive(session)) {
				console.error('Realtime-Task konnte nicht geladen werden:', error);
				update((state) => ({
					...state,
					tasks: state.tasks.filter((task) => task.id !== event.record.id)
				}));
			}
		}
	});

	if (isActive(session)) session.cleanups.push(unsubscribe);
	else unsubscribe();
}

async function subscribeToResources(update: StoreUpdate, session: SyncSession): Promise<void> {
	const unsubscribe = await pb.collection('resources').subscribe('*', async (event) => {
		if (!isActive(session)) return;
		if (event.action === 'delete') {
			update((state) => ({
				...state,
				resources: state.resources.filter((resource) => resource.id !== event.record.id)
			}));
			return;
		}

		try {
			const record = await pb.collection('resources').getOne(event.record.id, {
				expand: 'owner',
				requestKey: null
			});
			if (isActive(session)) update((state) => upsertResource(state, parseResourceRecord(record)));
		} catch (error) {
			if (isActive(session)) {
				console.error('Realtime-Ressource konnte nicht geladen werden:', error);
				update((state) => ({
					...state,
					resources: state.resources.filter((resource) => resource.id !== event.record.id)
				}));
			}
		}
	});

	if (isActive(session)) session.cleanups.push(unsubscribe);
	else unsubscribe();
}

async function initializeSession(update: StoreUpdate, session: SyncSession): Promise<void> {
	await forceFullSync(update, session);
	if (!isActive(session)) return;

	let lastWakeUp = 0;
	const onWakeUp = (): void => {
		const now = Date.now();
		if (now - lastWakeUp < 2_000) return;
		lastWakeUp = now;
		void forceFullSync(update, session);
	};
	const onVisibilityChange = (): void => {
		if (document.visibilityState === 'visible') onWakeUp();
	};

	window.addEventListener('focus', onWakeUp);
	document.addEventListener('visibilitychange', onVisibilityChange);
	session.cleanups.push(() => window.removeEventListener('focus', onWakeUp));
	session.cleanups.push(() => document.removeEventListener('visibilitychange', onVisibilityChange));

	await Promise.all([subscribeToTasks(update, session), subscribeToResources(update, session)]);
	if (!isActive(session)) return;

	const interval = window.setInterval(async () => {
		if (!isActive(session)) return;
		try {
			const latest = await pb.collection('tasks').getList(1, 1, {
				fields: 'id,updated',
				sort: '-updated',
				requestKey: null,
				headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
			});
			const latestUpdated = latest.items[0]?.updated;
			if (latestUpdated && latestUpdated > session.lastServerTime) {
				await forceFullSync(update, session);
			}
		} catch (error) {
			if (isActive(session)) console.error('PocketBase-Polling fehlgeschlagen:', error);
		}
	}, 15_000);
	session.cleanups.push(() => window.clearInterval(interval));
}

export async function initPocketBaseSync(update: StoreUpdate): Promise<void> {
	if (!browser || !pb.authStore.isValid || !pb.authStore.model?.id) return;
	const user = pb.authStore.model;

	if (activeSession?.userId === user.id && !activeSession.disposed) {
		return activeSession.ready;
	}
	await disposePocketBaseSync();

	const session: SyncSession = {
		userId: user.id,
		disposed: false,
		cleanups: [],
		lastServerTime: '',
		syncing: false,
		ready: Promise.resolve()
	};
	activeSession = session;
	update((state) => ({
		...state,
		settings: {
			...state.settings,
			myShortsign: typeof user.shortsign === 'string' ? user.shortsign : 'ME',
			isAuthenticated: true
		}
	}));

	session.ready = initializeSession(update, session);
	return session.ready;
}

export async function disposePocketBaseSync(): Promise<void> {
	const session = activeSession;
	if (!session) return;
	activeSession = null;
	session.disposed = true;

	for (const cleanup of session.cleanups.splice(0)) {
		try {
			cleanup();
		} catch (error) {
			console.error('Synchronisierungs-Ressource konnte nicht beendet werden:', error);
		}
	}
}
