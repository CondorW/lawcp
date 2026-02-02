<script lang="ts">
    import { store } from '$lib/stores/tasks';
    import { ArrowLeft, ChevronLeft, ChevronRight, Calendar } from 'lucide-svelte';
    import { formatDate } from '$lib/utils';

    let currentDate = new Date();
    let year = currentDate.getFullYear();
    let month = currentDate.getMonth();

    const monthNames = ["Jänner", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

    function nextMonth() {
        if (month === 11) { month = 0; year++; } else { month++; }
        currentDate = new Date(year, month, 1);
    }

    function prevMonth() {
        if (month === 0) { month = 11; year--; } else { month--; }
        currentDate = new Date(year, month, 1);
    }

    function getDaysInMonth(y: number, m: number) {
        return new Date(y, m + 1, 0).getDate();
    }

    function getFirstDayOfMonth(y: number, m: number) {
        // 0 = Sunday, 1 = Monday. We want 0 = Monday.
        const day = new Date(y, m, 1).getDay();
        return day === 0 ? 6 : day - 1;
    }

    $: days = Array.from({ length: getDaysInMonth(year, month) }, (_, i) => i + 1);
    $: offset = getFirstDayOfMonth(year, month);
    $: offsetArray = Array.from({ length: offset }, (_, i) => i);

    // Safer filtering logic
    $: tasksInMonth = $store.tasks.filter(t => {
        if (!t.dueDate) return false;
        const [tYear, tMonth] = t.dueDate.split('-').map(Number);
        return tYear === year && tMonth === (month + 1);
    });

    function getTasksForDay(d: number) {
        // Create YYYY-MM-DD string to compare
        const dayStr = String(d).padStart(2, '0');
        const monthStr = String(month + 1).padStart(2, '0');
        const dateStr = `${year}-${monthStr}-${dayStr}`;
        
        return tasksInMonth.filter(t => t.dueDate === dateStr);
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

        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
            <div class="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                {#each ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as day}
                    <div class="py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">{day}</div>
                {/each}
            </div>

            <div class="grid grid-cols-7 auto-rows-fr bg-slate-200 dark:bg-slate-800 gap-px">
                {#each offsetArray as _}
                    <div class="bg-slate-50/50 dark:bg-slate-900/50 min-h-[140px]"></div>
                {/each}

                {#each days as day}
                    <div class="bg-white dark:bg-slate-900 min-h-[140px] p-2 hover:bg-amber-50/30 dark:hover:bg-slate-800/50 transition-colors relative group">
                        <span class="text-sm font-semibold text-slate-400 group-hover:text-amber-600">{day}</span>
                        
                        <div class="mt-2 space-y-1.5 overflow-y-auto max-h-[100px] custom-scrollbar">
                            {#each getTasksForDay(day) as task}
                                <div class="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-1.5 rounded border-l-4 border-slate-500 hover:border-amber-500 shadow-sm transition-all truncate cursor-default" title={task.title}>
                                    {#if task.matterRef}
                                        <span class="font-bold text-[10px] text-slate-400 block mb-0.5">{task.matterRef}</span>
                                    {/if}
                                    {task.title}
                                </div>
                            {/each}
                        </div>
                    </div>
                {/each}
            </div>
        </div>
    </div>
</div>