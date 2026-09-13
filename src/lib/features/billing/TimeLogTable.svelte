<script lang="ts">
	import type { BillingViewMode, EnrichedTimeLog } from './billing';
	import { Briefcase, Clock, Pencil, Trash2 } from 'lucide-svelte';

	interface Props {
		logs: EnrichedTimeLog[];
		viewMode: BillingViewMode;
		myId: string;
		onEdit: (log: EnrichedTimeLog) => void;
		onDelete: (log: EnrichedTimeLog) => void;
	}

	let { logs, viewMode, myId, onEdit, onDelete }: Props = $props();
</script>

{#if logs.length === 0}
	<div
		class="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white py-24 text-slate-400 dark:border-slate-800 dark:bg-slate-900"
	>
		<Briefcase size={56} class="mb-5 opacity-20" />
		<p class="text-xl font-medium">Keine Einträge in diesem Zeitraum gefunden.</p>
		<p class="mt-2 text-base">Buche Zeiten über den Button oben rechts.</p>
	</div>
{:else}
	<div
		class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
	>
		<div class="overflow-x-auto">
			<table class="w-full text-left text-sm whitespace-nowrap">
				<thead
					class="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400"
				>
					<tr>
						<th class="px-6 py-4 text-xs font-bold tracking-wider uppercase">Datum</th>
						<th class="px-6 py-4 text-xs font-bold tracking-wider uppercase">Dauer</th>
						{#if viewMode === 'TEAM'}<th
								class="px-6 py-4 text-xs font-bold tracking-wider uppercase">Mitarbeiter</th
							>{/if}
						<th class="px-6 py-4 text-xs font-bold tracking-wider uppercase">REF</th>
						<th class="w-full px-6 py-4 text-xs font-bold tracking-wider uppercase"
							>Task / Tätigkeit</th
						>
						<th class="px-6 py-4 text-right text-xs font-bold tracking-wider uppercase">Aktion</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100 dark:divide-slate-800">
					{#each logs as log (log.id)}
						<tr class="group transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/30">
							<td class="px-6 py-4 align-top">
								<div class="mb-0.5 text-sm font-medium text-slate-900 dark:text-white">
									{new Date(log.date).toLocaleDateString('de-CH')}
								</div>
								<div class="text-xs text-slate-500">
									{new Date(log.date).toLocaleTimeString('de-CH', {
										hour: '2-digit',
										minute: '2-digit'
									})} Uhr
								</div>
							</td>
							<td class="px-6 py-4 align-top">
								<span
									class="inline-flex items-center gap-1.5 rounded-md border border-brand-100 bg-brand-50 px-3 py-1.5 text-sm font-bold text-brand-700 dark:border-brand-800/50 dark:bg-brand-900/20 dark:text-brand-400"
									><Clock size={14} /> {log.minutes}m</span
								>
							</td>
							{#if viewMode === 'TEAM'}
								<td class="px-6 py-4 align-top"
									><span class="text-xs font-bold text-slate-700 uppercase dark:text-slate-300"
										>{log.userSign}</span
									></td
								>
							{/if}
							<td class="px-6 py-4 align-top">
								<span
									class="rounded bg-slate-200 px-2 py-1 text-[11px] font-bold tracking-wider text-slate-700 uppercase dark:bg-slate-700 dark:text-slate-300"
									>{log.matterRef}</span
								>
							</td>
							<td class="px-6 py-4 whitespace-normal">
								<div class="mb-1 text-sm font-bold text-slate-900 dark:text-white">
									{log.taskTitle}
								</div>
								{#if log.note}<div
										class="text-sm leading-relaxed text-slate-600 italic dark:text-slate-400"
									>
										„{log.note}“
									</div>{/if}
							</td>
							<td class="px-6 py-4 text-right align-top">
								{#if log.userId === myId}
									<div
										class="flex items-center justify-end gap-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
									>
										<button
											onclick={() => onEdit(log)}
											class="rounded-md p-2 text-slate-400 transition-colors hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-900/20"
											title="Bearbeiten"><Pencil size={16} /></button
										>
										<button
											onclick={() => onDelete(log)}
											class="rounded-md p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20"
											title="Löschen"><Trash2 size={16} /></button
										>
									</div>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
{/if}
