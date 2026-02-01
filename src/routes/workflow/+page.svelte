<script lang="ts">
    import { store, type Task } from '$lib/stores/tasks';
    import { ArrowLeft, Link, X } from 'lucide-svelte';
    import { onMount } from 'svelte';

    // Wir visualisieren in "Spalten" basierend auf Abhängigkeiten (Topological Sort light)
    // Level 0: Keine Dependencies. Level 1: Dependencies auf Level 0 Tasks, etc.

    function getLevel(task: Task, allTasks: Task[], memo = new Map<string, number>()): number {
        if (memo.has(task.id)) return memo.get(task.id)!;
        if (!task.dependencies || task.dependencies.length === 0) return 0;

        let maxDepth = 0;
        for (const depId of task.dependencies) {
            const parent = allTasks.find(t => t.id === depId);
            if (parent) {
                // Prevent cycles explicitly (simple check)
                if (memo.has(depId) && memo.get(depId) === -1) continue; // Cycle detection placeholder
                maxDepth = Math.max(maxDepth, getLevel(parent, allTasks, memo));
            }
        }
        const lvl = maxDepth + 1;
        memo.set(task.id, lvl);
        return lvl;
    }

    $: levels = (() => {
        const map = new Map<number, Task[]>();
        const memo = new Map<string, number>();
        $store.tasks.forEach(t => {
            const lvl = getLevel(t, $store.tasks, memo);
            if (!map.has(lvl)) map.set(lvl, []);
            map.get(lvl)?.push(t);
        });
        // Convert to array sorted by level key
        return Array.from(map.entries()).sort((a, b) => a[0] - b[0]).map(e => e[1]);
    })();

    // Connection Mode
    let connectingSourceId: string | null = null;

    function startConnect(taskId: string) {
        if (connectingSourceId === taskId) {
            connectingSourceId = null; // Cancel
        } else if (connectingSourceId) {
            // Finish connection
            store.toggleDependency(taskId, connectingSourceId); // taskId depends on source
            connectingSourceId = null;
        } else {
            connectingSourceId = taskId;
        }
    }

    // SVG Lines Logic (Simple Calculation on Render is tricky in Svelte without DOM reference, 
    // so we use a simplified approach: Draw lines based on estimated card positions or just list dependencies textually for MVP reliability,
    // BUT user asked for "Visual". We try a CSS Grid approach with simple SVG overlay).
    
    // For MVP stability without complex JS layout engines (Dagre), we use a Column-Layout and visualize "Predecessors" textually inside cards
    // but highlight them visually.
</script>

<div class="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-8 font-sans overflow-x-auto">
    <div class="min-w-[1000px]">
        <div class="flex items-center justify-between mb-8 sticky left-0">
            <div class="flex items-center gap-4">
                <a href="/" class="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full"><ArrowLeft /></a>
                <h1 class="text-3xl font-bold">Workflow Sequencer</h1>
            </div>
            <div class="text-sm text-gray-500">
                {#if connectingSourceId}
                    <span class="text-blue-600 font-bold animate-pulse">Select target task to link...</span>
                {:else}
                    Click <Link size={14} class="inline"/> to link tasks.
                {/if}
            </div>
        </div>

        <div class="flex gap-16 pb-20">
            {#each levels as levelTasks, i}
                <div class="flex flex-col gap-4 min-w-[300px]">
                    <h3 class="font-bold text-gray-400 uppercase tracking-widest text-xs mb-4">Phase {i + 1}</h3>
                    {#each levelTasks as task (task.id)}
                        <div class={`relative p-4 rounded-xl border-2 shadow-sm transition-all bg-white dark:bg-slate-800 ${connectingSourceId === task.id ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 dark:border-slate-700'}`}>
                            
                            <div class="flex justify-between items-start mb-2">
                                <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300">{task.matterRef || 'REF'}</span>
                                <button 
                                    onclick={() => startConnect(task.id)}
                                    class={`p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 ${task.dependencies?.length > 0 ? 'text-blue-600' : 'text-gray-400'}`}
                                    title="Link Dependency"
                                >
                                    <Link size={16} />
                                </button>
                            </div>

                            <div class="font-bold text-sm mb-2">{task.title}</div>

                            {#if task.dependencies?.length > 0}
                                <div class="mt-3 pt-3 border-t border-gray-100 dark:border-slate-700 text-xs">
                                    <span class="text-gray-400 block mb-1">Waiting for:</span>
                                    {#each task.dependencies as depId}
                                        {@const dep = $store.tasks.find(t => t.id === depId)}
                                        {#if dep}
                                            <div class="flex items-center justify-between bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-2 py-1 rounded mb-1">
                                                <span class="truncate max-w-[180px]">{dep.title}</span>
                                                <button onclick={() => store.toggleDependency(task.id, depId)} class="hover:text-red-900"><X size={12}/></button>
                                            </div>
                                        {/if}
                                    {/each}
                                </div>
                            {/if}

                            <div class={`h-1 w-full mt-2 rounded-full ${task.status === 'DONE' ? 'bg-green-500' : 'bg-gray-200 dark:bg-slate-700'}`}>
                                <div class={`h-full rounded-full ${task.status === 'DONE' ? 'w-full' : 'w-0'}`}></div>
                            </div>
                        </div>
                    {/each}
                </div>
                
                {#if i < levels.length - 1}
                    <div class="flex items-center justify-center">
                        <div class="h-full w-px bg-gray-200 dark:bg-slate-700 dashed"></div>
                    </div>
                {/if}
            {/each}
        </div>
    </div>
</div>