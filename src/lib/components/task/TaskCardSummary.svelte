<script lang="ts">
	import { localDateInputToIso, isoToDateInputValue } from '$lib/domain/dates';
	import { filterReviewSubtasks, getPendingSubtasks } from '$lib/domain/subtasks';
	import { store } from '$lib/stores/tasks';
	import type { Task, TeamMember } from '$lib/types';
	import { cn, formatDate } from '$lib/utils';
	import { Calendar, ChevronDown, Flag, ListTodo, Plus, Zap } from 'lucide-svelte';
	import TaggedText from '$lib/components/text/TaggedText.svelte';

	interface Props {
		task: Task;
		team: TeamMember[];
		isOwner: boolean;
		ownerShortsign: string;
		isStale: boolean;
		onOpen: () => void;
	}

	let { task, team, isOwner, ownerShortsign, isStale, onOpen }: Props = $props();
	let dragging = $state(false);
	let newSubtaskTitle = $state('');
	let isEditingRef = $state(false);
	let editRefBuffer = $state('');

	let pendingSubtasks = $derived(getPendingSubtasks(task.subtasks));
	let isMicroReview = $derived(
		!isOwner && task.status !== 'REVIEW' && filterReviewSubtasks(task.subtasks).length > 0
	);
	let activeTopLevelSubtasks = $derived(task.subtasks.filter((subtask) => !subtask.archived));
	let completedCount = $derived(activeTopLevelSubtasks.filter((subtask) => subtask.done).length);

	function handleAddSubtask(): void {
		const title = newSubtaskTitle.trim();
		if (!title) return;
		void store.addSubtask(task.id, title);
		newSubtaskTitle = '';
	}

	function startEditRef(): void {
		editRefBuffer = task.matterRef ?? '';
		isEditingRef = true;
		setTimeout(() => document.getElementById(`edit-ref-${task.id}`)?.focus(), 10);
	}

	function saveEditRef(): void {
		if (editRefBuffer !== (task.matterRef ?? '')) void store.updateTaskRef(task.id, editRefBuffer);
		isEditingRef = false;
	}

	function onDragStart(event: DragEvent): void {
		const target = event.target as HTMLElement;
		if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName)) {
			event.preventDefault();
			return;
		}
		event.dataTransfer?.setData('text/plain', task.id);
		dragging = true;
	}

	function openNativePicker(event: MouseEvent): void {
		event.stopPropagation();
		const input = (event.currentTarget as HTMLElement).querySelector<HTMLInputElement>(
			'input[type="date"]'
		);
		if (!input) return;
		try {
			input.showPicker();
		} catch {
			input.focus();
			input.click();
		}
	}

	function updateCourtDate(event: Event): void {
		const value = (event.currentTarget as HTMLInputElement).value;
		void store.toggleFlag(task.id, value ? localDateInputToIso(value) : null);
	}

	function updateInternalDate(event: Event): void {
		const value = (event.currentTarget as HTMLInputElement).value;
		void store.updateDate(task.id, value ? localDateInputToIso(value) : '');
	}
</script>

<div
	id={`case-card-${task.id}`}
	class={cn(
		'group relative flex h-fit w-full cursor-move flex-col gap-1.5 overflow-hidden rounded-xl p-2.5 transition-shadow duration-200',
		task.status === 'DONE'
			? 'border border-slate-200 bg-slate-50 opacity-60 shadow-none ring-0 grayscale dark:border-slate-700 dark:bg-slate-800/50'
			: task.priority === 'HIGH'
				? 'border-transparent bg-white shadow-[0_0_15px_rgba(239,68,68,0.3)] ring-2 ring-red-500 dark:bg-slate-800'
				: isStale
					? 'border-transparent bg-white ring-2 shadow-brand-500/10 ring-brand-600 dark:bg-slate-800 dark:ring-brand-500'
					: 'border border-slate-200 bg-white shadow-sm hover:shadow-md dark:border-slate-700 dark:bg-slate-800',
		dragging && 'opacity-50'
	)}
	style:break-inside="avoid"
	role="listitem"
	draggable="true"
	ondragstart={onDragStart}
	ondragend={() => (dragging = false)}
>
	<div
		class="flex w-full min-w-0 items-center justify-between gap-1 outline-none"
		role="button"
		tabindex="0"
		onclick={onOpen}
		onkeydown={(event) => event.key === 'Enter' && onOpen()}
	>
		<div class="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
			{#if isEditingRef}
				<input
					id={`edit-ref-${task.id}`}
					type="text"
					bind:value={editRefBuffer}
					onblur={saveEditRef}
					onkeydown={(event) => {
						if (event.key === 'Enter') {
							event.preventDefault();
							saveEditRef();
						}
					}}
					class="w-[75px] shrink-0 rounded border border-brand-500 bg-white px-1.5 py-0.5 text-left text-[10px] font-bold tracking-wider text-slate-900 uppercase focus:outline-none dark:bg-slate-800 dark:text-slate-100"
					onclick={(event) => event.stopPropagation()}
				/>
			{:else}
				<button
					class="block w-fit max-w-[75px] shrink-0 cursor-text truncate rounded bg-slate-100 px-1.5 py-0.5 text-left text-[10px] font-bold tracking-wider text-slate-600 uppercase transition-colors hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
					onclick={(event) => {
						event.stopPropagation();
						startEditRef();
					}}
					title="Referenz bearbeiten"
				>
					{task.matterRef || 'NO-REF'}
				</button>
			{/if}

			{#if !isOwner}
				<span
					class="shrink-0 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-600 uppercase dark:bg-brand-900/30 dark:text-brand-400"
				>
					{ownerShortsign}
				</span>
			{/if}

			{#if task.priority === 'HIGH' && task.status !== 'DONE'}
				<Zap
					size={12}
					class="shrink-0 fill-red-500 text-red-500 drop-shadow-[0_0_3px_rgba(239,68,68,0.5)]"
				/>
			{/if}
		</div>
		<div class="flex shrink-0 items-center gap-1 text-slate-400">
			<div
				class="flex h-6 w-6 shrink-0 items-center justify-center rounded transition-colors hover:bg-slate-100 dark:hover:bg-slate-700/50"
			>
				<ChevronDown size={16} />
			</div>
		</div>
	</div>

	<button
		type="button"
		class="flex w-full min-w-0 flex-grow flex-col overflow-hidden text-left"
		onclick={onOpen}
	>
		<span
			class="line-clamp-3 w-full min-w-0 text-sm font-medium [overflow-wrap:anywhere] break-words whitespace-normal"
		>
			<TaggedText text={task.title} {team} />
		</span>
	</button>

	{#if !isMicroReview}
		<div
			class="mt-1 flex min-h-[28px] w-full min-w-0 cursor-text items-start gap-1.5 rounded border border-slate-200 bg-slate-50 px-1.5 py-1 transition-colors focus-within:border-brand-500 focus-within:bg-white hover:border-brand-300 dark:border-slate-700/50 dark:bg-slate-900/50 dark:focus-within:bg-slate-800"
		>
			<Plus size={11} class="mt-0.5 shrink-0 text-slate-400" />
			<textarea
				id={`quick-add-${task.id}`}
				bind:value={newSubtaskTitle}
				placeholder="Task hinzufügen..."
				class="m-0 w-full min-w-0 flex-1 resize-none overflow-hidden border-none bg-transparent p-0 text-[11px] leading-snug text-slate-700 outline-none placeholder:text-slate-400 focus:ring-0 dark:text-slate-300"
				rows="1"
				oninput={(event) => {
					event.currentTarget.style.height = 'auto';
					event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
				}}
				onkeydown={(event) => {
					if (event.key === 'Enter' && !event.shiftKey) {
						event.preventDefault();
						event.stopPropagation();
						handleAddSubtask();
						event.currentTarget.style.height = 'auto';
					}
				}}
			></textarea>
		</div>
	{/if}

	{#if pendingSubtasks.length > 0}
		<div class="mt-1.5 mb-1 flex w-full min-w-0 flex-col gap-1">
			{#each pendingSubtasks as subtask (subtask.id)}
				<button
					class="group/mini flex w-full min-w-0 items-start gap-2 overflow-hidden rounded px-1.5 py-1.5 text-left transition-colors outline-none hover:bg-slate-100 focus:ring-1 focus:ring-brand-500 dark:hover:bg-slate-700/50"
					onclick={(event) => {
						event.stopPropagation();
						void store.toggleSubtask(task.id, subtask.id);
					}}
					title={subtask.title}
				>
					<span
						class="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-slate-300 transition-colors group-hover/mini:border-brand-500 dark:border-slate-500"
					></span>
					<span
						class="min-w-0 flex-1 text-xs leading-snug [overflow-wrap:anywhere] break-words whitespace-normal text-slate-700 dark:text-slate-300"
						>{subtask.title}</span
					>
					{#if subtask.reviewState === 'REQUESTED'}
						<span
							class="mt-0.5 ml-auto shrink-0 rounded bg-purple-100 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-purple-700 uppercase"
							>Rev</span
						>
					{:else if subtask.reviewState === 'REVISION'}
						<span
							class="mt-0.5 ml-auto shrink-0 rounded bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-rose-700 uppercase"
							>!</span
						>
					{/if}
				</button>
			{/each}
		</div>
	{/if}

	<div
		class="mt-auto flex w-full min-w-0 flex-nowrap items-center justify-between gap-1 border-t border-slate-100 pt-2 dark:border-slate-700/50"
	>
		<div class="flex shrink-0 items-center gap-1.5 text-xs font-bold text-slate-400">
			<ListTodo size={13} />
			{completedCount}/{activeTopLevelSubtasks.length}
		</div>
		<div class="ml-auto flex min-w-0 shrink-0 flex-nowrap items-center justify-end gap-1">
			<button
				type="button"
				class={task.flaggedDate
					? 'relative flex h-6 shrink-0 items-center justify-center gap-1 rounded border border-rose-300 bg-rose-100 px-1.5 text-rose-700 transition-colors outline-none hover:bg-rose-200 focus:ring-0 dark:border-slate-700 dark:bg-rose-900/50 dark:text-rose-400'
					: 'relative flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 transition-colors outline-none hover:bg-slate-100 hover:text-rose-500 focus:ring-0 dark:hover:bg-slate-700/50'}
				onclick={openNativePicker}
				title={task.flaggedDate ? 'Gerichtstermin anpassen' : 'Gerichtstermin setzen'}
			>
				<Flag size={13} class="pointer-events-none shrink-0" />
				{#if task.flaggedDate}<span
						class="pointer-events-none shrink-0 text-xs font-bold tracking-tight whitespace-nowrap"
						>{formatDate(task.flaggedDate)}</span
					>{/if}
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
					? 'relative flex h-6 shrink-0 items-center gap-1 rounded text-xs font-bold text-slate-600 transition-colors outline-none hover:bg-slate-100 hover:text-slate-800 focus:ring-0 dark:text-slate-300 dark:hover:bg-slate-700/50'
					: 'relative flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 transition-colors outline-none hover:bg-slate-100 hover:text-slate-600 focus:ring-0 dark:hover:bg-slate-700/50'}
				onclick={openNativePicker}
				title={task.dueDate ? 'Fälligkeit anpassen' : 'Fälligkeit setzen'}
			>
				<Calendar size={13} class="pointer-events-none shrink-0" />
				{#if task.dueDate}<span
						class="pointer-events-none shrink-0 text-xs tracking-tight whitespace-nowrap"
						>{formatDate(task.dueDate)}</span
					>{/if}
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
</div>
