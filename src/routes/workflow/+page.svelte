<script lang="ts">
    import { store } from '$lib/stores/tasks';
    import { ArrowLeft, Plus, Move } from 'lucide-svelte';

    let selectedTaskId: string | null = null;
    let container: HTMLDivElement;

    // State
    let draggingSubId: string | null = null;
    let linkingSourceId: string | null = null;
    let mouseX = 0;
    let mouseY = 0;

    $: selectedTask = $store.tasks.find(t => t.id === selectedTaskId);

    // --- Helpers ---
    function getCurve(x1: number, y1: number, x2: number, y2: number) {
        const c1x = x1 + (x2 - x1) / 2;
        const c1y = y1;
        const c2x = x1 + (x2 - x1) / 2;
        const c2y = y2;
        return `M ${x1} ${y1} C ${c1x} ${c1y} ${c2x} ${c2y} ${x2} ${y2}`;
    }

    // --- Logic ---
    function addStep() {
        if (!selectedTaskId || !container) return;
        // Mitte des Canvas berechnen
        const rect = container.getBoundingClientRect();
        const centerX = rect.width / 2 - 110; // Minus halbe Kartenbreite
        const centerY = rect.height / 2 - 40; // Minus halbe Kartenhöhe
        // Kleiner Random Offset
        const x = centerX + (Math.random() * 40 - 20);
        const y = centerY + (Math.random() * 40 - 20);
        
        store.addSubtask(selectedTaskId, 'Neuer Schritt', 'GENERIC', x, y);
    }

    function onCanvasMouseMove(e: MouseEvent) {
        if (!container) return;
        const rect = container.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;

        if (draggingSubId && selectedTaskId) {
            // Drag Position (Grid Snap 20px)
            const x = Math.round((mouseX - 110) / 20) * 20;
            const y = Math.round((mouseY - 20) / 20) * 20;
            store.updateSubtaskPos(selectedTaskId, draggingSubId, x, y);
        }
    }

    function startLink(e: MouseEvent, subId: string) {
        e.stopPropagation();
        linkingSourceId = subId;
    }

    function finishLink(e: MouseEvent, targetId: string) {
        e.stopPropagation();
        if (selectedTaskId && linkingSourceId && linkingSourceId !== targetId) {
            store.connectSubtasks(selectedTaskId, linkingSourceId, targetId);
            linkingSourceId = null;
        }
    }

    function startDrag(e: MouseEvent, subId: string) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'BUTTON') return;
        e.stopPropagation();
        draggingSubId = subId;
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            draggingSubId = null;
            linkingSourceId = null;
        }
    }
</script>

<div class="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex overflow-hidden font-sans">
    
    <div class="w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-20 shadow-xl">
        <div class="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 bg-slate-50 dark:bg-slate-900">
            <a href="/" class="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"><ArrowLeft size={20}/></a>
            <h1 class="font-bold text-lg">Prozess Designer</h1>
        </div>
        <div class="flex-1 overflow-y-auto p-3 space-y-2">
            {#each $store.tasks as task}
                <button 
                    onclick={() => { selectedTaskId = task.id; draggingSubId = null; linkingSourceId = null; }}
                    class={`w-full text-left p-3 rounded-xl border transition-all duration-200 group ${selectedTaskId === task.id ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-500' : 'border-transparent bg-slate-50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 hover:shadow-md'}`}
                >
                    <div class="flex justify-between items-center mb-1">
                        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500 group-hover:text-amber-600">{task.matterRef || 'REF'}</span>
                    </div>
                    <div class="font-bold text-sm truncate">{task.title}</div>
                </button>
            {/each}
        </div>
    </div>

    <div 
        class="flex-1 relative bg-slate-100 dark:bg-slate-950 overflow-hidden cursor-crosshair" 
        bind:this={container}
        onmousemove={onCanvasMouseMove}
        onmouseup={() => { draggingSubId = null; }}
        onclick={() => { linkingSourceId = null; }} 
        role="application"
        tabindex="-1"
        onkeydown={handleKeyDown}
    >
        <div class="absolute inset-0 opacity-10 dark:opacity-20 pointer-events-none" style="background-image: radial-gradient(#64748b 1px, transparent 1px); background-size: 20px 20px;"></div>

        {#if !selectedTask}
            <div class="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                <p>Wähle links eine Aufgabe aus.</p>
            </div>
        {:else}
            <div class="absolute top-6 left-6 z-30 flex gap-3">
                <button onclick={(e) => { e.stopPropagation(); addStep(); }} class="bg-slate-900 dark:bg-amber-600 text-white shadow-lg px-5 py-2.5 rounded-full font-bold text-sm hover:scale-105 transition-transform flex items-center gap-2">
                    <Plus size={18}/> Schritt hinzufügen
                </button>
                <div class="bg-white/90 dark:bg-slate-800/90 backdrop-blur px-4 py-2.5 rounded-full text-xs font-medium text-slate-500 shadow-sm border border-slate-200 dark:border-slate-700">
                    Drag: Bewegen • Rechts: Start Link • Links: Ende Link
                </div>
            </div>

            <svg class="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible">
                <defs>
                    <marker id="arrow" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
                        <path d="M0,0 L0,6 L9,3 z" fill="#94a3b8" />
                    </marker>
                    <marker id="arrow-active" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
                        <path d="M0,0 L0,6 L9,3 z" fill="#3b82f6" />
                    </marker>
                </defs>

                {#each selectedTask.subtasks as source}
                    {#each source.next as targetId}
                        {@const target = selectedTask.subtasks.find(s => s.id === targetId)}
                        {#if target}
                            {@const pathData = getCurve(source.x + 220, source.y + 40, target.x, target.y + 40)}
                            <path d={pathData} stroke="transparent" stroke-width="15" fill="none" class="pointer-events-auto cursor-pointer" onclick={(e) => { e.stopPropagation(); if(selectedTaskId) store.disconnectSubtasks(selectedTaskId, source.id, targetId); }}>
                                <title>Klick zum Löschen</title>
                            </path>
                            <path d={pathData} stroke="#94a3b8" stroke-width="2" fill="none" marker-end="url(#arrow)" />
                        {/if}
                    {/each}
                {/each}

                {#if linkingSourceId}
                    {@const src = selectedTask.subtasks.find(s => s.id === linkingSourceId)}
                    {#if src}
                        <path d={getCurve(src.x + 220, src.y + 40, mouseX, mouseY)} stroke="#3b82f6" stroke-width="2" stroke-dasharray="5,5" fill="none" marker-end="url(#arrow-active)" />
                    {/if}
                {/if}
            </svg>

            {#each selectedTask.subtasks as sub (sub.id)}
                <div 
                    class={`absolute w-[220px] bg-white dark:bg-slate-800 rounded-xl shadow-lg border-2 transition-all z-10 group ${linkingSourceId === sub.id ? 'border-blue-500 ring-4 ring-blue-500/20' : 'border-slate-200 dark:border-slate-700 hover:border-amber-400'}`}
                    style="left: {sub.x}px; top: {sub.y}px;"
                    onmousedown={(e) => startDrag(e, sub.id)}
                >
                    <div class="px-3 py-2 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 rounded-t-xl cursor-move">
                        <span class="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{sub.type}</span>
                        <Move size={14} class="text-slate-300" />
                    </div>

                    <div class="p-3">
                        <input 
                            value={sub.title} 
                            onchange={(e) => store.updateSubtaskTitle(selectedTaskId!, sub.id, e.currentTarget.value)}
                            class="w-full text-sm font-bold bg-transparent border-0 p-0 focus:ring-0 text-slate-800 dark:text-slate-200"
                        />
                    </div>

                    <button 
                        class="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-slate-100 dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-500 rounded-full hover:scale-125 hover:border-green-500 transition-all flex items-center justify-center z-20 cursor-pointer shadow-sm"
                        onclick={(e) => finishLink(e, sub.id)}
                        title="Eingang (Ziel)"
                    >
                        <div class="w-1.5 h-1.5 bg-slate-400 rounded-full"></div>
                    </button>

                    <button 
                        class={`absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 border-2 rounded-full hover:scale-125 transition-all flex items-center justify-center z-20 cursor-pointer shadow-sm ${linkingSourceId === sub.id ? 'bg-blue-500 border-blue-600' : 'bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-500 hover:border-blue-500'}`}
                        onclick={(e) => startLink(e, sub.id)}
                        title="Ausgang (Start)"
                    >
                        <div class={`w-1.5 h-1.5 rounded-full ${linkingSourceId === sub.id ? 'bg-white' : 'bg-slate-400'}`}></div>
                    </button>
                </div>
            {/each}
        {/if}
    </div>
</div>