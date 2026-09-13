<script lang="ts">
	import { store } from '$lib/stores/tasks';
	import TaskCard from '$lib/components/TaskCard.svelte';
	import { Search, Archive, ArrowLeft } from 'lucide-svelte';
	import { resolve } from '$app/paths';

	let searchQuery = '';

	$: archivedTasks = $store.tasks.filter(
		(t) => t.archived && t.title.toLowerCase().includes(searchQuery.toLowerCase())
	);
</script>

<svelte:head>
	<title>Archiv | Lawganized</title>
</svelte:head>

<!-- LAYOUT: min-h-screen mit p-6 lg:p-8 -->
<div
	class="min-h-screen bg-slate-50 p-6 font-sans text-slate-900 lg:p-8 dark:bg-slate-950 dark:text-slate-100"
>
	<!-- LAYOUT: Auf 1600px verbreitert -->
	<div class="mx-auto max-w-[1600px]">
		<!-- HEADER-BEREICH: Identisch zur Ressourcen-Seite -->
		<div class="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
			<div class="flex items-center gap-4">
				<a
					href={resolve('/')}
					class="rounded-full p-2 transition-colors hover:bg-slate-200 dark:hover:bg-slate-800"
					title="Zurück zum Board"
				>
					<ArrowLeft size={24} />
				</a>
				<h1 class="flex items-center gap-3 text-2xl font-bold tracking-tight sm:text-3xl">
					<Archive size={28} class="text-brand-600 dark:text-brand-500" />
					Archiv
				</h1>
			</div>

			<div class="relative w-full sm:w-80">
				<Search class="absolute top-3 left-3.5 text-slate-400" size={18} />
				<!-- TYPOGRAPHY: text-sm (14px) -->
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Im Archiv suchen..."
					class="w-full rounded-lg border border-slate-300 bg-white py-2.5 pr-4 pl-10 text-sm text-slate-900 transition-shadow outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
				/>
			</div>
		</div>

		{#if archivedTasks.length === 0}
			<!-- EMPTY STATE: Identisch zur Abrechnungs-Seite -->
			<div
				class="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-24 text-slate-400 shadow-sm dark:border-slate-700 dark:bg-slate-900"
			>
				<Archive size={56} class="mb-5 opacity-20" />
				<h3 class="mb-2 text-base font-bold text-slate-700 dark:text-slate-300">
					Keine Aufgaben im Archiv
				</h3>
				<p class="max-w-sm text-center text-sm font-medium">
					Aufgaben, die du archivierst, tauchen hier auf und können jederzeit wiederhergestellt
					werden.
				</p>
			</div>
		{:else}
			<!-- GRID LAYOUT: Bis zu 4 Spalten auf sehr großen Bildschirmen. items-start verhindert unschönes vertikales Strecken der Karten -->
			<div class="grid grid-cols-1 items-start gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{#each archivedTasks as task (task.id)}
					<TaskCard {task} />
				{/each}
			</div>
		{/if}
	</div>
</div>
