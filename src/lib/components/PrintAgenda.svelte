<script lang="ts">
    import type { Task } from '$lib/types';

    // Svelte 5 Props
    let { tasks, userSign, dateString }: { tasks: Task[], userSign: string, dateString: string } = $props();

    let printTodos = $derived(tasks.filter(t => t.status === 'TODO'));
    let printWaiting = $derived(tasks.filter(t => t.status === 'WAITING'));
    let printReview = $derived(tasks.filter(t => t.status === 'REVIEW'));
</script>

<div class="hidden print:block max-w-[210mm] mx-auto bg-white text-black p-8 font-serif">
    <div class="border-b-2 border-black pb-2 mb-6 flex justify-between items-end">
        <div>
            <h1 class="text-2xl font-bold tracking-tight mb-1">Lawganized Tagesagenda</h1>
            <p class="text-gray-600 font-sans text-xs">Statusbericht: Offene und in Bearbeitung befindliche Mandate</p>
        </div>
        <div class="text-right">
            <div class="font-bold text-base mb-1">{userSign}</div>
            <div class="text-xs text-gray-500 font-sans">{dateString}</div>
        </div>
    </div>

    {#snippet printSubtasks(subs: any[], level: number)}
        {#each subs as sub}
            <div class="flex items-start gap-1 text-[10px] leading-tight {sub.done ? 'text-gray-400' : 'text-gray-700'}" style="margin-left: {level * 0.75}rem">
                <span class="font-mono font-bold">{sub.done ? '☑' : '☐'}</span>
                <span class="{sub.done ? 'line-through decoration-gray-300' : ''}">{sub.title}</span>
            </div>
            {#if sub.subtasks && sub.subtasks.length > 0}
                {@render printSubtasks(sub.subtasks, level + 1)}
            {/if}
        {/each}
    {/snippet}

    {#snippet printSection(title: string, list: any[])}
        {#if list.length > 0}
            <div class="mb-6 font-sans">
                <h2 class="text-sm font-bold mb-2 pb-0.5 border-b border-gray-300 uppercase tracking-wider text-gray-800">
                    {title} <span class="text-gray-400 normal-case ml-1">({list.length})</span>
                </h2>
                <table class="w-full text-left border-collapse text-xs">
                    <tbody>
                        {#each list as task}
                            <tr class="border-b border-gray-100">
                                <td class="py-1.5 w-24 align-top">
                                    <span class="font-bold bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">{task.matterRef || 'N/A'}</span>
                                </td>
                                <td class="py-1.5 pr-2 align-top">
                                    <div class="font-bold text-gray-900 mb-0.5">{task.title}</div>
                                    {#if task.subtasks && task.subtasks.length > 0}
                                        <div class="mt-1 mb-1 border-l border-gray-200 pl-1.5">
                                            {@render printSubtasks(task.subtasks, 0)}
                                        </div>
                                    {/if}
                                </td>
                                <td class="py-1.5 w-20 align-top text-right text-gray-500 text-[10px] whitespace-nowrap">
                                    {new Date(task.dueDate).toLocaleDateString('de-CH')}
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

    {#if tasks.length === 0}
        <div class="text-center text-gray-400 mt-10 italic font-sans text-sm">
            Keine aktiven Aufgaben für heute verzeichnet.
        </div>
    {/if}
</div>