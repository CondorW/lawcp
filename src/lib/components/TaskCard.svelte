<script lang="ts">
	import { store } from '$lib/stores/tasks';
	import { pb } from '$lib/pocketbase';
	import type { Task, SubtaskType, Subtask } from '$lib/types';
	import { cn } from '$lib/utils';
	import { ChevronDown, ChevronUp, ListTodo, Eye, Archive, Plus, Flag, Calendar, Clock } from 'lucide-svelte';
	import { onMount, tick } from 'svelte';

	import TaskTitle from './task/TaskTitle.svelte';
	import SubtaskItem from './task/SubtaskItem.svelte';
	import TaskFooter from './task/TaskFooter.svelte';

	let { task }: { task: Task } = $props();

	const myId = pb.authStore.model?.id || '';
	
	let isOwner = $derived(task.owner === myId || (task.assignees && task.assignees.includes(myId)));
	let ownerShortsign = $derived(task.expand?.owner?.shortsign || '?');
	const isTeamLeader = !pb.authStore.model?.teamLeader;

	let currentAssignee = $derived(task.assignees && task.assignees.length > 0 ? task.assignees[0] : '');

	let dragging = $state(false);
	let newSubtaskTitle = $state('');
	let newSubtaskType: SubtaskType = $state('GENERIC');

	const isNewlyCreated = Date.now() - new Date(task.createdAt || Date.now()).getTime() < 3000;
	let isExpanded = $state(isNewlyCreated);
	let showArchived = $state(false);

	function focusSubtaskInput() {
		let attempts = 0;
		const tryFocus = () => {
			const input = document.getElementById(`new-subtask-${task.id}`) as HTMLInputElement;
			if (input) {
				input.focus({ preventScroll: true });
			} else if (attempts < 20) { 
				attempts++;
				setTimeout(tryFocus, 50);
			}
		};
		tryFocus();
	}

	onMount(() => {
		const handleFocusRequest = async (e: Event) => {
			const customEvent = e as CustomEvent;
			if (customEvent.detail === task.id) {
				isExpanded = true;
				await tick(); 
				
				const card = document.getElementById(`case-card-${task.id}`);
				if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
				
				focusSubtaskInput();
			}
		};
		window.addEventListener('lawganized-focus-task', handleFocusRequest);
		return () => window.removeEventListener('lawganized-focus-task', handleFocusRequest);
	});

	// FIX: Stale-Time auf 30 Tage hochgesetzt
	let isStale = $derived((() => {
		if (task.status === 'DONE' || task.archived) return false;
		const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
		const now = Date.now();
		let lastActive = new Date(task.createdAt || Date.now()).getTime();

		const checkSubtasks = (subs: Subtask[] | undefined) => {
			if (!subs) return;
			for (const sub of subs) {
				if (sub.done && sub.completedAt) {
					const compTime = new Date(sub.completedAt).getTime();
					if (compTime > lastActive) lastActive = compTime;
				}
				checkSubtasks(sub.subtasks);
			}
		};

		checkSubtasks(task.subtasks);
		return (now - lastActive) > THIRTY_DAYS;
	})());

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

	function getActiveSubtasks(subs: Subtask[]): Subtask[] {
		if (!subs) return [];
		return subs
			.filter(s => !s.archived)
			.map(s => ({ ...s, subtasks: getActiveSubtasks(s.subtasks || []) }));
	}

	function getArchivedSubtasks(subs: Subtask[]): Subtask[] {
		if (!subs) return [];
		let archived: Subtask[] = [];
		for (const s of subs) {
			if (s.archived) {
				archived.push(s);
			} else {
				archived = archived.concat(getArchivedSubtasks(s.subtasks || []));
			}
		}
		return archived;
	}

	let activeSubtasksRaw = $derived(getActiveSubtasks(task.subtasks || []));
	let archivedSubtasks = $derived(getArchivedSubtasks(task.subtasks || []));
	let isMicroReviewForTL = $derived(!isOwner && task.status !== 'REVIEW' && filterReviewSubtasks(task.subtasks || []).length > 0);
	let displaySubtasks = $derived(isMicroReviewForTL ? filterReviewSubtasks(activeSubtasksRaw) : activeSubtasksRaw);

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
		if (target.closest('.expand-chevron')) {
			isExpanded = !isExpanded;
			if (isExpanded) focusSubtaskInput();
			return;
		}
		if (['INPUT', 'BUTTON', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.closest('button')) return;
		isExpanded = !isExpanded;
		if (isExpanded) focusSubtaskInput();
	}
</script>

<div
	id={`case-card-${task.id}`}
	role="listitem"
	class={cn(
		"group relative flex flex-col transition-all cursor-move bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:shadow-md",
		isExpanded ? "p-3 gap-2.5 is-expanded col-span-full border border-slate-300 dark:border-slate-600" : "p-2 gap-1.5 h-full",
		!isExpanded && !isStale && "border border-slate-200 dark:border-slate-700",
		isStale && !isExpanded && "ring-2 ring-brand-600 dark:ring-brand-500 shadow-brand-500/10 border-transparent",
		task.status === 'DONE' && "bg-slate-50 dark:bg-slate-800/50 opacity-60 grayscale ring-0 border-slate-200",
		dragging && "opacity-50",
	)}
	draggable="true"
	ondragstart={onDragStart}
	ondragend={() => dragging = false}
>
	<div 
		class="flex justify-between items-center gap-1 outline-none w-full" 
		role="button" 
		tabindex="0" 
		onclick={toggleExpand}
		onkeydown={(e) => e.key === 'Enter' && toggleExpand(e as KeyboardEvent)}
	>
		<div class="flex items-center gap-1.5 min-w-0">
			<span class="text-[11px] font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded uppercase tracking-wider truncate max-w-[85px] shrink-0">
				{task.matterRef || 'NO-REF'}
			</span>
			
			{#if !isExpanded && !isOwner}
				<span class="px-1.5 py-0.5 bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400 rounded text-[10px] font-bold uppercase shrink-0">
					{ownerShortsign}
				</span>
			{/if}
		</div>
		
		<div class="flex items-center gap-1.5 shrink-0 text-slate-400">
			{#if task.flaggedDate && !isExpanded} 
				<div class="flex items-center gap-1 bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-700 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider shadow-sm">
					<Flag size={10} class="fill-rose-600 dark:fill-rose-400" /> FRIST
				</div>
			{/if}
			
			{#if task.dueDate && !isExpanded} <Calendar size={13} /> {/if}
			
			<div class="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
				{#if isExpanded} <ChevronUp size={16} /> {:else} <ChevronDown size={16} /> {/if}
			</div>
		</div>
	</div>

	<div 
		class={cn("flex-grow min-w-0 flex flex-col", !isExpanded && "pointer-events-none")}
		role="button" 
		tabindex="0" 
		onclick={!isExpanded ? toggleExpand : undefined}
		onkeydown={undefined}
	>
		<div class={cn("w-full transition-all", !isExpanded ? "text-sm line-clamp-3" : "text-base whitespace-normal break-words")}>
			<TaskTitle {task} />
		</div>
	</div>

	{#if !isExpanded}
		<div class="flex items-center justify-between mt-auto pt-1.5 border-t border-slate-100 dark:border-slate-700/50">
			<div class="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
				<ListTodo size={12} /> 
				{task.subtasks?.filter(s=>s.done).length || 0} / {task.subtasks?.length || 0} Tasks
				
				{#if task.subtasks?.some(s => s.reviewState === 'REVISION')}
					<span class="ml-1 text-rose-500 font-bold">(! Rev)</span>
				{/if}
			</div>
			
			{#if isStale}
				<span class="px-1.5 py-0.5 rounded bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400 text-[10px] font-bold tracking-widest flex items-center gap-1 shrink-0" title="Seit über 30 Tagen inaktiv">
					<Clock size={10} /> STALE
				</span>
			{/if}
		</div>
	{/if}

	{#if isExpanded}
		<div class="space-y-1.5 my-0.5 border-t border-slate-100 dark:border-slate-700 pt-2 animate-in fade-in slide-in-from-top-2 duration-200">
			
			{#if isOwner && isTeamLeader}
				<div class="flex items-center gap-1.5 mb-2">
					<span class="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">An:</span>
					<div class="flex flex-wrap gap-1">
						<button onclick={() => assignTo('')} class={cn("px-2 py-0.5 text-[10px] font-bold rounded border transition-all shadow-sm", currentAssignee === '' ? "bg-yellow-50 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700")}>ME</button>
						{#each $store.firmUsers as user}
							{#if user.id !== myId && user.shortsign}
								<button onclick={() => assignTo(user.id)} class={cn("px-2 py-0.5 text-[10px] font-bold rounded border transition-all shadow-sm uppercase", currentAssignee === user.id ? "bg-brand-50 text-brand-800 border-brand-300 dark:bg-brand-900/30 dark:text-brand-400 dark:border-brand-700" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700")}>{user.shortsign}</button>
							{/if}
						{/each}
					</div>
				</div>
			{/if}

			{#if !isMicroReviewForTL}
				<div class="flex items-center mb-2 pb-2 border-b border-slate-50 dark:border-slate-700/50 group/input">
					<div class="w-5 shrink-0 text-slate-300 dark:text-slate-600 group-focus-within/input:text-brand-500 pl-0.5 flex items-center">
						<Plus size={14} />
					</div>
					<input 
						id={`new-subtask-${task.id}`} 
						type="text" 
						bind:value={newSubtaskTitle} 
						placeholder="Neuer Task..." 
						class="flex-grow bg-transparent border-0 focus:ring-0 px-1 py-0.5 text-[13px] placeholder:text-slate-400 text-slate-800 dark:text-slate-200 outline-none" 
						onkeydown={(e) => e.key === 'Enter' && handleAddSubtask()} 
					/>
				</div>
			{/if}

			<div class="space-y-1">
				{#each displaySubtasks as sub (sub.id)}
					<SubtaskItem taskId={task.id} {sub} />
				{/each}
			</div>

			{#if archivedSubtasks.length > 0}
				<div class="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/50">
					<button 
						onclick={(e) => { e.stopPropagation(); showArchived = !showArchived; }}
						class="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 uppercase tracking-widest outline-none transition-colors w-fit"
					>
						<Archive size={11} />
						{archivedSubtasks.length} Archiviert
						<div class="ml-0.5 opacity-70">
							{#if showArchived}<ChevronUp size={11} />{:else}<ChevronDown size={11} />{/if}
						</div>
					</button>

					{#if showArchived}
						<div class="mt-2 space-y-1.5 opacity-75 grayscale-[50%] border-l-2 border-slate-200 dark:border-slate-700 pl-2 ml-1">
							{#each archivedSubtasks as sub (sub.id)}
								<SubtaskItem taskId={task.id} {sub} />
							{/each}
						</div>
					{/if}
				</div>
			{/if}
			
			<div class="mt-4 pt-2 border-t border-slate-100 dark:border-slate-700/50">
				<TaskFooter {task} {isOwner} {ownerShortsign} {isExpanded} />
			</div>
		</div>
	{/if}
</div>