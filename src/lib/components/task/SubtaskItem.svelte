<script lang="ts">
	import { store } from '$lib/stores/tasks';
	import { pb } from '$lib/pocketbase';
	import type { Subtask } from '$lib/types';
	import {
		CheckSquare,
		Square,
		Copy,
		ListPlus,
		CornerDownRight,
		Check,
		X,
		Trash2,
		Eye,
		ShieldAlert,
		BadgeCheck,
		Archive,
		ArchiveRestore
	} from 'lucide-svelte';
	import { cn } from '$lib/utils';
	import { autosize, focusOnMount } from '$lib/actions';
	import TaggedText from '$lib/components/text/TaggedText.svelte';
	import { belongsToLeader } from '$lib/domain/users';

	export let taskId: string;
	export let sub: Subtask;

	$: parentTask = $store.tasks.find((t) => t.id === taskId);
	const myId = pb.authStore.model?.id || '';
	$: isTeamLeader = belongsToLeader(parentTask?.expand?.owner?.teamLeader, myId);

	let isEditing = false;
	let addingChild = false;
	let newChildTitle = '';

	function startEdit() {
		isEditing = true;
		setTimeout(() => document.getElementById(`sub-edit-${sub.id}`)?.focus(), 10);
	}

	function stopEdit() {
		isEditing = false;
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
			e.preventDefault();
			stopEdit();
		}
		if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
			e.preventDefault();
			stopEdit();
			startAddChild();
		}
	}

	function startAddChild() {
		addingChild = true;
		newChildTitle = '';
	}
	function cancelAddChild() {
		addingChild = false;
		newChildTitle = '';
	}

	function confirmAddChild() {
		if (newChildTitle.trim()) {
			store.addSubSubtask(taskId, sub.id, newChildTitle.trim());
			newChildTitle = '';
		} else {
			cancelAddChild();
		}
	}

	async function copyEmail() {
		const team = $store.settings.team;
		const leader = team.find((m) => m.isLeader);
		const recipientName = leader ? leader.name : 'Kollegen';
		const body = `Liebe ${recipientName},\n\n${sub.title}\n\nLG`;
		try {
			await navigator.clipboard.writeText(body);
			alert('E-Mail kopiert!');
		} catch (e) {
			console.error(e);
		}
	}

	function getFullFilename(variant: string) {
		const date = new Date()
			.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
			.replace(/\./g, '-');
		const cleanSub = sub.title.replace(/[^a-zA-Z0-9äöüÄÖÜß ]/g, '').trim();
		return `${date} - ${cleanSub} ${variant}`;
	}
</script>

<div
	class={cn(
		'group/sub flex flex-col gap-1 rounded-lg border bg-gray-50/80 p-2 text-sm transition-colors dark:bg-slate-900/50',
		sub.reviewState === 'REQUESTED'
			? 'border-purple-300 bg-purple-50/30 dark:border-purple-800 dark:bg-purple-900/10'
			: sub.reviewState === 'REVISION'
				? 'border-red-300 bg-red-50/30 dark:border-red-800 dark:bg-red-900/10'
				: sub.reviewState === 'APPROVED'
					? 'border-emerald-300 bg-emerald-50/30 dark:border-emerald-800 dark:bg-emerald-900/10'
					: 'border-gray-100 dark:border-slate-700'
	)}
>
	<div class="relative flex w-full items-start gap-2">
		<button
			onclick={() => store.toggleSubtask(taskId, sub.id)}
			class="mt-0.5 flex-shrink-0 text-gray-400 hover:text-brand-600"
		>
			{#if sub.done}<CheckSquare size={16} class="text-brand-500" />{:else}<Square size={16} />{/if}
		</button>

		{#if isEditing}
			<textarea
				id={`sub-edit-${sub.id}`}
				use:autosize
				value={sub.title}
				onchange={(e) => store.updateSubtaskTitle(taskId, sub.id, e.currentTarget.value)}
				onblur={stopEdit}
				onkeydown={handleKeyDown}
				rows="1"
				spellcheck="false"
				class="block min-h-[20px] w-full min-w-0 flex-grow resize-none overflow-hidden rounded border border-brand-300 bg-white p-1 text-sm leading-snug break-words whitespace-pre-wrap focus:ring-0 dark:bg-slate-800"
			></textarea>
		{:else}
			<div
				role="button"
				tabindex="0"
				onclick={startEdit}
				onkeydown={(e) => e.key === 'Enter' && startEdit()}
				class={cn(
					'-mx-1 min-h-[20px] w-full min-w-0 flex-grow cursor-text rounded border border-transparent p-0 px-1 text-sm leading-snug break-words whitespace-pre-wrap hover:border-slate-200',
					sub.done && 'text-gray-400 line-through'
				)}
			>
				<TaggedText text={sub.title} team={$store.settings.team} />

				{#if sub.reviewState === 'APPROVED'}
					<span
						class="ml-2 inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600"
					>
						<BadgeCheck size={12} /> FREIGEGEBEN
					</span>
				{:else if sub.reviewState === 'REVISION'}
					<span
						class="ml-2 inline-flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600"
					>
						<ShieldAlert size={12} /> KORREKTUR
					</span>
				{/if}
			</div>
		{/if}

		<div class="flex flex-shrink-0 items-center gap-0.5">
			{#if !sub.done}
				{#if sub.reviewState === 'REQUESTED' && isTeamLeader}
					<button
						onclick={(e) => {
							e.stopPropagation();
							store.setSubtaskReviewState(taskId, sub.id, 'APPROVED');
						}}
						class="mr-1 rounded bg-emerald-100 p-1 text-emerald-600 transition-colors hover:text-emerald-700"
						title="Freigeben"
					>
						<Check size={14} />
					</button>
					<button
						onclick={(e) => {
							e.stopPropagation();
							store.setSubtaskReviewState(taskId, sub.id, 'REVISION');
						}}
						class="mr-1 rounded bg-red-100 p-1 text-red-600 transition-colors hover:text-red-700"
						title="Korrektur anfordern"
					>
						<X size={14} />
					</button>
				{:else}
					<button
						onclick={(e) => {
							e.stopPropagation();
							const newState = sub.reviewState === 'REQUESTED' ? null : 'REQUESTED';
							store.setSubtaskReviewState(taskId, sub.id, newState);
						}}
						class={cn(
							'mt-0.5 transition-all',
							sub.reviewState === 'REQUESTED'
								? 'text-purple-600 opacity-100 dark:text-purple-400'
								: 'text-gray-300 opacity-0 group-hover/sub:opacity-100 hover:text-purple-600'
						)}
						title={sub.reviewState === 'REQUESTED' ? 'Review abbrechen' : 'Review anfordern'}
					>
						<Eye size={14} />
					</button>
				{/if}
			{/if}

			<button
				onclick={startAddChild}
				class="mt-0.5 text-gray-300 opacity-0 transition-opacity group-hover/sub:opacity-100 hover:text-brand-600"
				title="Subtask hinzufügen"
			>
				<ListPlus size={14} />
			</button>

			{#if sub.type === 'EMAIL'}
				<button
					onclick={copyEmail}
					class="mt-0.5 text-gray-300 opacity-0 group-hover/sub:opacity-100 hover:text-yellow-600"
					title="E-Mail kopieren"
				>
					<Copy size={14} />
				</button>
			{/if}

			<button
				onclick={(e) => {
					e.stopPropagation();
					store.archiveSubtask(taskId, sub.id, !sub.archived);
				}}
				class="mt-0.5 ml-1 text-gray-300 opacity-0 transition-opacity group-hover/sub:opacity-100 hover:text-brand-500"
				title={sub.archived ? 'Wiederherstellen' : 'Archivieren'}
			>
				{#if sub.archived}
					<ArchiveRestore size={14} />
				{:else}
					<Archive size={14} />
				{/if}
			</button>

			<button
				onclick={(e) => {
					e.stopPropagation();
					store.deleteSubtask(taskId, sub.id);
				}}
				class="mt-0.5 text-gray-300 opacity-0 transition-opacity group-hover/sub:opacity-100 hover:text-red-500"
				title="Löschen"
			>
				<Trash2 size={14} />
			</button>
		</div>
	</div>

	{#if !sub.done && sub.type === 'DOCUMENT'}
		<div class="flex gap-3 pl-7">
			<button
				onclick={() => navigator.clipboard.writeText(getFullFilename('Redline'))}
				class="flex items-center gap-1 text-xs text-gray-400 hover:text-brand-600"
				><Copy size={12} /> Redline</button
			>
			<button
				onclick={() => navigator.clipboard.writeText(getFullFilename('Cleaned'))}
				class="flex items-center gap-1 text-xs text-gray-400 hover:text-green-600"
				><Copy size={12} /> Cleaned</button
			>
		</div>
	{/if}

	{#if (sub.subtasks && sub.subtasks.length > 0) || addingChild}
		<div class="mt-1 ml-2 space-y-1 border-l-2 border-slate-200 pl-4 dark:border-slate-700">
			{#each sub.subtasks || [] as child (child.id)}
				<svelte:self {taskId} sub={child} />
			{/each}

			{#if addingChild}
				<div
					class="animate-in fade-in slide-in-from-top-1 flex w-full items-start gap-2 duration-200"
				>
					<div class="mt-1.5 flex-shrink-0 text-brand-500"><CornerDownRight size={12} /></div>
					<div class="flex min-w-0 flex-grow items-start gap-2">
						<textarea
							use:autosize={newChildTitle}
							use:focusOnMount
							bind:value={newChildTitle}
							onkeydown={(e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									confirmAddChild();
								}
								if (e.key === 'Escape') cancelAddChild();
							}}
							onblur={() => {
								if (!newChildTitle.trim()) cancelAddChild();
							}}
							rows="1"
							placeholder="Unterschritt..."
							class="block min-h-[32px] w-full min-w-0 flex-grow resize-none overflow-hidden rounded border border-brand-500 bg-white p-2 text-xs leading-snug break-words whitespace-pre-wrap text-gray-900 shadow-sm focus:ring-0 dark:bg-slate-800 dark:text-white"
						></textarea>
						<div class="flex flex-shrink-0 gap-1">
							<button
								onclick={confirmAddChild}
								class="flex h-8 w-8 items-center justify-center rounded bg-brand-50 p-1.5 text-brand-600 hover:text-brand-700 dark:bg-brand-900/20"
								><Check size={14} /></button
							>
							<button
								onclick={cancelAddChild}
								class="flex h-8 w-8 items-center justify-center rounded bg-slate-50 p-1.5 text-slate-400 hover:text-slate-600 dark:bg-slate-800"
								><X size={14} /></button
							>
						</div>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>
