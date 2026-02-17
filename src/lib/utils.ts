import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
// FIX: Subtask und TeamMember importieren!
import type { TeamMember, Subtask } from "./types";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string | null) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

export function renderTitleWithTags(title: string, team: TeamMember[]) {
    if (!title) return '';
    return title.split(/(\s+)/).map(word => {
        const match = word.match(/^@([a-zA-Z0-9äöüÄÖÜ]+)(.*)/);
        if (match) {
            const tag = match[1];
            const rest = match[2];
            const member = team.find(m => m.shortsign.toLowerCase() === tag.toLowerCase());
            // Fallback Farbe falls Member nicht gefunden wird
            const color = member ? member.color : 'bg-gray-200 text-gray-800';
            return `<span class="inline-block px-1.5 py-0.5 mx-0.5 rounded text-xs font-bold uppercase ${color}">@${tag}</span>${rest}`;
        }
        return word;
    }).join('');
}

// FIX: Die rekursiven Helper müssen hier sauber definiert sein
export function recursiveUpdate(subtasks: Subtask[], targetId: string, fn: (s: Subtask) => Subtask): Subtask[] {
    return subtasks.map(s => {
        if (s.id === targetId) return fn(s);
        if (s.subtasks?.length) return { ...s, subtasks: recursiveUpdate(s.subtasks, targetId, fn) };
        return s;
    });
}

export function recursiveAdd(subtasks: Subtask[], parentId: string, newSub: Subtask): Subtask[] {
    return subtasks.map(s => {
        if (s.id === parentId) return { ...s, subtasks: [...(s.subtasks || []), newSub] };
        if (s.subtasks?.length) return { ...s, subtasks: recursiveAdd(s.subtasks, parentId, newSub) };
        return s;
    });
}