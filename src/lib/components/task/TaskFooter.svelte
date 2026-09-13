<script lang="ts">
	import { store } from '$lib/stores/tasks';
	import type { Task } from '$lib/types';
	import { Calendar, Flag, BrainCircuit, Trash2, Archive, ArchiveRestore } from 'lucide-svelte';
	import { formatDate } from '$lib/utils';
	import { isoToDateInputValue, localDateInputToIso } from '$lib/domain/dates';
	import { toastStore } from '$lib/stores/toasts';

	interface Props {
		task: Task;
		isOwner: boolean;
		isExpanded?: boolean;
		onOpenContext?: () => void;
	}

	let { task, isOwner, isExpanded = false, onOpenContext }: Props = $props();

	function openNativePicker(e: MouseEvent): void {
		e.stopPropagation();
		const button = e.currentTarget as HTMLElement;
		const input = button.querySelector<HTMLInputElement>('input[type="date"]');

		if (!input) return;

		try {
			input.showPicker();
		} catch {
			input.focus();
			input.click();
		}
	}

	function updateCourtDate(e: Event): void {
		const target = e.currentTarget as HTMLInputElement;
		void store.toggleFlag(task.id, target.value ? localDateInputToIso(target.value) : null);
	}

	function updateInternalDate(e: Event): void {
		const target = e.currentTarget as HTMLInputElement;
		void store.updateDate(task.id, target.value ? localDateInputToIso(target.value) : '');
	}

	async function toggleTaskArchive(): Promise<void> {
		if (task.archived) {
			await store.archiveTask(task.id, false);
			return;
		}

		const confirmed = await toastStore.confirm({
			title: 'Case archivieren?',
			message: `„${task.title}“ wird aus dem aktiven Board ausgeblendet.`,
			confirmLabel: 'Archivieren',
			tone: 'warning'
		});

		if (confirmed) await store.archiveTask(task.id, true);
	}

	async function deleteTask(): Promise<void> {
		const confirmed = await toastStore.confirm({
			title: 'Case endgültig löschen?',
			message: `„${task.title}“ inklusive aller Subtasks und Zeitbuchungen wird gelöscht.`,
			confirmLabel: 'Löschen',
			tone: 'danger'
		});

		if (confirmed) await store.deleteTask(task.id);
	}
</script>

<div class="flex h-6 min-w-0 flex-grow flex-row items-center justify-between pr-0.5">
	<div class="flex h-full flex-row items-center gap-1">
		{#if task.matterRef && !isExpanded}
			<button
				type="button"
				onclick={(event) => {
					event.stopPropagation();

					if (onOpenContext) onOpenContext();
					else store.openMatterNotes(task.matterRef!);
				}}
				class="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 transition-colors outline-none hover:bg-purple-50 hover:text-purple-600 focus:ring-0 dark:hover:bg-purple-900/30"
				title="Akten-Notizen öffnen"
			>
				<BrainCircuit size={13} class="pointer-events-none" />
			</button>
		{/if}
	</div>

	<div class="flex h-full shrink-0 flex-row items-center gap-1.5">
		{#if isOwner}
			<button
				type="button"
				onclick={(event) => {
					event.stopPropagation();
					void toggleTaskArchive();
				}}
				class="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 transition-all outline-none hover:bg-brand-50 hover:text-brand-600 focus:ring-0 dark:hover:bg-brand-900/20"
				title={task.archived ? 'Wiederherstellen' : 'Archivieren'}
			>
				{#if task.archived}
					<ArchiveRestore size={13} class="pointer-events-none" />
				{:else}
					<Archive size={13} class="pointer-events-none" />
				{/if}
			</button>

			<button
				type="button"
				onclick={(event) => {
					event.stopPropagation();
					void deleteTask();
				}}
				class="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 transition-all outline-none hover:bg-rose-50 hover:text-rose-600 focus:ring-0 dark:hover:bg-rose-900/20"
				title="Löschen"
			>
				<Trash2 size={13} class="pointer-events-none" />
			</button>
		{/if}

		<button
			type="button"
			class={task.flaggedDate
				? 'relative flex h-6 shrink-0 items-center justify-center gap-1.5 rounded border border-rose-300 bg-rose-100 px-1.5 text-xs font-bold tracking-wide text-rose-700 transition-colors outline-none hover:bg-rose-200 focus:ring-0 dark:border-rose-700 dark:bg-rose-900/50 dark:text-rose-400'
				: 'relative flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-500 transition-colors outline-none hover:bg-slate-100 hover:text-rose-500 focus:ring-0 dark:text-slate-400 dark:hover:bg-slate-700/50'}
			onclick={openNativePicker}
			title={task.flaggedDate ? 'Gerichtstermin anpassen' : 'Gerichtstermin setzen'}
		>
			<Flag size={13} class="pointer-events-none" />

			{#if task.flaggedDate}
				<span class="pointer-events-none">{formatDate(task.flaggedDate)}</span>
			{/if}

			<input
				type="date"
				class="sr-only"
				tabindex="-1"
				value={isoToDateInputValue(task.flaggedDate)}
				onchange={updateCourtDate}
				onclick={(event) => event.stopPropagation()}
			/>
		</button>

		<button
			type="button"
			class={task.dueDate
				? 'relative flex h-6 shrink-0 items-center gap-1.5 rounded px-1.5 text-xs font-bold text-slate-600 transition-colors outline-none hover:bg-slate-100 hover:text-slate-800 focus:ring-0 dark:text-slate-300 dark:hover:bg-slate-700/50'
				: 'relative flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-500 transition-colors outline-none hover:bg-slate-100 hover:text-slate-600 focus:ring-0 dark:text-slate-400 dark:hover:bg-slate-700/50'}
			onclick={openNativePicker}
			title={task.dueDate ? 'Fälligkeit anpassen' : 'Fälligkeit setzen'}
		>
			<Calendar size={13} class="pointer-events-none" />

			{#if task.dueDate}
				<span class="pointer-events-none tracking-wide">{formatDate(task.dueDate)}</span>
			{/if}

			<input
				type="date"
				class="sr-only"
				tabindex="-1"
				value={isoToDateInputValue(task.dueDate)}
				onchange={updateInternalDate}
				onclick={(event) => event.stopPropagation()}
			/>
		</button>
	</div>
</div>