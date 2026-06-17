<script lang="ts">
	import { store } from '$lib/stores/tasks';
	import type { Task } from '$lib/types';
	import TaskCard from './TaskCard.svelte';

	let { title, id, tasks, color = 'bg-slate-400' }: { title: string, id: Task['status'], tasks: Task[], color?: string } = $props();

	function onDragOver(e: DragEvent) {
		e.preventDefault();
		if(e.dataTransfer) e.dataTransfer.dropEffect = 'move';
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		const taskId = e.dataTransfer?.getData('text/plain');
		if (taskId) {
			store.moveTask(taskId, id);
		}
	}
</script>

<div class="flex flex-col h-full min-h-0 w-full pt-4" role="list" ondragover={onDragOver} ondrop={onDrop}>
	<div class="flex items-center justify-between px-4 pb-3 shrink-0 border-b border-slate-100 dark:border-slate-800/50 mb-2">
		<h3 class="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2.5">
			<div class={`w-3 h-3 rounded-full shadow-sm ${color}`}></div>
			{title}
		</h3>
		<span class="rounded-full bg-slate-200 dark:bg-slate-700 px-2.5 py-0.5 text-xs font-bold text-slate-700 dark:text-slate-300">
			{tasks.length}
		</span>
	</div>

	<!-- flex flex-col hinzugefügt, damit die Dropzone mt-auto nutzen kann -->
	<div class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar flex flex-col">
		
		<!-- CSS Columns (Masonry Layout): Keine Grid-Zeilen, Karten fließen nahtlos ineinander -->
		<div class="columns-[185px] gap-3 px-3 pt-1 w-full">
			{#each tasks as task (task.id)}
				<div class="break-inside-avoid block w-full mb-3">
					<TaskCard {task} />
				</div>
			{/each}
		</div>

		<!-- FIX: Die Drop-Zone wurde AUS dem Masonry-Grid herausgeschoben. 
		     Dadurch verbraucht sie keine Spalte mehr und verursacht keine Löcher! -->
		<div class="px-3 pb-4 mt-auto">
			<div 
				role="region" 
				aria-label="Drop-Zone Puffer" 
				class="w-full min-h-[4rem] border-2 border-transparent border-dashed rounded-xl transition-colors opacity-50 shrink-0" 
				ondragenter={(e) => e.currentTarget.classList.add('border-slate-300', 'dark:border-slate-700')} 
				ondragleave={(e) => e.currentTarget.classList.remove('border-slate-300', 'dark:border-slate-700')} 
				ondrop={(e) => e.currentTarget.classList.remove('border-slate-300', 'dark:border-slate-700')}
			></div>
		</div>
	</div>
</div>