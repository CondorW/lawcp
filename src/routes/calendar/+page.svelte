<script lang="ts">
    import { store, type Task } from '$lib/stores/tasks';
    import { ArrowLeft, ChevronLeft, ChevronRight, Calendar, Plus, X, Clock } from 'lucide-svelte';
    import { fade, scale } from 'svelte/transition';

    let currentDate = new Date();
    let year = currentDate.getFullYear();
    let month = currentDate.getMonth();

    // Modal State
    let showModal = false;
    let newTaskTitle = '';
    let newTaskRef = '';
    let newTaskDate = '';

    // Drag & Drop State
    let draggingTaskId: string | null = null;
    let dragOverDate: string | null = null;

    const monthNames = ["Jänner", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

    type CalendarCell = 
        | { type: 'empty'; id: string; dateStr?: undefined; dayNum?: undefined; tasks?: undefined }
        | { type: 'day'; dayNum: number; dateStr: string; tasks: Task[]; id?: undefined };

    function nextMonth() {
        if (month === 11) { month = 0; year++; } else { month++; }
        currentDate = new Date(year, month, 1);
    }

    function prevMonth() {
        if (month === 0) { month = 11; year--; } else { month--; }
        currentDate = new Date(year, month, 1);
    }

    // 1. Reaktivität: Tasks gruppieren
    $: tasksByDate = $store.tasks.reduce((acc, task) => {
        if (!task.dueDate) return acc;
        if (!acc[task.dueDate]) acc[task.dueDate] = [];
        acc[task.dueDate].push(task);
        return acc;
    }, {} as Record<string, Task[]>);

    // 2. Reaktivität: Kalenderstruktur bauen
    $: calendarDays = (() => {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const startDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; 
        
        const days: CalendarCell[] = [];
        
        for (let i = 0; i < startDayIndex; i++) {
            days.push({ type: 'empty', id: `empty-${i}` });
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const tasks = tasksByDate[dateStr] || [];
            days.push({ type: 'day', dayNum: i, dateStr, tasks });
        }
        return days;
    })();

    // --- Modal Logic ---
    function openAddModal(dateStr: string) {
        newTaskDate = dateStr;
        newTaskTitle = '';
        newTaskRef = '';
        showModal = true;
        setTimeout(() => document.getElementById('new-task-input')?.focus(), 50);
    }

    function closeModal() {
        showModal = false;
    }

    function saveTask() {
        if (!newTaskTitle.trim()) return;
        store.addTask(newTaskTitle, newTaskRef, newTaskDate);
        closeModal();
    }

    function handleModalKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter') saveTask();
        if (e.key === 'Escape') closeModal();
    }

    function onDayKeyDown(e: KeyboardEvent, dateStr: string) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openAddModal(dateStr);
        }
    }

    // --- Drag & Drop Logic ---
    function handleDragStart(e: DragEvent, taskId: string) {
        draggingTaskId = taskId;
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', taskId);
            // Kleines Geisterbild
            e.dataTransfer.setDragImage(e.target as Element, 0, 0);
        }
    }

    function handleDragOver(e: DragEvent, dateStr: string) {
        e.preventDefault(); // Erlaubt Drop
        dragOverDate = dateStr;
    }

    function handleDragLeave(e: DragEvent) {
        // Optional: Reset highlight if leaving specific area (handled via dragOverDate usually)
    }

    function handleDrop(e: DragEvent, dateStr: string) {
        e.preventDefault();
        dragOverDate = null;
        const taskId = e.dataTransfer?.getData('text/plain');
        
        if (taskId && taskId === draggingTaskId) {
            store.updateDate(taskId, dateStr);
        }
        draggingTaskId = null;
    }
</script>

<div class="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-8 font-sans">
    <div class="max-w-[1600px] mx-auto">
        <div class="flex items-center justify-between mb-8">
            <div class="flex items-center gap-4">
                <a href="/" class="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"><ArrowLeft /></a>
                <h1 class="text-3xl font-bold font-serif text-slate-800 dark:text-slate-100 flex items-center gap-3">
                    <Calendar class="text-amber-600" />
                    {monthNames[month]} <span class="text-slate-400 font-light">{year}</span>
                </h1>
            </div>
            <div class="flex gap-2">
                <button onclick={prevMonth} class="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm"><ChevronLeft /></button>
                <button onclick={nextMonth} class="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm"><ChevronRight /></button>
            </div>
        </div>

        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden select-none">
            <div class="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                {#each ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as dayName}
                    <div class="py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">{dayName}</div>
                {/each}
            </div>

            <div class="grid grid-cols-7 auto-rows-fr bg-slate-200 dark:bg-slate-800 gap-px">
                {#each calendarDays as cell (cell.type === 'day' ? cell.dateStr : cell.id)}
                    {#if cell.type === 'empty'}
                         <div class="bg-slate-50/50 dark:bg-slate-900/50 min-h-[140px]"></div>
                    {:else}
                        <div 
                            class={`bg-white dark:bg-slate-900 min-h-[140px] p-2 transition-all relative group cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-amber-500 ${dragOverDate === cell.dateStr ? 'bg-amber-50 dark:bg-amber-900/20 ring-2 ring-inset ring-amber-400' : 'hover:bg-amber-50/20 dark:hover:bg-slate-800/80'}`}
                            onclick={() => openAddModal(cell.dateStr!)}
                            onkeydown={(e) => onDayKeyDown(e, cell.dateStr!)}
                            ondragover={(e) => handleDragOver(e, cell.dateStr!)}
                            ondrop={(e) => handleDrop(e, cell.dateStr!)}
                            role="button"
                            tabindex="0"
                        >
                            <div class="flex justify-between items-start">
                                <span class={`text-sm font-semibold transition-colors ${dragOverDate === cell.dateStr ? 'text-amber-600 font-bold scale-110' : 'text-slate-400 group-hover:text-amber-600'}`}>{cell.dayNum}</span>
                                <div class="opacity-0 group-hover:opacity-100 transition-opacity text-amber-500">
                                    <Plus size={16} />
                                </div>
                            </div>
                            
                            <div class="mt-2 space-y-1.5 overflow-y-auto max-h-[100px] custom-scrollbar">
                                {#each cell.tasks as task (task.id)}
                                    <div 
                                        class={`text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-1.5 rounded border-l-4 border-slate-500 hover:border-amber-500 shadow-sm transition-all truncate cursor-grab active:cursor-grabbing ${draggingTaskId === task.id ? 'opacity-50 scale-95' : ''}`}
                                        title={task.title}
                                        role="button"
                                        tabindex="0"
                                        draggable="true"
                                        ondragstart={(e) => handleDragStart(e, task.id)}
                                        onclick={(e) => e.stopPropagation()} 
                                        onkeydown={(e) => e.stopPropagation()}
                                    >
                                        {#if task.matterRef}
                                            <span class="font-bold text-[10px] text-slate-400 block mb-0.5">{task.matterRef}</span>
                                        {/if}
                                        {task.title}
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/if}
                {/each}
            </div>
        </div>
    </div>

    {#if showModal}
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4" transition:fade={{ duration: 200 }}>
            <div 
                class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm focus:outline-none" 
                onclick={closeModal}
                onkeydown={(e) => e.key === 'Escape' && closeModal()}
                role="button"
                tabindex="0"
            ></div>
            
            <div 
                class="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
                transition:scale={{ duration: 200, start: 0.95 }}
            >
                <div class="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <h2 class="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Clock size={20} class="text-amber-500"/>
                        Schnelleingabe
                    </h2>
                    <button onclick={closeModal} class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div class="p-6 space-y-5">
                    <div>
                        <label class="block text-xs font-bold uppercase text-slate-500 mb-1.5" for="new-task-input">Aufgabe</label>
                        <input 
                            id="new-task-input"
                            type="text" 
                            bind:value={newTaskTitle} 
                            placeholder="Was ist zu tun?" 
                            class="w-full rounded-lg border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 p-3 text-base shadow-sm"
                            onkeydown={handleModalKeydown}
                        />
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-bold uppercase text-slate-500 mb-1.5" for="new-task-date">Frist</label>
                            <input 
                                id="new-task-date"
                                type="date" 
                                bind:value={newTaskDate} 
                                class="w-full rounded-lg border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 p-2.5 shadow-sm"
                            />
                        </div>
                        <div>
                            <label class="block text-xs font-bold uppercase text-slate-500 mb-1.5" for="new-task-ref">Ref-Nr.</label>
                            <input 
                                id="new-task-ref"
                                type="text" 
                                bind:value={newTaskRef} 
                                placeholder="Optional" 
                                class="w-full rounded-lg border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 p-2.5 shadow-sm font-mono text-sm"
                                onkeydown={handleModalKeydown}
                            />
                        </div>
                    </div>
                </div>

                <div class="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                    <button onclick={closeModal} class="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-slate-600 transition-all">
                        Abbrechen
                    </button>
                    <button onclick={saveTask} class="px-5 py-2 text-sm font-bold text-white bg-slate-900 dark:bg-amber-600 hover:bg-slate-800 dark:hover:bg-amber-500 rounded-lg shadow-md hover:shadow-lg transition-all transform active:scale-95 flex items-center gap-2">
                        <Plus size={16} /> Speichern
                    </button>
                </div>
            </div>
        </div>
    {/if}
</div>