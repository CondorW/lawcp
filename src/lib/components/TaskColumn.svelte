<script lang="ts">
	import { store } from '$lib/stores/tasks';
	import type { Task } from '$lib/types';
	import TaskCard from './TaskCard.svelte';

	let {
		title,
		id,
		tasks,
		color = 'bg-slate-400',
		columns
	}: {
		title: string;
		id: Task['status'];
		tasks: Task[];
		color?: string;
		columns?: number;
	} = $props();

	let containerWidth = $state(0);

	const MIN_COL_WIDTH = 185;
	const GAP = 12;
	const PADDING = 24; // px-3 (12px links + 12px rechts)

	// Berechnet die optimale Spaltenanzahl dynamisch anhand der Container-Breite
	let automaticColumnCount = $derived.by(() => {
		if (!containerWidth) return 1;
		const available = containerWidth - PADDING;
		const count = Math.floor((available + GAP) / (MIN_COL_WIDTH + GAP));
		return Math.max(1, count);
	});
	let columnCount = $derived(
		columns === undefined ? automaticColumnCount : Math.max(1, Math.floor(columns))
	);

	// Höhenbewusster Greedy-Algorithmus: Verteilt Aufgaben in die jeweils niedrigste Spalte
	function distributeTasks(taskList: Task[], colCount: number): Task[][] {
		if (colCount <= 1) return [taskList];

		const cols: Task[][] = Array.from({ length: colCount }, () => []);
		const colHeights: number[] = new Array(colCount).fill(0);

		for (const task of taskList) {
			let minColIdx = 0;
			let minHeight = colHeights[0];

			for (let i = 1; i < colCount; i++) {
				if (colHeights[i] < minHeight) {
					minHeight = colHeights[i];
					minColIdx = i;
				}
			}

			cols[minColIdx].push(task);

			// Geschätzte Höhe: Basishöhe (Header/Footer/Quick-Add ~120px) + 28px pro offener Subtask
			const pendingSubs = (task.subtasks || []).filter((s) => !s.done && !s.archived).length;
			const estimatedHeight = 120 + pendingSubs * 28;
			colHeights[minColIdx] += estimatedHeight + GAP;
		}

		return cols;
	}

	let distributedColumns = $derived(distributeTasks(tasks, columnCount));

	function onDragOver(e: DragEvent) {
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		const taskId = e.dataTransfer?.getData('text/plain');
		if (taskId) {
			store.moveTask(taskId, id);
		}
	}
</script>

<div
	class="flex h-full min-h-0 w-full flex-col pt-4"
	role="list"
	ondragover={onDragOver}
	ondrop={onDrop}
>
	<div
		class="mb-2 flex shrink-0 items-center justify-between border-b border-slate-100 px-4 pb-3 dark:border-slate-800/50"
	>
		<h3 class="flex items-center gap-2.5 text-base font-bold text-slate-800 dark:text-slate-100">
			<div class={`h-3 w-3 rounded-full shadow-sm ${color}`}></div>
			{title}
		</h3>
		<span
			class="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-300"
		>
			{tasks.length}
		</span>
	</div>

	<div
		bind:clientWidth={containerWidth}
		class="custom-scrollbar flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto"
	>
		<!-- Masonry Spaltenverbund: Keine Grid-Zeilen, vollständige vertikale Füllung -->
		<div class="flex w-full items-start gap-3 px-3 pt-1">
			{#each distributedColumns as col, colIdx (colIdx)}
				<div class="flex min-w-0 flex-1 flex-col gap-3">
					{#each col as task (task.id)}
						<TaskCard {task} />
					{/each}
				</div>
			{/each}
		</div>

		<!-- Drop-Zone am unteren Ende -->
		<div class="mt-auto px-3 pt-3 pb-4">
			<div
				role="region"
				aria-label="Drop-Zone Puffer"
				class="min-h-[4rem] w-full shrink-0 rounded-xl border-2 border-dashed border-transparent opacity-50 transition-colors"
				ondragenter={(e) =>
					e.currentTarget.classList.add('border-slate-300', 'dark:border-slate-700')}
				ondragleave={(e) =>
					e.currentTarget.classList.remove('border-slate-300', 'dark:border-slate-700')}
				ondrop={(e) =>
					e.currentTarget.classList.remove('border-slate-300', 'dark:border-slate-700')}
			></div>
		</div>
	</div>
</div>
