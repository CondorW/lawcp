<script lang="ts">
    import type { Task } from '$lib/stores/tasks';
    import { store } from '$lib/stores/tasks';
    import TaskCard from './TaskCard.svelte';

    export let title: string;
    // Fix: Explicitly use the Status type instead of generic string
    export let id: Task['status']; 
    export let tasks: Task[];
    export let color = 'bg-gray-400';

    function onDragOver(e: DragEvent) { e.preventDefault(); if(e.dataTransfer) e.dataTransfer.dropEffect = 'move'; }
    
    function onDrop(e: DragEvent) {
        e.preventDefault();
        const taskId = e.dataTransfer?.getData('text/plain');
        if (taskId) { 
            store.moveTask(taskId, id); 
        }
    }
</script>

<div class="flex flex-col gap-4 min-h-[500px]" role="list" ondragover={onDragOver} ondrop={onDrop}>
    <div class="flex items-center justify-between px-2 py-1">
        <h3 class="text-base font-bold text-gray-900 dark:text-slate-100 flex items-center gap-3">
            <div class={`w-3 h-3 rounded-full shadow-sm ${color}`}></div> 
            {title}
        </h3>
        <span class="rounded-full bg-gray-200 dark:bg-slate-700 px-2.5 py-0.5 text-xs font-bold text-gray-700 dark:text-gray-300">
            {tasks.length}
        </span>
    </div>

    <div class="space-y-4">
        {#each tasks as task (task.id)}
            <TaskCard {task} />
        {/each}
    </div>
</div>