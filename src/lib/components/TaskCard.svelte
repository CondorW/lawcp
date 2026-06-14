<script module>
	const expandedTasks = new Set<string>();
	let activeFocusId: string | null = null;
</script>

<script lang="ts">
	import { store } from '$lib/stores/tasks';
	import { pb } from '$lib/pocketbase';
	import type { Task, SubtaskType, Subtask } from '$lib/types';
	import { cn, formatDate } from '$lib/utils';
	import { ChevronDown, ChevronUp, ListTodo, Archive, Plus, Flag, Calendar, Clock, X, BrainCircuit, Loader2 } from 'lucide-svelte';
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

	function getInitialExpanded() { return expandedTasks.has(task.id); }
	let isExpanded = $state(getInitialExpanded());
	
	let showArchived = $state(false);
	let isEditingRef = $state(false);
	let editRefBuffer = $state('');

	// ====== MATTER NOTES INTEGRATION ======
	let noteContent = $state('');
	let contextId = $state<string | undefined>(undefined);
	let isLoadingContext = $state(false);
	let isSavingContext = $state(false);

	async function loadContextData() {
		if (!task.matterRef) return;
		isLoadingContext = true;
		const record = await store.fetchContext(task.matterRef);
		if (record) {
			contextId = record.id;
			noteContent = record.content;
		} else {
			contextId = undefined;
			noteContent = '';
		}
		isLoadingContext = false;
	}

	async function saveContextData() {
		if (!task.matterRef || noteContent === undefined) return;
		isSavingContext = true;
		const record = await store.saveContext(task.matterRef, noteContent, contextId);
		if (record && !contextId) {
			contextId = record.id;
		}
		isSavingContext = false;
	}

	function openExpanded() {
		isExpanded = true;
		if (task.matterRef) loadContextData();
		focusSubtaskInput();
	}

	function closeExpanded() {
		if (task.matterRef && !isLoadingContext) {
			saveContextData();
		}
		isExpanded = false;
	}
	// ============================================

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
			const input = document.getElementById(isExpanded ? `new-subtask-${task.id}` : `quick-add-${task.id}`) as HTMLTextAreaElement;
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
			openExpanded();
		}

		if (activeFocusId === task.id) {
			tick().then(() => setTimeout(focusSubtaskInput, 50));
		}

		const handleFocusRequest = async (e: Event) => {
			const customEvent = e as CustomEvent;
			if (customEvent.detail === task.id) {
				openExpanded();
				await tick(); 
				const card = document.getElementById(`case-card-${task.id}`);
				if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

	let activeTopLevelSubs = $derived((task.subtasks || []).filter(s => !s.archived));
	let activeDoneCount = $derived(activeTopLevelSubs.filter(s => s.done).length);
	let activeTotalCount = $derived(activeTopLevelSubs.length);

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

	function openNativePicker(e: MouseEvent) {
		e.stopPropagation();
		const btn = e.currentTarget as HTMLElement;
		const input = btn.querySelector('input[type="date"]') as HTMLInputElement;
		if (input) {
			try { input.showPicker(); } 
			catch (err) { input.focus(); input.click(); }
		}
	}

	async function updateCourtDate(e: Event) {
		const target = e.target as HTMLInputElement;
		const newDate = target.value ? new Date(target.value).toISOString() : null;
		try { await pb.collection('tasks').update(task.id, { flaggedDate: newDate }); } 
		catch (err) { console.error(err); }
	}

	async function updateInternalDate(e: Event) {
		const target = e.target as HTMLInputElement;
		const newDate = target.value ? new Date(target.value).toISOString() : null;
		try { await pb.collection('tasks').update(task.id, { dueDate: newDate }); } 
		catch (err) { console.error(err); }
	}
</script>

<svelte:window onkeydown={(e) => { if (isExpanded && e.key === 'Escape') { e.preventDefault(); closeExpanded(); } }} />

<!-- MAIN BOARD CARD (Minimiertes Grid Layout) -->
<div
	id={`case-card-${task.id}`}
	class={cn(
		"group relative flex flex-col cursor-move bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:shadow-md h-fit p-2.5 gap-1.5 w-full",
		!isStale && "border border-slate-200 dark:border-slate-700",
		isStale && "ring-2 ring-brand-600 dark:ring-brand-500 shadow-brand-500/10 border-transparent",
		task.status === 'DONE' && "bg-slate-50 dark:bg-slate-800/50 opacity-60 grayscale ring-0 border-slate-200",
		dragging && "opacity-50",
	)}
	style:break-inside="avoid"
	role="listitem"
	draggable="true"
	ondragstart={onDragStart}
	ondragend={() => dragging = false}
>
	<div 
		class="flex justify-between items-center gap-1 outline-none w-full" 
		role="button" 
		tabindex="0" 
		onclick={openExpanded}
		onkeydown={(e) => e.key === 'Enter' && openExpanded()}
	>
		<div class="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
			{#if isEditingRef}
				<input 
					id={`edit-ref-${task.id}`}
					type="text" 
					bind:value={editRefBuffer} 
					onblur={saveEditRef} 
					onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveEditRef(); } }} 
					class="text-[10px] font-bold px-1.5 py-0.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded uppercase tracking-wider border border-brand-500 focus:outline-none w-[75px] shrink-0 text-left" 
					onclick={(e) => e.stopPropagation()}
				/>
			{:else}
				<button 
					class="text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded uppercase tracking-wider truncate block w-fit max-w-[75px] text-left shrink-0 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors cursor-text"
					onclick={(e) => { e.stopPropagation(); startEditRef(); }}
					title="Referenz bearbeiten"
				>
					{task.matterRef || 'NO-REF'}
				</button>
			{/if}
			
			{#if !isOwner}
				<span class="px-1.5 py-0.5 bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400 rounded text-[10px] font-bold uppercase shrink-0">
					{ownerShortsign}
				</span>
			{/if}
		</div>
		
		<div class="flex items-center gap-1 shrink-0 text-slate-400">
			<div class="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors shrink-0">
				<ChevronDown size={16} />
			</div>
		</div>
	</div>

	<div 
		class="flex-grow min-w-0 flex flex-col pointer-events-none"
		role="button" 
		tabindex="0" 
		onclick={openExpanded}
		onkeydown={undefined}
	>
		<div class="w-full text-sm font-medium whitespace-normal break-words line-clamp-3">
			<TaskTitle {task} />
		</div>
	</div>

	{#if !isMicroReviewForTL}
		<div 
			class="mt-1 flex items-start gap-1.5 bg-slate-50 dark:bg-slate-900/50 rounded border border-slate-200 dark:border-slate-700/50 px-1.5 py-1 hover:border-brand-300 focus-within:border-brand-500 focus-within:bg-white dark:focus-within:bg-slate-800 transition-colors cursor-text min-h-[28px]"
			role="button"
			tabindex="0"
			onclick={(e) => { e.stopPropagation(); document.getElementById(`quick-add-${task.id}`)?.focus(); }}
			onkeydown={(e) => { if(e.key === 'Enter') { e.stopPropagation(); document.getElementById(`quick-add-${task.id}`)?.focus(); } }}
		>
			<Plus size={11} class="text-slate-400 shrink-0 mt-0.5" />
			<textarea 
				id={`quick-add-${task.id}`}
				bind:value={newSubtaskTitle} 
				placeholder="Task hinzufügen..." 
				class="flex-1 bg-transparent border-none focus:ring-0 text-[11px] p-0 m-0 w-full text-slate-700 dark:text-slate-300 placeholder:text-slate-400 outline-none resize-none leading-snug overflow-hidden" 
				rows="1"
				oninput={(e) => {
					e.currentTarget.style.height = 'auto';
					e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
				}}
				onkeydown={(e) => {
					if (e.key === 'Enter' && !e.shiftKey) {
						e.preventDefault();
						e.stopPropagation();
						handleAddSubtask();
						e.currentTarget.style.height = 'auto';
					}
				}} 
				onfocus={() => activeFocusId = task.id}
				onblur={() => { if(activeFocusId === task.id) activeFocusId = null; }}
			></textarea>
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
					<span class="text-xs text-slate-700 dark:text-slate-300 leading-snug whitespace-normal break-words">{sub.title}</span>
					
					{#if sub.reviewState === 'REQUESTED'}
						<span class="ml-auto text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 mt-0.5">Rev</span>
					{:else if sub.reviewState === 'REVISION'}
						<span class="ml-auto text-[9px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 mt-0.5">!</span>
					{/if}
				</button>
			{/each}
		</div>
	{/if}

	<!-- FIX 3: Minimized Footer: 'truncate' & 'overflow-hidden' restlos entfernt. 'tracking-tight' integriert. -->
	<div class="flex items-center justify-between mt-auto pt-2 border-t border-slate-100 dark:border-slate-700/50 gap-1 flex-nowrap w-full">
		<div class="flex items-center gap-1.5 text-xs font-bold text-slate-400 shrink-0">
			<ListTodo size={13} /> 
			{activeDoneCount}/{activeTotalCount}
		</div>

		<div class="flex items-center gap-1 ml-auto flex-nowrap justify-end shrink-0">
			{#if task.flaggedDate}
				<button type="button" class="relative h-6 px-1.5 bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-400 rounded border border-rose-300 dark:border-slate-700 flex items-center gap-1 hover:bg-rose-200 transition-colors outline-none focus:ring-0 shrink-0" onclick={openNativePicker} title="Gerichtstermin anpassen">
					<Flag size={13} class="pointer-events-none shrink-0" />
					<span class="text-xs font-bold tracking-tight pointer-events-none whitespace-nowrap shrink-0">{formatDate(task.flaggedDate)}</span>
					<input type="date" class="sr-only" tabindex="-1" value={task.flaggedDate.split('T')[0]} onchange={updateCourtDate} onclick={(e) => e.stopPropagation()} />
				</button>
			{:else}
				<button type="button" class="relative w-6 h-6 flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-rose-500 transition-colors rounded outline-none focus:ring-0 shrink-0" onclick={openNativePicker} title="Gerichtstermin setzen">
					<Flag size={13} class="pointer-events-none shrink-0" />
					<input type="date" class="sr-only" tabindex="-1" value="" onchange={updateCourtDate} onclick={(e) => e.stopPropagation()} />
				</button>
			{/if}

			{#if task.dueDate}
				<button type="button" class="relative h-6 px-1.5 flex items-center gap-1 rounded text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors outline-none focus:ring-0 shrink-0" onclick={openNativePicker} title="Fälligkeit anpassen">
					<Calendar size={13} class="pointer-events-none shrink-0" />
					<span class="text-xs tracking-tight pointer-events-none whitespace-nowrap shrink-0">{formatDate(task.dueDate)}</span>
					<input type="date" class="sr-only" tabindex="-1" value={task.dueDate.split('T')[0]} onchange={updateInternalDate} onclick={(e) => e.stopPropagation()} />
				</button>
			{:else}
				<button type="button" class="relative w-6 h-6 flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-600 transition-colors rounded outline-none focus:ring-0 shrink-0" onclick={openNativePicker} title="Fälligkeit setzen">
					<Calendar size={13} class="pointer-events-none shrink-0" />
					<input type="date" class="sr-only" tabindex="-1" value="" onchange={updateInternalDate} onclick={(e) => e.stopPropagation()} />
				</button>
			{/if}

			{#if isStale}
				<span class="px-1.5 py-0.5 rounded bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400 text-xs font-bold tracking-widest flex items-center gap-1 shrink-0" title="Seit über 30 Tagen inaktiv">
					<Clock size={13} class="shrink-0" /> <span class="whitespace-nowrap">STALE</span>
				</span>
			{/if}
		</div>
	</div>
</div>

<!-- ============================================== -->
<!-- FULL SCREEN COMBINED MODAL (Task + Context) -->
<!-- ============================================== -->
{#if isExpanded}
	<!-- FIX 1: z-[150] Overlay Navbar -->
	<div 
		class="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-sm overflow-y-auto" 
		role="presentation"
		onclick={(e) => { if(e.target === e.currentTarget) closeExpanded(); }}
		ondragstart={(e) => { e.preventDefault(); e.stopPropagation(); }}
	>
		<div 
			class="min-h-full flex items-center justify-center p-4 sm:p-6" 
			role="presentation"
			onclick={(e) => { if(e.target === e.currentTarget) closeExpanded(); }}
		>
			<div 
				class={cn("bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800", task.matterRef ? "max-w-6xl" : "max-w-3xl")}
				style="max-height: 90vh;" 
				role="dialog"
				aria-modal="true"
				tabindex="-1"
				onclick={(e) => e.stopPropagation()}
				onkeydown={(e) => {
					if (e.key === 'Escape') {
						e.preventDefault();
						e.stopPropagation();
						closeExpanded();
					}
				}}
			>
				<!-- Global Modal Header -->
				<div class="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
					<div class="flex items-center gap-3">
						<span class="text-xs font-bold px-2 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700 uppercase tracking-wider">{task.matterRef || 'NO-REF'}</span>
						{#if !isOwner}
							<span class="px-2 py-1 bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400 rounded text-xs font-bold uppercase">{ownerShortsign}</span>
						{/if}
					</div>
					<button onclick={closeExpanded} class="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors outline-none focus:ring-2 focus:ring-brand-500">
						<X size={20} />
					</button>
				</div>

				<!-- Split Body Layout -->
				<div class="flex flex-col md:flex-row flex-1 min-h-0 overflow-y-auto md:overflow-hidden">
					
					<!-- LEFT COLUMN: Task Details -->
					<div class="flex-1 p-5 sm:p-6 md:overflow-y-auto custom-scrollbar flex flex-col gap-5 shrink-0 md:shrink">
						<div class="text-lg sm:text-xl font-bold whitespace-normal break-words text-slate-900 dark:text-slate-100">
							<TaskTitle {task} />
						</div>
						
						{#if isOwner && isTeamLeader}
							<div class="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-4 mb-1 shrink-0">
								<span class="text-xs font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">An:</span>
								<div class="flex flex-wrap gap-1.5">
									<button onclick={() => assignTo('')} class={cn("px-3 py-1.5 text-xs font-bold rounded-lg border transition-all shadow-sm", currentAssignee === '' ? "bg-yellow-50 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700")}>ME</button>
									{#each myTeamMembers as user}
										{#if user.id !== myId && user.shortsign}
											<button onclick={() => assignTo(user.id)} class={cn("px-3 py-1.5 text-xs font-bold rounded-lg border transition-all shadow-sm uppercase", currentAssignee === user.id ? "bg-brand-50 text-brand-800 border-brand-300 dark:bg-brand-900/30 dark:text-brand-400 dark:border-brand-700" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700")}>{user.shortsign}</button>
										{/if}
									{/each}
								</div>
							</div>
						{/if}

						{#if !isMicroReviewForTL}
							<div class="flex items-start gap-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 p-2.5 focus-within:border-brand-500 focus-within:bg-white dark:focus-within:bg-slate-800 transition-colors shrink-0">
								<Plus size={18} class="text-slate-400 mt-[5px] shrink-0" />
								<textarea 
									id={`new-subtask-${task.id}`} 
									bind:value={newSubtaskTitle} 
									placeholder="Neuer Task..." 
									class="flex-grow bg-transparent border-0 focus:ring-0 w-full text-sm placeholder:text-slate-400 text-slate-800 dark:text-slate-200 outline-none resize-none leading-snug min-h-[44px]" 
									rows="2"
									oninput={(e) => {
										e.currentTarget.style.height = 'auto';
										e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
									}}
									onkeydown={(e) => {
										if (e.key === 'Enter' && !e.shiftKey) {
											e.preventDefault();
											e.stopPropagation();
											handleAddSubtask();
											e.currentTarget.style.height = 'auto';
										}
									}}
									onfocus={() => activeFocusId = task.id}
									onblur={() => { if(activeFocusId === task.id) activeFocusId = null; }} 
								></textarea>
							</div>
						{/if}

						<!-- FIX 2: Subtasks in einem 2-Spalten Layout innerhalb des Modals mit erzwungenem Zeilenumbruch -->
						<div class="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start shrink-0 [&_span]:whitespace-normal [&_span]:break-words">
							{#each displaySubtasks as sub (sub.id)}
								<SubtaskItem taskId={task.id} {sub} />
							{/each}
						</div>

						{#if archivedSubtasks.length > 0}
							<div class="mt-2 pt-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
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
									<!-- FIX 2: Auch archivierte Subtasks im 2-Spalten Layout -->
									<div class="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3 items-start opacity-75 grayscale-[50%] border-l-2 border-slate-200 dark:border-slate-700 pl-4 ml-2 [&_span]:whitespace-normal [&_span]:break-words">
										{#each archivedSubtasks as sub (sub.id)}
											<SubtaskItem taskId={task.id} {sub} />
										{/each}
									</div>
								{/if}
							</div>
						{/if}
						
						<div class="mt-auto pt-5 border-t border-slate-100 dark:border-slate-800 shrink-0">
							<TaskFooter {task} {isOwner} {ownerShortsign} isExpanded={true} />
						</div>
					</div>

					<!-- RIGHT COLUMN: Matter Context / Notes -->
					{#if task.matterRef}
						<div class="w-full md:w-[380px] lg:w-[450px] min-h-[300px] md:min-h-0 border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col shrink-0">
							<div class="flex items-center gap-2 px-5 py-3 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
								<div class="p-1.5 bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300 rounded">
									<BrainCircuit size={16} />
								</div>
								<h3 class="font-bold text-sm text-slate-800 dark:text-slate-200">Aktennotizen</h3>
								{#if isLoadingContext}
									<Loader2 size={14} class="animate-spin text-purple-500 ml-auto" />
								{/if}
							</div>
							
							<div class="flex-1 overflow-hidden relative p-4 flex flex-col min-h-0">
								<textarea 
									bind:value={noteContent} 
									onkeydown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); closeExpanded(); } }}
									class="flex-1 w-full resize-none border-0 bg-transparent focus:ring-0 text-sm leading-relaxed text-slate-700 dark:text-slate-300 placeholder:text-slate-400 custom-scrollbar" 
									placeholder="Brain Dump: Strategie, Notizen... (Strg+Enter zum Schließen)" 
									spellcheck="false"
								></textarea>
							</div>

							<div class="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center shrink-0">
								<span class="text-[10px] text-slate-400 flex items-center gap-1">
									{#if isSavingContext}
										<Loader2 size={10} class="animate-spin text-purple-500" /> Speichere...
									{:else}
										Gesichert in PocketBase
									{/if}
								</span>
								<button onclick={saveContextData} disabled={isSavingContext || isLoadingContext} class="px-3 py-1.5 bg-slate-900 dark:bg-purple-600 text-white rounded text-xs font-bold hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50">
									Speichern
								</button>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}