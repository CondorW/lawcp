<script lang="ts">
    import { store } from '$lib/stores/tasks';
    import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-svelte';
    import { formatDate } from '$lib/utils'; // Make sure utils.ts exists!

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

    // Get Tasks for a specific day
    function getTasksForDay(d: number) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        return $store.tasks.filter(t => t.dueDate === dateStr);
    }
</script>

<div class="min-h-screen bg-gray-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-8 font-sans">
    <div class="max-w-[1600px] mx-auto">
        <div class="flex items-center justify-between mb-8">
            <div class="flex items-center gap-4">
                <a href="/" class="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full"><ArrowLeft /></a>
                <h1 class="text-3xl font-bold">{monthNames[month]} {year}</h1>
            </div>
            <div class="flex gap-2">
                <button onclick={prevMonth} class="p-2 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded hover:bg-gray-50"><ChevronLeft /></button>
                <button onclick={nextMonth} class="p-2 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded hover:bg-gray-50"><ChevronRight /></button>
            </div>
        </div>

        <div class="grid grid-cols-7 gap-px bg-gray-200 dark:bg-slate-700 border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden shadow-sm">
            {#each ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as day}
                <div class="bg-gray-100 dark:bg-slate-800 p-2 text-center font-bold text-sm">{day}</div>
            {/each}

            {#each offsetArray as _}
                <div class="bg-white dark:bg-slate-900 h-32 md:h-48"></div>
            {/each}

            {#each days as day}
                <div class="bg-white dark:bg-slate-900 h-32 md:h-48 p-2 border-t border-transparent hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors relative group">
                    <span class="text-sm font-semibold text-gray-400 group-hover:text-blue-600">{day}</span>
                    
                    <div class="mt-2 space-y-1 overflow-y-auto max-h-[calc(100%-24px)] custom-scrollbar">
                        {#each getTasksForDay(day) as task}
                            <div class="text-[10px] md:text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 p-1 rounded truncate border-l-2 border-blue-500" title={task.title}>
                                {task.matterRef ? `${task.matterRef}: ` : ''}{task.title}
                            </div>
                        {/each}
                    </div>
                </div>
            {/each}
        </div>
    </div>
</div>