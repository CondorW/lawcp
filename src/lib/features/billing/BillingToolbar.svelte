<script lang="ts">
	import { resolve } from '$app/paths';
	import type { BillingFilterMode, BillingViewMode } from './billing';
	import { ArrowLeft, Clock, FileDown, Plus, User, Users } from 'lucide-svelte';

	interface Props {
		filterMode: BillingFilterMode;
		viewMode: BillingViewMode;
		canViewTeam: boolean;
		onFilterChange: (mode: BillingFilterMode) => void;
		onViewChange: (mode: BillingViewMode) => void;
		onCreate: () => void;
		onExport: () => void;
	}

	const filters: Array<{ value: BillingFilterMode; label: string }> = [
		{ value: 'TODAY', label: 'Heute' },
		{ value: 'WEEK', label: '7 Tage' },
		{ value: 'MONTH', label: 'Monat' },
		{ value: 'ALL', label: 'Alle' }
	];

	let {
		filterMode,
		viewMode,
		canViewTeam,
		onFilterChange,
		onViewChange,
		onCreate,
		onExport
	}: Props = $props();
</script>

<header
	class="relative z-10 flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4 shadow-sm lg:px-8 dark:border-slate-800 dark:bg-slate-900"
>
	<div class="flex items-center gap-4">
		<a
			href={resolve('/')}
			class="rounded-full border border-transparent p-2 transition-colors hover:border-slate-200 hover:bg-slate-100 dark:hover:border-slate-700 dark:hover:bg-slate-800"
			aria-label="Zur Aufgabenübersicht"
		>
			<ArrowLeft size={24} />
		</a>
		<h1 class="flex items-center gap-2 text-xl font-bold tracking-tight">
			<Clock class="text-brand-600" size={24} /> Zeiterfassung
		</h1>
	</div>

	<div class="flex flex-wrap items-center gap-4">
		{#if canViewTeam}
			<div
				class="hidden rounded-lg border border-brand-200 bg-brand-50 p-1.5 md:flex dark:border-slate-700 dark:bg-slate-800"
			>
				<button
					onclick={() => onViewChange('ME')}
					class="flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-bold transition-colors {viewMode ===
					'ME'
						? 'bg-white text-brand-700 shadow-sm dark:bg-slate-600 dark:text-white'
						: 'text-slate-500 hover:text-brand-600 dark:hover:text-slate-300'}"
				>
					<User size={16} /> Meine
				</button>
				<button
					onclick={() => onViewChange('TEAM')}
					class="flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-bold transition-colors {viewMode ===
					'TEAM'
						? 'bg-white text-brand-700 shadow-sm dark:bg-slate-600 dark:text-white'
						: 'text-slate-500 hover:text-brand-600 dark:hover:text-slate-300'}"
				>
					<Users size={16} /> Team
				</button>
			</div>
		{/if}

		<div
			class="hidden rounded-lg border border-slate-200 bg-slate-100 p-1.5 md:flex dark:border-slate-700 dark:bg-slate-800"
		>
			{#each filters as filter (filter.value)}
				<button
					onclick={() => onFilterChange(filter.value)}
					class="rounded-md px-4 py-1.5 text-sm font-bold transition-colors {filterMode ===
					filter.value
						? 'bg-white text-slate-900 shadow-sm dark:bg-slate-600 dark:text-white'
						: 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}"
				>
					{filter.label}
				</button>
			{/each}
		</div>

		<button
			onclick={onCreate}
			class="flex items-center gap-2 rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600"
			title="Zeit buchen"
		>
			<Plus size={18} /> Buchen
		</button>
		<button
			onclick={onExport}
			class="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-brand-700"
			title="Als CSV exportieren"
		>
			<FileDown size={18} /> Export
		</button>
	</div>
</header>
