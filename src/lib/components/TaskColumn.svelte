<script lang="ts">
    import { store } from '$lib/stores/tasks';
    // FIX 1: Der Typ 'Task' kommt aus deiner zentralen Typendatei, nicht aus dem Store
    import type { Task } from '$lib/types'; 
    import TaskCard from './TaskCard.svelte';

    export let title: string;
    export let id: Task['status'];
    export let tasks: Task[];
    export let color = 'bg-gray-400';
    import { flip } from 'svelte/animate';
    import { fade, fly } from 'svelte/transition';

    function onDragOver(e: DragEvent) {
        e.preventDefault();
        if(e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    }

    function onDrop(e: DragEvent) {
        e.preventDefault();
        const taskId = e.dataTransfer?.getData('text/plain');
        if (taskId) {
            store.moveTask(taskId, id);
        }
    }
</script>

<div 
    class="flex flex-col h-full flex-1 gap-4 min-h-[500px]" 
    role="list" 
    ondragover={onDragOver} 
    ondrop={onDrop}
>
    <div class="flex items-center justify-between px-2 py-1 shrink-0">
        <h3 class="text-base font-bold text-gray-900 dark:text-slate-100 flex items-center gap-3">
            <div class={`w-3 h-3 rounded-full shadow-sm ${color}`}></div>
            {title}
        </h3>
        <span class="rounded-full bg-gray-200 dark:bg-slate-700 px-2.5 py-0.5 text-xs font-bold text-gray-700 dark:text-gray-300">
            {tasks.length}
        </span>
    </div>

    <div class="space-y-4 flex-1 pb-10">
        {#each tasks as task (task.id)}
            <div animate:flip={{ duration: 250 }} in:fly={{ y: 20, duration: 300 }} out:fade={{ duration: 150 }}>
                <TaskCard {task} />
            </div>
        {/each}
    </div>
</div>