import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string | null) {
	if (!dateStr) return '';
	return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}
