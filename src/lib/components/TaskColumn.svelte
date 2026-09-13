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
	const PADDING = 24;

	let automaticColumnCount = $derived.by(() => {
		if (!containerWidth) return 1;

		const available = containerWidth - PADDING;
		const count = Math.floor((available + GAP) / (MIN_COL_WIDTH + GAP));

		return Math.max(1, count);
	});

	let columnCount = $derived(
		columns === undefined ? automaticColumnCount : Math.max(1, Math.floor(columns))
	);

	// Verteilt Aufgaben immer in die momentan niedrigste Spalte.
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

			const pendingSubs = (task.subtasks || []).filter(
				(subtask) => !subtask.done && !subtask.archived
			).length;

			const estimatedHeight = 120 + pendingSubs * 28;
			colHeights[minColIdx] += estimatedHeight + GAP;
		}

		return cols;
	}

	let distributedColumns = $derived(distributeTasks(tasks, columnCount));

	function onDragOver(event: DragEvent): void {
		event.preventDefault();

		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'move';
		}
	}

	function onDrop(event: DragEvent): void {
		event.preventDefault();

		const taskId = event.dataTransfer?.getData('text/plain');
		if (taskId) {
			void store.moveTask(taskId, id);
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
		class="mb-2 flex min-w-0 shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-2 pb-3 xl:px-3 2xl:px-4 dark:border-slate-800/50"
	>
		<h3
			class="flex min-w-0 items-center gap-1.5 text-xs leading-tight font-bold text-slate-800 xl:gap-2 xl:text-sm 2xl:gap-2.5 2xl:text-base dark:text-slate-100"
		>
			<div
				class={`h-2.5 w-2.5 shrink-0 rounded-full shadow-sm 2xl:h-3 2xl:w-3 ${color}`}
			></div>
			<span>{title}</span>
		</h3>

		<span
			class="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700 2xl:px-2.5 2xl:text-xs dark:bg-slate-700 dark:text-slate-300"
		>
			{tasks.length}
		</span>
	</div>

	<div
		bind:clientWidth={containerWidth}
		class="custom-scrollbar flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto"
	>
		<div class="flex w-full items-start gap-3 px-3 pt-1">
			{#each distributedColumns as col, colIdx (colIdx)}
				<div class="flex min-w-0 flex-1 flex-col gap-3">
					{#each col as task (task.id)}
						<TaskCard {task} />
					{/each}
				</div>
			{/each}
		</div>

		<div class="mt-auto px-3 pt-3 pb-4">
			<div
				role="region"
				aria-label="Drop-Zone Puffer"
				class="min-h-[4rem] w-full shrink-0 rounded-xl border-2 border-dashed border-transparent opacity-50 transition-colors"
				ondragenter={(event) =>
					event.currentTarget.classList.add('border-slate-300', 'dark:border-slate-700')}
				ondragleave={(event) =>
					event.currentTarget.classList.remove('border-slate-300', 'dark:border-slate-700')}
				ondrop={(event) =>
					event.currentTarget.classList.remove('border-slate-300', 'dark:border-slate-700')}
			></div>
		</div>
	</div>
</div>