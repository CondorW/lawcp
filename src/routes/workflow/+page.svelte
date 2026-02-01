<script lang="ts">
    import { store } from '$lib/stores/tasks';
    import { ArrowLeft, Plus } from 'lucide-svelte';

    let selectedTaskId: string | null = null;
    let container: HTMLDivElement;

    // State
    let draggingSubId: string | null = null;
    let linkingSourceId: string | null = null;
    
    // Mouse Pos for dragging line
    let mouseX = 0;
    let mouseY = 0;

    $: selectedTask = $store.tasks.find(t => t.id === selectedTaskId);

    // --- Dragging Logic ---
    function onMouseDown(e: MouseEvent, subId: string) {
        if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'BUTTON') return;
        e.stopPropagation();
        draggingSubId = subId;
    }

    function onMouseMove(e: MouseEvent) {
        const rect = container?.getBoundingClientRect();
        if(!rect) return;
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;

        if (draggingSubId && selectedTaskId) {
            store.updateSubtaskPos(selectedTaskId, draggingSubId, mouseX - 100, mouseY - 40);
        }
    }

    function onMouseUp() { draggingSubId = null; }

    // --- Linking Logic ---
    function toggleLinkMode(e: MouseEvent, subId: string) {
        e.stopPropagation();
        if (linkingSourceId === subId) {
            linkingSourceId = null; // Cancel
        } else if (linkingSourceId) {
            // Complete Link
            // FIX: TS Error (linkingSourceId!)
            if (selectedTaskId) store.connectSubtasks(selectedTaskId, linkingSourceId!, subId);
            linkingSourceId = null;
        } else {
            // Start Link
            linkingSourceId = subId;
        }
    }

    function removeLink(e: Event, sourceId: string, targetId: string) {
        e.stopPropagation();
        if (selectedTaskId) store.disconnectSubtasks(selectedTaskId, sourceId, targetId);
    }
    
    function handleKeyDown(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            draggingSubId = null;
            linkingSourceId = null;
        }
    }
</script>

<div class="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex overflow-hidden font-sans">
    
    <div class="w-80 bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 flex flex-col z-20 shadow-lg">
        <div class="p-4 border-b border-gray-200 dark:border-slate-700 flex items-center gap-3">
            <a href="/" class="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full"><ArrowLeft size={20}/></a>
            <h1 class="font-bold text-lg">Prozess Designer</h1>
        </div>
        <div class="flex-1 overflow-y-auto p-2 space-y-2">
            {#each $store.tasks as task}
                <button 
                    onclick={() => { selectedTaskId = task.id; draggingSubId = null; linkingSourceId = null; }}
                    class={`w-full text-left p-3 rounded-lg border transition-all ${selectedTaskId === task.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-500' : 'border-transparent hover:bg-gray-50 dark:hover:bg-slate-700'}`}
                >
                    <div class="text-xs font-bold text-gray-500 mb-1">{task.matterRef || 'Ref'}</div>
                    <div class="font-medium text-sm truncate">{task.title}</div>
                </button>
            {/each}
        </div>
    </div>

    <div 
        class="flex-1 relative bg-slate-50 dark:bg-slate-900 overflow-hidden outline-none cursor-crosshair" 
        bind:this={container}
        onmousemove={onMouseMove}
        onmouseup={onMouseUp}
        role="application"
        tabindex="-1"
        onkeydown={handleKeyDown}
    >
        {#if !selectedTask}
            <div class="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                <p>Wähle links eine Aufgabe aus.</p>
            </div>
        {:else}
            <div class="absolute top-4 left-4 z-30 flex gap-2">
                <button onclick={() => { if(selectedTaskId) store.addSubtask(selectedTaskId, 'Neuer Schritt') }} class="bg-white dark:bg-slate-800 shadow-md border dark:border-slate-700 px-4 py-2 rounded-full font-bold text-sm hover:bg-gray-50 flex items-center gap-2">
                    <Plus size={16}/> Schritt hinzufügen
                </button>
            </div>

            <svg class="absolute inset-0 w-full h-full pointer-events-none z-0">
                <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
                    </marker>
                </defs>
                {#each selectedTask.subtasks as source}
                    {#each source.next as targetId}
                        {@const target = selectedTask.subtasks.find(s => s.id === targetId)}
                        {#if target}
                            <line 
                                x1={source.x + 200} y1={source.y + 40} 
                                x2={target.x} y2={target.y + 40} 
                                stroke="#94a3b8" stroke-width="2" marker-end="url(#arrowhead)" 
                                class="pointer-events-auto cursor-pointer hover:stroke-red-500 transition-colors"
                                onclick={(e) => removeLink(e, source.id, targetId)}
                            />
                            <circle cx={(source.x + 200 + target.x) / 2} cy={(source.y + 40 + target.y + 40) / 2} r="8" fill="white" stroke="#ef4444" class="pointer-events-auto cursor-pointer" onclick={(e) => removeLink(e, source.id, targetId)} />
                        {/if}
                    {/each}
                {/each}
                
                {#if linkingSourceId}
                    {@const src = selectedTask.subtasks.find(s => s.id === linkingSourceId)}
                    {#if src}
                         <line x1={src.x + 200} y1={src.y + 40} x2={mouseX} y2={mouseY} stroke="#3b82f6" stroke-width="2" stroke-dasharray="5,5" />
                    {/if}
                {/if}
            </svg>

            {#each selectedTask.subtasks as sub (sub.id)}
                <div 
                    class="absolute w-[200px] h-[80px] bg-white dark:bg-slate-800 border-2 rounded-xl shadow-sm hover:shadow-lg transition-all z-10"
                    style="left: {sub.x}px; top: {sub.y}px; border-color: {linkingSourceId === sub.id ? '#3b82f6' : (sub.done ? '#22c55e' : '#e2e8f0')}"
                    onmousedown={(e) => onMouseDown(e, sub.id)}
                >
                    <div class="p-3 h-full flex flex-col justify-center">
                        <div class="text-[10px] font-bold text-gray-400 uppercase mb-1">{sub.type}</div>
                        <input 
                            value={sub.title} 
                            onchange={(e) => store.updateSubtaskTitle(selectedTaskId!, sub.id, e.currentTarget.value)}
                            class="font-bold text-sm bg-transparent border-none p-0 focus:ring-0 w-full truncate cursor-text"
                        />
                    </div>

                    <button 
                        class={`absolute -right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-2 transition-transform flex items-center justify-center z-20 cursor-pointer shadow-sm ${linkingSourceId === sub.id ? 'bg-blue-500 border-blue-600 scale-110' : 'bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-500 hover:scale-110'}`}
                        onclick={(e) => toggleLinkMode(e, sub.id)}
                        title="Verbinden"
                    >
                        <div class={`w-2.5 h-2.5 rounded-full ${linkingSourceId === sub.id ? 'bg-white' : 'bg-blue-500'}`}></div>
                    </button>

                    <div class="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-gray-300 dark:bg-slate-600 rounded-full"></div>
                </div>
            {/each}

        {/if}
    </div>
</div>