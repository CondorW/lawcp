import { z } from 'zod';

export const SubtaskTypeSchema = z.enum(['GENERIC', 'DOCUMENT', 'RESEARCH', 'EMAIL']);

export const TeamMemberSchema = z.object({
    id: z.string(),
    name: z.string(),
    shortsign: z.string(),
    email: z.string().optional(),
    color: z.string().default('bg-slate-200 text-slate-700'),
    isLeader: z.boolean().default(false)
});

export const ResourceSchema = z.object({
    id: z.string(),
    type: z.enum(['COMPANY', 'PERSON']),
    name: z.string(),
    identifier: z.string().optional(),
    address: z.string().optional(),
    notes: z.string().optional()
});

export const SettingsSchema = z.object({
    myShortsign: z.string().default('ME'),
    darkMode: z.boolean().default(true),
    isAuthenticated: z.boolean().default(true), // NEW: Security Flag
    team: z.array(TeamMemberSchema).default([])
});

// FIX: Lazy Loading für Rekursion
export const SubtaskSchema: z.ZodType<any> = z.lazy(() => z.object({
    id: z.string(),
    title: z.string(),
    done: z.boolean().default(false),
    type: SubtaskTypeSchema.default('GENERIC'),
    payload: z.string().optional(),
    x: z.number().default(0),
    y: z.number().default(0),
    next: z.array(z.string()).default([]),
    // NEU: Nested Subtasks
    subtasks: z.array(SubtaskSchema).default([])
}));

export const TaskSchema = z.object({
	id: z.string(),
	title: z.string().min(1, "Titel fehlt"),
	matterRef: z.string().optional(),
	dueDate: z.string(),
    flaggedDate: z.string().nullable().default(null),
	status: z.enum(['TODO', 'WAITING', 'REVIEW', 'DONE']),
	priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
	createdAt: z.string(),
    timeTracked: z.number().default(0),
    subtasks: z.array(SubtaskSchema).default([]),
    dependencies: z.array(z.string()).default([])
});

export const AppDataSchema = z.object({
    tasks: z.array(TaskSchema),
    settings: SettingsSchema,
    resources: z.array(ResourceSchema).default([])
});

export type SubtaskType = z.infer<typeof SubtaskTypeSchema>;
export type TeamMember = z.infer<typeof TeamMemberSchema>;
export type Resource = z.infer<typeof ResourceSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type Subtask = z.infer<typeof SubtaskSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type AppData = z.infer<typeof AppDataSchema>;