<script lang="ts">
    import { store } from '$lib/stores/tasks';
    import type { Task, SubtaskType } from '$lib/types';
    import { cn } from '$lib/utils';
    
    // Module Imports
    import TaskHeader from './task/TaskHeader.svelte';
    import TaskTitle from './task/TaskTitle.svelte';
    import TaskFooter from './task/TaskFooter.svelte';
    import SubtaskItem from './task/SubtaskItem.svelte';

    export let task: Task;

    let dragging = false;
    let newSubtaskTitle = '';
    let newSubtaskType: SubtaskType = 'GENERIC';

    function handleAddSubtask() {
        if (!newSubtaskTitle.trim()) return;
        store.addSubtask(task.id, newSubtaskTitle, newSubtaskType);
        newSubtaskTitle = '';
    }

    function onDragStart(e: DragEvent) {
        // Verhindern, dass Drag startet, wenn man in Inputs schreibt
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') { 
            e.preventDefault(); 
            return; 
        }
        
        // Drag Data setzen
        e.dataTransfer?.setData('text/plain', task.id); 
        dragging = true;
    }
</script>

<div 
    role="listitem"
    class={cn(
        "group relative flex flex-col gap-3 rounded-xl border p-5 shadow-sm transition-all cursor-move bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:shadow-md",
        task.status === 'DONE' && "bg-gray-50 dark:bg-slate-800/50 opacity-60 grayscale",
        dragging && "opacity-50"
    )}
    draggable="true"
    ondragstart={onDragStart}
    ondragend={() => dragging = false}
>
    <TaskHeader {task} />

    <TaskTitle {task} />

    <div class="space-y-3 my-2 border-t border-gray-100 dark:border-slate-700 pt-3">
        {#each task.subtasks || [] as sub (sub.id)}
            <SubtaskItem taskId={task.id} {sub} />
        {/each}

        <div class="flex gap-2 items-center mt-3 pt-1 relative z-20">
            <select bind:value={newSubtaskType} class="text-xs bg-gray-100 dark:bg-slate-700 border-0 rounded px-2 py-1 text-gray-600 dark:text-gray-300 cursor-pointer focus:ring-0"><option value="GENERIC">Task</option><option value="DOCUMENT">Doc</option><option value="RESEARCH">Res</option><option value="EMAIL">Mail</option></select>
            <input 
                id={`new-subtask-${task.id}`}
                type="text" 
                bind:value={newSubtaskTitle}
                placeholder="Neuer Subtask... (Enter)" 
                class="flex-grow bg-transparent border-b border-transparent focus:border-blue-500 p-1 text-sm placeholder:text-gray-400 focus:ring-0 text-gray-700 dark:text-gray-300"
                onkeydown={(e) => e.key === 'Enter' && handleAddSubtask()} 
            />
        </div>
    </div>

    <TaskFooter {task} />
</div>