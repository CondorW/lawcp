<script lang="ts">
    import { store } from '$lib/stores/tasks';
    import type { Task } from '$lib/types';
    import { ArrowLeft, ChevronLeft, ChevronRight, Calendar, Plus, X } from 'lucide-svelte';
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
        if (month === 11) {
            month = 0;
            year++;
        } else {
            month++;
        }
        currentDate = new Date(year, month, 1);
    }

    function prevMonth() {
        if (month === 0) {
            month = 11;
            year--;
        } else {
            month--;
        }
        currentDate = new Date(year, month, 1);
    }

    $: tasksByDate = $store.tasks.reduce((acc, task) => {
        if (!task.dueDate) return acc;
        if (!acc[task.dueDate]) acc[task.dueDate] = [];
        acc[task.dueDate].push(task);
        return acc;
    }, {} as Record<string, Task[]>);

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
        store.addTask('TODO', newTaskTitle, newTaskRef, newTaskDate);
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
            e.dataTransfer.setDragImage(e.target as Element, 0, 0);
        }
    }

    function handleDragOver(e: DragEvent, dateStr: string) {
        e.preventDefault();
        dragOverDate = dateStr;
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

<!-- LAYOUT FIX: h-screen und overflow-hidden garantieren, dass die Seite niemals vertikal scrollt -->
<div class="h-screen overflow-hidden flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 lg:p-6 font-sans">
    
    <div class="max-w-[1600px] w-full mx-auto flex flex-col flex-1 min-h-0">
        
        <!-- HEADER (Kompakter gemacht) -->
        <div class="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div class="flex items-center gap-4">
                <a href="/" class="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                    <ArrowLeft size={24} />
                </a>
                <!-- KONTRAST FIX: blue-600 im Light Mode, blue-400 im Dark Mode für perfekten Kontrast -->
                <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                    <Calendar size={28} class="text-blue-600 dark:text-blue-400" /> 
                    {monthNames[month]} <span class="text-slate-400">{year}</span>
                </h1>
            </div>

            <div class="flex gap-2">
                <button onclick={prevMonth} class="p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-colors outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400">
                    <ChevronLeft size={20} />
                </button>
                <button onclick={nextMonth} class="p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-colors outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400">
                    <ChevronRight size={20} />
                </button>
            </div>
        </div>

        <!-- KALENDER BEREICH: Nimmt den restlichen Platz ein (flex-1) -->
        <div class="flex-1 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden min-h-0 select-none">
            
            <!-- Wochentage (Kopfzeile) -->
            <div class="shrink-0 grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                {#each ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as dayName}
                    <div class="py-2.5 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">{dayName}</div>
                {/each}
            </div>

            <!-- Kalender Grid: auto-rows-fr sorgt dafür, dass sich die Zellen den Platz perfekt aufteilen -->
            <div class="flex-1 grid grid-cols-7 auto-rows-fr bg-slate-200 dark:border-slate-800 gap-px min-h-0">
                {#each calendarDays as cell (cell.type === 'day' ? cell.dateStr : cell.id)}
                    {#if cell.type === 'empty'}
                        <div class="bg-slate-50/50 dark:bg-slate-900/50"></div>
                    {:else}
                        <div 
                            class={`bg-white dark:bg-slate-900 flex flex-col min-h-0 p-2 transition-all relative group cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 dark:focus:ring-blue-400 ${dragOverDate === cell.dateStr ? 'bg-blue-50/50 dark:bg-blue-900/20 ring-2 ring-inset ring-blue-500 dark:ring-blue-400' : 'hover:bg-slate-50 dark:hover:bg-slate-800/80'}`}
                            onclick={() => openAddModal(cell.dateStr!)}
                            onkeydown={(e) => onDayKeyDown(e, cell.dateStr!)}
                            ondragover={(e) => handleDragOver(e, cell.dateStr!)}
                            ondrop={(e) => handleDrop(e, cell.dateStr!)}
                            role="button"
                            tabindex="0"
                        >
                            <div class="shrink-0 flex justify-between items-start mb-1.5">
                                <span class={`text-sm font-bold transition-colors ${dragOverDate === cell.dateStr ? 'text-blue-600 dark:text-blue-400 scale-110' : 'text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400'}`}>{cell.dayNum}</span>
                                <div class="opacity-0 group-hover:opacity-100 transition-opacity text-blue-600 dark:text-blue-400">
                                    <Plus size={16} />
                                </div>
                            </div>
                            
                            <!-- Tasks-Container scrollt in sich selbst, wenn nötig -->
                            <div class="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                                {#each cell.tasks as task (task.id)}
                                    <div 
                                        class={`bg-slate-100 dark:bg-slate-800 px-2 py-1.5 rounded-md border-l-[3px] border-slate-300 dark:border-slate-600 hover:border-blue-600 dark:hover:border-blue-400 shadow-sm transition-all cursor-grab active:cursor-grabbing ${draggingTaskId === task.id ? 'opacity-50 scale-95' : ''}`}
                                        title={task.title}
                                        role="button"
                                        tabindex="0"
                                        draggable="true"
                                        ondragstart={(e) => handleDragStart(e, task.id)}
                                        onclick={(e) => e.stopPropagation()}
                                        onkeydown={(e) => e.stopPropagation()}
                                    >
                                        {#if task.matterRef}
                                            <span class="inline-block text-[10px] font-bold px-1 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded uppercase tracking-wider mb-0.5 truncate max-w-full">
                                                {task.matterRef}
                                            </span>
                                        {/if}
                                        <div class="text-xs font-medium text-slate-800 dark:text-slate-200 leading-tight line-clamp-2">
                                            {task.title}
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/if}
                {/each}
            </div>
            
        </div>
    </div>

    <!-- Modal-Bereich -->
    {#if showModal}
        <div class="fixed inset-0 z-[9999] flex items-center justify-center p-4" transition:fade={{ duration: 150 }}>
            <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onclick={closeModal} onkeydown={(e) => e.key === 'Escape' && closeModal()} role="button" tabindex="-1"></div>
            
            <div class="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg p-8 space-y-6" transition:scale={{ duration: 200, start: 0.95 }}>
                <div class="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
                    <h3 class="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Plus size={20} class="text-blue-600 dark:text-blue-400" /> Schnelleingabe
                    </h3>
                    <button onclick={closeModal} class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 outline-none">
                        <X size={24} />
                    </button>
                </div>
                
                <div class="space-y-5">
                    <div>
                        <label class="block text-xs font-bold uppercase text-slate-500 mb-2" for="new-task-input">Aufgabe</label>
                        <input id="new-task-input" type="text" bind:value={newTaskTitle} placeholder="Was ist zu tun?" class="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none p-3 text-sm shadow-sm" onkeydown={handleModalKeydown} />
                    </div>
                    
                    <div class="grid grid-cols-2 gap-5">
                        <div>
                            <label class="block text-xs font-bold uppercase text-slate-500 mb-2" for="new-task-date">Frist (Intern)</label>
                            <input id="new-task-date" type="date" bind:value={newTaskDate} class="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 dark:[color-scheme:dark] outline-none p-3 text-sm shadow-sm" />
                        </div>
                        <div>
                            <label class="block text-xs font-bold uppercase text-slate-500 mb-2" for="new-task-ref">Aktenzeichen / Ref.</label>
                            <input id="new-task-ref" type="text" bind:value={newTaskRef} placeholder="Optional" class="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none p-3 text-sm shadow-sm uppercase" onkeydown={handleModalKeydown} />
                        </div>
                    </div>
                </div>
                
                <div class="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button onclick={closeModal} class="px-5 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors outline-none bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg">
                        Abbrechen
                    </button>
                    <button onclick={saveTask} disabled={!newTaskTitle.trim()} class="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors outline-none flex items-center gap-2">
                        <Plus size={18} /> Speichern
                    </button>
                </div>
            </div>
        </div>
    {/if}
</div>