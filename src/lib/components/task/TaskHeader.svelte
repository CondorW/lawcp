<script lang="ts">
    import { store } from '$lib/stores/tasks';
    import type { Task } from '$lib/types';
    import { Flag, Trash2, BrainCircuit } from 'lucide-svelte';

    export let task: Task;

    let isEditingRef = false;
    let editRefBuffer = '';

    function startEditRef() { 
        editRefBuffer = task.matterRef || ''; 
        isEditingRef = true; 
        setTimeout(() => document.getElementById(`edit-ref-${task.id}`)?.focus(), 10); 
    }
    
    function saveEditRef() { 
        if (editRefBuffer !== task.matterRef) store.updateTaskRef(task.id, editRefBuffer); 
        isEditingRef = false; 
    }
</script>

<div class="flex justify-between items-start">
    <div class="flex items-center gap-2">
        {#if isEditingRef}
            <input
                id={`edit-ref-${task.id}`}
                type="text"
                bind:value={editRefBuffer}
                onblur={saveEditRef}
                onkeydown={(e) => e.key === 'Enter' && saveEditRef()}
                class="text-xs font-bold px-2 py-1 rounded border uppercase w-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="REF"
            />
        {:else}
             <button onclick={startEditRef} class="text-xs font-bold px-2 py-1 rounded border uppercase tracking-wider text-slate-500 bg-slate-50 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600 max-w-[120px] truncate hover:text-amber-600 transition-colors">
                {task.matterRef || 'NO-REF'}
            </button>
        {/if}

        {#if task.matterRef}
            <button 
                onclick={() => store.openMatterNotes(task.matterRef!)}
                class="p-1 rounded-full text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors ml-1"
                title="Akten-Notizen öffnen"
            >
                <BrainCircuit size={16} />
            </button>
        {/if}
    </div>

    <div class="flex gap-1 items-center">
         <div class="relative w-8 h-8 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-slate-700 rounded-full cursor-pointer group/btn">
            <Flag size={16} class={task.flaggedDate ? "text-red-500 fill-red-500" : "text-gray-300 hover:text-red-400"} />
            <input type="date" value={task.flaggedDate || ""} onchange={(e) => { e.stopPropagation(); store.toggleFlag(task.id, e.currentTarget.value || null); }} class="absolute inset-0 opacity-0 cursor-pointer z-20" />
        </div>
        <button onclick={() => store.deleteTask(task.id)} class="text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16} /></button>
    </div>
</div>