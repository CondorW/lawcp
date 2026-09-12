import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { pb } from '$lib/pocketbase';
import { chatStore } from '$lib/stores/chat.svelte';
import * as AppLogic from '$lib/stores/modules/appLogic';
import * as DBLogic from '$lib/stores/modules/dbLogic';
import * as SyncLogic from '$lib/stores/modules/syncLogic';
import { flushTaskMutations, resetTaskMutationQueue } from '$lib/stores/modules/taskMutationQueue';
import {
	SettingsSchema,
	type AppData,
	type Resource,
	type Settings,
	type SubtaskType,
	type TaskPriority
} from '$lib/types';
import { get, writable } from 'svelte/store';

const DEFAULT_SETTINGS: Settings = {
	myShortsign: 'ME',
	darkMode: true,
	isAuthenticated: false,
	team: []
};

function createInitialState(darkMode = true): AppData {
	return {
		tasks: [],
		settings: { ...DEFAULT_SETTINGS, darkMode },
		resources: [],
		matterNotes: [],
		firmUsers: []
	};
}

function loadStoredSettings(): Settings | null {
	if (!browser) return null;
	const stored = localStorage.getItem('lawcp_settings');
	if (!stored) return null;

	try {
		const parsedJson: unknown = JSON.parse(stored);
		const storedObject =
			typeof parsedJson === 'object' && parsedJson !== null && !Array.isArray(parsedJson)
				? parsedJson
				: {};
		const result = SettingsSchema.safeParse({ ...DEFAULT_SETTINGS, ...storedObject });
		return result.success ? result.data : null;
	} catch (error) {
		console.error('Lokale Einstellungen konnten nicht gelesen werden:', error);
		return null;
	}
}

function createStore() {
	const initialState = createInitialState();
	const { subscribe, update } = writable<AppData>(initialState);
	const activeMatterStore = writable<string | null>(null);
	const readableStore = { subscribe };
	const read = () => get(readableStore);

	const storedSettings = loadStoredSettings();
	if (storedSettings) update((state) => ({ ...state, settings: storedSettings }));

	const saveLocal = (state: AppData): AppData => {
		if (browser) localStorage.setItem('lawcp_settings', JSON.stringify(state.settings));
		return state;
	};

	const clearSessionState = (): void => {
		activeMatterStore.set(null);
		update((state) => createInitialState(state.settings.darkMode));
	};

	const resetSession = async (): Promise<void> => {
		await Promise.all([SyncLogic.disposePocketBaseSync(), chatStore.reset()]);
		resetTaskMutationQueue();
		clearSessionState();
	};

	return {
		subscribe,
		activeMatter: activeMatterStore,
		init: () => SyncLogic.initPocketBaseSync(update),
		resetSession,
		toggleDarkMode: () => update((state) => saveLocal(AppLogic.toggleDarkMode(state))),
		login: (shortsign: string) => update((state) => saveLocal(AppLogic.login(state, shortsign))),
		addTeamMember: (name: string, shortsign: string, color: string) =>
			update((state) => saveLocal(AppLogic.addTeamMember(state, name, shortsign, color))),
		removeTeamMember: (id: string) =>
			update((state) => saveLocal(AppLogic.removeTeamMember(state, id))),
		setTeamLeader: (id: string) => update((state) => saveLocal(AppLogic.setTeamLeader(state, id))),

		updateSettings: async (values: Partial<Settings>) => {
			update((state) => saveLocal(AppLogic.updateSettings(state, values)));
			if (pb.authStore.isValid && pb.authStore.model && values.myShortsign) {
				try {
					await pb
						.collection('users')
						.update(pb.authStore.model.id, { shortsign: values.myShortsign }, { requestKey: null });
					await pb.collection('users').authRefresh({ requestKey: null });
				} catch (error) {
					console.error('Einstellungen konnten nicht synchronisiert werden:', error);
				}
			}
		},

		logout: async () => {
			// Persist already accepted edits before invalidating the authenticated client.
			await flushTaskMutations();
			await Promise.all([SyncLogic.disposePocketBaseSync(), chatStore.reset()]);
			resetTaskMutationQueue();
			pb.authStore.clear();
			if (browser) {
				localStorage.removeItem('lawcp_settings');
				localStorage.removeItem('lawcp_resources');
				clearSessionState();
				await goto(resolve('/login'));
			}
		},

		addResource: (resource: Omit<Resource, 'id' | 'created' | 'updated' | 'owner' | 'expand'>) =>
			DBLogic.addResource(update, resource),
		deleteResource: (id: string) => DBLogic.deleteResource(update, id),

		addTask: (
			status: string,
			title: string,
			matterRef?: string,
			date?: string,
			assignedTo?: string
		) => DBLogic.addTask(update, status, title, matterRef, date, assignedTo),
		assignTask: (taskId: string, assigneeId: string) =>
			DBLogic.assignTask(update, taskId, assigneeId),
		deleteTask: (id: string) => DBLogic.deleteTask(update, id),
		archiveTask: (id: string, archived: boolean) => DBLogic.archiveTask(update, id, archived),
		updateTaskTitle: (id: string, title: string) => DBLogic.updateTaskTitle(update, id, title),
		updateTaskRef: (id: string, matterRef: string) => DBLogic.updateTaskRef(update, id, matterRef),
		updateTaskPriority: (id: string, priority: TaskPriority) =>
			DBLogic.updateTaskPriority(update, id, priority),
		updateDate: (id: string, date: string) => DBLogic.updateDate(update, id, date),
		toggleFlag: (id: string, date: string | null) => DBLogic.toggleFlag(update, id, date),
		moveTask: (id: string, status: string) => DBLogic.moveTask(update, id, status),

		addSubtask: (taskId: string, title: string, type: SubtaskType = 'GENERIC', x = 0, y = 0) =>
			DBLogic.addSubtask(update, taskId, title, type, x, y),
		toggleSubtask: (taskId: string, subtaskId: string) =>
			DBLogic.toggleSubtask(update, taskId, subtaskId),
		archiveSubtask: (taskId: string, subtaskId: string, archived: boolean) =>
			DBLogic.archiveSubtask(update, taskId, subtaskId, archived),
		setSubtaskReviewState: (
			taskId: string,
			subtaskId: string,
			state: 'REQUESTED' | 'APPROVED' | 'REVISION' | null
		) => DBLogic.setSubtaskReviewState(update, read, taskId, subtaskId, state),
		updateSubtaskTitle: (taskId: string, subtaskId: string, title: string) =>
			DBLogic.updateSubtaskTitle(update, taskId, subtaskId, title),
		addSubSubtask: (taskId: string, parentSubtaskId: string, title: string) =>
			DBLogic.addSubSubtask(update, taskId, parentSubtaskId, title),
		updateSubtaskPos: (taskId: string, subtaskId: string, x: number, y: number) =>
			DBLogic.updateSubtaskPos(update, taskId, subtaskId, x, y),
		connectSubtasks: (taskId: string, sourceId: string, targetId: string) =>
			DBLogic.connectSubtasks(update, taskId, sourceId, targetId),
		disconnectSubtasks: (taskId: string, sourceId: string, targetId: string) =>
			DBLogic.disconnectSubtasks(update, taskId, sourceId, targetId),
		deleteSubtask: (taskId: string, subtaskId: string) =>
			DBLogic.deleteSubtask(update, taskId, subtaskId),

		openMatterNotes: (matterRef: string) => activeMatterStore.set(matterRef),
		closeMatterNotes: () => activeMatterStore.set(null),
		fetchContext: (matterRef: string) => DBLogic.fetchContext(matterRef),
		saveContext: (matterRef: string, content: string, contextId?: string) =>
			DBLogic.saveContext(matterRef, content, contextId),

		addTimeLog: (taskId: string, minutes: number, note: string, date: string) =>
			DBLogic.addTimeLog(update, taskId, minutes, note, date),
		updateTimeLog: (taskId: string, logId: string, minutes: number, note: string, date: string) =>
			DBLogic.updateTimeLog(update, taskId, logId, minutes, note, date),
		deleteTimeLog: (taskId: string, logId: string) => DBLogic.deleteTimeLog(update, taskId, logId)
	};
}

export const store = createStore();
