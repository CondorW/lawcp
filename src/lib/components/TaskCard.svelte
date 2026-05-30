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

	let isExpanded = $state(false);
	let showArchived = $state(false);

	function getLeaderId(userField: any): string | null {
		if (!userField) return null;
		if (Array.isArray(userField)) return userField.length > 0 ? userField[0] : null;
		if (typeof userField === 'string' && userField.trim() !== '') return userField;
		return null;
	}

	let myTeamMembers = $derived($store.firmUsers.filter(u => getLeaderId(u.teamLeader) === myId));

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
		if (Date.now() - new Date(task.createdAt || Date.now()).getTime() < 3000) {
			isExpanded = true;
		}

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

	function getPendingSubtasksFlattened(subs: Subtask[] | undefined): Subtask[] {
		if (!subs) return [];
		let result: Subtask[] = [];
		for (const s of subs) {
			if (!s.done && !s.archived) result.push(s);
			if (s.subtasks) result = result.concat(getPendingSubtasksFlattened(s.subtasks));
		}
		return result;
	}

	let pendingSubtasksList = $derived(getPendingSubtasksFlattened(task.subtasks));

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
		"group relative flex flex-col transition-all cursor-move bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:shadow-md h-fit",
		isExpanded ? "p-3 gap-2.5 is-expanded border border-slate-300 dark:border-slate-600 z-50 shadow-xl" : "p-2 gap-1",
		!isExpanded && !isStale && "border border-slate-200 dark:border-slate-700",
		isStale && !isExpanded && "ring-2 ring-brand-600 dark:ring-brand-500 shadow-brand-500/10 border-transparent",
		task.status === 'DONE' && "bg-slate-50 dark:bg-slate-800/50 opacity-60 grayscale ring-0 border-slate-200",
		dragging && "opacity-50",
	)}
	style:break-inside={isExpanded ? 'avoid' : 'auto'}
	draggable="true"
	ondragstart={onDragStart}
	ondragend={() => dragging = false}
>
	<div 
		class="flex justify-between items-center gap-1.5 outline-none w-full" 
		role="button" 
		tabindex="0" 
		onclick={toggleExpand}
		onkeydown={(e) => e.key === 'Enter' && toggleExpand(e as KeyboardEvent)}
	>
		<div class="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
			<span class="text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded uppercase tracking-wider truncate block w-full">
				{task.matterRef || 'NO-REF'}
			</span>
			
			{#if !isExpanded && !isOwner}
				<span class="px-1.5 py-0.5 bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400 rounded text-[10px] font-bold uppercase shrink-0">
					{ownerShortsign}
				</span>
			{/if}
		</div>
		
		<div class="flex items-center gap-1 shrink-0 text-slate-400">
			{#if task.flaggedDate && !isExpanded} 
				<div class="flex items-center justify-center bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-700 w-5 h-5 rounded shadow-sm shrink-0" title="Gerichtstermin">
					<Flag size={10} class="fill-rose-600 dark:fill-rose-400" /> 
				</div>
			{/if}
			
			{#if task.dueDate && !isExpanded} 
				<div class="flex items-center justify-center w-5 h-5 rounded hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors shrink-0" title="Fälligkeit">
					<Calendar size={12} />
				</div>
			{/if}
			
			<div class="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors shrink-0 expand-chevron">
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
		<!-- Quick Add Feld direkt unter dem Case Namen -->
		{#if !isMicroReviewForTL}
			<div 
				class="mt-1 flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900/50 rounded border border-slate-200 dark:border-slate-700/50 px-1.5 py-1 hover:border-brand-300 focus-within:border-brand-500 focus-within:bg-white dark:focus-within:bg-slate-800 transition-colors cursor-text"
				onclick={(e) => { e.stopPropagation(); document.getElementById(`quick-add-${task.id}`)?.focus(); }}
				onkeydown={(e) => e.stopPropagation()}
				role="button"
				tabindex="-1"
			>
				<Plus size={11} class="text-slate-400 shrink-0" />
				<input 
					id={`quick-add-${task.id}`}
					type="text" 
					bind:value={newSubtaskTitle} 
					placeholder="" 
					class="flex-1 bg-transparent border-none focus:ring-0 text-[11px] p-0 text-slate-700 dark:text-slate-300 placeholder:text-slate-400 outline-none" 
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							e.stopPropagation();
							handleAddSubtask();
						}
					}} 
				/>
			</div>
		{/if}

		{#if pendingSubtasksList.length > 0}
			<div class="mt-1 flex flex-col gap-0.5 mb-0.5">
				{#each pendingSubtasksList as sub (sub.id)}
					<button 
						class="flex items-start gap-2 text-left px-1 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors group/mini outline-none focus:ring-1 focus:ring-brand-500"
						onclick={(e) => { e.stopPropagation(); store.toggleSubtask(task.id, sub.id); }}
						title={sub.title}
					>
						<div class="w-3.5 h-3.5 rounded-sm border border-slate-300 dark:border-slate-500 mt-0.5 shrink-0 flex items-center justify-center group-hover/mini:border-brand-500 transition-colors"></div>
						<span class="text-[11px] text-slate-700 dark:text-slate-300 leading-snug line-clamp-2">{sub.title}</span>
						
						{#if sub.reviewState === 'REQUESTED'}
							<span class="ml-auto text-[8px] bg-purple-100 text-purple-700 px-1 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 mt-0.5">Rev</span>
						{:else if sub.reviewState === 'REVISION'}
							<span class="ml-auto text-[8px] bg-rose-100 text-rose-700 px-1 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 mt-0.5">!</span>
						{/if}
					</button>
				{/each}
			</div>
		{/if}

		<div class="flex items-center justify-between mt-auto pt-1.5 border-t border-slate-100 dark:border-slate-700/50">
			<div class="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
				<ListTodo size={11} /> 
				{task.subtasks?.filter(s=>s.done).length || 0} / {task.subtasks?.length || 0}
			</div>
			
			{#if isStale}
				<span class="px-1.5 py-0.5 rounded bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400 text-[9px] font-bold tracking-widest flex items-center gap-1 shrink-0" title="Seit über 30 Tagen inaktiv">
					<Clock size={9} /> STALE
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
						{#each myTeamMembers as user}
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
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								e.stopPropagation();
								handleAddSubtask();
							}
						}} 
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