// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { TeamMember } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Formatiert YYYY-MM-DD zu DD.MM.YYYY
export function formatDate(isoString: string) {
    if (!isoString) return '';
    const [year, month, day] = isoString.split('-');
    return `${day}.${month}.${year}`;
}

// NEU: Tag Renderer
export function renderTitleWithTags(title: string, team: TeamMember[]) {
    // Sicherheitshalber escapen wir HTML nicht komplett, da wir HTML zurückgeben.
    // In einer echten App sollte man hier DOMPurify nutzen.
    return title.split(/(\s+)/).map(word => {
        const match = word.match(/^@([a-zA-Z0-9äöüÄÖÜ]+)(.*)/);
        if (match) {
            const tag = match[1];
            const rest = match[2];
            const member = team.find(m => m.shortsign.toLowerCase() === tag.toLowerCase());
            if (member) return `<span class="inline-block px-1.5 py-0.5 mx-0.5 rounded text-xs font-bold uppercase ${member.color}">@${tag}</span>${rest}`;
        }
        return word;
    }).join('');
}