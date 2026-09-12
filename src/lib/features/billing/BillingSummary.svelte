<script lang="ts">
	import type { BillingViewMode } from './billing';
	import { Banknote, Clock } from 'lucide-svelte';

	let {
		totalHours,
		entryCount,
		viewMode
	}: { totalHours: string; entryCount: number; viewMode: BillingViewMode } = $props();
</script>

<div class="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
	<div
		class="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
	>
		<div>
			<div class="mb-1.5 text-sm font-bold tracking-widest text-slate-400 uppercase">
				Gefilterte Zeit {viewMode === 'TEAM' ? '(Team)' : ''}
			</div>
			<div class="text-4xl font-bold text-slate-800 dark:text-white">
				{totalHours} <span class="text-xl font-medium text-slate-500">Stunden</span>
			</div>
		</div>
		<div class="rounded-full bg-brand-50 p-4 text-brand-600 dark:bg-brand-900/20">
			<Clock size={32} />
		</div>
	</div>
	<div
		class="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
	>
		<div>
			<div class="mb-1.5 text-sm font-bold tracking-widest text-slate-400 uppercase">
				Erfasste Einträge {viewMode === 'TEAM' ? '(Team)' : ''}
			</div>
			<div class="text-4xl font-bold text-slate-800 dark:text-white">{entryCount}</div>
		</div>
		<div class="rounded-full bg-emerald-50 p-4 text-emerald-600 dark:bg-emerald-900/20">
			<Banknote size={32} />
		</div>
	</div>
</div>
