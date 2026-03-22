import { pb } from '$lib/pocketbase';
import { browser } from '$app/environment';
import { isDraggingLock } from './dbLogic';
import type { AppData, Task, Resource } from '$lib/types';

export const initPocketBaseSync = async (update: (fn: (s: AppData) => AppData) => void) => {
	if (!browser) return;

	if (pb.authStore.isValid && pb.authStore.model) {
		const user = pb.authStore.model;
		update((s) => ({ ...s, settings: { ...s.settings, myShortsign: user.shortsign || 'ME', isAuthenticated: true } }));
	}

	// --- 1. ZENTRALE HARD-SYNC FUNKTION ---
	const forceFullSync = async () => {
		try {
			const users = await pb.collection('users').getFullList({ fields: 'id,name,shortsign,email,teamLeader', sort: 'shortsign' });

			const resRecords = await pb.collection('resources').getFullList({ sort: '-created', expand: 'owner' });
			const resources = resRecords.map((r: any) => ({
				id: r.id, type: r.type, name: r.name, identifier: r.identifier, seat: r.seat, address: r.address, street: r.street, zip: r.zip, city: r.city, notes: r.notes, created: r.created, updated: r.updated, owner: r.owner, expand: r.expand
			}));

			const records = await pb.collection('tasks').getFullList({ sort: '-created', expand: 'owner' });
			const tasks = records.map((r: any) => ({
				id: r.id, title: r.title, status: r.status, matterRef: r.matterRef, dueDate: r.dueDate ? r.dueDate.substring(0, 10) : '', subtasks: r.subtasks || [], flaggedDate: r.flaggedDate ? r.flaggedDate.substring(0, 10) : null, priority: r.priority || 'MEDIUM', createdAt: r.created, timeTracked: r.timeTracked || 0, dependencies: r.dependencies || [], assignees: r.assignees || [], owner: r.owner, expand: r.expand
			}));

			update((s) => {
				if (isDraggingLock) return s;
				return { ...s, tasks: tasks as Task[], firmUsers: users, resources: resources as Resource[] };
			});
		} catch (e) {
			console.error('PB Load Error:', e);
		}
	};

	await forceFullSync();

	// --- 2. WAKE-UP CALL ---
	let lastWakeUp = 0;
	const onWakeUp = () => {
		const now = Date.now();
		if (now - lastWakeUp > 2000) {
			lastWakeUp = now;
			forceFullSync();
		}
	};

	window.addEventListener('focus', onWakeUp);
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible') onWakeUp();
	});

	// --- 3. REALTIME SUBSCRIPTION (Ignoriert im HP Browser, gut für andere) ---
	pb.collection('tasks').subscribe('*', async (e) => {
		const myId = pb.authStore.model?.id;
		if (e.action === 'delete') {
			update((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== e.record.id) }));
			return;
		}
		if (e.action === 'create' || e.action === 'update') {
			try {
				const r = await pb.collection('tasks').getOne(e.record.id, { expand: 'owner' });
				const isOwner = r.owner === myId;
				const isAssignee = r.assignees?.includes(myId);
				const isTeamReview = r.expand?.owner?.teamLeader === myId && r.status === 'REVIEW';

				if (isOwner || isAssignee || isTeamReview) {
					update((s) => {
						const index = s.tasks.findIndex((t) => t.id === r.id);
						const currentLocalTask = index !== -1 ? s.tasks[index] : null;
						const subtasksToUse = isDraggingLock && currentLocalTask ? currentLocalTask.subtasks : r.subtasks || [];

						const updatedTask: Task = {
							id: r.id, title: r.title, status: r.status as Task['status'], matterRef: r.matterRef, dueDate: r.dueDate ? r.dueDate.substring(0, 10) : '', subtasks: subtasksToUse, flaggedDate: r.flaggedDate ? r.flaggedDate.substring(0, 10) : null, priority: r.priority || 'MEDIUM', createdAt: r.created, timeTracked: r.timeTracked || 0, dependencies: r.dependencies || [], assignees: r.assignees || [], owner: r.owner, expand: r.expand
						};

						if (index !== -1) {
							const newTasks = [...s.tasks];
							newTasks[index] = updatedTask;
							return { ...s, tasks: newTasks };
						} else {
							return { ...s, tasks: [updatedTask, ...s.tasks] };
						}
					});
				} else {
					update((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== r.id) }));
				}
			} catch (err) {
				update((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== e.record.id) }));
			}
		}
	});

	pb.collection('resources').subscribe('*', async (e) => {
		if (e.action === 'delete') {
			update((s) => ({ ...s, resources: s.resources.filter((r) => r.id !== e.record.id) }));
			return;
		}
		if (e.action === 'create' || e.action === 'update') {
			try {
				const r = await pb.collection('resources').getOne(e.record.id, { expand: 'owner' });
				const updatedRes: Resource = {
					id: r.id, type: r.type as 'COMPANY' | 'PERSON' | 'AUTHORITY', name: r.name, identifier: r.identifier, seat: r.seat, address: r.address, street: r.street, zip: r.zip, city: r.city, notes: r.notes, created: r.created, updated: r.updated, owner: r.owner, expand: r.expand
				};
				update((s) => {
					const index = s.resources.findIndex((res) => res.id === r.id);
					if (index !== -1) {
						const newRes = [...s.resources];
						newRes[index] = updatedRes;
						return { ...s, resources: newRes };
					} else {
						return { ...s, resources: [updatedRes, ...s.resources] };
					}
				});
			} catch (err) {
				update((s) => ({ ...s, resources: s.resources.filter((r) => r.id !== e.record.id) }));
			}
		}
	});

	// --- 4. CLEAN DELTA-POLLER (Ressourcenschonend, alle 15s) ---
	let lastServerTime = '';
	let pollInterval: ReturnType<typeof setInterval>;

	const runSync = async () => {
		const myId = pb.authStore.model?.id;
		if (!myId) return;

		try {
			// Wir checken nur den neuesten Zeitstempel, um Last zu sparen
			const serverMeta = await pb.collection('tasks').getFullList({
				fields: 'id,updated', sort: '-updated', requestKey: null, headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }, limit: 1
			});

			if (!lastServerTime && serverMeta.length > 0) {
				lastServerTime = serverMeta[0].updated;
				return;
			}

			let missedTasks: any[] = [];
			if (lastServerTime && serverMeta.length > 0 && serverMeta[0].updated > lastServerTime) {
				missedTasks = await pb.collection('tasks').getFullList({
					filter: `updated > "${lastServerTime}"`, expand: 'owner', sort: '-updated', requestKey: null, headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
				});
			}

			if (missedTasks.length > 0) {
				lastServerTime = missedTasks[0].updated;

				update((s) => {
					let newTasks = [...s.tasks];
					let hasChanges = false;

					missedTasks.forEach((mt: any) => {
						const index = newTasks.findIndex((t) => t.id === mt.id);
						const isOwner = mt.owner === myId;
						const isAssignee = mt.assignees?.includes(myId);
						const isTeamReview = mt.expand?.owner?.teamLeader === myId && mt.status === 'REVIEW';

						if (isOwner || isAssignee || isTeamReview) {
							const currentLocalTask = index !== -1 ? newTasks[index] : null;
							const subtasksToUse = isDraggingLock && currentLocalTask ? currentLocalTask.subtasks : mt.subtasks || [];

							const taskObj: Task = {
								id: mt.id, title: mt.title, status: mt.status, matterRef: mt.matterRef, dueDate: mt.dueDate ? mt.dueDate.substring(0, 10) : '', subtasks: subtasksToUse, flaggedDate: mt.flaggedDate ? mt.flaggedDate.substring(0, 10) : null, priority: mt.priority || 'MEDIUM', createdAt: mt.created, timeTracked: mt.timeTracked || 0, dependencies: mt.dependencies || [], assignees: mt.assignees || [], owner: mt.owner, expand: mt.expand
							};

							if (index !== -1) {
								if (JSON.stringify(newTasks[index]) !== JSON.stringify(taskObj)) {
									newTasks[index] = taskObj;
									hasChanges = true;
								}
							} else {
								newTasks.unshift(taskObj);
								hasChanges = true;
							}
						} else if (index !== -1) {
							newTasks = newTasks.filter((t) => t.id !== mt.id);
							hasChanges = true;
						}
					});

					return hasChanges ? { ...s, tasks: newTasks } : s;
				});
			}
		} catch (e) {
			// Silent fail for network blips
		}
	};

	// Startet den ressourcenschonenden Poller (15 Sekunden Intervall)
	pollInterval = setInterval(runSync, 15000);
};