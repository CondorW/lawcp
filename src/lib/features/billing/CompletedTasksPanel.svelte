<script lang="ts">
	import TaggedText from '$lib/components/text/TaggedText.svelte';
	import type { TeamMember } from '$lib/types';
	import type { BillingViewMode, GroupedCompletedTask } from './billing';
	import { CheckSquare } from 'lucide-svelte';

	let {
		groups,
		viewMode,
		team
	}: { groups: GroupedCompletedTask[]; viewMode: BillingViewMode; team: TeamMember[] } = $props();
</script>

<aside class="flex w-full shrink-0 flex-col gap-6 lg:w-[480px]">
	<div
		class="sticky top-0 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
	>
		<h3
			class="mb-6 flex items-center gap-2 border-b border-slate-100 pb-4 text-base font-bold text-slate-800 dark:border-slate-800 dark:text-white"
		>
			<CheckSquare size={20} class="text-emerald-500" /> Heute erledigt {viewMode === 'TEAM'
				? 'im Team'
				: ''}
		</h3>
		{#if groups.length === 0}
			<div class="py-8 text-center">
				<p class="text-sm text-slate-400 italic">Noch keine Teilschritte heute abgehakt.</p>
			</div>
		{:else}
			<div class="max-h-[calc(100vh-250px)] space-y-8 overflow-y-auto pr-4">
				{#each groups as group (group.taskId)}
					<div class="relative border-l-[3px] border-emerald-200 pl-5 dark:border-emerald-800/50">
						{#if group.matterRef !== 'NO-REF'}
							<div class="mb-2">
								<span
									class="rounded bg-slate-100 px-2.5 py-1 text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:bg-slate-800"
									>{group.matterRef}</span
								>
							</div>
						{/if}
						<div
							class="mb-3 line-clamp-3 text-sm leading-snug font-bold text-slate-800 dark:text-slate-200"
						>
							{group.taskTitle}
						</div>
						<div class="space-y-3">
							{#each group.subtasks as subtask (subtask.id)}
								<div class="flex items-start gap-2.5">
									<span class="mt-[-1px] shrink-0 text-base text-emerald-500">↳</span>
									<div class="min-w-0">
										{#if subtask.completedAt}<span
												class="mb-1 block text-xs font-bold text-slate-400"
												>{new Date(subtask.completedAt).toLocaleTimeString('de-CH', {
													hour: '2-digit',
													minute: '2-digit'
												})} Uhr</span
											>{/if}
										<p
											class="text-sm leading-snug font-medium break-words text-slate-700 dark:text-slate-300"
										>
											<TaggedText text={subtask.title} {team} />
										</p>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</aside>
