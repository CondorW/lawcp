import { z } from 'zod';
import {
	FirmUserSchema,
	ResourceSchema,
	SubtaskSchema,
	TaskPrioritySchema,
	TaskSchema,
	TaskStatusSchema,
	TimeLogSchema,
	type FirmUser,
	type Resource,
	type Task
} from '$lib/types';
import { sortSubtasksDeep } from '$lib/domain/subtasks';

const PocketBaseRecordSchema = z
	.object({
		id: z.string(),
		created: z.string().optional(),
		updated: z.string().optional()
	})
	.loose();

function optionalText(value: unknown): string | undefined {
	return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function text(value: unknown, fallback = ''): string {
	return typeof value === 'string' ? value : fallback;
}

function stringList(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((entry): entry is string => typeof entry === 'string')
		: [];
}

export function parseTaskRecord(input: unknown): Task {
	const record = PocketBaseRecordSchema.parse(input);
	const raw = record as Record<string, unknown>;
	const status = TaskStatusSchema.parse(raw.status);
	const priority = TaskPrioritySchema.catch('MEDIUM').parse(raw.priority);
	const subtasks = z.array(SubtaskSchema).parse(Array.isArray(raw.subtasks) ? raw.subtasks : []);
	const timeLogs = z.array(TimeLogSchema).parse(Array.isArray(raw.timeLogs) ? raw.timeLogs : []);

	return TaskSchema.parse({
		id: record.id,
		title: text(raw.title),
		matterRef: optionalText(raw.matterRef),
		dueDate: optionalText(raw.dueDate)?.slice(0, 10) ?? '',
		flaggedDate: optionalText(raw.flaggedDate)?.slice(0, 10) ?? null,
		status,
		priority,
		archived: Boolean(raw.archived),
		createdAt: record.created ?? new Date(0).toISOString(),
		updatedAt: record.updated,
		timeLogs,
		subtasks: sortSubtasksDeep(subtasks),
		assignees: stringList(raw.assignees),
		owner: optionalText(raw.owner),
		expand: raw.expand
	});
}

export function parseResourceRecord(input: unknown): Resource {
	const record = PocketBaseRecordSchema.parse(input);
	const raw = record as Record<string, unknown>;

	return ResourceSchema.parse({
		id: record.id,
		type: raw.type,
		name: raw.name,
		identifier: optionalText(raw.identifier),
		seat: optionalText(raw.seat),
		address: optionalText(raw.address),
		street: optionalText(raw.street),
		zip: optionalText(raw.zip),
		city: optionalText(raw.city),
		notes: optionalText(raw.notes),
		created: record.created,
		updated: record.updated,
		owner: optionalText(raw.owner),
		expand: raw.expand
	});
}

export function parseFirmUserRecord(input: unknown): FirmUser {
	const record = PocketBaseRecordSchema.parse(input);
	const raw = record as Record<string, unknown>;

	return FirmUserSchema.parse({
		id: record.id,
		name: optionalText(raw.name),
		shortsign: optionalText(raw.shortsign),
		email: optionalText(raw.email),
		teamLeader: raw.teamLeader
	});
}

export function parseRecordList<T>(
	records: unknown[],
	parseRecord: (record: unknown) => T,
	label: string
): T[] {
	return records.flatMap((record) => {
		try {
			return [parseRecord(record)];
		} catch (error) {
			console.error(`Ungültiger PocketBase-Datensatz in ${label}:`, error);
			return [];
		}
	});
}
