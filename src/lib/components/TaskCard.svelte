<script lang="ts">
	import { store } from '$lib/stores/tasks';
	import { pb } from '$lib/pocketbase';
	import type { Task, SubtaskType, Subtask } from '$lib/types';
	import { cn } from '$lib/utils';
	import { ChevronDown, ChevronUp, ListTodo, Eye } from 'lucide-svelte';

	import TaskHeader from './task/TaskHeader.svelte';
	import TaskTitle from './task/TaskTitle.svelte';
	import TaskFooter from './task/TaskFooter.svelte';
	import SubtaskItem from './task/SubtaskItem.svelte';

	export let task: Task;

	const myId = pb.authStore.model?.id || '';
	const isOwner = task.owner === myId || (task.assignees && task.assignees.includes(myId));
	const ownerShortsign = task.expand?.owner?.shortsign || '?';
	const isTeamLeader = !pb.authStore.model?.teamLeader;

	$: currentAssignee = task.assignees && task.assignees.length > 0 ? task.assignees[0] : '';

	let dragging = false;
	let newSubtaskTitle = '';
	let newSubtaskType: SubtaskType = 'GENERIC';
	
	// NEU: Der Accordion-Status (Standard: Zugeklappt)
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
		if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.tagName === 'BUTTON') {
			e.preventDefault();
			return;
		}
		e.dataTransfer?.setData('text/plain', task.id);
		dragging = true;
	}

	// Toggle-Logik, die Formular-Elemente ignoriert
	function toggleExpand(e: MouseEvent | KeyboardEvent) {
		const target = e.target as HTMLElement;
		if (['INPUT', 'BUTTON', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.closest('button')) {
			return; // Klicks auf Inputs oder Buttons ignorieren
		}
		isExpanded = !isExpanded;
	}
</script>

<div
	role="listitem"
	class={cn(
		"group relative flex flex-col gap-2 rounded-xl border p-3 shadow-sm transition-all cursor-move bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:shadow-md",
		task.status === 'DONE' && "bg-gray-50 dark:bg-slate-800/50 opacity-60 grayscale",
		dragging && "opacity-50",
		!isOwner && "border-amber-200 dark:border-amber-900/30"
	)}
	draggable="true"
	ondragstart={onDragStart}
	ondragend={() => dragging = false}
>
	{#if !isOwner}
		<div class="absolute top-2 right-2 z-10 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-200 text-[10px] font-bold px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800/50 uppercase tracking-wide select-none">
			{ownerShortsign}
		</div>
	{/if}

	<div 
		role="button" 
		tabindex="0" 
		class="outline-none"
		onclick={toggleExpand}
		onkeydown={(e) => e.key === 'Enter' && toggleExpand(e as KeyboardEvent)}
	>
		<TaskHeader {task} />
		
		<div class="flex justify-between items-start gap-2">
			<div class="flex-grow min-w-0"><TaskTitle {task} /></div>
			<div class="text-slate-400 shrink-0 mt-1 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
				{#if isExpanded}
					<ChevronUp size={18} />
				{:else}
					<ChevronDown size={18} />
				{/if}
			</div>
		</div>

		{#if !isExpanded && task.subtasks && task.subtasks.length > 0}
			<div class="flex items-center gap-2 mt-2 pt-2 border-t border-gray-50 dark:border-slate-700/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
				<ListTodo size={12} />
				{task.subtasks.filter(s => s.done).length} / {task.subtasks.length} Subtasks
				
				{#if isMicroReviewForTL}
					<span class="ml-auto flex items-center gap-1 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 px-1.5 py-0.5 rounded">
						<Eye size={10} /> REVIEW OFFEN
					</span>
				{:else if task.subtasks.some(s => s.reviewState === 'REVISION')}
					<span class="ml-auto flex items-center gap-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded">
						KORREKTUR
					</span>
				{:else if task.subtasks.some(s => s.reviewState === 'APPROVED')}
					<span class="ml-auto flex items-center gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-1.5 py-0.5 rounded">
						FREIGEGEBEN
					</span>
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
						<button
							onclick={() => assignTo('')}
							class={cn(
								"px-2 py-0.5 text-xs font-bold rounded border transition-all shadow-sm",
								currentAssignee === '' 
									? "bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700" 
									: "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
							)}
							title="Privat (Nur für mich sichtbar)"
						>
							ME
						</button>
						{#each $store.firmUsers as user}
							{#if user.id !== myId && user.shortsign}
								<button
									onclick={() => assignTo(user.id)}
									class={cn(
										"px-2 py-0.5 text-xs font-bold rounded border transition-all shadow-sm uppercase tracking-wider",
										currentAssignee === user.id 
											? "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700" 
											: "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
									)}
									title={user.name || user.email}
								>
									{user.shortsign}
								</button>
							{/if}
						{/each}
					</div>
				</div>
			{/if}

			{#if !isMicroReviewForTL}
				<div class="flex gap-2 items-center mb-3 pb-2 border-b border-gray-50 dark:border-slate-700/50 relative z-20">
					<select
						bind:value={newSubtaskType}
						class="text-xs bg-gray-100 dark:bg-slate-700 border-0 rounded px-2 py-1 text-gray-600 dark:text-gray-300 cursor-pointer focus:ring-0"
					>
						<option value="GENERIC">Task</option>
						<option value="DOCUMENT">Doc</option>
						<option value="RESEARCH">Res</option>
						<option value="EMAIL">Mail</option>
					</select>
					<input
						id={`new-subtask-${task.id}`}
						type="text"
						bind:value={newSubtaskTitle}
						placeholder="Neuer Subtask... (Enter)"
						class="flex-grow bg-transparent border-b border-transparent focus:border-blue-500 p-1 text-sm placeholder:text-gray-400 focus:ring-0 text-gray-700 dark:text-gray-300"
						onkeydown={(e) => e.key === 'Enter' && handleAddSubtask()}
					/>
				</div>
			{/if}

			{#each displaySubtasks as sub (sub.id)}
				<SubtaskItem taskId={task.id} {sub} />
			{/each}
			
			{#if displaySubtasks.length === 0}
				<div class="text-[10px] text-slate-400 uppercase tracking-widest text-center py-2 font-bold">
					Keine Subtasks
				</div>
			{/if}

		</div>
	{/if}

	<TaskFooter {task} />
</div>