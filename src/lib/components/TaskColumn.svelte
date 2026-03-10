<script lang="ts">
    import { store } from '$lib/stores/tasks';
    import type { Task } from '$lib/types';
    import TaskCard from './TaskCard.svelte';
    import { flip } from 'svelte/animate';
    import { fade, fly } from 'svelte/transition';

    export let title: string;
    export let id: Task['status'];
    export let tasks: Task[];
    export let color = 'bg-gray-400';

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
    class="flex flex-col h-full w-full" 
    role="list" 
    ondragover={onDragOver} 
    ondrop={onDrop}
>
    <div class="flex items-center justify-between px-2 py-1 shrink-0 mb-3">
        <h3 class="text-base font-bold text-gray-900 dark:text-slate-100 flex items-center gap-3">
            <div class={`w-3 h-3 rounded-full shadow-sm ${color}`}></div>
            {title}
        </h3>
        <span class="rounded-full bg-gray-200 dark:bg-slate-700 px-2.5 py-0.5 text-xs font-bold text-gray-700 dark:text-gray-300">
            {tasks.length}
        </span>
    </div>

    <div class="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar pr-1 pb-4 flex flex-col space-y-4">
        {#each tasks as task (task.id)}
            <div animate:flip={{ duration: 250 }} in:fly={{ y: 20, duration: 300 }} out:fade={{ duration: 150 }} class="shrink-0">
                <TaskCard {task} />
            </div>
        {/each}
        
        <div 
            role="region"
            aria-label="Drop-Zone Puffer"
            class="flex-1 min-h-[4rem] border-2 border-transparent border-dashed rounded-lg transition-colors opacity-50 shrink-0"
            ondragenter={(e) => e.currentTarget.classList.add('border-slate-300', 'dark:border-slate-700')}
            ondragleave={(e) => e.currentTarget.classList.remove('border-slate-300', 'dark:border-slate-700')}
            ondrop={(e) => e.currentTarget.classList.remove('border-slate-300', 'dark:border-slate-700')}
        ></div>
    </div>
</div>