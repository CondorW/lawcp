<script lang="ts">
	import {
		isoToDateInputValue,
		localDateInputToIso,
		toLocalDateInputValue
	} from '$lib/domain/dates';
	import type { Task } from '$lib/types';
	import { fade, scale } from 'svelte/transition';
	import { Pencil, Plus, X } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { getRecommendedNotes, type EnrichedTimeLog, type TimeLogFormValue } from './billing';

	interface Props {
		tasks: Task[];
		editLog?: EnrichedTimeLog | null;
		onClose: () => void;
		onSave: (value: TimeLogFormValue) => void;
	}

	let { tasks, editLog = null, onClose, onSave }: Props = $props();
	let taskId = $state('');
	let date = $state(toLocalDateInputValue());
	let minutes = $state(15);
	let note = $state('');

	let selectedTask = $derived(tasks.find((task) => task.id === taskId));
	let recommendedNotes = $derived(getRecommendedNotes(selectedTask));

	onMount(() => {
		taskId = editLog?.taskId ?? '';
		date = editLog ? isoToDateInputValue(editLog.date) : toLocalDateInputValue();
		minutes = editLog?.minutes ?? 15;
		note = editLog?.note ?? '';
	});

	function appendToNote(text: string): void {
		note = note ? `${note}\n- ${text}` : `- ${text}`;
	}

	function save(): void {
		if (!taskId || !Number.isFinite(minutes) || minutes <= 0 || !date) return;
		onSave({
			logId: editLog?.id,
			taskId,
			minutes,
			note: note.trim(),
			date: localDateInputToIso(date)
		});
	}
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && onClose()} />

<div
	class="fixed inset-0 z-[9999] flex items-center justify-center p-4"
	role="dialog"
	aria-modal="true"
	aria-label={editLog ? 'Zeit bearbeiten' : 'Zeit buchen'}
	transition:fade={{ duration: 150 }}
>
	<button
		type="button"
		class="absolute inset-0 h-full w-full bg-slate-900/40 backdrop-blur-sm"
		onclick={onClose}
		aria-label="Dialog schließen"
	></button>
	<div
		class="relative w-full max-w-lg space-y-6 rounded-xl border border-slate-200 bg-white p-8 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
		transition:scale={{ duration: 200, start: 0.95 }}
	>
		<header
			class="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800"
		>
			<h3 class="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-white">
				{#if editLog}<Pencil size={20} class="text-brand-600" /> Zeit bearbeiten
				{:else}<Plus size={20} class="text-brand-600" /> Zeit buchen{/if}
			</h3>
			<button
				onclick={onClose}
				class="text-slate-400 outline-none hover:text-slate-600 dark:hover:text-slate-200"
				aria-label="Dialog schließen"><X size={24} /></button
			>
		</header>

		<div class="space-y-5">
			<div>
				<label for="taskSelect" class="mb-2 block text-xs font-bold text-slate-500 uppercase"
					>Für welche Aufgabe?</label
				>
				<select
					id="taskSelect"
					bind:value={taskId}
					disabled={Boolean(editLog)}
					class="w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
				>
					<option value="" disabled>Bitte wählen...</option>
					{#each tasks as task (task.id)}<option value={task.id}
							>[{task.matterRef || 'NO-REF'}] {task.title}</option
						>{/each}
				</select>
			</div>

			<div class="grid grid-cols-2 gap-5">
				<div>
					<label for="logDateInput" class="mb-2 block text-xs font-bold text-slate-500 uppercase"
						>Datum</label
					>
					<input
						id="logDateInput"
						type="date"
						bind:value={date}
						class="w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:[color-scheme:dark]"
					/>
				</div>
				<div>
					<label for="logMinutesInput" class="mb-2 block text-xs font-bold text-slate-500 uppercase"
						>Dauer (Minuten)</label
					>
					<input
						id="logMinutesInput"
						type="number"
						bind:value={minutes}
						min="1"
						class="w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
					/>
				</div>
			</div>

			<div class="flex gap-3">
				{#each [15, 30, 60] as amount (amount)}
					<button
						onclick={() => (minutes = amount)}
						class="flex-1 rounded-lg border border-slate-200 bg-slate-100 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
						>{amount === 60 ? '+1h' : `+${amount}m`}</button
					>
				{/each}
			</div>

			<div>
				<label for="logNoteInput" class="mb-2 block text-xs font-bold text-slate-500 uppercase"
					>Tätigkeit / Bemerkung</label
				>
				<textarea
					id="logNoteInput"
					bind:value={note}
					rows="3"
					class="w-full resize-none rounded-lg border border-slate-300 p-3 text-sm leading-relaxed text-slate-900 outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
					placeholder="Was wurde gemacht?"
				></textarea>

				{#if recommendedNotes.length > 0 && !editLog}
					<div class="mt-4">
						<span
							class="mb-2 block text-xs font-bold tracking-wider text-emerald-600 uppercase dark:text-emerald-500"
							>Ausgeführte Teilschritte:</span
						>
						<div class="flex flex-wrap gap-2">
							{#each recommendedNotes as recommendation, index (`${index}:${recommendation}`)}
								<button
									type="button"
									onclick={() => appendToNote(recommendation)}
									class="max-w-full truncate rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-left text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40"
									>+ {recommendation}</button
								>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>

		<footer class="flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
			<button
				onclick={onClose}
				class="rounded-lg bg-slate-100 px-5 py-2.5 text-sm font-bold text-slate-600 transition-colors outline-none hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
				>Abbrechen</button
			>
			<button
				onclick={save}
				disabled={!taskId || minutes <= 0 || !date}
				class="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-colors outline-none hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
				>Speichern</button
			>
		</footer>
	</div>
</div>
