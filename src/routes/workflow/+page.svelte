<script lang="ts">
    import { store } from '$lib/stores/tasks';
    import { pb } from '$lib/pocketbase';
    import type { Subtask } from '$lib/types';
    import { ArrowLeft, Plus, Move, CornerDownRight, CheckCircle2, CheckSquare, Printer } from 'lucide-svelte';
    import { autosize } from '$lib/actions';

    let selectedTaskId: string | null = null;
    let container: HTMLDivElement;

    // --- FIX 1: Der lokale Drag-State für 60 FPS Performance ---
    let draggingSubId: string | null = null;
    let localDragX = 0;
    let localDragY = 0;
    
    let linkingSourceId: string | null = null;
    let mouseX = 0;
    let mouseY = 0;

    $: selectedTask = $store.tasks.find(t => t.id === selectedTaskId);

    type FlatSubtask = Subtask & { level: number };
    function flattenSubtasks(subs: Subtask[] | undefined, level = 0): FlatSubtask[] {
        if (!subs) return [];
        return subs.reduce((acc: FlatSubtask[], sub) => {
            return [
                ...acc,
                { ...sub, level },
                ...flattenSubtasks(sub.subtasks, level + 1)
            ];
        }, []);
    }

    // Die echte Wahrheit aus der Datenbank
    $: flattenedSubs = selectedTask ? flattenSubtasks(selectedTask.subtasks) : [];

    // --- FIX 1.2: Das Rendering-Array ---
    // Wir verschmelzen die Datenbank-Wahrheit in Echtzeit mit unserer lokalen Maus-Position,
    // OHNE den Store 60-mal pro Sekunde zu blockieren.
    $: renderSubs = flattenedSubs.map(sub => {
        if (sub.id === draggingSubId) {
            return { ...sub, x: localDragX, y: localDragY };
        }
        return sub;
    });

    function autoCenterUnplaced(taskId: string) {
        if (!container) return;
        const task = $store.tasks.find(t => t.id === taskId);
        if (!task) return;
        
        const subs = flattenSubtasks(task.subtasks);
        const unplaced = subs.filter(s => !s.x && !s.y);
        
        if (unplaced.length > 0) {
            const rect = container.getBoundingClientRect();
            const cx = rect.width > 0 ? Math.round(rect.width / 2) - 110 : 400;
            const cy = rect.height > 0 ? Math.round(rect.height / 2) - 45 : 300;

            unplaced.forEach((sub, i) => {
                const nx = cx + (i * 35) % 200;
                const ny = cy + (i * 35) % 200;
                store.updateSubtaskPos(taskId, sub.id, nx, ny);
            });
        }
    }

    function getCurve(x1: number, y1: number, x2: number, y2: number) {
        const c1x = x1 + (x2 - x1) / 2;
        const c1y = y1;
        const c2x = x1 + (x2 - x1) / 2;
        const c2y = y2;
        return `M ${x1} ${y1} C ${c1x} ${c1y} ${c2x} ${c2y} ${x2} ${y2}`;
    }

    function addStep() {
        if (!selectedTaskId || !container) return;
        const rect = container.getBoundingClientRect();
        let x = Math.round((rect.width / 2) - 110);
        let y = Math.round((rect.height / 2) - 45);
        const stepCount = flattenedSubs.length;
        x += (stepCount * 25) % 150;
        y += (stepCount * 25) % 150;
        store.addSubtask(selectedTaskId, 'Neuer Schritt', 'GENERIC', x, y);
    }

    function onCanvasMouseMove(e: MouseEvent) {
        if (!container) return;
        const rect = container.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;

        // Wir updaten NUR unsere lokalen Variablen. Butterweich. Kein Store-Zugriff!
        if (draggingSubId && selectedTaskId) {
            localDragX = Math.round((mouseX - 110) / 20) * 20;
            localDragY = Math.round((mouseY - 20) / 20) * 20;
        }
    }

    function startDrag(e: MouseEvent, sub: any) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON') return;
        e.stopPropagation();
        
        // Drag aktivieren und Startkoordinaten setzen
        draggingSubId = sub.id;
        localDragX = sub.x || 0;
        localDragY = sub.y || 0;
    }

    function handleMouseUp() {
        // --- FIX 1.3: Der Store-Commit ---
        // Erst wenn die Maus losgelassen wird, speichern wir die neuen Koordinaten global und in der DB.
        if (draggingSubId && selectedTaskId) {
            store.updateSubtaskPos(selectedTaskId, draggingSubId, localDragX, localDragY);
        }
        draggingSubId = null;
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

    function handleKeyDown(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            draggingSubId = null;
            linkingSourceId = null;
        }
    }

    function printWorkflow() {
        window.print();
    }
</script>
<svelte:head>
    <style>
        @media print {
            @page {
                size: A4 landscape;
                margin: 10mm;
            }
        }
    </style>
</svelte:head>

<div class="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex overflow-hidden font-sans print:bg-white print:text-black">
    
    <div class="w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-20 shadow-xl shrink-0 print:hidden">
        <div class="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 bg-slate-50 dark:bg-slate-900">
            <a href="/" class="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"><ArrowLeft size={20}/></a>
            <h1 class="font-bold text-lg">Prozess Designer</h1>
        </div>
        <div class="flex-1 overflow-y-auto p-3 space-y-2">
            {#each $store.tasks as task}
                <button 
                    onclick={() => { 
                        selectedTaskId = task.id; 
                        draggingSubId = null; 
                        linkingSourceId = null; 
                        setTimeout(() => autoCenterUnplaced(task.id), 10);
                    }} 
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
        role="application"
        class="flex-1 relative bg-slate-100 dark:bg-slate-950 overflow-hidden cursor-crosshair print:overflow-visible print:bg-transparent print:absolute print:inset-0"
        bind:this={container}
        onmousemove={onCanvasMouseMove}
        onmouseup={handleMouseUp}
        onclick={() => { linkingSourceId = null; }}
        tabindex="0"
        onkeydown={handleKeyDown}
    >
        <div class="absolute inset-0 opacity-10 dark:opacity-20 pointer-events-none print:hidden" style="background-image: radial-gradient(#64748b 1px, transparent 1px); background-size: 20px 20px;"></div>

        {#if !selectedTask}
            <div class="absolute inset-0 flex flex-col items-center justify-center text-slate-400 print:hidden">
                <p>Wähle links eine Aufgabe aus.</p>
            </div>
        {:else}
            <div class="absolute top-6 left-6 z-30 flex gap-3 print:hidden">
                <button 
                    onclick={(e) => { e.stopPropagation(); addStep(); }} 
                    class="bg-slate-900 dark:bg-amber-600 text-white shadow-lg px-5 py-2.5 rounded-full font-bold text-sm hover:scale-105 transition-transform flex items-center gap-2"
                >
                    <Plus size={18}/> Schritt hinzufügen
                </button>
                
                <button 
                    onclick={(e) => { e.stopPropagation(); printWorkflow(); }} 
                    class="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-lg px-4 py-2.5 rounded-full font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-2"
                    title="Diagramm drucken"
                >
                    <Printer size={18}/> Drucken
                </button>

                <div class="bg-white/90 dark:bg-slate-800/90 backdrop-blur px-4 py-2.5 rounded-full text-xs font-medium text-slate-500 shadow-sm border border-slate-200 dark:border-slate-700">
                    Drag: Bewegen • Rechts: Start Link • Links: Ende Link
                </div>
            </div>

            <div class="hidden print:block absolute top-0 left-0 p-8 z-0">
                <h1 class="text-3xl font-bold font-serif mb-1">Workflow: {selectedTask.title}</h1>
                <p class="text-gray-500 font-bold tracking-widest">{selectedTask.matterRef || 'KEINE REF'}</p>
            </div>

            <svg class="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible print:w-[200vw] print:h-[200vh]">
                <defs>
                    <marker id="arrow" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
                        <path d="M0,0 L0,6 L9,3 z" fill="#94a3b8" class="print:fill-black" />
                    </marker>
                    <marker id="arrow-active" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
                        <path d="M0,0 L0,6 L9,3 z" fill="#3b82f6" />
                    </marker>
                </defs>

                {#each renderSubs as source}
                    {#each source.next as targetId}
                        {@const target = renderSubs.find(s => s.id === targetId)}
                        {#if target}
                            {@const pathData = getCurve(source.x + 220, source.y + 40, target.x, target.y + 40)}
                            <path 
                                role="button" tabindex="0"
                                d={pathData} 
                                stroke="transparent" stroke-width="15" fill="none" 
                                class="pointer-events-auto cursor-pointer focus:outline-none focus:stroke-red-500/30 print:hidden"
                                onclick={(e) => { e.stopPropagation(); if(selectedTaskId) store.disconnectSubtasks(selectedTaskId, source.id, targetId); }}
                                onkeydown={(e) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); if(selectedTaskId) store.disconnectSubtasks(selectedTaskId, source.id, targetId); } }}
                            >
                                <title>Klick oder Enter zum Löschen</title>
                            </path>
                            <path d={pathData} stroke={source.done && target.done ? "#22c55e" : "#94a3b8"} class="print:stroke-slate-500" stroke-width="2" fill="none" marker-end="url(#arrow)" />
                        {/if}
                    {/each}
                {/each}

                {#if linkingSourceId}
                    {@const src = renderSubs.find(s => s.id === linkingSourceId)}
                    {#if src}
                        <path d={getCurve(src.x + 220, src.y + 40, mouseX, mouseY)} stroke="#3b82f6" stroke-width="2" stroke-dasharray="5,5" fill="none" marker-end="url(#arrow-active)" />
                    {/if}
                {/if}
            </svg>

            {#each renderSubs as sub (sub.id)}
                <div 
                    role="button"
                    tabindex="0"
                    class={`absolute w-[220px] shadow-lg z-10 group transition-colors duration-200 print:shadow-none print:border-black
                        ${linkingSourceId === sub.id ? 'border-blue-500 ring-4 ring-blue-500/20' : 'hover:border-amber-400'}
                        ${sub.level > 0 ? 'border-dashed border-2 rounded-tl-3xl rounded-br-3xl rounded-tr-sm rounded-bl-sm' : 'border-2 rounded-xl'}
                        ${sub.done ? 'bg-slate-50 dark:bg-slate-900 border-green-500/50 opacity-80 grayscale-[0.2] print:bg-white print:border-gray-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 print:border-black'}
                    `}
                    style="left: {sub.x || 0}px; top: {sub.y || 0}px;"
                    onmousedown={(e) => startDrag(e, sub)}
                >
                    <div class={`px-3 py-2 border-b flex justify-between items-center cursor-move transition-colors print:border-black
                        ${sub.level > 0 ? 'rounded-tl-3xl rounded-tr-sm' : 'rounded-t-xl'}
                        ${sub.done ? 'bg-green-50/50 dark:bg-green-900/20 border-green-100 dark:border-green-900/50 print:bg-transparent print:border-gray-300' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700 print:bg-transparent print:border-black'}
                    `}>
                        <div class="flex items-center gap-1.5 pl-1">
                            {#if sub.done}
                                <CheckCircle2 size={14} class="text-green-600 dark:text-green-500 print:text-gray-400"/>
                            {:else if sub.level > 0}
                                <CornerDownRight size={12} class="text-slate-400 print:text-black"/>
                            {/if}
                            <span class={`text-[10px] font-bold uppercase tracking-wider ${sub.done ? 'text-green-600 dark:text-green-500 print:text-gray-400' : 'text-slate-400 print:text-black'}`}>
                                {sub.type === 'GENERIC' ? (sub.level > 0 ? 'Unterschritt' : 'Schritt') : sub.type}
                            </span>
                        </div>
                        <div class="flex items-center gap-2 print:hidden">
                            <button 
                                onclick={(e) => { e.stopPropagation(); store.toggleSubtask(selectedTaskId!, sub.id); }}
                                class="text-slate-300 hover:text-green-500 transition-colors"
                                title="Erledigt markieren"
                            >
                                <CheckSquare size={14} class={sub.done ? "text-green-500" : ""} />
                            </button>
                            <Move size={14} class="text-slate-300" />
                        </div>
                    </div>

                    <div class="p-3">
                        <textarea 
                            use:autosize
                            value={sub.title} 
                            onchange={(e) => store.updateSubtaskTitle(selectedTaskId!, sub.id, e.currentTarget.value)} 
                            rows="1"
                            spellcheck="false"
                            class={`w-full text-sm font-bold bg-transparent border-0 p-0 focus:ring-0 transition-colors resize-none overflow-hidden block whitespace-pre-wrap break-words min-h-[20px]
                                ${sub.done ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-200 print:text-black'}
                            `}
                        ></textarea>
                    </div>

                    <button 
                        class="absolute -left-3 top-10 -translate-y-1/2 w-6 h-6 bg-slate-100 dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-500 rounded-full hover:scale-125 hover:border-green-500 transition-all flex items-center justify-center z-20 cursor-pointer shadow-sm print:hidden"
                        onclick={(e) => finishLink(e, sub.id)}
                        title="Eingang (Ziel)"
                    >
                        <div class="w-1.5 h-1.5 bg-slate-400 rounded-full"></div>
                    </button>
                    <button 
                        class={`absolute -right-3 top-10 -translate-y-1/2 w-6 h-6 border-2 rounded-full hover:scale-125 transition-all flex items-center justify-center z-20 cursor-pointer shadow-sm print:hidden
                        ${linkingSourceId === sub.id ? 'bg-white' : 'bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-500 hover:border-blue-500'}`}
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