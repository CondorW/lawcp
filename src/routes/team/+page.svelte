<script lang="ts">
	import { store } from '$lib/stores/tasks';
	import { pb } from '$lib/pocketbase';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		ArrowLeft,
		Activity,
		AlertCircle,
		CheckCircle2,
		Clock,
		ShieldAlert,
		Flag,
		X,
		ListTodo,
		CheckSquare,
		Square,
		Calendar,
		Zap
	} from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import type { Task, Subtask } from '$lib/types';
	import { cn } from '$lib/utils';
	import { filterReviewSubtasks } from '$lib/domain/subtasks';
	import { belongsToLeader, getPrimaryRelationId } from '$lib/domain/users';

	let isTeamLeader = $derived(getPrimaryRelationId(pb.authStore.model?.teamLeader) === null);
	let myId = $derived(pb.authStore.model?.id || '');
	let selectedTask = $state<Task | null>(null);

	onMount(() => {
		if (!isTeamLeader) goto(resolve('/'));
	});

	const hasSubtaskInReview = (subtasks: Subtask[]): boolean =>
		filterReviewSubtasks(subtasks).length > 0;

	async function togglePriority(e: Event, task: Task): Promise<void> {
		e.stopPropagation();
		const newPrio = task.priority === 'HIGH' ? 'MEDIUM' : 'HIGH';

		if (selectedTask && selectedTask.id === task.id) {
			selectedTask = { ...selectedTask, priority: newPrio };
		}

		await store.updateTaskPriority(task.id, newPrio);
		if (selectedTask?.id === task.id) {
			selectedTask = $store.tasks.find((candidate) => candidate.id === task.id) ?? selectedTask;
		}
	}

	let teamMembers = $derived(
		$store.firmUsers.filter((user) => belongsToLeader(user.teamLeader, myId))
	);

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
					// Prio HIGH überschreibt normale Sortierung
					if (a.priority === 'HIGH' && b.priority !== 'HIGH') return -1;
					if (a.priority !== 'HIGH' && b.priority === 'HIGH') return 1;

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
	<div class="mt-2 space-y-2">
		{#each subtasks as sub (sub.id)}
			<div class="flex items-start gap-3">
				<div class="mt-0.5 shrink-0 text-slate-400">
					{#if sub.done}<CheckSquare size={16} class="text-emerald-500" />{:else}<Square
							size={16}
						/>{/if}
				</div>
				<div class="flex-1">
					<span
						class={`text-sm ${sub.done ? 'text-slate-400 line-through' : 'font-medium text-slate-700 dark:text-slate-200'}`}
						>{sub.title}</span
					>
					{#if sub.subtasks && sub.subtasks.length > 0}
						<div class="mt-2 ml-2 border-l-2 border-slate-100 pl-4 dark:border-slate-800">
							{@render subtaskTree(sub.subtasks)}
						</div>
					{/if}
				</div>
			</div>
		{/each}
	</div>
{/snippet}

{#if isTeamLeader}
	<div
		class="flex h-screen flex-col overflow-hidden bg-slate-50 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100 print:bg-white print:text-black"
	>
		<div
			class="relative flex min-h-[64px] shrink-0 items-center justify-center border-b border-slate-200 bg-white px-6 py-3 lg:px-8 dark:border-slate-800 dark:bg-slate-900"
		>
			<div class="absolute left-6 flex items-center gap-4 lg:left-8">
				<a
					href={resolve('/')}
					class="rounded-full border border-transparent p-1.5 transition-colors hover:border-slate-200 hover:bg-slate-100 dark:hover:border-slate-700 dark:hover:bg-slate-800"
					><ArrowLeft size={20} /></a
				>
				<h1 class="text-lg font-bold tracking-tight">Team-Radar</h1>
			</div>
			<div class="flex items-center gap-3">
				<div class="flex items-center gap-2 rounded-md bg-slate-100 px-3 py-1.5 dark:bg-slate-800">
					<Activity size={16} class="text-brand-500" /><span class="text-sm font-bold"
						>{globalMetrics.totalActive} <span class="font-normal text-slate-500">Aktiv</span></span
					>
				</div>
				<div class="flex items-center gap-2 rounded-md bg-slate-100 px-3 py-1.5 dark:bg-slate-800">
					<CheckCircle2 size={16} class="text-purple-500" /><span class="text-sm font-bold"
						>{globalMetrics.totalReview}
						<span class="font-normal text-slate-500">Review</span></span
					>
				</div>
				<div
					class={`flex items-center gap-2 rounded-md px-3 py-1.5 ${globalMetrics.totalOverdue > 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}
				>
					<AlertCircle size={16} /><span class="text-sm font-bold"
						>{globalMetrics.totalOverdue}
						<span class="font-normal opacity-80">Überfällig</span></span
					>
				</div>
			</div>
		</div>

		<div class="custom-scrollbar flex-1 overflow-auto p-6 lg:px-8">
			<div class="mx-auto flex max-w-[1800px] flex-wrap justify-center gap-8 pb-4">
				{#each userMetrics as data (data.user.id)}
					<div
						class="flex h-max w-full max-w-[400px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
					>
						<div
							class="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-900/50"
						>
							<div class="flex items-center gap-4">
								<div
									class="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-base font-bold text-slate-700 shadow-inner dark:bg-slate-700 dark:text-slate-200"
								>
									{data.user.shortsign}
								</div>
								<div>
									<h3 class="text-base leading-tight font-bold">
										{data.user.name || data.user.email}
									</h3>
									<div class="mt-1 text-xs font-medium text-slate-500">
										{data.active} offene Aufgaben
									</div>
								</div>
							</div>
							{#if data.overdueCount > 0}
								<div
									class="flex items-center gap-1.5 rounded bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700 dark:bg-red-900/30 dark:text-red-400"
								>
									<ShieldAlert size={14} />
									{data.overdueCount}
								</div>
							{/if}
						</div>
						<div
							class="grid shrink-0 grid-cols-3 divide-x divide-slate-100 border-b border-slate-100 dark:divide-slate-800 dark:border-slate-800"
						>
							<div class="p-3 text-center">
								<div class="text-xl font-bold text-slate-700 dark:text-slate-200">{data.todo}</div>
								<div class="mt-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
									To Do
								</div>
							</div>
							<div class="bg-brand-50/30 p-3 text-center dark:bg-brand-900/5">
								<div class="text-xl font-bold text-brand-600 dark:text-brand-500">
									{data.inArbeit}
								</div>
								<div class="mt-1 text-[10px] font-bold tracking-wider text-brand-500/70 uppercase">
									In Arbeit
								</div>
							</div>
							<div class="bg-purple-50/30 p-3 text-center dark:bg-purple-900/5">
								<div class="text-xl font-bold text-purple-600 dark:text-purple-500">
									{data.review}
								</div>
								<div class="mt-1 text-[10px] font-bold tracking-wider text-purple-500/70 uppercase">
									Review
								</div>
							</div>
						</div>
						<div class="bg-slate-50/30 p-5 dark:bg-slate-900/20">
							<h4
								class="mb-4 flex items-center gap-1.5 text-xs font-bold tracking-widest text-slate-400 uppercase"
							>
								<Clock size={14} /> Dringendste Aufgaben
							</h4>
							{#if data.urgentTasks.length > 0}
								<div class="space-y-3">
									{#each data.urgentTasks as task (task.id)}
										{@const effStatus =
											hasSubtaskInReview(task.subtasks) && task.status !== 'DONE'
												? 'REVIEW'
												: task.status}
										{@const isMicro = effStatus === 'REVIEW' && task.status !== 'REVIEW'}

										<button
											onclick={() => (selectedTask = task)}
											class={cn(
												'group flex w-full flex-col gap-2 rounded-lg border p-3.5 text-left shadow-sm transition-all focus:ring-2 focus:ring-brand-500 focus:outline-none',
												task.priority === 'HIGH'
													? 'border-red-300 bg-red-50/50 shadow-[0_0_10px_rgba(239,68,68,0.15)] hover:border-red-400 dark:border-red-800 dark:bg-red-900/20'
													: 'border-slate-200 bg-white hover:border-brand-400 hover:shadow-md dark:border-slate-700 dark:bg-slate-800'
											)}
										>
											<div class="flex w-full items-start justify-between gap-3">
												<span
													class="line-clamp-2 flex items-start gap-1.5 text-sm leading-snug font-bold text-slate-700 transition-colors group-hover:text-brand-700 dark:text-slate-200 dark:group-hover:text-brand-400"
												>
													{#if task.priority === 'HIGH'}
														<Zap size={14} class="mt-0.5 shrink-0 fill-red-500 text-red-500" />
													{/if}
													{task.title}
												</span>
												{#if task.matterRef}
													<span
														class="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap text-slate-500 uppercase dark:bg-slate-700"
														>{task.matterRef}</span
													>
												{/if}
											</div>
											<div
												class="mt-1 flex w-full items-center justify-between border-t border-slate-100 pt-2.5 dark:border-slate-700"
											>
												<span
													class={`rounded px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${effStatus === 'WAITING' ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400' : effStatus === 'REVIEW' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}
												>
													{isMicro
														? 'TEIL-REVIEW'
														: effStatus === 'WAITING'
															? 'IN ARBEIT'
															: effStatus}
												</span>
												{#if task.flaggedDate}
													<div
														class="flex items-center gap-1.5 rounded bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-600 dark:bg-red-900/20 dark:text-red-400"
													>
														<Flag size={12} class="fill-red-600 dark:fill-red-400" /> FRIST: {new Date(
															task.flaggedDate
														).toLocaleDateString('de-DE')}
													</div>
												{:else if task.dueDate}
													<div class="text-[11px] font-medium text-slate-500">
														Target: {new Date(task.dueDate).toLocaleDateString('de-DE')}
													</div>
												{/if}
											</div>
										</button>
									{/each}
								</div>
							{:else}
								<div
									class="flex flex-col items-center gap-2 py-6 text-center text-sm text-slate-400 italic"
								>
									<CheckCircle2 size={28} class="text-slate-300 dark:text-slate-700" /> Keine offenen
									Aufgaben
								</div>
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
	{@const displaySubs = isMicro
		? filterReviewSubtasks(selectedTask.subtasks || [])
		: selectedTask.subtasks || []}
	<div
		class="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
		transition:fade={{ duration: 150 }}
	>
		<div
			class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
			onclick={() => (selectedTask = null)}
			onkeydown={(e) => e.key === 'Escape' && (selectedTask = null)}
			role="button"
			tabindex="-1"
		></div>

		<div
			class={cn(
				'relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white transition-all dark:bg-slate-900',
				selectedTask.priority === 'HIGH' && selectedTask.status !== 'DONE'
					? 'border-transparent shadow-[0_0_25px_rgba(239,68,68,0.4)] ring-2 ring-red-500'
					: 'border border-slate-200 shadow-2xl dark:border-slate-800'
			)}
			transition:scale={{ duration: 200, start: 0.95 }}
		>
			<div
				class="flex items-start justify-between gap-4 rounded-t-2xl border-b border-slate-100 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900/80"
			>
				<div class="flex-1">
					<div class="mb-3 flex flex-wrap items-center gap-3">
						<span
							class={`rounded px-2 py-1 text-[10px] font-bold tracking-widest uppercase ${effStatus === 'WAITING' ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400' : effStatus === 'REVIEW' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}
						>
							{isMicro ? 'TEIL-REVIEW' : effStatus === 'WAITING' ? 'IN ARBEIT' : effStatus}
						</span>
						{#if selectedTask.matterRef}<span
								class="rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold tracking-wider text-slate-500 uppercase dark:border-slate-700 dark:bg-slate-800"
								>Ref: {selectedTask.matterRef}</span
							>{/if}

						<button
							onclick={(e) => togglePriority(e, selectedTask!)}
							class={cn(
								'flex items-center gap-1.5 rounded px-2 py-1 text-[10px] font-bold tracking-wider uppercase transition-colors outline-none focus:ring-2 focus:ring-red-500',
								selectedTask.priority === 'HIGH'
									? 'bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.4)]'
									: 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
							)}
						>
							<Zap size={12} class={selectedTask.priority === 'HIGH' ? 'fill-white' : ''} />
							{selectedTask.priority === 'HIGH' ? 'Prio: Hoch' : 'Prio Setzen'}
						</button>
					</div>
					<h2 class="text-xl leading-snug font-bold text-slate-900 dark:text-white">
						{selectedTask.title}
					</h2>
				</div>
				<button
					onclick={() => (selectedTask = null)}
					class="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
					><X size={20} /></button
				>
			</div>
			<div class="custom-scrollbar flex-1 overflow-y-auto p-6">
				<div
					class="mb-8 flex flex-wrap gap-6 rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50"
				>
					<div>
						<div class="mb-1 text-[10px] font-bold tracking-widest text-slate-400 uppercase">
							Zuständig
						</div>
						<div
							class="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200"
						>
							<div
								class="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold dark:bg-slate-700"
							>
								{selectedTask.expand?.owner?.shortsign || '?'}
							</div>
							<span>{selectedTask.expand?.owner?.name || 'Unbekannt'}</span>
						</div>
					</div>
					<div>
						<div class="mb-1 text-[10px] font-bold tracking-widest text-slate-400 uppercase">
							{selectedTask.flaggedDate ? 'Frist' : 'Target'}
						</div>
						{#if selectedTask.flaggedDate}<div
								class="flex items-center gap-1.5 text-sm font-bold text-red-600 dark:text-red-400"
							>
								<Flag size={14} class="fill-red-600 dark:fill-red-400" />{new Date(
									selectedTask.flaggedDate
								).toLocaleDateString('de-DE')}
							</div>{:else if selectedTask.dueDate}<div
								class="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200"
							>
								<Calendar size={14} class="text-slate-400" />{new Date(
									selectedTask.dueDate
								).toLocaleDateString('de-DE')}
							</div>{:else}<div class="text-sm text-slate-400 italic">Keine Frist</div>{/if}
					</div>
				</div>
				<div>
					<h3
						class="mb-4 flex items-center gap-2 border-b border-slate-100 pb-2 text-sm font-bold text-slate-900 dark:border-slate-800 dark:text-white"
					>
						<ListTodo size={16} class="text-slate-400" />{isMicro
							? 'Zu kontrollierende Subtasks'
							: 'Subtasks'}<span class="ml-1 font-normal text-slate-400"
							>({displaySubs.filter((s) => s.done).length} / {displaySubs.length})</span
						>
					</h3>
					{#if displaySubs && displaySubs.length > 0}{@render subtaskTree(displaySubs)}{:else}<div
							class="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-400 italic dark:border-slate-800 dark:bg-slate-900/50"
						>
							Keine Subtasks zur Kontrolle markiert.
						</div>{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
