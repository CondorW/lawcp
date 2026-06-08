<script lang="ts">
	import type { Task, Subtask } from '$lib/types';
	import { Flag } from 'lucide-svelte';

	let { tasks, userSign, dateString }: { tasks: Task[], userSign: string, dateString: string } = $props();

	const printSort = (a: Task, b: Task) => {
		const aIsCourt = a.flaggedDate !== null;
		const bIsCourt = b.flaggedDate !== null;
		if (aIsCourt && !bIsCourt) return -1;
		if (!aIsCourt && bIsCourt) return 1;
		if (aIsCourt && bIsCourt) return new Date(a.flaggedDate!).getTime() - new Date(b.flaggedDate!).getTime();
		return new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime();
	};

	// 1. Filtere archivierte Haupt-Tasks heraus
	let activeTasks = $derived(tasks.filter(t => !t.archived));

	let printTodos = $derived(activeTasks.filter(t => t.status === 'TODO').sort(printSort));
	let printWaiting = $derived(activeTasks.filter(t => t.status === 'WAITING').sort(printSort));
	let printReview = $derived(activeTasks.filter(t => t.status === 'REVIEW').sort(printSort));

	// 2. Rekursive Helper-Funktion, um archivierte Subtasks komplett zu verstecken
	function getActiveSubs(subs: Subtask[] | undefined): Subtask[] {
		if (!subs) return [];
		return subs.filter(s => !s.archived).map(s => ({...s, subtasks: getActiveSubs(s.subtasks)}));
	}
</script>

<div class="hidden print:block w-full mx-auto bg-white text-black p-4 font-serif">
	<div class="border-b-2 border-black pb-2 mb-6 flex justify-between items-end">
		<div>
			<h1 class="text-2xl font-bold tracking-tight mb-1">Lawganized Tagesagenda</h1>
			<p class="text-gray-600 font-sans text-xs uppercase tracking-widest font-bold">Statusbericht: {userSign}</p>
		</div>
		<div class="text-right">
			<div class="text-sm text-gray-500 font-sans">{dateString}</div>
		</div>
	</div>

	{#snippet printSubtasks(subs: Subtask[], level: number)}
		{#each getActiveSubs(subs) as sub}
			<div class="flex items-start gap-1.5 text-[10px] leading-tight {sub.done ? 'text-gray-400' : 'text-gray-700'}" style="margin-left: {level * 1}rem">
				<span class="font-mono">{sub.done ? '☑' : '☐'}</span>
				<span class="{sub.done ? 'line-through decoration-gray-300' : ''}">{sub.title}</span>
			</div>
			{#if sub.subtasks && sub.subtasks.length > 0}
				{@render printSubtasks(sub.subtasks, level + 1)}
			{/if}
		{/each}
	{/snippet}

	{#snippet printSection(title: string, list: Task[])}
		{#if list.length > 0}
			<div class="mb-8 font-sans">
				<h2 class="text-sm font-bold mb-3 pb-1 border-b border-gray-300 uppercase tracking-widest text-gray-900 bg-gray-50 px-2">
					{title} <span class="text-gray-400 normal-case font-medium ml-2">({list.length} Aufgaben)</span>
				</h2>

				<table class="w-full text-left border-collapse">
					<thead>
						<tr class="text-[9px] uppercase tracking-tighter text-gray-400 border-b border-gray-100">
							<th class="py-1 w-28">Referenz</th>
							<th class="py-1">Aufgabe / Details</th>
							<th class="py-1 w-24 text-right">Termin</th>
						</tr>
					</thead>
					<tbody class="text-xs">
						{#each list as task}
							<tr class="border-b border-gray-100 break-inside-avoid">
								<td class="py-2.5 align-top">
									<span class="font-bold text-[10px] text-gray-700">{task.matterRef || '---'}</span>
								</td>
								<td class="py-2.5 pr-4 align-top">
									<div class="flex items-start gap-2 mb-1 flex-wrap">
										<span class="border border-black text-black text-[8px] px-1.5 py-0.5 rounded font-bold tracking-widest uppercase mt-0.5 shrink-0">
											{task.expand?.owner?.shortsign || '?'}
										</span>
										<div class="font-bold text-gray-900 text-sm leading-tight">{task.title}</div>
										{#if task.flaggedDate}
											<span class="bg-black text-white text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-tighter mt-0.5 shrink-0">Gerichtsfrist</span>
										{/if}
									</div>
									{#if task.subtasks && task.subtasks.length > 0}
										<div class="mt-2 mb-1 border-l-2 border-gray-100 pl-3">
											{@render printSubtasks(task.subtasks, 0)}
										</div>
									{/if}
								</td>
								<td class="py-2.5 align-top text-right whitespace-nowrap">
									<div class="font-bold {task.flaggedDate ? 'text-black underline underline-offset-2' : 'text-gray-600'}">
										{#if task.dueDate}
											{new Date(task.dueDate).toLocaleDateString('de-CH')}
										{:else}
											---
										{/if}
									</div>
									{#if task.flaggedDate}
										<div class="text-[9px] text-gray-500 italic mt-0.5">Frist: {new Date(task.flaggedDate).toLocaleDateString('de-CH')}</div>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/snippet}

	{@render printSection("In Arbeit", printWaiting)}
	{@render printSection("Review", printReview)}
	{@render printSection("To Do", printTodos)}

	{#if activeTasks.length === 0}
		<div class="text-center text-gray-400 mt-20 italic font-sans text-sm border-2 border-dashed border-gray-100 p-10 rounded-xl">
			Keine aktiven Aufgaben zur Dokumentation vorhanden.
		</div>
	{/if}

	<div class="fixed bottom-0 left-0 w-full text-[9px] text-gray-300 font-sans flex justify-between border-t border-gray-50 pt-1 bg-white">
		<span>Lawganized - Vertrauliches Dokument</span>
		<span>Gedruckt am {new Date().toLocaleString('de-CH')}</span>
	</div>
</div>