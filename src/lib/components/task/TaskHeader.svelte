<script lang="ts">
	import { store } from '$lib/stores/tasks';
	import type { Task } from '$lib/types';
	import { Trash2, BrainCircuit } from 'lucide-svelte';

	// Svelte 5: Props & State
	let { task }: { task: Task } = $props();
	let isEditingRef = $state(false);
	let editRefBuffer = $state('');

	function startEditRef() {
		editRefBuffer = task.matterRef || '';
		isEditingRef = true;
		setTimeout(() => document.getElementById(`edit-ref-${task.id}`)?.focus(), 10);
	}

	function saveEditRef() {
		if (editRefBuffer !== task.matterRef) {
			store.updateTaskRef(task.id, editRefBuffer);
		}
		isEditingRef = false;
	}
</script>

<div class="flex items-center gap-1 h-7">
	
	{#if isEditingRef}
		<input
			id={`edit-ref-${task.id}`}
			type="text"
			bind:value={editRefBuffer}
			onblur={saveEditRef}
			onkeydown={(e) => e.key === 'Enter' && saveEditRef()}
			class="h-7 text-[11px] font-bold px-2 rounded border uppercase w-24 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-gray-300 dark:border-slate-600 flex items-center"
			placeholder="REF"
		/>
	{:else}
		<button
			onclick={(e) => { e.stopPropagation(); startEditRef(); }}
			class="h-7 px-2 flex items-center justify-center text-[11px] font-bold rounded border uppercase tracking-wider text-slate-500 bg-slate-50 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600 max-w-[100px] truncate hover:text-amber-600 transition-colors outline-none"
		>
			{task.matterRef || 'NO-REF'}
		</button>
	{/if}

	{#if task.matterRef}
		<button
			onclick={(e) => { e.stopPropagation(); store.openMatterNotes(task.matterRef!); }}
			class="w-7 h-7 flex items-center justify-center rounded hover:bg-purple-100 dark:hover:bg-purple-900/30 hover:text-purple-600 text-slate-400 transition-colors outline-none focus:ring-0"
			title="Akten-Notizen öffnen"
		>
			<BrainCircuit size={14} />
		</button>
	{/if}

	<button
		onclick={(e) => { e.stopPropagation(); store.deleteTask(task.id); }}
		class="w-7 h-7 flex items-center justify-center rounded hover:bg-red-100 dark:hover:bg-red-900/20 hover:text-red-600 text-slate-300 opacity-0 group-hover:opacity-100 transition-all outline-none focus:ring-0"
		title="Aufgabe löschen"
	>
		<Trash2 size={14} />
	</button>

</div>