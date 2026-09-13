<script lang="ts">
	import type { Task, Subtask } from '$lib/types';

	// Svelte 5 Props: Wir erwarten genau EINE Aufgabe
	let {
		task,
		userSign,
		dateString
	}: { task: Task | undefined; userSign: string; dateString: string } = $props();
</script>

{#if task}
	<div class="mx-auto hidden max-w-[210mm] bg-white p-8 font-serif text-black print:block">
		<div class="mb-8 flex items-end justify-between border-b-2 border-black pb-4">
			<div>
				<h1 class="mb-1 text-3xl font-bold tracking-tight">Workflow-Protokoll</h1>
				<p class="font-sans text-sm font-bold tracking-wider text-gray-600 uppercase">
					{task.matterRef ? `REF: ${task.matterRef}` : 'Keine Referenz'}
				</p>
			</div>
			<div class="text-right">
				<div class="mb-1 text-lg font-bold">{userSign}</div>
				<div class="font-sans text-sm text-gray-500">{dateString}</div>
			</div>
		</div>

		<div class="mb-10 rounded-lg border border-slate-200 bg-slate-50 p-4">
			<h2 class="mb-1 text-xl font-bold text-gray-900">{task.title}</h2>
			{#if task.dueDate}
				<p class="font-sans text-sm text-gray-500">
					Fälligkeit: {new Date(task.dueDate).toLocaleDateString('de-CH')}
				</p>
			{/if}
		</div>

		{#snippet printSubtasks(subs: Subtask[], level: number)}
			{#each subs as sub (sub.id)}
				<div class="mb-4 flex items-start gap-4" style="margin-left: {level * 1.5}rem">
					<div class="mt-0.5 font-mono text-xl {sub.done ? 'text-gray-400' : 'text-black'}">
						{sub.done ? '☑' : '☐'}
					</div>
					<div class="flex-1">
						<div
							class="text-base font-bold {sub.done
								? 'text-gray-500 line-through decoration-gray-300'
								: 'text-gray-900'}"
						>
							{sub.title}
						</div>
						<div class="mt-0.5 font-sans text-[10px] tracking-wider text-gray-400 uppercase">
							{sub.type === 'GENERIC' ? (level > 0 ? 'Unterschritt' : 'Schritt') : sub.type}
						</div>
					</div>
				</div>

				{#if sub.subtasks && sub.subtasks.length > 0}
					<div class="mt-2 mb-6 border-l-2 border-gray-200 pl-4">
						{@render printSubtasks(sub.subtasks, level + 1)}
					</div>
				{/if}
			{/each}
		{/snippet}

		<div>
			<h3
				class="mb-4 border-b border-gray-300 pb-1 font-sans text-sm font-bold tracking-wider text-gray-800 uppercase"
			>
				Prozess-Schritte
			</h3>
			{#if task.subtasks && task.subtasks.length > 0}
				{@render printSubtasks(task.subtasks, 0)}
			{:else}
				<p class="font-sans text-sm text-gray-500 italic">
					Keine Arbeitsschritte in diesem Workflow definiert.
				</p>
			{/if}
		</div>

		<div class="fixed right-8 bottom-4 font-sans text-xs text-gray-400">
			Automatisch generiert aus Lawganized LWA
		</div>
	</div>
{/if}
