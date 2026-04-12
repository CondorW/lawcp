<script lang="ts">
	import { store } from '$lib/stores/tasks';
	import { pb } from '$lib/pocketbase';
	import type { Task, SubtaskType, Subtask } from '$lib/types';
	import { cn } from '$lib/utils';
	import { ChevronDown, ChevronUp, ListTodo, Eye } from 'lucide-svelte';

	import TaskTitle from './task/TaskTitle.svelte';
	import SubtaskItem from './task/SubtaskItem.svelte';
	import TaskFooter from './task/TaskFooter.svelte';

	export let task: Task;

	const myId = pb.authStore.model?.id || '';
	const isOwner = task.owner === myId || (task.assignees && task.assignees.includes(myId));
	const ownerShortsign = task.expand?.owner?.shortsign || '?';
	const isTeamLeader = !pb.authStore.model?.teamLeader;

	$: currentAssignee = task.assignees && task.assignees.length > 0 ? task.assignees[0] : '';

	let dragging = false;
	let newSubtaskTitle = '';
	let newSubtaskType: SubtaskType = 'GENERIC';
	let isExpanded = false;

	function filterReviewSubtasks(subs: Subtask[]): Subtask[] {
		if (!subs) return [];
		return subs.reduce((acc, sub) => {
			const filteredChildren = filterReviewSubtasks(sub.subtasks || []);
			if (sub.reviewState === 'REQUESTED' || filteredChildren.length > 0) {
				acc.push({ ...sub, subtasks: filteredChildren });
			}
			return acc;
		}, [] as Subtask[]);
	}

	$: isMicroReviewForTL = !isOwner && task.status !== 'REVIEW' && filterReviewSubtasks(task.subtasks || []).length > 0;
	
	$: displaySubtasks = isMicroReviewForTL 
		? filterReviewSubtasks(task.subtasks || []) 
		: (task.subtasks || []);

	function handleAddSubtask() {
		if (!newSubtaskTitle.trim()) return;
		store.addSubtask(task.id, newSubtaskTitle, newSubtaskType);
		newSubtaskTitle = '';
	}

	function assignTo(userId: string) {
		if (currentAssignee === userId) return;
		store.assignTask(task.id, userId);
	}

	function onDragStart(e: DragEvent) {
		const target = e.target as HTMLElement;
		if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName)) {
			e.preventDefault();
			return;
		}
		e.dataTransfer?.setData('text/plain', task.id);
		dragging = true;
	}

	function toggleExpand(e: MouseEvent | KeyboardEvent) {
		const target = e.target as HTMLElement;
		// FIX: Erlaubt den Klick, wenn er vom Chevron-Button kommt
		if (target.closest('.expand-chevron')) {
			isExpanded = !isExpanded;
			return;
		}
		if (['INPUT', 'BUTTON', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.closest('button')) return;
		isExpanded = !isExpanded;
	}
</script>

<div
	role="listitem"
	class={cn(
		"group relative flex flex-col gap-2 rounded-xl border p-2.5 shadow-sm transition-all cursor-move bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:shadow-md",
		task.status === 'DONE' && "bg-gray-50 dark:bg-slate-800/50 opacity-60 grayscale",
		dragging && "opacity-50",
		!isOwner && "border-amber-200 dark:border-amber-900/30"
	)}
	draggable="true"
	ondragstart={onDragStart}
	ondragend={() => dragging = false}
>
	<div 
		role="button" 
		tabindex="0" 
		class="outline-none w-full"
		onclick={toggleExpand}
		onkeydown={(e) => e.key === 'Enter' && toggleExpand(e as KeyboardEvent)}
	>
		<div class={cn("w-full transition-all", !isExpanded ? "truncate" : "whitespace-normal break-words leading-snug")}>
			<TaskTitle {task} />
		</div>

		{#if !isExpanded && task.subtasks && task.subtasks.length > 0}
			<div class="flex items-center gap-2 pt-1.5 mt-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
				<ListTodo size={12} />
				{task.subtasks.filter(s => s.done).length} / {task.subtasks.length} Subtasks
				{#if isMicroReviewForTL}
					<span class="ml-auto flex items-center gap-1 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 px-1.5 py-0.5 rounded"><Eye size={10} /> REVIEW OFFEN</span>
				{:else if task.subtasks.some(s => s.reviewState === 'REVISION')}
					<span class="ml-auto flex items-center gap-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded">KORREKTUR</span>
				{:else if task.subtasks.some(s => s.reviewState === 'APPROVED')}
					<span class="ml-auto flex items-center gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-1.5 py-0.5 rounded">FREIGEGEBEN</span>
				{/if}
			</div>
		{/if}
	</div>

	{#if isExpanded}
		<div class="space-y-2 my-1 border-t border-gray-100 dark:border-slate-700 pt-3 animate-in fade-in slide-in-from-top-2 duration-200">
			{#if isOwner && isTeamLeader}
				<div class="flex items-center gap-2 mb-3">
					<span class="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">An:</span>
					<div class="flex flex-wrap gap-1.5">
						<button onclick={() => assignTo('')} class={cn("px-2 py-0.5 text-xs font-bold rounded border transition-all shadow-sm", currentAssignee === '' ? "bg-amber-100 text-amber-800 border-amber-300" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50")}>ME</button>
						{#each $store.firmUsers as user}
							{#if user.id !== myId && user.shortsign}
								<button onclick={() => assignTo(user.id)} class={cn("px-2 py-0.5 text-xs font-bold rounded border transition-all shadow-sm uppercase", currentAssignee === user.id ? "bg-blue-100 text-blue-800 border-blue-300" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50")}>{user.shortsign}</button>
							{/if}
						{/each}
					</div>
				</div>
			{/if}

			{#if !isMicroReviewForTL}
				<div class="flex gap-2 items-center mb-3 pb-2 border-b border-gray-50 dark:border-slate-700/50 relative z-20">
					<select bind:value={newSubtaskType} class="text-xs bg-gray-100 dark:bg-slate-700 border-0 rounded px-2 py-1 text-gray-600 dark:text-gray-300 cursor-pointer focus:ring-0">
						<option value="GENERIC">Task</option>
						<option value="DOCUMENT">Doc</option>
						<option value="RESEARCH">Res</option>
						<option value="EMAIL">Mail</option>
					</select>
					<input id={`new-subtask-${task.id}`} type="text" bind:value={newSubtaskTitle} placeholder="Neuer Subtask... (Enter)" class="flex-grow bg-transparent border-b border-transparent focus:border-blue-500 p-1 text-sm placeholder:text-gray-400 focus:ring-0 text-gray-700 dark:text-gray-300" onkeydown={(e) => e.key === 'Enter' && handleAddSubtask()} />
				</div>
			{/if}

			{#each displaySubtasks as sub (sub.id)}
				<SubtaskItem taskId={task.id} {sub} />
			{/each}
		</div>
	{/if}

	<div class="mt-auto pt-2 border-t border-slate-100 dark:border-slate-700/50 flex flex-row items-center justify-between gap-1 h-7">
		
		<TaskFooter {task} {isOwner} {ownerShortsign} />
		
		<div 
			class="expand-chevron w-7 h-7 shrink-0 rounded flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors cursor-pointer outline-none"
			role="button" 
			tabindex="0"
			onclick={toggleExpand}
			onkeydown={(e) => e.key === 'Enter' && toggleExpand(e as KeyboardEvent)}
		>
			{#if isExpanded}
				<ChevronUp size={16} class="pointer-events-none" />
			{:else}
				<ChevronDown size={16} class="pointer-events-none" />
			{/if}
		</div>
	</div>
</div>