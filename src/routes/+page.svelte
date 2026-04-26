<script lang="ts">
	import { store } from '$lib/stores/tasks';
	import { pb } from '$lib/pocketbase';
	import { Settings, Save, LayoutGrid, Calendar, GitBranch, Building2, Upload, Filter, Printer, Users, DollarSign, Archive, ArchiveIcon } from 'lucide-svelte';
	import TaskInput from '$lib/components/TaskInput.svelte';
	import TaskColumn from '$lib/components/TaskColumn.svelte';
	import PrintAgenda from '$lib/components/PrintAgenda.svelte';
	import type { Task } from '$lib/types';

	let refFilter = '';
	const byDateAndPriority = (a: any, b: any): number => {
		const aIsCourtDeadline = a.flaggedDate !== null;
		const bIsCourtDeadline = b.flaggedDate !== null;

		if (aIsCourtDeadline && !bIsCourtDeadline) return -1;
		if (!aIsCourtDeadline && bIsCourtDeadline) return 1;
		if (aIsCourtDeadline && bIsCourtDeadline) {
			return new Date(a.flaggedDate).getTime() - new Date(b.flaggedDate).getTime();
		}
		return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
	};

	$: matchesFilter = (t: Task) => {
		if (!refFilter.trim()) return true;
		return t.matterRef && t.matterRef.toLowerCase().includes(refFilter.toLowerCase());
	};

	$: currentUserId = pb.authStore.model?.id || '';
	$: currentUserSign = pb.authStore.model?.shortsign || 'ME';

	$: isMyTask = (t: Task) => t.owner === currentUserId || (t.assignees && t.assignees.includes(currentUserId));
	
	const hasSubtaskInReview = (subtasks: any[]): boolean => {
		if (!subtasks || !Array.isArray(subtasks)) return false;
		for (const sub of subtasks) {
			if (sub.reviewState === 'REQUESTED') return true;
			if (sub.subtasks && hasSubtaskInReview(sub.subtasks)) return true;
		}
		return false;
	};

	$: effectiveStatus = (t: Task) => {
		const isMine = isMyTask(t);
		const hasReview = hasSubtaskInReview(t.subtasks);
		
		if (!isMine && hasReview && t.status !== 'DONE') return 'REVIEW';
		return t.status;
	};

	$: showOnMainBoard = (t: Task) => isMyTask(t) || effectiveStatus(t) === 'REVIEW';
	
	// FIX: Filtert jetzt archivierte Tasks aus dem Board heraus (!t.archived)
	$: todos = $store.tasks.filter(t => !t.archived && effectiveStatus(t) === 'TODO' && matchesFilter(t) && showOnMainBoard(t)).sort(byDateAndPriority);
	$: waiting = $store.tasks.filter(t => !t.archived && effectiveStatus(t) === 'WAITING' && matchesFilter(t) && showOnMainBoard(t)).sort(byDateAndPriority);
	$: review = $store.tasks.filter(t => !t.archived && effectiveStatus(t) === 'REVIEW' && matchesFilter(t) && showOnMainBoard(t)).sort(byDateAndPriority);
	$: done = $store.tasks.filter(t => !t.archived && effectiveStatus(t) === 'DONE' && matchesFilter(t) && showOnMainBoard(t)).sort(byDateAndPriority);
	
	$: myActiveTasks = $store.tasks.filter(t => 
		!t.archived &&
		['TODO', 'WAITING', 'REVIEW'].includes(effectiveStatus(t)) && 
		showOnMainBoard(t)
	).sort(byDateAndPriority);

	const printAgenda = () => window.print();
	const today = new Intl.DateTimeFormat('de-CH', { dateStyle: 'full' }).format(new Date());
</script>

<svelte:head>
	<style>
		@media print {
			@page {
				size: A4 portrait;
				margin: 10mm;
			}
		}
	</style>
</svelte:head>

<div class="h-screen overflow-hidden flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans print:bg-white print:text-black print:h-auto print:overflow-visible">
	
	<nav class="shrink-0 sticky top-0 z-50 bg-slate-900 text-white shadow-lg border-b border-slate-800 print:hidden">
		<div class="mx-auto max-w-[1800px] px-4 sm:px-6 lg:px-8">
			<div class="flex h-16 justify-between items-center">
				<div class="flex items-center gap-10">
					<div class="flex items-center gap-2.5">
						<div class="flex h-9 w-9 items-center justify-center rounded bg-amber-600 text-white font-serif font-bold text-xl shadow-sm">L</div>
						<span class="text-xl font-bold tracking-tight text-white font-sansserif">Lawganized<span class="text-amber-500">FL</span></span>
					</div>

					<div class="hidden md:flex items-center gap-1">
						<a href="/" class="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium bg-slate-800 text-white shadow-inner">
							<LayoutGrid size={16} /> Board
						</a>
						<a href="/calendar" class="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
							<Calendar size={16} /> Kalender
						</a>
						<a href="/workflow" class="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
							<GitBranch size={16} /> Workflow
						</a>
						<a href="/resources" class="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
							<Building2 size={16} /> Ressourcen
						</a>
						<a href="/abrechnung" class="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
							<DollarSign size={16} /> Abrechnung
						</a>
						<a href="/archive" class="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
							<ArchiveIcon size={16} /> Archiv
						</a>
						
						{#if !pb.authStore.model?.teamLeader}
							<div class="w-px h-5 bg-slate-700 mx-1"></div>
							<a href="/team" class="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-bold text-amber-500 hover:text-amber-400 hover:bg-slate-800 transition-colors bg-amber-500/10">
								<Users size={16} /> Teamansicht
							</a>
						{/if}
					</div>
				</div>

				<div class="flex items-center gap-3">
					<div class="relative hidden lg:block group">
						<Filter class="absolute left-2.5 top-1.5 text-slate-500 group-focus-within:text-amber-500 transition-colors" size={14}/>
						<input type="text" bind:value={refFilter} placeholder="Ref-Filter..." class="pl-8 pr-3 py-1.5 rounded-md border border-slate-600 bg-slate-800 text-xs text-white placeholder:text-slate-400 focus:ring-1 focus:ring-amber-500 outline-none w-32 focus:w-48 transition-all" />
					</div>
					
					<a href="/archive" class="p-2 text-slate-400 hover:text-white transition-colors hover:bg-slate-800 rounded-full" title="Zum Archiv">
						<Archive size={20} />
					</a>
					
					<button onclick={printAgenda} title="Tagesagenda drucken" class="p-2 text-slate-400 hover:text-white transition-colors hover:bg-slate-800 rounded-full">
						<Printer size={20} />
					</button>
					<a href="/settings" class="p-2 text-slate-400 hover:text-white transition-colors hover:bg-slate-800 rounded-full">
						<Settings size={20} />
					</a>
				</div>
			</div>
		</div>
	</nav>

	<main class="flex-1 overflow-hidden flex flex-col w-full max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6 gap-6 print:hidden">
		
		{#if refFilter}
			<div class="shrink-0 flex items-center gap-2 text-sm text-slate-500 bg-amber-50 dark:bg-amber-900/20 p-2 rounded border border-amber-200 dark:border-amber-800 w-fit mx-auto">
				<Filter size={14} class="text-amber-600"/>
				<span>Gefiltert nach: <strong>{refFilter}</strong></span>
				<button onclick={() => refFilter = ''} class="ml-2 hover:text-red-500 font-bold">✕</button>
			</div>
		{/if}

		<div class="shrink-0 max-w-4xl mx-auto w-full">
			<TaskInput />
		</div>

		<div class="flex-1 min-h-0 grid grid-cols-[repeat(4,minmax(320px,1fr))] divide-x divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto custom-scrollbar">
			
			<div class="p-4 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col h-full overflow-hidden">
				<TaskColumn id="TODO" title="To Do" tasks={todos} color="bg-slate-600" />
			</div>
			
			<div class="p-4 bg-white dark:bg-slate-900 flex flex-col h-full overflow-hidden">
				<TaskColumn id="WAITING" title="In Arbeit" tasks={waiting} color="bg-amber-500" />
			</div>
			
			<div class="p-4 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col h-full overflow-hidden">
				<TaskColumn id="REVIEW" title="Review" tasks={review} color="bg-purple-600" />
			</div>
			
			<div class="p-4 bg-white dark:bg-slate-900 flex flex-col h-full overflow-hidden">
				<TaskColumn id="DONE" title="Abgeschlossen" tasks={done} color="bg-emerald-600" />
			</div>
			
		</div>
	</main>

	<PrintAgenda tasks={myActiveTasks} userSign={currentUserSign} dateString={today} />
</div>