import type { FirmUser, Subtask, Task, TimeLog } from '$lib/types';

export type BillingFilterMode = 'TODAY' | 'WEEK' | 'MONTH' | 'ALL';
export type BillingViewMode = 'ME' | 'TEAM';

export type EnrichedTimeLog = TimeLog & {
	taskId: string;
	taskTitle: string;
	matterRef: string;
	userSign: string;
};

export interface GroupedCompletedTask {
	taskId: string;
	taskTitle: string;
	matterRef: string;
	latestTime: number;
	subtasks: Subtask[];
}

export interface TimeLogFormValue {
	logId?: string;
	taskId: string;
	minutes: number;
	note: string;
	date: string;
}

function startOfDay(date: Date): number {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function endOfDay(date: Date): number {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime() - 1;
}

export function isDateInBillingRange(
	dateValue: string,
	mode: BillingFilterMode,
	now = new Date()
): boolean {
	const timestamp = new Date(dateValue).getTime();
	if (!Number.isFinite(timestamp)) return false;
	if (mode === 'ALL') return true;

	const todayStart = startOfDay(now);
	const todayEnd = endOfDay(now);
	if (mode === 'TODAY') return timestamp >= todayStart && timestamp <= todayEnd;
	if (mode === 'WEEK') {
		const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).getTime();
		return timestamp >= weekStart && timestamp <= todayEnd;
	}

	const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
	return timestamp >= monthStart && timestamp <= todayEnd;
}

export function getUserSign(users: FirmUser[], userId: string): string {
	return users.find((user) => user.id === userId)?.shortsign ?? 'Unbekannt';
}

export function aggregateTimeLogs(
	tasks: Task[],
	users: FirmUser[],
	myId: string,
	teamMemberIds: string[],
	viewMode: BillingViewMode,
	filterMode: BillingFilterMode
): EnrichedTimeLog[] {
	const visibleUserIds = new Set(viewMode === 'ME' ? [myId] : teamMemberIds);

	return tasks
		.flatMap((task) =>
			task.timeLogs
				.filter(
					(log) => visibleUserIds.has(log.userId) && isDateInBillingRange(log.date, filterMode)
				)
				.map((log) => ({
					...log,
					taskId: task.id,
					taskTitle: task.title,
					matterRef: task.matterRef || 'NO-REF',
					userSign: getUserSign(users, log.userId)
				}))
		)
		.sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
}

export function getCompletedSubtasksToday(nodes: Subtask[], now = new Date()): Subtask[] {
	const from = startOfDay(now);
	const to = endOfDay(now);

	return nodes.flatMap((subtask) => {
		const completedAt = subtask.completedAt ? new Date(subtask.completedAt).getTime() : Number.NaN;
		const current = subtask.done && completedAt >= from && completedAt <= to ? [subtask] : [];
		return [...current, ...getCompletedSubtasksToday(subtask.subtasks, now)];
	});
}

export function groupCompletedTasksToday(
	tasks: Task[],
	myId: string,
	teamMemberIds: string[],
	viewMode: BillingViewMode
): GroupedCompletedTask[] {
	return tasks
		.flatMap((task): GroupedCompletedTask[] => {
			const relevant =
				viewMode === 'ME'
					? task.owner === myId || task.assignees.includes(myId)
					: Boolean(task.owner && teamMemberIds.includes(task.owner)) ||
						task.assignees.some((assignee) => teamMemberIds.includes(assignee));
			if (!relevant) return [];

			const subtasks = getCompletedSubtasksToday(task.subtasks).sort(
				(left, right) =>
					new Date(right.completedAt ?? 0).getTime() - new Date(left.completedAt ?? 0).getTime()
			);
			if (subtasks.length === 0) return [];

			return [
				{
					taskId: task.id,
					taskTitle: task.title,
					matterRef: task.matterRef || 'NO-REF',
					latestTime: new Date(subtasks[0].completedAt ?? 0).getTime(),
					subtasks
				}
			];
		})
		.sort((left, right) => right.latestTime - left.latestTime);
}

export function getRecommendedNotes(task: Task | undefined, now = new Date()): string[] {
	if (!task) return [];
	const recommendations: string[] = [];
	const todayStart = startOfDay(now);
	const todayEnd = endOfDay(now);
	const updatedAt = new Date(task.updatedAt ?? task.createdAt).getTime();

	if (task.status === 'DONE' && updatedAt >= todayStart && updatedAt <= todayEnd) {
		recommendations.push(`Abschluss: ${task.title}`);
	}
	for (const subtask of getCompletedSubtasksToday(task.subtasks, now)) {
		recommendations.push(subtask.title);
	}
	return recommendations;
}

function escapeCsvCell(value: string | number): string {
	let normalized = String(value);
	if (/^[\s]*[=+\-@]/.test(normalized)) normalized = `'${normalized}`;
	return `"${normalized.replace(/"/g, '""')}"`;
}

export function createBillingCsv(logs: EnrichedTimeLog[]): string {
	const headers = [
		'Datum',
		'Zeit',
		'Dauer (Minuten)',
		'Mitarbeiter',
		'Aktenzeichen',
		'Aufgabe',
		'Bemerkung'
	];
	const rows = logs.map((log) => {
		const date = new Date(log.date);
		return [
			date.toLocaleDateString('de-CH'),
			date.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' }),
			log.minutes,
			log.userSign,
			log.matterRef,
			log.taskTitle,
			log.note ?? ''
		]
			.map(escapeCsvCell)
			.join(';');
	});

	return ['sep=;', headers.map(escapeCsvCell).join(';'), ...rows].join('\n');
}
