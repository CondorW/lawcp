<script lang="ts">
	import { store } from '$lib/stores/tasks';
	import { pb } from '$lib/pocketbase';
	import { goto } from '$app/navigation';
	import { ArrowLeft, Activity, AlertCircle, CheckCircle2, Clock, ShieldAlert, Flag, X, ListTodo, CheckSquare, Square, Calendar } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import type { Task, Subtask } from '$lib/types';

	let isTeamLeader = $derived(!pb.authStore.model?.teamLeader);
	let myId = $derived(pb.authStore.model?.id || '');
	let selectedTask = $state<Task | null>(null);

	onMount(() => {
		if (!isTeamLeader) goto('/');
	});

	const hasSubtaskInReview = (subtasks: any[]): boolean => {
		if (!subtasks || !Array.isArray(subtasks)) return false;
		for (const sub of subtasks) {
			if (sub.reviewState === 'REQUESTED') return true;
			if (sub.subtasks && hasSubtaskInReview(sub.subtasks)) return true;
		}
		return false;
	};

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

	let teamMembers = $derived($store.firmUsers.filter((u) => u.teamLeader === myId));

	let userMetrics = $derived(
		teamMembers.map((user) => {
			const tasks = $store.tasks.filter(
				(t) => !t.archived && (t.owner === user.id || t.assignees?.includes(user.id))
			);

			const getEffectiveStatus = (t: Task) =>
				hasSubtaskInReview(t.subtasks) && t.status !== 'DONE' ? 'REVIEW' : t.status;

			const todo = tasks.filter((t) => getEffectiveStatus(t) === 'TODO').length;
			const inArbeit = tasks.filter((t) => getEffectiveStatus(t) === 'WAITING').length;
			const review = tasks.filter((t) => getEffectiveStatus(t) === 'REVIEW').length;
			const done = tasks.filter((t) => getEffectiveStatus(t) === 'DONE').length;

			const activeTasks = tasks.filter((t) => t.status !== 'DONE');

			const overdueTasks = activeTasks.filter((t) => {
				const date = t.flaggedDate || t.dueDate;
				if (!date) return false;
				const isPast = new Date(date).getTime() < new Date().getTime();
				const isNotToday = new Date(date).toDateString() !== new Date().toDateString();
				return isPast && isNotToday;
			});

			const urgentTasks = activeTasks
				.slice()
				.sort((a, b) => {
					const aIsCourt = a.flaggedDate !== null;
					const bIsCourt = b.flaggedDate !== null;
					if (aIsCourt && !bIsCourt) return -1;
					if (!aIsCourt && bIsCourt) return 1;

					const dateA = a.flaggedDate || a.dueDate;
					const dateB = b.flaggedDate || b.dueDate;
					if (!dateA) return 1;
					if (!dateB) return -1;
					return new Date(dateA).getTime() - new Date(dateB).getTime();
				})
				.slice(0, 5);

			return {
				user,
				total: tasks.length,
				active: activeTasks.length,
				todo,
				inArbeit,
				review,
				done,
				overdueCount: overdueTasks.length,
				urgentTasks
			};
		})
	);

	let globalMetrics = $derived({
		totalActive: userMetrics.reduce((acc, curr) => acc + curr.active, 0),
		totalReview: userMetrics.reduce((acc, curr) => acc + curr.review, 0),
		totalOverdue: userMetrics.reduce((acc, curr) => acc + curr.overdueCount, 0)
	});

</script>

{#snippet subtaskTree(subtasks: Subtask[])}
	<div class="space-y-2 mt-2">
		{#each subtasks as sub}
			<div class="flex items-start gap-3">
				<div class="mt-0.5 text-slate-400 shrink-0">
					{#if sub.done}<CheckSquare size={16} class="text-emerald-500" />{:else}<Square size={16} />{/if}
				</div>
				<div class="flex-1">
					<span class={`text-sm ${sub.done ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200 font-medium'}`}>{sub.title}</span>
					{#if sub.subtasks && sub.subtasks.length > 0}
						<div class="ml-2 pl-4 border-l-2 border-slate-100 dark:border-slate-800 mt-2">
							{@render subtaskTree(sub.subtasks)}
						</div>
					{/if}
				</div>
			</div>
		{/each}
	</div>
{/snippet}

{#if isTeamLeader}
	<div class="h-screen overflow-hidden flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans print:bg-white print:text-black">
		<div class="shrink-0 relative py-3 px-6 lg:px-8 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-center items-center min-h-[64px]">
			<div class="absolute left-6 lg:left-8 flex items-center gap-4">
				<a href="/" class="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700"><ArrowLeft size={20} /></a>
				<h1 class="text-lg font-bold tracking-tight">Team-Radar</h1>
			</div>
			<div class="flex items-center gap-3">
				<div class="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-md">
					<Activity size={16} class="text-brand-500"/><span class="text-sm font-bold">{globalMetrics.totalActive} <span class="text-slate-500 font-normal">Aktiv</span></span>
				</div>
				<div class="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-md">
					<CheckCircle2 size={16} class="text-purple-500"/><span class="text-sm font-bold">{globalMetrics.totalReview} <span class="text-slate-500 font-normal">Review</span></span>
				</div>
				<div class={`flex items-center gap-2 px-3 py-1.5 rounded-md ${globalMetrics.totalOverdue > 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
					<AlertCircle size={16} /><span class="text-sm font-bold">{globalMetrics.totalOverdue} <span class="opacity-80 font-normal">Überfällig</span></span>
				</div>
			</div>
		</div>

		<div class="flex-1 overflow-auto custom-scrollbar p-6 lg:px-8">
			<div class="flex flex-wrap justify-center gap-8 max-w-[1800px] mx-auto pb-4">
				{#each userMetrics as data}
					<div class="w-full max-w-[400px] bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col h-max overflow-hidden">
						<div class="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center shrink-0">
							<div class="flex items-center gap-4">
								<div class="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-base shadow-inner">
									{data.user.shortsign}
								</div>
								<div>
									<h3 class="font-bold text-base leading-tight">{(data.user as any).name || data.user.email}</h3>
									<div class="text-xs text-slate-500 font-medium mt-1">{data.active} offene Aufgaben</div>
								</div>
							</div>
							{#if data.overdueCount > 0}
								<div class="flex items-center gap-1.5 px-2.5 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-bold rounded">
									<ShieldAlert size={14} /> {data.overdueCount}
								</div>
							{/if}
						</div>
						<div class="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800 border-b border-slate-100 dark:border-slate-800 shrink-0">
							<div class="p-3 text-center">
								<div class="text-xl font-bold text-slate-700 dark:text-slate-200">{data.todo}</div>
								<div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">To Do</div>
							</div>
							<div class="p-3 text-center bg-brand-50/30 dark:bg-brand-900/5">
								<div class="text-xl font-bold text-brand-600 dark:text-brand-500">{data.inArbeit}</div>
								<div class="text-[10px] font-bold text-brand-500/70 uppercase tracking-wider mt-1">In Arbeit</div>
							</div>
							<div class="p-3 text-center bg-purple-50/30 dark:bg-purple-900/5">
								<div class="text-xl font-bold text-purple-600 dark:text-purple-500">{data.review}</div>
								<div class="text-[10px] font-bold text-purple-500/70 uppercase tracking-wider mt-1">Review</div>
							</div>
						</div>
						<div class="p-5 bg-slate-50/30 dark:bg-slate-900/20">
							<h4 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5"><Clock size={14} /> Dringendste Aufgaben</h4>
							{#if data.urgentTasks.length > 0}
								<div class="space-y-3">
									{#each data.urgentTasks as task}
										{@const effStatus = hasSubtaskInReview(task.subtasks) && task.status !== 'DONE' ? 'REVIEW' : task.status}
										{@const isMicro = effStatus === 'REVIEW' && task.status !== 'REVIEW'}
										<button onclick={() => selectedTask = task} class="w-full text-left group flex flex-col gap-2 p-3.5 rounded-lg border bg-white dark:bg-slate-800 shadow-sm transition-all hover:border-brand-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-500">
											<div class="flex justify-between items-start gap-3 w-full">
												<span class="text-sm font-bold text-slate-700 dark:text-slate-200 line-clamp-2 leading-snug group-hover:text-brand-700 dark:group-hover:text-brand-400 transition-colors">{task.title}</span>
												{#if task.matterRef}
													<span class="text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-slate-500 whitespace-nowrap uppercase shrink-0">{task.matterRef}</span>
												{/if}
											</div>
											<div class="flex justify-between items-center mt-1 border-t border-slate-100 dark:border-slate-700 pt-2.5 w-full">
												<span class={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${effStatus === 'WAITING' ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400' : effStatus === 'REVIEW' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
													{isMicro ? 'TEIL-REVIEW' : (effStatus === 'WAITING' ? 'IN ARBEIT' : effStatus)}
												</span>
												{#if task.flaggedDate}
													<div class="flex items-center gap-1.5 text-[11px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded"><Flag size={12} class="fill-red-600 dark:fill-red-400" /> FRIST: {new Date(task.flaggedDate).toLocaleDateString('de-DE')}</div>
												{:else if task.dueDate}
													<div class="text-[11px] font-medium text-slate-500">Target: {new Date(task.dueDate).toLocaleDateString('de-DE')}</div>
												{/if}
											</div>
										</button>
									{/each}
								</div>
							{:else}
								<div class="text-sm text-slate-400 italic text-center py-6 flex flex-col items-center gap-2"><CheckCircle2 size={28} class="text-slate-300 dark:text-slate-700" /> Keine offenen Aufgaben</div>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}

{#if selectedTask}
	{@const isMicro = selectedTask.status !== 'REVIEW' && hasSubtaskInReview(selectedTask.subtasks)}
	{@const effStatus = isMicro ? 'REVIEW' : selectedTask.status}
	{@const displaySubs = isMicro ? filterReviewSubtasks(selectedTask.subtasks || []) : (selectedTask.subtasks || [])}
	<div class="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6" transition:fade={{ duration: 150 }}>
		<div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onclick={() => selectedTask = null} onkeydown={(e) => e.key === 'Escape' && (selectedTask = null)} role="button" tabindex="-1"></div>
		<div class="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]" transition:scale={{ duration: 200, start: 0.95 }}>
			<div class="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 rounded-t-2xl flex justify-between items-start gap-4">
				<div class="flex-1">
					<div class="flex items-center gap-3 mb-3">
						<span class={`text-[10px] font-bold px-2 py-1 rounded tracking-widest uppercase ${effStatus === 'WAITING' ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400' : effStatus === 'REVIEW' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
							{isMicro ? 'TEIL-REVIEW' : (effStatus === 'WAITING' ? 'IN ARBEIT' : effStatus)}
						</span>
						{#if selectedTask.matterRef}<span class="text-[10px] font-bold px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-500 uppercase tracking-wider">Ref: {selectedTask.matterRef}</span>{/if}
					</div>
					<h2 class="text-xl font-bold text-slate-900 dark:text-white leading-snug">{selectedTask.title}</h2>
				</div>
				<button onclick={() => selectedTask = null} class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"><X size={20} /></button>
			</div>
			<div class="p-6 overflow-y-auto custom-scrollbar flex-1">
				<div class="flex flex-wrap gap-6 mb-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
					<div>
						<div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Zuständig</div>
						<div class="text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2"><div class="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold">{selectedTask.expand?.owner?.shortsign || '?'}</div><span>{(selectedTask.expand?.owner as any)?.name || 'Unbekannt'}</span></div>
					</div>
					<div>
						<div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{selectedTask.flaggedDate ? 'Frist' : 'Target'}</div>
						{#if selectedTask.flaggedDate}<div class="text-sm font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5"><Flag size={14} class="fill-red-600 dark:fill-red-400" />{new Date(selectedTask.flaggedDate).toLocaleDateString('de-DE')}</div>{:else if selectedTask.dueDate}<div class="text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5"><Calendar size={14} class="text-slate-400" />{new Date(selectedTask.dueDate).toLocaleDateString('de-DE')}</div>{:else}<div class="text-sm text-slate-400 italic">Keine Frist</div>{/if}
					</div>
				</div>
				<div>
					<h3 class="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2"><ListTodo size={16} class="text-slate-400" />{isMicro ? 'Zu kontrollierende Subtasks' : 'Subtasks'}<span class="text-slate-400 font-normal ml-1">({displaySubs.filter(s => s.done).length} / {displaySubs.length})</span></h3>
					{#if displaySubs && displaySubs.length > 0}{@render subtaskTree(displaySubs)}{:else}<div class="text-sm text-slate-400 italic bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 text-center">Keine Subtasks zur Kontrolle markiert.</div>{/if}
				</div>
			</div>
		</div>
	</div>
{/if}