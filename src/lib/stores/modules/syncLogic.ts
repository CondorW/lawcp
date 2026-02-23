import { pb } from '$lib/pocketbase';
import { browser } from '$app/environment';
import type { AppData, Task, Resource } from '$lib/types';

export const initPocketBaseSync = async (update: (fn: (s: AppData) => AppData) => void) => {
    if (!browser) return;

    if (pb.authStore.isValid && pb.authStore.model) {
        const user = pb.authStore.model;
        update(s => ({
            ...s,
            settings: { ...s.settings, myShortsign: user.shortsign || 'ME', isAuthenticated: true }
        }));
    }

    try {
        const users = await pb.collection('users').getFullList({
            fields: 'id,name,shortsign,email,teamLeader',
            sort: 'shortsign'
        });

        const resRecords = await pb.collection('resources').getFullList({ sort: '-created', expand: 'owner' });
        const resources = resRecords.map((r: any) => ({
            id: r.id, type: r.type, name: r.name, identifier: r.identifier, address: r.address,
            street: r.street, zip: r.zip, city: r.city, notes: r.notes, created: r.created,
            updated: r.updated, owner: r.owner, expand: r.expand
        }));

        const records = await pb.collection('tasks').getFullList({ sort: '-created', expand: 'owner' });
        const tasks = records.map((r: any) => ({
            id: r.id, title: r.title, status: r.status, matterRef: r.matterRef,
            dueDate: r.dueDate ? r.dueDate.substring(0, 10) : '', subtasks: r.subtasks || [],
            flaggedDate: r.flaggedDate ? r.flaggedDate.substring(0, 10) : null, priority: 'MEDIUM',
            createdAt: r.created, timeTracked: 0, dependencies: [], assignees: r.assignees || [],
            owner: r.owner, expand: r.expand
        }));

        update(s => ({ ...s, tasks: tasks as Task[], firmUsers: users, resources: resources as Resource[] }));
    } catch (e) {
        console.error("PB Load Error:", e);
    }

    // --- REALTIME SUBSCRIPTION: TASKS ---
    pb.collection('tasks').subscribe('*', async (e) => {
        const myId = pb.authStore.model?.id;

        if (e.action === 'delete') {
            update(s => ({ ...s, tasks: s.tasks.filter(t => t.id !== e.record.id) }));
            return;
        }

        if (e.action === 'create' || e.action === 'update') {
            try {
                const r = await pb.collection('tasks').getOne(e.record.id, { expand: 'owner' });
                const isOwner = r.owner === myId;
                const isAssignee = r.assignees?.includes(myId);
                const isTeamReview = r.expand?.owner?.teamLeader === myId && r.status === 'REVIEW';

                if (isOwner || isAssignee || isTeamReview) {
                    const updatedTask: Task = {
                        id: r.id, title: r.title, status: r.status as Task['status'], matterRef: r.matterRef,
                        dueDate: r.dueDate ? r.dueDate.substring(0, 10) : '', subtasks: r.subtasks || [],
                        flaggedDate: r.flaggedDate ? r.flaggedDate.substring(0, 10) : null, priority: 'MEDIUM',
                        createdAt: r.created, timeTracked: 0, dependencies: [], assignees: r.assignees || [],
                        owner: r.owner, expand: r.expand
                    };

                    update(s => {
                        const index = s.tasks.findIndex(t => t.id === r.id);
                        if (index !== -1) {
                            const newTasks = [...s.tasks];
                            newTasks[index] = updatedTask;
                            return { ...s, tasks: newTasks };
                        } else {
                            return { ...s, tasks: [updatedTask, ...s.tasks] };
                        }
                    });
                } else {
                    update(s => ({ ...s, tasks: s.tasks.filter(t => t.id !== r.id) }));
                }
            } catch (err) {
                update(s => ({ ...s, tasks: s.tasks.filter(t => t.id !== e.record.id) }));
            }
        }
    });

    // --- REALTIME SUBSCRIPTION: RESOURCES ---
    pb.collection('resources').subscribe('*', async (e) => {
        if (e.action === 'delete') {
            update(s => ({ ...s, resources: s.resources.filter(r => r.id !== e.record.id) }));
            return;
        }

        if (e.action === 'create' || e.action === 'update') {
            try {
                const r = await pb.collection('resources').getOne(e.record.id, { expand: 'owner' });
                const updatedRes: Resource = {
                    id: r.id, type: r.type as 'COMPANY' | 'PERSON', name: r.name, identifier: r.identifier,
                    address: r.address, street: r.street, zip: r.zip, city: r.city, notes: r.notes,
                    created: r.created, updated: r.updated, owner: r.owner, expand: r.expand
                };

                update(s => {
                    const index = s.resources.findIndex(res => res.id === r.id);
                    if (index !== -1) {
                        const newRes = [...s.resources];
                        newRes[index] = updatedRes;
                        return { ...s, resources: newRes };
                    } else {
                        return { ...s, resources: [updatedRes, ...s.resources] };
                    }
                });
            } catch (err) {
                update(s => ({ ...s, resources: s.resources.filter(r => r.id !== e.record.id) }));
            }
        }
    });

    // Background Verifier
    if (browser) {
        setInterval(async () => {
            const myId = pb.authStore.model?.id || '';
            if (!myId) return;

            let currentTasks: Task[] = [];
            update(s => { currentTasks = s.tasks; return s; });

            const foreignTasks = currentTasks.filter(t => t.owner !== myId);

            for (const t of foreignTasks) {
                try {
                    await pb.collection('tasks').getOne(t.id, { fields: 'id' });
                } catch (err: any) {
                    if (err.status === 404) {
                        update(s => ({ ...s, tasks: s.tasks.filter(task => task.id !== t.id) }));
                    }
                }
            }
        }, 5000);
    }
};