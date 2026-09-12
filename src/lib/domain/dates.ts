export function toLocalDateInputValue(date: Date = new Date()): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

export function isoToDateInputValue(value: string | null | undefined): string {
	if (!value) return '';
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? value.slice(0, 10) : toLocalDateInputValue(date);
}

export function localDateInputToIso(value: string, timeSource: Date = new Date()): string {
	const [year, month, day] = value.split('-').map(Number);
	const date = new Date(
		year,
		month - 1,
		day,
		timeSource.getHours(),
		timeSource.getMinutes(),
		timeSource.getSeconds(),
		timeSource.getMilliseconds()
	);
	return date.toISOString();
}
