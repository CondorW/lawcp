<script lang="ts">
	import { toLocalDateInputValue } from '$lib/domain/dates';
	import { belongsToLeader, getPrimaryRelationId } from '$lib/domain/users';
	import BillingSummary from '$lib/features/billing/BillingSummary.svelte';
	import BillingToolbar from '$lib/features/billing/BillingToolbar.svelte';
	import CompletedTasksPanel from '$lib/features/billing/CompletedTasksPanel.svelte';
	import TimeLogDialog from '$lib/features/billing/TimeLogDialog.svelte';
	import TimeLogTable from '$lib/features/billing/TimeLogTable.svelte';
	import {
		aggregateTimeLogs,
		createBillingCsv,
		groupCompletedTasksToday,
		type BillingFilterMode,
		type BillingViewMode,
		type EnrichedTimeLog,
		type TimeLogFormValue
	} from '$lib/features/billing/billing';
	import { pb } from '$lib/pocketbase';
	import { store } from '$lib/stores/tasks';

	let filterMode = $state<BillingFilterMode>('TODAY');
	let viewMode = $state<BillingViewMode>('ME');
	let showTimeLogDialog = $state(false);
	let editingLog = $state<EnrichedTimeLog | null>(null);

	let myId = $derived(pb.authStore.model?.id ?? '');
	let isTeamLeader = $derived(getPrimaryRelationId(pb.authStore.model?.teamLeader) === null);
	let teamMemberIds = $derived(
		$store.firmUsers.filter((user) => belongsToLeader(user.teamLeader, myId)).map((user) => user.id)
	);
	let canViewTeam = $derived(isTeamLeader && teamMemberIds.length > 0);
	let logs = $derived(
		aggregateTimeLogs($store.tasks, $store.firmUsers, myId, teamMemberIds, viewMode, filterMode)
	);
	let totalHours = $derived((logs.reduce((sum, log) => sum + log.minutes, 0) / 60).toFixed(1));
	let completedGroups = $derived(
		groupCompletedTasksToday($store.tasks, myId, teamMemberIds, viewMode)
	);
	let availableTasks = $derived(
		$store.tasks.filter(
			(task) => !task.archived && (task.owner === myId || task.assignees.includes(myId))
		)
	);

	$effect(() => {
		if (!canViewTeam && viewMode === 'TEAM') viewMode = 'ME';
	});

	function openCreateDialog(): void {
		editingLog = null;
		showTimeLogDialog = true;
	}

	function openEditDialog(log: EnrichedTimeLog): void {
		editingLog = log;
		showTimeLogDialog = true;
	}

	function closeDialog(): void {
		showTimeLogDialog = false;
		editingLog = null;
	}

	function saveTimeLog(value: TimeLogFormValue): void {
		if (value.logId) {
			void store.updateTimeLog(value.taskId, value.logId, value.minutes, value.note, value.date);
		} else {
			void store.addTimeLog(value.taskId, value.minutes, value.note, value.date);
		}
		closeDialog();
	}

	function deleteTimeLog(log: EnrichedTimeLog): void {
		if (confirm('Möchtest du diese Buchung wirklich löschen?')) {
			void store.deleteTimeLog(log.taskId, log.id);
		}
	}

	function exportCsv(): void {
		if (logs.length === 0) return;
		const blob = new Blob(['\uFEFF', createBillingCsv(logs)], { type: 'text/csv;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `Zeiterfassung_${viewMode}_${filterMode}_${toLocalDateInputValue()}.csv`;
		link.click();
		URL.revokeObjectURL(url);
	}
</script>

<div
	class="flex h-screen flex-col overflow-hidden bg-slate-50 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100"
>
	<BillingToolbar
		{filterMode}
		{viewMode}
		{canViewTeam}
		onFilterChange={(mode) => (filterMode = mode)}
		onViewChange={(mode) => (viewMode = mode)}
		onCreate={openCreateDialog}
		onExport={exportCsv}
	/>

	<div class="flex-1 overflow-auto p-6 lg:p-8">
		<div class="mx-auto flex max-w-[1600px] flex-col gap-8 lg:flex-row">
			<main class="min-w-0 flex-1">
				<BillingSummary {totalHours} entryCount={logs.length} {viewMode} />
				<TimeLogTable {logs} {viewMode} {myId} onEdit={openEditDialog} onDelete={deleteTimeLog} />
			</main>
			<CompletedTasksPanel groups={completedGroups} {viewMode} team={$store.settings.team} />
		</div>
	</div>
</div>

{#if showTimeLogDialog}
	<TimeLogDialog
		tasks={availableTasks}
		editLog={editingLog}
		onClose={closeDialog}
		onSave={saveTimeLog}
	/>
{/if}
