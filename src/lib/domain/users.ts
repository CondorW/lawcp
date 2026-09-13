import type { RelationValue } from '$lib/types';

export function getPrimaryRelationId(value: RelationValue | unknown): string | null {
	if (typeof value === 'string') return value.trim() || null;
	if (Array.isArray(value)) {
		const firstId = value.find(
			(entry): entry is string => typeof entry === 'string' && entry.trim() !== ''
		);
		return firstId ?? null;
	}
	return null;
}

export function belongsToLeader(value: RelationValue | unknown, leaderId: string): boolean {
	if (!leaderId) return false;
	return Array.isArray(value) ? value.includes(leaderId) : value === leaderId;
}
