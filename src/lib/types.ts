import { z } from 'zod';

export const SubtaskTypeSchema = z.enum(['GENERIC', 'DOCUMENT', 'RESEARCH', 'EMAIL']);
export const TaskStatusSchema = z.enum(['TODO', 'WAITING', 'REVIEW', 'DONE']);
export const TaskPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export const ReviewStateSchema = z.enum(['REQUESTED', 'APPROVED', 'REVISION']);
export const ResourceTypeSchema = z.enum(['COMPANY', 'PERSON', 'AUTHORITY']);

// PocketBase relations can be a single id or an array, depending on maxSelect.
export const RelationValueSchema = z
	.union([z.string(), z.array(z.string())])
	.nullable()
	.optional();

const optionalString = z.string().optional();

// PocketBase serialisiert ein nicht gesetztes Datumsfeld als leeren String; intern verwenden wir null.
const nullablePocketBaseDate = z
	.string()
	.nullish()
	.transform((value) => value || null);

export const TeamMemberSchema = z.object({
	id: z.string(),
	name: z.string(),
	shortsign: z.string(),
	email: optionalString,
	color: z.string().default('bg-slate-200 text-slate-700'),
	isLeader: z.boolean().default(false)
});

export const FirmUserSchema = z.object({
	id: z.string(),
	name: optionalString,
	shortsign: optionalString,
	email: optionalString,
	teamLeader: RelationValueSchema
});

export const ExpandedOwnerSchema = z.object({
	id: optionalString,
	name: optionalString,
	shortsign: optionalString,
	color: optionalString,
	teamLeader: RelationValueSchema
});

export const ResourceSchema = z.object({
	id: z.string(),
	type: ResourceTypeSchema,
	name: z.string(),
	identifier: optionalString,
	seat: optionalString,
	address: optionalString,
	street: optionalString,
	zip: optionalString,
	city: optionalString,
	notes: optionalString,
	created: optionalString,
	updated: optionalString,
	owner: optionalString,
	expand: z
		.object({
			owner: ExpandedOwnerSchema.optional()
		})
		.optional()
});

export const TimeLogSchema = z.object({
	id: z.string(),
	userId: z.string(),
	date: z.string(),
	minutes: z.number().finite().positive(),
	note: optionalString
});

export const MatterNoteSchema = z.object({
	ref: z.string(),
	content: z.string().default('')
});

export const SettingsSchema = z.object({
	myShortsign: z.string().default('ME'),
	darkMode: z.boolean().default(true),
	isAuthenticated: z.boolean().default(false),
	team: z.array(TeamMemberSchema).default([])
});

export type SubtaskType = z.infer<typeof SubtaskTypeSchema>;
export type TaskStatus = z.infer<typeof TaskStatusSchema>;
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;
export type ReviewState = z.infer<typeof ReviewStateSchema>;
export type RelationValue = z.infer<typeof RelationValueSchema>;

export interface Subtask {
	id: string;
	title: string;
	done: boolean;
	completedAt?: string;
	reviewState?: ReviewState | null;
	archived: boolean;
	type: SubtaskType;
	x: number;
	y: number;
	next: string[];
	subtasks: Subtask[];
}

// Explicit recursive output type prevents the former `any` from leaking through the domain.
export const SubtaskSchema: z.ZodType<Subtask> = z.lazy(() =>
	z.object({
		id: z.string(),
		title: z.string(),
		done: z.boolean().default(false),
		completedAt: optionalString,
		reviewState: ReviewStateSchema.nullable().optional(),
		archived: z
			.boolean()
			.nullable()
			.optional()
			.transform((value) => Boolean(value)),
		type: SubtaskTypeSchema.default('GENERIC'),
		x: z.number().finite().default(0),
		y: z.number().finite().default(0),
		next: z.array(z.string()).default([]),
		subtasks: z.array(SubtaskSchema).default([])
	})
);

export const TaskSchema = z.object({
	id: z.string(),
	title: z.string().min(1, 'Titel fehlt'),
	matterRef: optionalString,
	dueDate: z.string().default(''),
	flaggedDate: nullablePocketBaseDate,
	status: TaskStatusSchema,
	priority: TaskPrioritySchema.default('MEDIUM'),
	archived: z
		.boolean()
		.nullable()
		.optional()
		.transform((value) => Boolean(value)),
	createdAt: z.string(),
	updatedAt: optionalString,
	timeLogs: z.array(TimeLogSchema).default([]),
	subtasks: z.array(SubtaskSchema).default([]),
	assignees: z.array(z.string()).default([]),
	owner: optionalString,
	expand: z
		.object({
			owner: ExpandedOwnerSchema.optional()
		})
		.optional()
});

export const AppDataSchema = z.object({
	tasks: z.array(TaskSchema),
	settings: SettingsSchema,
	resources: z.array(ResourceSchema).default([]),
	matterNotes: z.array(MatterNoteSchema).default([]),
	firmUsers: z.array(FirmUserSchema).default([])
});

export type TeamMember = z.infer<typeof TeamMemberSchema>;
export type FirmUser = z.infer<typeof FirmUserSchema>;
export type Resource = z.infer<typeof ResourceSchema>;
export type TimeLog = z.infer<typeof TimeLogSchema>;
export type MatterNote = z.infer<typeof MatterNoteSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type AppData = z.infer<typeof AppDataSchema>;
