<script module>
	const expandedTasks = new Set<string>();
	let activeFocusId: string | null = null;
</script>

<script lang="ts">
	import { store } from '$lib/stores/tasks';
	import { pb } from '$lib/pocketbase';
	import type { Task, SubtaskType, Subtask } from '$lib/types';
	import { cn } from '$lib/utils';
	import { ChevronDown, ChevronUp, ListTodo, Archive, Plus, Flag, Calendar, Clock } from 'lucide-svelte';
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

	// FIX 3: Zweizeilige Initialisierung verhindert die "state_referenced_locally" Warnung
	let initialExpanded = expandedTasks.has(task.id);
	let isExpanded = $state(initialExpanded);
	
	let showArchived = $state(false);

	let isEditingRef = $state(false);
	let editRefBuffer = $state('');

	$effect(() => {
		if (isExpanded) expandedTasks.add(task.id);
		else expandedTasks.delete(task.id);
	});

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
			const input = document.getElementById(isExpanded ? `new-subtask-${task.id}` : `quick-add-${task.id}`) as HTMLInputElement;
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

		if (activeFocusId === task.id) {
			tick().then(() => setTimeout(focusSubtaskInput, 50));
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

	let isStale = $derived.by(() => {
		if (task.status === 'DONE' || task.archived) return false;
		const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
		let lastActive = new Date(task.createdAt || Date.now()).getTime();

		const checkSubtasks = (subs: Subtask[] | undefined) => {
			if (!subs) return;
			for (let i = 0; i < subs.length; i++) {
				const sub = subs[i];
				if (sub.done && sub.completedAt) {
					const compTime = new Date(sub.completedAt).getTime();
					if (compTime > lastActive) lastActive = compTime;
				}
				if (sub.subtasks && sub.subtasks.length > 0) checkSubtasks(sub.subtasks);
			}
		};
		checkSubtasks(task.subtasks);
		return (Date.now() - lastActive) > THIRTY_DAYS;
	});

	let pendingSubtasksList = $derived.by(() => {
		const result: Subtask[] = [];
		const traverse = (subs: Subtask[] | undefined) => {
			if (!subs) return;
			for (let i = 0; i < subs.length; i++) {
				const s = subs[i];
				if (!s.done && !s.archived) result.push(s);
				if (s.subtasks && s.subtasks.length > 0) traverse(s.subtasks);
			}
		};
		traverse(task.subtasks);
		return result;
	});

	function filterReviewSubtasks(subs: Subtask[] | undefined): Subtask[] {
		if (!subs) return [];
		const result: Subtask[] = [];
		for (let i = 0; i < subs.length; i++) {
			const sub = subs[i];
			const filteredChildren = filterReviewSubtasks(sub.subtasks);
			if (sub.reviewState === 'REQUESTED' || filteredChildren.length > 0) {
				result.push({ ...sub, subtasks: filteredChildren });
			}
		}
		return result;
	}

	function getActiveSubtasks(subs: Subtask[] | undefined): Subtask[] {
		if (!subs) return [];
		const result: Subtask[] = [];
		for (let i = 0; i < subs.length; i++) {
			const s = subs[i];
			if (!s.archived) {
				result.push({ ...s, subtasks: getActiveSubtasks(s.subtasks) });
			}
		}
		return result;
	}

	function getArchivedSubtasks(subs: Subtask[] | undefined): Subtask[] {
		if (!subs) return [];
		const result: Subtask[] = [];
		for (let i = 0; i < subs.length; i++) {
			const s = subs[i];
			if (s.archived) result.push(s);
			else result.push(...getArchivedSubtasks(s.subtasks));
		}
		return result;
	}

	let activeSubtasksRaw = $derived(getActiveSubtasks(task.subtasks));
	let archivedSubtasks = $derived(getArchivedSubtasks(task.subtasks));
	let isMicroReviewForTL = $derived(!isOwner && task.status !== 'REVIEW' && filterReviewSubtasks(task.subtasks).length > 0);
	let displaySubtasks = $derived(isMicroReviewForTL ? filterReviewSubtasks(activeSubtasksRaw) : activeSubtasksRaw);

	async function handleAddSubtask() {
		if (!newSubtaskTitle.trim()) return;
		activeFocusId = task.id;
		store.addSubtask(task.id, newSubtaskTitle, newSubtaskType);
		newSubtaskTitle = '';
		setTimeout(() => focusSubtaskInput(), 50);
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

<div
	id={`case-card-${task.id}`}
	role="listitem"
	class={cn(
		"group relative flex flex-col transition-all cursor-move bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:shadow-md h-fit",
		isExpanded ? "p-3 gap-3 is-expanded border border-slate-300 dark:border-slate-600 z-50 shadow-xl" : "p-2.5 gap-1.5",
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
		class="flex justify-between items-center gap-2 outline-none w-full" 
		role="button" 
		tabindex="0" 
		onclick={toggleExpand}
		onkeydown={(e) => e.key === 'Enter' && toggleExpand(e as KeyboardEvent)}
	>
		<div class="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
			{#if isEditingRef}
				<input 
					id={`edit-ref-${task.id}`}
					type="text" 
					bind:value={editRefBuffer} 
					onblur={saveEditRef} 
					onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveEditRef(); } }} 
					class="text-xs font-bold px-1.5 py-0.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded uppercase tracking-wider border border-brand-500 focus:outline-none w-[10ch] text-center shrink-0" 
					onclick={(e) => e.stopPropagation()}
				/>
			{:else}
				<button 
					class="text-xs font-bold px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded uppercase tracking-wider truncate block w-[10ch] text-center shrink-0 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors cursor-text"
					onclick={(e) => { e.stopPropagation(); startEditRef(); }}
					title="Referenz bearbeiten"
				>
					{task.matterRef || 'NO-REF'}
				</button>
			{/if}
			
			{#if task.flaggedDate && !isExpanded} 
				<div class="flex items-center justify-center bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-700 w-5 h-5 rounded shadow-sm shrink-0" title="Gerichtstermin">
					<Flag size={11} class="fill-rose-600 dark:fill-rose-400" /> 
				</div>
			{/if}

			{#if !isExpanded && !isOwner}
				<span class="px-2 py-0.5 bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400 rounded text-xs font-bold uppercase shrink-0 ml-0.5">
					{ownerShortsign}
				</span>
			{/if}
		</div>
		
		<div class="flex items-center gap-1.5 shrink-0 text-slate-400">
			{#if task.dueDate && !isExpanded} 
				<div class="flex items-center justify-center w-6 h-6 rounded hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors shrink-0" title="Fälligkeit">
					<Calendar size={14} />
				</div>
			{/if}
			
			<div class="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors shrink-0 expand-chevron">
				{#if isExpanded} <ChevronUp size={18} /> {:else} <ChevronDown size={18} /> {/if}
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
		<div class={cn("w-full transition-all", !isExpanded ? "text-base font-medium line-clamp-3" : "text-lg font-medium whitespace-normal break-words")}>
			<TaskTitle {task} />
		</div>
	</div>

	{#if !isExpanded}
		{#if !isMicroReviewForTL}
			<div 
				class="mt-1 flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900/50 rounded border border-slate-200 dark:border-slate-700/50 px-1.5 hover:border-brand-300 focus-within:border-brand-500 focus-within:bg-white dark:focus-within:bg-slate-800 transition-colors cursor-text h-5"
				onclick={(e) => { e.stopPropagation(); document.getElementById(`quick-add-${task.id}`)?.focus(); }}
				onkeydown={(e) => e.stopPropagation()}
				role="button"
				tabindex="-1"
			>
				<Plus size={10} class="text-slate-400 shrink-0" />
				<input 
					id={`quick-add-${task.id}`}
					type="text" 
					bind:value={newSubtaskTitle} 
					placeholder="Task hinzufügen..." 
					class="flex-1 bg-transparent border-none focus:ring-0 text-[10px] p-0 m-0 h-full text-slate-700 dark:text-slate-300 placeholder:text-slate-400 outline-none leading-none" 
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							e.stopPropagation();
							handleAddSubtask();
						}
					}} 
					onfocus={() => activeFocusId = task.id}
					onblur={() => { if(activeFocusId === task.id) activeFocusId = null; }}
				/>
			</div>
		{/if}

		{#if pendingSubtasksList.length > 0}
			<div class="mt-1.5 flex flex-col gap-1 mb-1">
				{#each pendingSubtasksList as sub (sub.id)}
					<button 
						class="flex items-start gap-2 text-left px-1.5 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors group/mini outline-none focus:ring-1 focus:ring-brand-500"
						onclick={(e) => { e.stopPropagation(); store.toggleSubtask(task.id, sub.id); }}
						title={sub.title}
					>
						<div class="w-4 h-4 rounded-sm border border-slate-300 dark:border-slate-500 mt-0.5 shrink-0 flex items-center justify-center group-hover/mini:border-brand-500 transition-colors"></div>
						<span class="text-sm text-slate-700 dark:text-slate-300 leading-snug line-clamp-2">{sub.title}</span>
						
						{#if sub.reviewState === 'REQUESTED'}
							<span class="ml-auto text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 mt-0.5">Rev</span>
						{:else if sub.reviewState === 'REVISION'}
							<span class="ml-auto text-[9px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 mt-0.5">!</span>
						{/if}
					</button>
				{/each}
			</div>
		{/if}

		<div class="flex items-center justify-between mt-auto pt-2 border-t border-slate-100 dark:border-slate-700/50">
			<div class="flex items-center gap-1.5 text-xs font-bold text-slate-400">
				<ListTodo size={14} /> 
				{task.subtasks?.filter(s=>s.done).length || 0} / {task.subtasks?.length || 0}
			</div>
			
			{#if isStale}
				<span class="px-2 py-0.5 rounded bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400 text-[10px] font-bold tracking-widest flex items-center gap-1 shrink-0" title="Seit über 30 Tagen inaktiv">
					<Clock size={11} /> STALE
				</span>
			{/if}
		</div>
	{/if}

	{#if isExpanded}
		<div class="space-y-2 my-1 border-t border-slate-100 dark:border-slate-700 pt-3 animate-in fade-in slide-in-from-top-2 duration-200">
			
			{#if isOwner && isTeamLeader}
				<div class="flex items-center gap-2 mb-3">
					<span class="text-xs font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">An:</span>
					<div class="flex flex-wrap gap-1.5">
						<button onclick={() => assignTo('')} class={cn("px-2.5 py-1 text-xs font-bold rounded border transition-all shadow-sm", currentAssignee === '' ? "bg-yellow-50 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700")}>ME</button>
						{#each myTeamMembers as user}
							{#if user.id !== myId && user.shortsign}
								<button onclick={() => assignTo(user.id)} class={cn("px-2.5 py-1 text-xs font-bold rounded border transition-all shadow-sm uppercase", currentAssignee === user.id ? "bg-brand-50 text-brand-800 border-brand-300 dark:bg-brand-900/30 dark:text-brand-400 dark:border-brand-700" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700")}>{user.shortsign}</button>
							{/if}
						{/each}
					</div>
				</div>
			{/if}

			{#if !isMicroReviewForTL}
				<div class="flex items-center mb-3 pb-3 border-b border-slate-50 dark:border-slate-700/50 group/input">
					<div class="w-6 shrink-0 text-slate-300 dark:text-slate-600 group-focus-within/input:text-brand-500 pl-0.5 flex items-center">
						<Plus size={16} />
					</div>
					<input 
						id={`new-subtask-${task.id}`} 
						type="text" 
						bind:value={newSubtaskTitle} 
						placeholder="Neuer Task..." 
						class="flex-grow bg-transparent border-0 focus:ring-0 px-2 py-1 text-sm placeholder:text-slate-400 text-slate-800 dark:text-slate-200 outline-none" 
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								e.stopPropagation();
								handleAddSubtask();
							}
						}}
						onfocus={() => activeFocusId = task.id}
						onblur={() => { if(activeFocusId === task.id) activeFocusId = null; }} 
					/>
				</div>
			{/if}

			<div class="space-y-1.5">
				{#each displaySubtasks as sub (sub.id)}
					<SubtaskItem taskId={task.id} {sub} />
				{/each}
			</div>

			{#if archivedSubtasks.length > 0}
				<div class="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50">
					<button 
						onclick={(e) => { e.stopPropagation(); showArchived = !showArchived; }}
						class="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 uppercase tracking-widest outline-none transition-colors w-fit"
					>
						<Archive size={14} />
						{archivedSubtasks.length} Archiviert
						<div class="ml-1 opacity-70">
							{#if showArchived}<ChevronUp size={14} />{:else}<ChevronDown size={14} />{/if}
						</div>
					</button>

					{#if showArchived}
						<div class="mt-3 space-y-2 opacity-75 grayscale-[50%] border-l-2 border-slate-200 dark:border-slate-700 pl-3 ml-1.5">
							{#each archivedSubtasks as sub (sub.id)}
								<SubtaskItem taskId={task.id} {sub} />
							{/each}
						</div>
					{/if}
				</div>
			{/if}
			
			<div class="mt-5 pt-3 border-t border-slate-100 dark:border-slate-700/50">
				<TaskFooter {task} {isOwner} {ownerShortsign} {isExpanded} />
			</div>
		</div>
	{/if}
</div>