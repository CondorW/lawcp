<script lang="ts">
	import type { Task, Subtask } from '$lib/types';

	let { tasks, userSign, dateString }: { tasks: Task[]; userSign: string; dateString: string } =
		$props();

	const printSort = (a: Task, b: Task) => {
		const aIsCourt = a.flaggedDate !== null;
		const bIsCourt = b.flaggedDate !== null;
		if (aIsCourt && !bIsCourt) return -1;
		if (!aIsCourt && bIsCourt) return 1;
		if (aIsCourt && bIsCourt)
			return new Date(a.flaggedDate!).getTime() - new Date(b.flaggedDate!).getTime();
		return new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime();
	};

	// 1. Filtere archivierte Haupt-Tasks heraus
	let activeTasks = $derived(tasks.filter((t) => !t.archived));

	let printTodos = $derived(activeTasks.filter((t) => t.status === 'TODO').sort(printSort));
	let printWaiting = $derived(activeTasks.filter((t) => t.status === 'WAITING').sort(printSort));
	let printReview = $derived(activeTasks.filter((t) => t.status === 'REVIEW').sort(printSort));

	// 2. Rekursive Helper-Funktion, um archivierte Subtasks komplett zu verstecken
	function getActiveSubs(subs: Subtask[] | undefined): Subtask[] {
		if (!subs) return [];
		return subs
			.filter((s) => !s.archived)
			.map((s) => ({ ...s, subtasks: getActiveSubs(s.subtasks) }));
	}
</script>

<div class="mx-auto hidden w-full bg-white p-4 font-serif text-black print:block">
	<div class="mb-6 flex items-end justify-between border-b-2 border-black pb-2">
		<div>
			<h1 class="mb-1 text-2xl font-bold tracking-tight">Lawganized Tagesagenda</h1>
			<p class="font-sans text-xs font-bold tracking-widest text-gray-600 uppercase">
				Statusbericht: {userSign}
			</p>
		</div>
		<div class="text-right">
			<div class="font-sans text-sm text-gray-500">{dateString}</div>
		</div>
	</div>

	{#snippet printSubtasks(subs: Subtask[], level: number)}
		{#each getActiveSubs(subs) as sub (sub.id)}
			<div
				class="flex items-start gap-1.5 text-[10px] leading-tight {sub.done
					? 'text-gray-400'
					: 'text-gray-700'}"
				style="margin-left: {level * 1}rem"
			>
				<span class="font-mono">{sub.done ? '☑' : '☐'}</span>
				<span class={sub.done ? 'line-through decoration-gray-300' : ''}>{sub.title}</span>
			</div>
			{#if sub.subtasks && sub.subtasks.length > 0}
				{@render printSubtasks(sub.subtasks, level + 1)}
			{/if}
		{/each}
	{/snippet}

	{#snippet printSection(title: string, list: Task[])}
		{#if list.length > 0}
			<div class="mb-8 font-sans">
				<h2
					class="mb-3 border-b border-gray-300 bg-gray-50 px-2 pb-1 text-sm font-bold tracking-widest text-gray-900 uppercase"
				>
					{title}
					<span class="ml-2 font-medium text-gray-400 normal-case">({list.length} Aufgaben)</span>
				</h2>

				<table class="w-full border-collapse text-left">
					<thead>
						<tr
							class="border-b border-gray-100 text-[9px] tracking-tighter text-gray-400 uppercase"
						>
							<th class="w-28 py-1">Referenz</th>
							<th class="py-1">Aufgabe / Details</th>
							<th class="w-24 py-1 text-right">Termin</th>
						</tr>
					</thead>
					<tbody class="text-xs">
						{#each list as task (task.id)}
							<tr class="break-inside-avoid border-b border-gray-100">
								<td class="py-2.5 align-top">
									<span class="text-[10px] font-bold text-gray-700">{task.matterRef || '---'}</span>
								</td>
								<td class="py-2.5 pr-4 align-top">
									<div class="mb-1 flex flex-wrap items-start gap-2">
										<span
											class="mt-0.5 shrink-0 rounded border border-black px-1.5 py-0.5 text-[8px] font-bold tracking-widest text-black uppercase"
										>
											{task.expand?.owner?.shortsign || '?'}
										</span>
										<div class="text-sm leading-tight font-bold text-gray-900">{task.title}</div>
										{#if task.flaggedDate}
											<span
												class="mt-0.5 shrink-0 rounded bg-black px-1.5 py-0.5 text-[8px] font-black tracking-tighter text-white uppercase"
												>Gerichtsfrist</span
											>
										{/if}
									</div>
									{#if task.subtasks && task.subtasks.length > 0}
										<div class="mt-2 mb-1 border-l-2 border-gray-100 pl-3">
											{@render printSubtasks(task.subtasks, 0)}
										</div>
									{/if}
								</td>
								<td class="py-2.5 text-right align-top whitespace-nowrap">
									<div
										class="font-bold {task.flaggedDate
											? 'text-black underline underline-offset-2'
											: 'text-gray-600'}"
									>
										{#if task.dueDate}
											{new Date(task.dueDate).toLocaleDateString('de-CH')}
										{:else}
											---
										{/if}
									</div>
									{#if task.flaggedDate}
										<div class="mt-0.5 text-[9px] text-gray-500 italic">
											Frist: {new Date(task.flaggedDate).toLocaleDateString('de-CH')}
										</div>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/snippet}

	{@render printSection('In Arbeit', printWaiting)}
	{@render printSection('Review', printReview)}
	{@render printSection('To Do', printTodos)}

	{#if activeTasks.length === 0}
		<div
			class="mt-20 rounded-xl border-2 border-dashed border-gray-100 p-10 text-center font-sans text-sm text-gray-400 italic"
		>
			Keine aktiven Aufgaben zur Dokumentation vorhanden.
		</div>
	{/if}

	<div
		class="fixed bottom-0 left-0 flex w-full justify-between border-t border-gray-50 bg-white pt-1 font-sans text-[9px] text-gray-300"
	>
		<span>Lawganized - Vertrauliches Dokument</span>
		<span>Gedruckt am {new Date().toLocaleString('de-CH')}</span>
	</div>
</div>
