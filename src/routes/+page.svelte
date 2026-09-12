<script lang="ts">
	import { store } from '$lib/stores/tasks';
	import { chatStore } from '$lib/stores/chat.svelte';
	import { pb } from '$lib/pocketbase';
	import {
		Settings,
		LayoutGrid,
		Calendar,
		GitBranch,
		Building2,
		Filter,
		Printer,
		Users,
		DollarSign,
		ArchiveIcon,
		Plus,
		MessageSquare
	} from 'lucide-svelte';
	import TaskColumn from '$lib/components/TaskColumn.svelte';
	import PrintAgenda from '$lib/components/PrintAgenda.svelte';
	import ChatSidebar from '$lib/components/ChatSidebar.svelte';
	import type { Task } from '$lib/types';
	import { filterReviewSubtasks } from '$lib/domain/subtasks';
	import { toLocalDateInputValue } from '$lib/domain/dates';
	import { resolve } from '$app/paths';

	let navInputTitle = $state('');
	let navInputRef = $state('');
	let navInputDate = $state(toLocalDateInputValue());
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
			const myCases = $store.tasks.filter(
				(t) => t.owner === currentUserId || (t.assignees && t.assignees.includes(currentUserId))
			);
			const newestCase = [...myCases].sort(
				(a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
			)[0];

			if (newestCase) {
				const input =
					document.getElementById(`quick-add-${newestCase.id}`) ||
					document.getElementById(`new-subtask-${newestCase.id}`);
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

	const byDateAndPriority = (a: Task, b: Task): number => {
		const aCourtDeadline = a.flaggedDate;
		const bCourtDeadline = b.flaggedDate;
		const aIsCourtDeadline = Boolean(aCourtDeadline);
		const bIsCourtDeadline = Boolean(bCourtDeadline);

		if (aIsCourtDeadline && !bIsCourtDeadline) return -1;
		if (!aIsCourtDeadline && bIsCourtDeadline) return 1;
		if (aCourtDeadline && bCourtDeadline) {
			return new Date(aCourtDeadline).getTime() - new Date(bCourtDeadline).getTime();
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
		// FIX: REVIEW existiert als Board-Spalte nicht mehr. Wird für alle wie In Arbeit (WAITING) behandelt.
		if (t.status === 'REVIEW') {
			return 'WAITING';
		}
		return t.status;
	}

	function showOnMainBoard(t: Task) {
		const hasReview = filterReviewSubtasks(t.subtasks).length > 0;
		return isMyTask(t) || hasReview;
	}

	let todos = $derived(
		$store.tasks
			.filter(
				(t) =>
					!t.archived && effectiveStatus(t) === 'TODO' && matchesFilter(t) && showOnMainBoard(t)
			)
			.sort(byDateAndPriority)
	);
	let waiting = $derived(
		$store.tasks
			.filter(
				(t) =>
					!t.archived && effectiveStatus(t) === 'WAITING' && matchesFilter(t) && showOnMainBoard(t)
			)
			.sort(byDateAndPriority)
	);
	let done = $derived(
		$store.tasks
			.filter(
				(t) =>
					!t.archived && effectiveStatus(t) === 'DONE' && matchesFilter(t) && showOnMainBoard(t)
			)
			.sort(byDateAndPriority)
	);

	let myActiveTasks = $derived(
		$store.tasks
			.filter(
				(t) => !t.archived && ['TODO', 'WAITING'].includes(effectiveStatus(t)) && showOnMainBoard(t)
			)
			.sort(byDateAndPriority)
	);

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

<ChatSidebar bind:isOpen={isChatOpen} />

<div
	class="flex h-screen flex-col overflow-hidden bg-slate-50 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100 print:h-auto print:overflow-visible print:bg-white print:text-black"
>
	<nav
		class="sticky top-0 z-[100] w-full shrink-0 border-b border-slate-800 bg-slate-900 text-white shadow-lg print:hidden"
	>
		<div class="w-full px-3 sm:px-6">
			<div class="flex h-20 items-center justify-between gap-6">
				<div class="flex shrink-0 items-center gap-3">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-lg border border-brand-500 bg-brand-600 font-serif text-xl font-bold text-white shadow-sm"
					>
						L
					</div>
					<span class="font-sansserif hidden text-xl font-bold tracking-tight text-white xl:block"
						>LAWganized</span
					>
				</div>

				<div
					class="flex max-w-4xl flex-1 items-center rounded-xl border border-slate-700 bg-slate-800/80 p-1.5 shadow-inner transition-all focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500"
				>
					<div class="relative flex-1">
						<div class="absolute top-1/2 left-3.5 -translate-y-1/2 text-brand-500 opacity-80">
							<Plus size={18} />
						</div>
						<input
							id="nav-task-title"
							type="text"
							bind:value={navInputTitle}
							onkeydown={onNavKeyDown}
							placeholder="Neuen Case erfassen... (Strg+Enter)"
							class="w-full border-0 bg-transparent py-2.5 pr-3 pl-10 text-sm text-white outline-none placeholder:text-slate-400 focus:ring-0"
						/>
					</div>
					<div class="mx-1 h-6 w-px shrink-0 bg-slate-700"></div>
					<input
						type="text"
						bind:value={navInputRef}
						onkeydown={onNavKeyDown}
						placeholder="REF"
						class="w-24 border-0 bg-transparent px-3 py-2.5 text-center text-[11px] font-bold tracking-wider text-slate-300 uppercase outline-none placeholder:text-slate-500 focus:ring-0"
					/>
					<div class="mx-1 h-6 w-px shrink-0 bg-slate-700"></div>
					<input
						type="date"
						bind:value={navInputDate}
						onkeydown={onNavKeyDown}
						class="w-36 border-0 bg-transparent px-3 py-2.5 text-sm text-slate-300 outline-none focus:ring-0 dark:[color-scheme:dark]"
					/>
					<button
						onclick={handleNavAdd}
						class="ml-1 flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors outline-none hover:bg-brand-500 focus:ring-2 focus:ring-white"
						>Add</button
					>
				</div>

				<div class="flex shrink-0 items-center gap-1.5">
					<div class="group relative hidden lg:block">
						<Filter
							class="absolute top-2 left-3 text-slate-400 transition-colors group-focus-within:text-brand-500"
							size={16}
						/>
						<input
							type="text"
							bind:value={refFilter}
							placeholder="Filter..."
							class="w-28 rounded-lg border border-slate-700 bg-slate-800 py-2 pr-3 pl-9 text-sm text-white transition-all outline-none placeholder:text-slate-500 focus:w-48 focus:ring-1 focus:ring-brand-500"
						/>
					</div>

					<a
						href={resolve('/')}
						class="ml-2 rounded-xl bg-brand-900/20 p-2.5 text-brand-500 transition-colors"
						title="Board"><LayoutGrid size={20} /></a
					>

					<div class="mx-1 h-5 w-px bg-slate-700"></div>
					<button
						onclick={() => (isChatOpen = !isChatOpen)}
						class={`flex items-center justify-center rounded-xl p-2.5 transition-colors outline-none focus:ring-2 focus:ring-brand-500 ${isChatOpen ? 'bg-brand-900/30 text-brand-500' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
						title="Team Chat öffnen"
					>
						<div class="relative flex items-center justify-center">
							<MessageSquare size={20} />
							{#if chatStore.unreadCount > 0}
								<div
									class="animate-in zoom-in absolute -top-1.5 -right-2 flex h-4 w-4 items-center justify-center rounded-full border border-slate-900 bg-rose-500 text-[9px] font-bold text-white shadow-sm"
								>
									{chatStore.unreadCount > 9 ? '9+' : chatStore.unreadCount}
								</div>
							{/if}
						</div>
					</button>
					<div class="mx-1 h-5 w-px bg-slate-700"></div>

					<a
						href={resolve('/calendar')}
						class="rounded-xl p-2.5 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
						title="Kalender"><Calendar size={20} /></a
					>
					<a
						href={resolve('/workflow')}
						class="rounded-xl p-2.5 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
						title="Workflow"><GitBranch size={20} /></a
					>
					<a
						href={resolve('/resources')}
						class="rounded-xl p-2.5 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
						title="Ressourcen"><Building2 size={20} /></a
					>
					<a
						href={resolve('/abrechnung')}
						class="rounded-xl p-2.5 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
						title="Abrechnung"><DollarSign size={20} /></a
					>

					{#if isTeamLeader}
						<div class="mx-2 h-5 w-px bg-slate-700"></div>
						<a
							href={resolve('/team')}
							class="rounded-xl p-2.5 text-brand-500 transition-colors hover:bg-slate-800 hover:text-brand-400"
							title="Teamansicht"><Users size={20} /></a
						>
					{/if}

					<div class="mx-2 h-5 w-px bg-slate-700"></div>
					<a
						href={resolve('/archive')}
						class="rounded-full p-2.5 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
						title="Archiv"><ArchiveIcon size={20} /></a
					>
					<button
						onclick={printAgenda}
						title="Tagesagenda drucken"
						class="rounded-full p-2.5 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
						><Printer size={20} /></button
					>
					<a
						href={resolve('/settings')}
						class="rounded-full p-2.5 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
						title="Einstellungen"><Settings size={20} /></a
					>
				</div>
			</div>
		</div>
	</nav>

	<main class="flex min-h-0 w-full flex-1 flex-col gap-4 px-3 py-4 sm:px-6 print:hidden">
		{#if refFilter}
			<div
				class="mx-auto flex w-fit shrink-0 items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 p-2.5 text-sm text-brand-700 shadow-sm dark:border-brand-800 dark:bg-brand-900/20 dark:text-brand-400"
			>
				<Filter size={16} class="text-brand-600" />
				<span>Gefiltert nach: <strong>{refFilter}</strong></span>
				<button onclick={() => (refFilter = '')} class="ml-3 font-bold hover:text-rose-600"
					>✕</button
				>
			</div>
		{/if}

		<!-- FIX: Ein sauberes, stures 4-Spalten-Layout (1:2:1 Ratio) für ALLE (Leader & Member). Keine Review Spalte mehr. -->
		<div
			class="grid min-h-0 flex-1 grid-cols-4 divide-x divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900"
		>
			<div
				class="col-span-1 flex h-full min-h-0 flex-col overflow-hidden bg-slate-50/50 dark:bg-slate-900/50"
			>
				<TaskColumn id="TODO" title="To Do" tasks={todos} color="bg-slate-600" />
			</div>

			<div
				class="col-span-2 flex h-full min-h-0 flex-col overflow-hidden bg-white dark:bg-slate-900"
			>
				<TaskColumn id="WAITING" title="In Arbeit" tasks={waiting} color="bg-brand-500" />
			</div>

			<div
				class="col-span-1 flex h-full min-h-0 flex-col overflow-hidden bg-white dark:bg-slate-900"
			>
				<TaskColumn id="DONE" title="Abgeschlossen" tasks={done} color="bg-emerald-600" />
			</div>
		</div>
	</main>

	<PrintAgenda tasks={myActiveTasks} userSign={currentUserSign} dateString={today} />
</div>
