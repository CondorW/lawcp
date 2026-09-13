<script module lang="ts">
	const expandedTaskIds: string[] = [];

	function isRememberedAsExpanded(taskId: string): boolean {
		return expandedTaskIds.includes(taskId);
	}

	function rememberExpandedState(taskId: string, expanded: boolean): void {
		const index = expandedTaskIds.indexOf(taskId);
		if (expanded && index < 0) expandedTaskIds.push(taskId);
		if (!expanded && index >= 0) expandedTaskIds.splice(index, 1);
	}
</script>

<script lang="ts">
	import { isTaskStale } from '$lib/domain/subtasks';
	import { belongsToLeader, getPrimaryRelationId } from '$lib/domain/users';
	import { pb } from '$lib/pocketbase';
	import { store } from '$lib/stores/tasks';
	import type { Task } from '$lib/types';
	import { onMount } from 'svelte';
	import TaskCardSummary from './task/TaskCardSummary.svelte';
	import TaskDetailsDialog from './task/TaskDetailsDialog.svelte';

	let { task }: { task: Task } = $props();

	const myId = pb.authStore.model?.id ?? '';
	const isTeamLeader = getPrimaryRelationId(pb.authStore.model?.teamLeader) === null;
	let isExpanded = $state(false);

	let isOwner = $derived(task.owner === myId || task.assignees.includes(myId));
	let ownerShortsign = $derived(task.expand?.owner?.shortsign ?? '?');
	let teamMembers = $derived(
		$store.firmUsers.filter((user) => belongsToLeader(user.teamLeader, myId))
	);
	let stale = $derived(
		task.status !== 'DONE' && !task.archived && isTaskStale(task.createdAt, task.subtasks)
	);

	$effect(() => {
		rememberExpandedState(task.id, isExpanded);
	});

	onMount(() => {
		isExpanded = isRememberedAsExpanded(task.id);
		const createdAt = new Date(task.createdAt).getTime();
		if (Number.isFinite(createdAt) && Date.now() - createdAt < 3_000) isExpanded = true;
	});
</script>

<TaskCardSummary
	{task}
	team={$store.settings.team}
	{isOwner}
	{ownerShortsign}
	isStale={stale}
	onOpen={() => (isExpanded = true)}
/>

{#if isExpanded}
	<TaskDetailsDialog
		{task}
		{myId}
		{isOwner}
		{ownerShortsign}
		{isTeamLeader}
		{teamMembers}
		onClose={() => (isExpanded = false)}
	/>
{/if}
