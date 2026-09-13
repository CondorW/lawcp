import { get, writable } from 'svelte/store';

export type ToastTone = 'info' | 'success' | 'warning' | 'danger' | 'error';

export interface ToastItem {
	id: string;
	title: string;
	message?: string;
	tone: ToastTone;
	confirmLabel?: string;
	cancelLabel?: string;
}

interface NotificationOptions {
	title: string;
	message?: string;
	tone?: Exclude<ToastTone, 'danger'>;
	durationMs?: number;
}

interface ConfirmationOptions {
	title: string;
	message?: string;
	confirmLabel: string;
	cancelLabel?: string;
	tone?: 'warning' | 'danger';
}

let toastSequence = 0;

function createToastId(): string {
	toastSequence += 1;
	return `toast-${Date.now()}-${toastSequence}`;
}

class ToastStore {
	private readonly items = writable<ToastItem[]>([]);
	private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
	private readonly confirmationResolvers = new Map<string, (confirmed: boolean) => void>();

	// Stellt den normalen Svelte-Store-Vertrag ohne Rune-Modul bereit.
	readonly subscribe = this.items.subscribe;

	notify({ title, message, tone = 'info', durationMs = 4_500 }: NotificationOptions): string {
		const id = createToastId();
		this.enqueue({ id, title, message, tone });
		this.timers.set(
			id,
			setTimeout(() => this.dismiss(id), durationMs)
		);
		return id;
	}

	success(title: string, message?: string): string {
		return this.notify({ title, message, tone: 'success' });
	}

	error(title: string, message?: string): string {
		return this.notify({ title, message, tone: 'error', durationMs: 6_000 });
	}

	confirm({
		title,
		message,
		confirmLabel,
		cancelLabel = 'Abbrechen',
		tone = 'danger'
	}: ConfirmationOptions): Promise<boolean> {
		const id = createToastId();
		this.enqueue({ id, title, message, tone, confirmLabel, cancelLabel });

		return new Promise((resolve) => {
			this.confirmationResolvers.set(id, resolve);
		});
	}

	accept(id: string): void {
		this.settleConfirmation(id, true);
	}

	dismiss(id: string): void {
		this.settleConfirmation(id, false);
	}

	clear(): void {
		for (const timer of this.timers.values()) clearTimeout(timer);
		this.timers.clear();

		for (const resolve of this.confirmationResolvers.values()) resolve(false);
		this.confirmationResolvers.clear();

		this.items.set([]);
	}

	private enqueue(toast: ToastItem): void {
		// Verhindert, dass wiederholte Fehlermeldungen die Oberfläche verdecken.
		const currentItems = get(this.items);
		if (currentItems.length >= 5) this.dismiss(currentItems[0].id);

		this.items.update((items) => [...items, toast]);
	}

	private settleConfirmation(id: string, confirmed: boolean): void {
		const timer = this.timers.get(id);
		if (timer) clearTimeout(timer);
		this.timers.delete(id);

		const resolve = this.confirmationResolvers.get(id);
		this.confirmationResolvers.delete(id);

		this.items.update((items) => items.filter((toast) => toast.id !== id));
		resolve?.(confirmed);
	}
}

export const toastStore = new ToastStore();