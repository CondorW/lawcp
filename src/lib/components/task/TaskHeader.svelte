<script lang="ts">
    import { store } from '$lib/stores/tasks';
    import type { Task } from '$lib/types';
    import { Flag, Trash2, BrainCircuit } from 'lucide-svelte';

    // Svelte 5: Props & State
    let { task }: { task: Task } = $props();
    
    let isEditingRef = $state(false);
    let editRefBuffer = $state('');
    
    // Referenz auf das versteckte Input-Feld
    let dateInput: HTMLInputElement;

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

    // FIX 1: Der JavaScript-Trigger für den Kalender
    function handleFlagClick(e: MouseEvent) {
        e.stopPropagation();
        try {
            // Öffnet den nativen Browser-Kalender programmgesteuert
            dateInput.showPicker();
        } catch (err) {
            // Fallback
            dateInput.focus();
            dateInput.click();
        }
    }

    function onDateChange(e: Event) {
        e.stopPropagation();
        const target = e.currentTarget as HTMLInputElement;
        store.toggleFlag(task.id, target.value || null);
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
            <button 
                onclick={(e) => { e.stopPropagation(); startEditRef(); }} 
                class="text-xs font-bold px-2 py-1 rounded border uppercase tracking-wider text-slate-500 bg-slate-50 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600 max-w-[120px] truncate hover:text-amber-600 transition-colors"
            >
                {task.matterRef || 'NO-REF'}
            </button>
        {/if}

        {#if task.matterRef}
            <button 
                onclick={(e) => { e.stopPropagation(); store.openMatterNotes(task.matterRef!); }} 
                class="p-1 rounded-full text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors ml-1" 
                title="Akten-Notizen öffnen" 
            >
                <BrainCircuit size={16} />
            </button>
        {/if}
    </div>

    <div class="flex gap-1 items-center group">
        
        <button 
            onclick={handleFlagClick}
            class="relative w-8 h-8 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
            title="Gerichtsfrist setzen"
        >
            <Flag size={16} class={task.flaggedDate ? "text-red-500 fill-red-500" : "text-gray-400 hover:text-red-500"} />
            
            <input 
                bind:this={dateInput}
                type="date" 
                value={task.flaggedDate || ""} 
                onchange={onDateChange} 
                class="sr-only" 
                tabindex="-1"
            />
        </button>

        <button 
            onclick={(e) => { e.stopPropagation(); store.deleteTask(task.id); }} 
            class="text-gray-300 hover:text-red-500 p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"
            title="Aufgabe löschen"
        >
            <Trash2 size={16} />
        </button>
    </div>
</div>