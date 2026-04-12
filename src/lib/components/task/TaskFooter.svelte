<script lang="ts">
    import { store } from '$lib/stores/tasks';
    import { pb } from '$lib/pocketbase';
    import type { Task } from '$lib/types';
    import { Calendar, Flag, BrainCircuit, Trash2 } from 'lucide-svelte';
    import { formatDate } from '$lib/utils';

    interface Props {
        task: Task;
        isOwner: boolean;
        ownerShortsign: string;
    }

    let { task, isOwner, ownerShortsign }: Props = $props();

    let isEditingRef = $state(false);
    let editRefBuffer = $state('');

    function startEditRef() {
        editRefBuffer = task.matterRef || '';
        isEditingRef = true;
        setTimeout(() => document.getElementById(`edit-ref-${task.id}`)?.focus(), 10);
    }

    function saveEditRef() {
        if (editRefBuffer !== task.matterRef) {
            store.updateTaskRef(task.id, editRefBuffer);
        }
        isEditingRef = false;
    }

    // Die schnelle native Picker-Logik
    function openNativePicker(e: MouseEvent) {
        e.stopPropagation();
        const btn = e.currentTarget as HTMLElement;
        const input = btn.querySelector('input[type="date"]') as HTMLInputElement;
        if (input) {
            try {
                input.showPicker();
            } catch (err) {
                input.focus();
                input.click();
            }
        }
    }

    async function updateCourtDate(e: Event) {
        const target = e.target as HTMLInputElement;
        const newDate = target.value ? new Date(target.value).toISOString() : null;
        try {
            await pb.collection('tasks').update(task.id, { flaggedDate: newDate });
        } catch (err) {
            console.error(err);
        }
    }

    async function updateInternalDate(e: Event) {
        const target = e.target as HTMLInputElement;
        const newDate = target.value ? new Date(target.value).toISOString() : null;
        try {
            await pb.collection('tasks').update(task.id, { dueDate: newDate });
        } catch (err) {
            console.error(err);
        }
    }
</script>

<div class="flex flex-row items-center justify-between flex-grow min-w-0 pr-1 h-7">
    
    <div class="flex flex-row items-center gap-1 h-full">
        
        {#if isEditingRef}
            <input
                id={`edit-ref-${task.id}`}
                type="text"
                bind:value={editRefBuffer}
                onblur={saveEditRef}
                onkeydown={(e) => e.key === 'Enter' && saveEditRef()}
                class="h-7 text-[11px] font-bold px-2 rounded border uppercase w-20 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-gray-300 dark:border-slate-600 flex items-center"
                placeholder="REF"
            />
        {:else}
            <button
                type="button"
                onclick={(e) => { e.stopPropagation(); startEditRef(); }}
                class="h-7 px-2 flex items-center justify-center text-[11px] font-bold rounded border uppercase tracking-wider text-slate-500 bg-slate-50 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600 max-w-[90px] truncate hover:text-amber-600 transition-colors outline-none focus:ring-0"
            >
                <span class="pointer-events-none">{task.matterRef || 'NO-REF'}</span>
            </button>
        {/if}

        {#if task.matterRef}
            <button
                type="button"
                onclick={(e) => { e.stopPropagation(); store.openMatterNotes(task.matterRef!); }}
                class="w-7 h-7 flex items-center justify-center rounded hover:bg-purple-100 dark:hover:bg-purple-900/30 hover:text-purple-600 text-slate-400 transition-colors outline-none focus:ring-0 shrink-0"
                title="Akten-Notizen öffnen"
            >
                <BrainCircuit size={14} class="pointer-events-none" />
            </button>
        {/if}

        {#if !isOwner}
            <div class="h-7 px-1.5 ml-1 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-200 rounded border border-amber-200 dark:border-amber-800/50 uppercase tracking-wide text-[10px] font-bold flex items-center justify-center shrink-0" title="Delegiert von {ownerShortsign}">
                {ownerShortsign}
            </div>
        {/if}
    </div>

    <div class="flex flex-row items-center gap-1 h-full shrink-0">
        
        <button
            type="button"
            onclick={(e) => { e.stopPropagation(); store.deleteTask(task.id); }}
            class="w-7 h-7 flex items-center justify-center rounded hover:bg-red-100 dark:hover:bg-red-900/20 hover:text-red-600 text-slate-300 opacity-0 group-hover:opacity-100 transition-all outline-none focus:ring-0 shrink-0"
            title="Aufgabe löschen"
        >
            <Trash2 size={14} class="pointer-events-none" />
        </button>

        <button 
            type="button" 
            class={task.flaggedDate ? "relative h-7 px-2 bg-red-100 text-red-600 rounded border border-red-200 text-[11px] font-bold flex items-center justify-center tracking-wide hover:bg-red-200 transition-colors outline-none focus:ring-0 shrink-0" : "relative w-7 h-7 flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-red-500 transition-colors rounded outline-none focus:ring-0 shrink-0"}
            onclick={openNativePicker}
            title={task.flaggedDate ? "Gerichtstermin anpassen" : "Gerichtstermin setzen"}
        >
            {#if task.flaggedDate}
                <span class="pointer-events-none">{formatDate(task.flaggedDate)}</span>
            {:else}
                <Flag size={14} class="pointer-events-none" />
            {/if}
            <input type="date" class="sr-only" tabindex="-1" value={task.flaggedDate ? task.flaggedDate.split('T')[0] : ''} onchange={updateCourtDate} onclick={(e) => e.stopPropagation()} />
        </button>

        <button 
            type="button" 
            class={task.dueDate ? "relative h-7 px-2 flex items-center gap-1.5 rounded text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors outline-none focus:ring-0 shrink-0" : "relative w-7 h-7 flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-600 transition-colors rounded outline-none focus:ring-0 shrink-0"}
            onclick={openNativePicker}
            title={task.dueDate ? "Fälligkeit anpassen" : "Fälligkeit setzen"}
        >
            {#if task.dueDate}
                <Calendar size={14} class="pointer-events-none" />
                <span class="text-[11px] font-medium tracking-wide pointer-events-none">
                    {formatDate(task.dueDate)}
                </span>
            {:else}
                <Calendar size={14} class="pointer-events-none" />
            {/if}
            <input type="date" class="sr-only" tabindex="-1" value={task.dueDate ? task.dueDate.split('T')[0] : ''} onchange={updateInternalDate} onclick={(e) => e.stopPropagation()} />
        </button>
    </div>
</div>