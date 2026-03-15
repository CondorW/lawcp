<script lang="ts">
    import type { Task, Subtask } from '$lib/types';

    // Svelte 5 Props: Wir erwarten genau EINE Aufgabe
    let { task, userSign, dateString }: { task: Task | undefined, userSign: string, dateString: string } = $props();
</script>

{#if task}
<div class="hidden print:block max-w-[210mm] mx-auto bg-white text-black p-8 font-serif">
    <div class="border-b-2 border-black pb-4 mb-8 flex justify-between items-end">
        <div>
            <h1 class="text-3xl font-bold tracking-tight mb-1">Workflow-Protokoll</h1>
            <p class="text-gray-600 font-sans text-sm font-bold uppercase tracking-wider">
                {task.matterRef ? `REF: ${task.matterRef}` : 'Keine Referenz'}
            </p>
        </div>
        <div class="text-right">
            <div class="font-bold text-lg mb-1">{userSign}</div>
            <div class="text-sm text-gray-500 font-sans">{dateString}</div>
        </div>
    </div>

    <div class="mb-10 bg-slate-50 border border-slate-200 p-4 rounded-lg">
        <h2 class="text-xl font-bold text-gray-900 mb-1">{task.title}</h2>
        {#if task.dueDate}
            <p class="text-sm text-gray-500 font-sans">Fälligkeit: {new Date(task.dueDate).toLocaleDateString('de-CH')}</p>
        {/if}
    </div>

    {#snippet printSubtasks(subs: Subtask[], level: number)}
        {#each subs as sub}
            <div class="flex items-start gap-4 mb-4" style="margin-left: {level * 1.5}rem">
                <div class="mt-0.5 text-xl font-mono {sub.done ? 'text-gray-400' : 'text-black'}">
                    {sub.done ? '☑' : '☐'}
                </div>
                <div class="flex-1">
                    <div class="font-bold text-base {sub.done ? 'text-gray-500 line-through decoration-gray-300' : 'text-gray-900'}">
                        {sub.title}
                    </div>
                    <div class="text-[10px] text-gray-400 font-sans uppercase tracking-wider mt-0.5">
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
        <h3 class="text-sm font-bold mb-4 pb-1 border-b border-gray-300 uppercase tracking-wider text-gray-800 font-sans">
            Prozess-Schritte
        </h3>
        {#if task.subtasks && task.subtasks.length > 0}
            {@render printSubtasks(task.subtasks, 0)}
        {:else}
            <p class="text-gray-500 italic font-sans text-sm">Keine Arbeitsschritte in diesem Workflow definiert.</p>
        {/if}
    </div>

    <div class="fixed bottom-4 right-8 text-xs text-gray-400 font-sans">
        Automatisch generiert aus Lawganized LWA
    </div>
</div>
{/if}