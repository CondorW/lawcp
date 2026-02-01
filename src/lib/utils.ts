// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Formatiert YYYY-MM-DD zu DD.MM.YYYY
export function formatDate(isoString: string) {
    if (!isoString) return '';
    const [year, month, day] = isoString.split('-');
    return `${day}.${month}.${year}`;
}