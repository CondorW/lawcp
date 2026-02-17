<script lang="ts">
    import { store } from '$lib/stores/tasks';
    import type { Task } from '$lib/types';
    import { Calendar, Flag, X } from 'lucide-svelte';
    import { formatDate } from '$lib/utils';
    import { fade, scale } from 'svelte/transition';

    export let task: Task;
    let showReschedule = false;
    let rescheduleDate = task.dueDate;

    function save() {
        if (rescheduleDate !== task.dueDate) store.updateDate(task.id, rescheduleDate);
        showReschedule = false;
    }
</script>

<div class="relative flex items-center justify-between border-t border-gray-100 dark:border-slate-700 pt-3 mt-1">
    <button 
        class="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-blue-600 transition-colors w-full text-left"
        onclick={(e) => { e.stopPropagation(); showReschedule = true; rescheduleDate = task.dueDate; }}
    >
        <Calendar size={14} />
        <span>{formatDate(task.dueDate)}</span>
        {#if task.flaggedDate}
            <span class="ml-auto text-red-500 font-bold bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded flex items-center gap-1">
                <Flag size={10} fill="currentColor"/> {formatDate(task.flaggedDate)}
            </span>
        {/if}
    </button>

    {#if showReschedule}
        <div class="fixed inset-0 z-[9999] flex items-center justify-center p-4" role="dialog" aria-modal="true" transition:fade={{ duration: 150 }}>
            <div 
                class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" 
                onclick={() => showReschedule = false} 
                onkeydown={(e) => e.key === 'Escape' && (showReschedule = false)}
                role="button" tabindex="-1"
            ></div>
            
            <div class="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-sm p-5 space-y-4" transition:scale={{ duration: 200, start: 0.95 }}>
                <div class="flex justify-between items-center"><h3 class="text-sm font-bold uppercase text-slate-500 tracking-wider flex items-center gap-2"><Calendar size={16} /> Datum verschieben</h3><button onclick={() => showReschedule = false} class="text-slate-400 hover:text-slate-600"><X size={18}/></button></div>
                <div class="space-y-1"><label for={`date-${task.id}`} class="text-xs font-bold text-slate-400 uppercase">Neues Datum</label><input id={`date-${task.id}`} type="date" bind:value={rescheduleDate} class="w-full rounded-lg border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 shadow-sm focus:ring-2 focus:ring-amber-500"/></div>
                <div class="flex justify-end gap-2 pt-2"><button onclick={() => showReschedule = false} class="px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-lg">Abbrechen</button><button onclick={save} class="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md">Speichern</button></div>
            </div>
        </div>
    {/if}
</div>