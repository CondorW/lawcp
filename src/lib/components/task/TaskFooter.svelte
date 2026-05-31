<script lang="ts">
	import { store } from '$lib/stores/tasks';
	import { pb } from '$lib/pocketbase';
	import type { Task } from '$lib/types';
	import { Calendar, Flag, BrainCircuit, Trash2, Archive, ArchiveRestore } from 'lucide-svelte';
	import { formatDate } from '$lib/utils';

	interface Props { task: Task; isOwner: boolean; ownerShortsign: string; isExpanded?: boolean; }
	let { task, isOwner, ownerShortsign, isExpanded = false }: Props = $props();

	function openNativePicker(e: MouseEvent) {
		e.stopPropagation();
		const btn = e.currentTarget as HTMLElement;
		const input = btn.querySelector('input[type="date"]') as HTMLInputElement;
		if (input) {
			try { input.showPicker(); } 
			catch (err) { input.focus(); input.click(); }
		}
	}

	async function updateCourtDate(e: Event) {
		const target = e.target as HTMLInputElement;
		const newDate = target.value ? new Date(target.value).toISOString() : null;
		try { await pb.collection('tasks').update(task.id, { flaggedDate: newDate }); } 
		catch (err) { console.error(err); }
	}

	async function updateInternalDate(e: Event) {
		const target = e.target as HTMLInputElement;
		const newDate = target.value ? new Date(target.value).toISOString() : null;
		try { await pb.collection('tasks').update(task.id, { dueDate: newDate }); } 
		catch (err) { console.error(err); }
	}
</script>

<div class="flex flex-row items-center justify-between flex-grow min-w-0 pr-0.5 h-6">
	<div class="flex flex-row items-center gap-1 h-full">
		{#if task.matterRef}
			<button type="button" onclick={(e) => { e.stopPropagation(); store.openMatterNotes(task.matterRef!); }} class="w-6 h-6 flex items-center justify-center rounded hover:bg-purple-50 dark:hover:bg-purple-900/30 hover:text-purple-600 text-slate-400 transition-colors outline-none focus:ring-0 shrink-0" title="Akten-Notizen öffnen">
				<BrainCircuit size={14} class="pointer-events-none" />
			</button>
		{/if}
	</div>

	<div class="flex flex-row items-center gap-1 h-full shrink-0">
		<button type="button" onclick={(e) => { e.stopPropagation(); store.archiveTask(task.id, !task.archived); }} class="w-6 h-6 flex items-center justify-center rounded hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:text-brand-600 text-slate-400 transition-all outline-none focus:ring-0 shrink-0" title={task.archived ? "Wiederherstellen" : "Archivieren"}>
			{#if task.archived}<ArchiveRestore size={14} class="pointer-events-none" />{:else}<Archive size={14} class="pointer-events-none" />{/if}
		</button>
		
		<button type="button" onclick={(e) => { e.stopPropagation(); store.deleteTask(task.id); }} class="w-6 h-6 flex items-center justify-center rounded hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-600 text-slate-400 transition-all outline-none focus:ring-0 shrink-0" title="Löschen">
			<Trash2 size={14} class="pointer-events-none" />
		</button>

		<button type="button" class={task.flaggedDate ? "relative h-6 px-1.5 bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-400 rounded border border-rose-300 dark:border-rose-700 text-[10px] font-bold flex items-center justify-center tracking-wide hover:bg-rose-200 transition-colors outline-none focus:ring-0 shrink-0" : "relative w-6 h-6 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-rose-500 transition-colors rounded outline-none focus:ring-0 shrink-0"} onclick={openNativePicker} title={task.flaggedDate ? "Gerichtstermin anpassen" : "Gerichtstermin setzen"}>
			{#if task.flaggedDate}
				<span class="pointer-events-none">{formatDate(task.flaggedDate)}</span>
			{:else}
				<Flag size={14} class="pointer-events-none" />
			{/if}
			<input type="date" class="sr-only" tabindex="-1" value={task.flaggedDate ? task.flaggedDate.split('T')[0] : ''} onchange={updateCourtDate} onclick={(e) => e.stopPropagation()} />
		</button>

		<button type="button" class={task.dueDate ? "relative h-6 px-1.5 flex items-center gap-1 rounded font-medium text-slate-600 dark:text-slate-300 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors outline-none focus:ring-0 shrink-0" : "relative w-6 h-6 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-600 transition-colors rounded outline-none focus:ring-0 shrink-0"} onclick={openNativePicker} title={task.dueDate ? "Fälligkeit anpassen" : "Fälligkeit setzen"}>
			{#if task.dueDate}
				<Calendar size={14} class="pointer-events-none" />
				<span class="text-[10px] font-medium tracking-wide pointer-events-none">{formatDate(task.dueDate)}</span>
			{:else}
				<Calendar size={14} class="pointer-events-none" />
			{/if}
			<input type="date" class="sr-only" tabindex="-1" value={task.dueDate ? task.dueDate.split('T')[0] : ''} onchange={updateInternalDate} onclick={(e) => e.stopPropagation()} />
		</button>
	</div>
</div>