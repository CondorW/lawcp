<script lang="ts">
	import {
		filterReviewSubtasks,
		getActiveSubtasks,
		getArchivedSubtasks
	} from '$lib/domain/subtasks';
	import { store } from '$lib/stores/tasks';
	import type { FirmUser, Task } from '$lib/types';
	import { cn } from '$lib/utils';
	import {
		Archive,
		BrainCircuit,
		ChevronDown,
		ChevronUp,
		Loader2,
		Plus,
		X,
		Zap
	} from 'lucide-svelte';
	import { onMount, tick } from 'svelte';
	import SubtaskItem from './SubtaskItem.svelte';
	import TaskFooter from './TaskFooter.svelte';
	import TaskTitle from './TaskTitle.svelte';

	interface Props {
		task: Task;
		myId: string;
		isOwner: boolean;
		ownerShortsign: string;
		isTeamLeader: boolean;
		teamMembers: FirmUser[];
		onClose: () => void;
	}

	type ContextStatus = 'idle' | 'loading' | 'dirty' | 'saving' | 'saved' | 'error';

	let { task, myId, isOwner, ownerShortsign, isTeamLeader, teamMembers, onClose }: Props = $props();
	let newSubtaskTitle = $state('');
	let showArchived = $state(false);
	let noteContent = $state('');
	let contextId = $state<string | undefined>();
	let contextStatus = $state<ContextStatus>('idle');

	let currentAssignee = $derived(task.assignees[0] ?? '');
	let activeSubtasks = $derived(getActiveSubtasks(task.subtasks));
	let archivedSubtasks = $derived(getArchivedSubtasks(task.subtasks));
	let reviewSubtasks = $derived(filterReviewSubtasks(activeSubtasks));
	let isMicroReview = $derived(!isOwner && task.status !== 'REVIEW' && reviewSubtasks.length > 0);
	let displaySubtasks = $derived(isMicroReview ? reviewSubtasks : activeSubtasks);

	onMount(() => {
		if (task.matterRef) void loadContext();
		void tick().then(() => document.getElementById(`new-subtask-${task.id}`)?.focus());
	});

	async function loadContext(): Promise<void> {
		if (!task.matterRef) return;
		contextStatus = 'loading';
		try {
			const record = await store.fetchContext(task.matterRef);
			contextId = record?.id;
			noteContent = record?.content ?? '';
			contextStatus = 'saved';
		} catch {
			contextStatus = 'error';
		}
	}

	async function saveContext(): Promise<boolean> {
		if (!task.matterRef || contextStatus === 'loading') return true;
		contextStatus = 'saving';
		const record = await store.saveContext(task.matterRef, noteContent, contextId);
		if (!record) {
			contextStatus = 'error';
			return false;
		}
		contextId = record.id;
		contextStatus = 'saved';
		return true;
	}

	async function close(): Promise<void> {
		if (task.matterRef && contextStatus === 'dirty' && !(await saveContext())) return;
		onClose();
	}

	function addSubtask(): void {
		const title = newSubtaskTitle.trim();
		if (!title) return;
		void store.addSubtask(task.id, title);
		newSubtaskTitle = '';
	}

	function assignTo(userId: string): void {
		if (currentAssignee !== userId) void store.assignTask(task.id, userId);
	}
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape') {
			event.preventDefault();
			void close();
		}
	}}
/>

<div
	class="fixed inset-0 z-[150] overflow-y-auto bg-slate-900/60 backdrop-blur-sm"
	role="presentation"
	onclick={(event) => event.target === event.currentTarget && void close()}
	ondragstart={(event) => {
		event.preventDefault();
		event.stopPropagation();
	}}
>
	<div
		class="flex min-h-full items-center justify-center p-4 sm:p-6"
		role="presentation"
		onclick={(event) => event.target === event.currentTarget && void close()}
	>
		<div
			class={cn(
				'flex h-[85vh] w-full flex-col overflow-hidden rounded-2xl bg-white transition-all duration-300 dark:bg-slate-900',
				task.matterRef ? 'max-w-6xl' : 'max-w-3xl',
				task.priority === 'HIGH' && task.status !== 'DONE'
					? 'border-transparent shadow-[0_0_30px_rgba(239,68,68,0.3)] ring-2 ring-red-500'
					: 'border border-slate-200 shadow-2xl dark:border-slate-800'
			)}
			role="dialog"
			aria-modal="true"
			aria-label={`Aufgabe ${task.title}`}
			tabindex="-1"
		>
			<header
				class="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-3 dark:border-slate-800 dark:bg-slate-800/50"
			>
				<div class="flex flex-wrap items-center gap-3">
					<span
						class="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-bold tracking-wider text-slate-700 uppercase dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
						>{task.matterRef || 'NO-REF'}</span
					>
					{#if !isOwner}
						<span
							class="rounded bg-brand-50 px-2 py-1 text-xs font-bold text-brand-600 uppercase dark:bg-brand-900/30 dark:text-brand-400"
							>{ownerShortsign}</span
						>
					{/if}
					{#if task.priority === 'HIGH'}
						<span
							class="flex items-center gap-1.5 rounded bg-red-500 px-2 py-1 text-[10px] font-bold tracking-wider text-white uppercase shadow-[0_0_10px_rgba(239,68,68,0.4)]"
						>
							<Zap size={12} class="fill-white" /> Prio
						</span>
					{/if}
				</div>
				<button
					onclick={() => void close()}
					class="rounded-lg p-1.5 text-slate-400 transition-colors outline-none hover:bg-slate-200 hover:text-slate-700 focus:ring-2 focus:ring-brand-500 dark:hover:bg-slate-700 dark:hover:text-slate-200"
					aria-label="Aufgabe schließen"
				>
					<X size={20} />
				</button>
			</header>

			<div class="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
				<main
					class="flex min-w-0 flex-1 shrink-0 flex-col gap-5 p-5 sm:p-6 md:shrink md:overflow-y-auto"
				>
					<div
						class="w-full min-w-0 text-lg font-bold [overflow-wrap:anywhere] break-words whitespace-normal text-slate-900 sm:text-xl dark:text-slate-100"
					>
						<TaskTitle {task} />
					</div>

					{#if isOwner && isTeamLeader}
						<div
							class="mb-1 flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-100 pb-4 dark:border-slate-800"
						>
							<span
								class="text-xs font-bold tracking-wider text-slate-400 uppercase dark:text-slate-500"
								>An:</span
							>
							<div class="flex flex-wrap gap-1.5">
								<button
									onclick={() => assignTo('')}
									class={cn(
										'rounded-lg border px-3 py-1.5 text-xs font-bold shadow-sm transition-all',
										currentAssignee === ''
											? 'border-yellow-300 bg-yellow-50 text-yellow-800 dark:border-slate-700 dark:bg-yellow-900/30 dark:text-yellow-400'
											: 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800'
									)}>ME</button
								>
								{#each teamMembers as user (user.id)}
									{#if user.id !== myId && user.shortsign}
										<button
											onclick={() => assignTo(user.id)}
											class={cn(
												'rounded-lg border px-3 py-1.5 text-xs font-bold uppercase shadow-sm transition-all',
												currentAssignee === user.id
													? 'border-brand-300 bg-brand-50 text-brand-800 dark:border-slate-700 dark:bg-brand-900/30 dark:text-brand-400'
													: 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800'
											)}>{user.shortsign}</button
										>
									{/if}
								{/each}
							</div>
						</div>
					{/if}

					{#if !isMicroReview}
						<div
							class="flex w-full min-w-0 shrink-0 items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 transition-colors focus-within:border-brand-500 focus-within:bg-white dark:border-slate-700/50 dark:bg-slate-800/50 dark:focus-within:bg-slate-800"
						>
							<Plus size={18} class="mt-[5px] shrink-0 text-slate-400" />
							<textarea
								id={`new-subtask-${task.id}`}
								bind:value={newSubtaskTitle}
								placeholder="Neuer Task..."
								class="min-h-[44px] w-full min-w-0 flex-grow resize-none border-0 bg-transparent text-sm leading-snug text-slate-800 outline-none placeholder:text-slate-400 focus:ring-0 dark:text-slate-200"
								rows="2"
								onkeydown={(event) => {
									if (event.key === 'Enter' && !event.shiftKey) {
										event.preventDefault();
										addSubtask();
									}
								}}
							></textarea>
						</div>
					{/if}

					<div
						class="grid w-full min-w-0 shrink-0 grid-cols-1 items-start gap-3 lg:grid-cols-2 [&_*]:min-w-0 [&_span]:[overflow-wrap:anywhere] [&_span]:break-words [&_span]:whitespace-normal"
					>
						{#each displaySubtasks as subtask (subtask.id)}
							<SubtaskItem taskId={task.id} sub={subtask} />
						{/each}
					</div>

					{#if archivedSubtasks.length > 0}
						<div
							class="mt-2 w-full min-w-0 shrink-0 border-t border-slate-100 pt-4 dark:border-slate-800"
						>
							<button
								onclick={() => (showArchived = !showArchived)}
								class="flex w-fit items-center gap-1.5 text-xs font-bold tracking-widest text-slate-400 uppercase transition-colors outline-none hover:text-brand-600 dark:hover:text-brand-400"
							>
								<Archive size={14} />
								{archivedSubtasks.length} Archiviert
								{#if showArchived}<ChevronUp size={14} />{:else}<ChevronDown size={14} />{/if}
							</button>
							{#if showArchived}
								<div
									class="mt-4 ml-2 grid w-full min-w-0 grid-cols-1 items-start gap-3 border-l-2 border-slate-200 pl-4 opacity-75 grayscale-[50%] lg:grid-cols-2 dark:border-slate-700"
								>
									{#each archivedSubtasks as subtask (subtask.id)}
										<SubtaskItem taskId={task.id} sub={subtask} />
									{/each}
								</div>
							{/if}
						</div>
					{/if}

					<div class="mt-auto shrink-0 border-t border-slate-100 pt-5 dark:border-slate-800">
						<TaskFooter {task} {isOwner} isExpanded />
					</div>
				</main>

				{#if task.matterRef}
					<aside
						class="flex min-h-[300px] w-full min-w-0 shrink-0 flex-col border-t border-slate-100 bg-slate-50/50 md:min-h-0 md:w-[380px] md:border-t-0 md:border-l lg:w-[450px] dark:border-slate-800 dark:bg-slate-900/30"
					>
						<div
							class="flex shrink-0 items-center gap-2 border-b border-slate-100 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900"
						>
							<div
								class="rounded bg-purple-100 p-1.5 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300"
							>
								<BrainCircuit size={16} />
							</div>
							<h3 class="text-sm font-bold text-slate-800 dark:text-slate-200">Aktennotizen</h3>
							{#if contextStatus === 'loading' || contextStatus === 'saving'}
								<Loader2 size={14} class="ml-auto animate-spin text-purple-500" />
							{/if}
						</div>
						<div class="relative flex min-h-0 flex-1 flex-col overflow-hidden p-4">
							<textarea
								bind:value={noteContent}
								oninput={() => (contextStatus = 'dirty')}
								onkeydown={(event) => {
									if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
										event.preventDefault();
										void close();
									}
								}}
								class="w-full min-w-0 flex-1 resize-none border-0 bg-transparent text-sm leading-relaxed text-slate-700 placeholder:text-slate-400 focus:ring-0 dark:text-slate-300"
								placeholder="Brain Dump: Strategie, Notizen... (Strg+Enter zum Schließen)"
								spellcheck="false"
							></textarea>
						</div>
						<div
							class="flex shrink-0 items-center justify-between border-t border-slate-100 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900"
						>
							<span
								class={cn(
									'flex items-center gap-1 text-[10px]',
									contextStatus === 'error' ? 'text-rose-500' : 'text-slate-400'
								)}
							>
								{#if contextStatus === 'saving'}<Loader2
										size={10}
										class="animate-spin text-purple-500"
									/> Speichere...
								{:else if contextStatus === 'dirty'}Nicht gespeichert
								{:else if contextStatus === 'error'}Speichern fehlgeschlagen
								{:else}Gesichert in PocketBase{/if}
							</span>
							<button
								onclick={() => void saveContext()}
								disabled={contextStatus === 'saving' || contextStatus === 'loading'}
								class="rounded bg-slate-900 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:opacity-50 dark:bg-purple-600"
							>
								Speichern
							</button>
						</div>
					</aside>
				{/if}
			</div>
		</div>
	</div>
</div>
