<script lang="ts">
	import { store } from '$lib/stores/tasks';
	import { chatStore } from '$lib/stores/chat.svelte';
	import { pb } from '$lib/pocketbase';
	import { Settings, LayoutGrid, Calendar, GitBranch, Building2, Filter, Printer, Users, DollarSign, ArchiveIcon, Plus, MessageSquare } from 'lucide-svelte';
	import TaskColumn from '$lib/components/TaskColumn.svelte';
	import PrintAgenda from '$lib/components/PrintAgenda.svelte';
	import ChatSidebar from '$lib/components/ChatSidebar.svelte';
	import { cn } from '$lib/utils';
	import type { Task, Subtask } from '$lib/types';

	let navInputTitle = $state('');
	let navInputRef = $state('');
	let navInputDate = $state(new Date().toISOString().split('T')[0]);
	let refFilter = $state('');
	let isChatOpen = $state(false);

	let currentUserId = $derived(pb.authStore.model?.id || '');
	let currentUserSign = $derived(pb.authStore.model?.shortsign || 'ME');
	let isTeamLeader = $derived(!pb.authStore.model?.teamLeader);

	async function handleNavAdd() {
		if (!navInputTitle.trim()) return;
		const title = navInputTitle;
		const ref = navInputRef;
		const date = navInputDate;

		navInputTitle = '';
		navInputRef = '';

		await store.addTask('TODO', title, ref, date);

		setTimeout(() => {
			const myCases = $store.tasks.filter(t => t.owner === currentUserId || (t.assignees && t.assignees.includes(currentUserId)));
			const newestCase = [...myCases].sort((a,b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0];
			
			if (newestCase) {
				const input = document.getElementById(`quick-add-${newestCase.id}`) || document.getElementById(`new-subtask-${newestCase.id}`);
				if (input) input.focus({ preventScroll: true });
			} else {
				document.getElementById('nav-task-title')?.focus();
			}
		}, 150);
	}

	function onNavKeyDown(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
			e.preventDefault();
			handleNavAdd();
		}
	}

	const byDateAndPriority = (a: any, b: any): number => {
		const aIsCourtDeadline = !!a.flaggedDate;
		const bIsCourtDeadline = !!b.flaggedDate;
		
		if (aIsCourtDeadline && !bIsCourtDeadline) return -1;
		if (!aIsCourtDeadline && bIsCourtDeadline) return 1;
		if (aIsCourtDeadline && bIsCourtDeadline) {
			return new Date(a.flaggedDate).getTime() - new Date(b.flaggedDate).getTime();
		}
		
		const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
		const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
		if (aDue !== bDue) return aDue - bDue;
		
		const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
		const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
		return bCreated - aCreated;
	};

	function matchesFilter(t: Task) {
		if (!refFilter.trim()) return true;
		return t.matterRef && t.matterRef.toLowerCase().includes(refFilter.toLowerCase());
	}

	function isMyTask(t: Task) {
		return t.owner === currentUserId || (t.assignees && t.assignees.includes(currentUserId));
	}

	function effectiveStatus(t: Task) {
		if (!isTeamLeader && t.status === 'REVIEW') {
			return 'WAITING';
		}
		return t.status;
	}

	function showOnMainBoard(t: Task) {
		const hasReview = t.subtasks?.some(s => s.reviewState === 'REQUESTED' || s.subtasks?.some((sub: any) => sub.reviewState === 'REQUESTED'));
		return isMyTask(t) || hasReview;
	}
	
	let todos = $derived($store.tasks.filter(t => !t.archived && effectiveStatus(t) === 'TODO' && matchesFilter(t) && showOnMainBoard(t)).sort(byDateAndPriority));
	let waiting = $derived($store.tasks.filter(t => !t.archived && effectiveStatus(t) === 'WAITING' && matchesFilter(t) && showOnMainBoard(t)).sort(byDateAndPriority));
	let review = $derived($store.tasks.filter(t => !t.archived && effectiveStatus(t) === 'REVIEW' && matchesFilter(t) && showOnMainBoard(t)).sort(byDateAndPriority));
	let done = $derived($store.tasks.filter(t => !t.archived && effectiveStatus(t) === 'DONE' && matchesFilter(t) && showOnMainBoard(t)).sort(byDateAndPriority));
	
	let myActiveTasks = $derived($store.tasks.filter(t => !t.archived && ['TODO', 'WAITING', 'REVIEW'].includes(effectiveStatus(t)) && showOnMainBoard(t)).sort(byDateAndPriority));

	const printAgenda = () => window.print();
	const today = new Intl.DateTimeFormat('de-CH', { dateStyle: 'full' }).format(new Date());
</script>

<svelte:head>
	<style>
		@media print {
			@page { size: A4 portrait; margin: 10mm; }
		}
	</style>
</svelte:head>

<ChatSidebar bind:isOpen={isChatOpen} />

<div class="h-screen overflow-hidden flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans print:bg-white print:text-black print:h-auto print:overflow-visible">
	
	<nav class="shrink-0 sticky top-0 z-[100] bg-slate-900 text-white shadow-lg border-b border-slate-800 print:hidden w-full">
		<div class="w-full px-3 sm:px-6">
			<div class="flex h-20 justify-between items-center gap-6">
				
				<div class="flex items-center gap-3 shrink-0">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white font-serif font-bold text-xl shadow-sm border border-brand-500">L</div>
					<span class="text-xl font-bold tracking-tight text-white font-sansserif hidden xl:block">LAWganized</span>
				</div>

				<div class="flex-1 max-w-4xl flex items-center bg-slate-800/80 rounded-xl border border-slate-700 p-1.5 focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-brand-500 transition-all shadow-inner">
					<div class="flex-1 relative">
						<div class="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-500 opacity-80"><Plus size={18} /></div>
						<input id="nav-task-title" type="text" bind:value={navInputTitle} onkeydown={onNavKeyDown} placeholder="Neuen Case erfassen... (Strg+Enter)" class="w-full bg-transparent border-0 py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-slate-400 focus:ring-0 outline-none" />
					</div>
					<div class="w-px h-6 bg-slate-700 shrink-0 mx-1"></div>
					<input type="text" bind:value={navInputRef} onkeydown={onNavKeyDown} placeholder="REF" class="w-24 bg-transparent border-0 py-2.5 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-300 placeholder:text-slate-500 focus:ring-0 outline-none text-center" />
					<div class="w-px h-6 bg-slate-700 shrink-0 mx-1"></div>
					<input type="date" bind:value={navInputDate} onkeydown={onNavKeyDown} class="w-36 bg-transparent border-0 py-2.5 px-3 text-sm text-slate-300 focus:ring-0 outline-none dark:[color-scheme:dark]" />
					<button onclick={handleNavAdd} class="shrink-0 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm rounded-lg transition-colors flex items-center gap-1.5 shadow-sm ml-1 outline-none focus:ring-2 focus:ring-white">Add</button>
				</div>

				<div class="flex items-center gap-1.5 shrink-0">
					<div class="relative group hidden lg:block">
						<Filter class="absolute left-3 top-2 text-slate-400 group-focus-within:text-brand-500 transition-colors" size={16}/>
						<input type="text" bind:value={refFilter} placeholder="Filter..." class="pl-9 pr-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-sm text-white placeholder:text-slate-500 focus:ring-1 focus:ring-brand-500 outline-none w-28 focus:w-48 transition-all" />
					</div>
					
					<a href="/" class="p-2.5 ml-2 text-brand-500 bg-brand-900/20 transition-colors rounded-xl" title="Board"><LayoutGrid size={20} /></a>
					
					<div class="w-px h-5 bg-slate-700 mx-1"></div>
					<button onclick={() => isChatOpen = !isChatOpen} class={`p-2.5 transition-colors rounded-xl outline-none focus:ring-2 focus:ring-brand-500 flex items-center justify-center ${isChatOpen ? 'text-brand-500 bg-brand-900/30' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`} title="Team Chat öffnen" >
						<div class="relative flex items-center justify-center">
							<MessageSquare size={20} />
							{#if chatStore.unreadCount > 0}
								<div class="absolute -top-1.5 -right-2 bg-rose-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-sm border border-slate-900 animate-in zoom-in">
									{chatStore.unreadCount > 9 ? '9+' : chatStore.unreadCount}
								</div>
							{/if}
						</div>
					</button>
					<div class="w-px h-5 bg-slate-700 mx-1"></div>

					<a href="/calendar" class="p-2.5 text-slate-300 hover:text-white transition-colors hover:bg-slate-800 rounded-xl" title="Kalender"><Calendar size={20} /></a>
					<a href="/workflow" class="p-2.5 text-slate-300 hover:text-white transition-colors hover:bg-slate-800 rounded-xl" title="Workflow"><GitBranch size={20} /></a>
					<a href="/resources" class="p-2.5 text-slate-300 hover:text-white transition-colors hover:bg-slate-800 rounded-xl" title="Ressourcen"><Building2 size={20} /></a>
					<a href="/abrechnung" class="p-2.5 text-slate-300 hover:text-white transition-colors hover:bg-slate-800 rounded-xl" title="Abrechnung"><DollarSign size={20} /></a>
					
					{#if isTeamLeader}
						<div class="w-px h-5 bg-slate-700 mx-2"></div>
						<a href="/team" class="p-2.5 text-brand-500 hover:text-brand-400 transition-colors hover:bg-slate-800 rounded-xl" title="Teamansicht"><Users size={20} /></a>
					{/if}

					<div class="w-px h-5 bg-slate-700 mx-2"></div>
					<a href="/archive" class="p-2.5 text-slate-300 hover:text-white transition-colors hover:bg-slate-800 rounded-full" title="Archiv"><ArchiveIcon size={20} /></a>
					<button onclick={printAgenda} title="Tagesagenda drucken" class="p-2.5 text-slate-300 hover:text-white transition-colors hover:bg-slate-800 rounded-full"><Printer size={20} /></button>
					<a href="/settings" class="p-2.5 text-slate-300 hover:text-white transition-colors hover:bg-slate-800 rounded-full" title="Einstellungen"><Settings size={20} /></a>
				</div>
			</div>
		</div>
	</nav>

	<main class="flex-1 min-h-0 flex flex-col w-full px-3 sm:px-6 py-4 gap-4 print:hidden">
		{#if refFilter}
			<div class="shrink-0 flex items-center gap-2 text-sm text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 p-2.5 rounded-lg border border-brand-200 dark:border-brand-800 w-fit mx-auto shadow-sm">
				<Filter size={16} class="text-brand-600"/>
				<span>Gefiltert nach: <strong>{refFilter}</strong></span>
				<button onclick={() => refFilter = ''} class="ml-3 hover:text-rose-600 font-bold">✕</button>
			</div>
		{/if}

		<div class={cn(
			"flex-1 min-h-0 grid divide-x divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden",
			isTeamLeader ? "grid-cols-6" : "grid-cols-4"
		)}>
			<div class="col-span-1 flex flex-col h-full min-h-0 overflow-hidden bg-slate-50/50 dark:bg-slate-900/50">
				<TaskColumn id="TODO" title="To Do" tasks={todos} color="bg-slate-600" />
			</div>
			
			<div class="col-span-2 flex flex-col h-full min-h-0 overflow-hidden bg-white dark:bg-slate-900">
				<TaskColumn id="WAITING" title="In Arbeit" tasks={waiting} color="bg-brand-500" />
			</div>
			
			{#if isTeamLeader}
				<div class="col-span-2 flex flex-col h-full min-h-0 overflow-hidden bg-slate-50/50 dark:bg-slate-900/50">
					<TaskColumn id="REVIEW" title="Review" tasks={review} color="bg-purple-600" />
				</div>
			{/if}
			
			<div class="col-span-1 flex flex-col h-full min-h-0 overflow-hidden bg-white dark:bg-slate-900">
				<TaskColumn id="DONE" title="Abgeschlossen" tasks={done} color="bg-emerald-600" />
			</div>
		</div>
	</main>

	<PrintAgenda tasks={myActiveTasks} userSign={currentUserSign} dateString={today} />
</div>