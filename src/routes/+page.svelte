<script lang="ts">
    import { store } from '$lib/stores/tasks';
    import { Settings, Save } from 'lucide-svelte';
    import TaskInput from '$lib/components/TaskInput.svelte';
    import TaskColumn from '$lib/components/TaskColumn.svelte';

    // Helper for sorting
    const byDate = (a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();

    // Reactive Stores (Filtering the main task list)
    $: todos = $store.tasks.filter(t => t.status === 'TODO').sort(byDate);
    $: waiting = $store.tasks.filter(t => t.status === 'WAITING').sort(byDate);
    $: review = $store.tasks.filter(t => t.status === 'REVIEW').sort(byDate);
    $: done = $store.tasks.filter(t => t.status === 'DONE').sort(byDate);
</script>

<div class="min-h-screen bg-gray-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100 pb-20 font-sans transition-colors text-base">
    <nav class="sticky top-0 z-20 border-b border-gray-200 bg-white/90 backdrop-blur-md dark:bg-slate-800/90 dark:border-slate-700">
        <div class="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8">
            <div class="flex h-16 justify-between items-center">
                <div class="flex items-center gap-2">
                    <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white font-bold dark:bg-blue-600">L</div>
                    <span class="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Law<span class="text-blue-600 dark:text-blue-400">CP</span></span>
                </div>
                <div class="flex items-center gap-2">
                    <a href="/settings" class="p-2 text-gray-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white transition-colors" aria-label="Settings" title="Settings">
                        <Settings size={20} />
                    </a>
                    <button onclick={() => store.exportData()} class="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm dark:bg-slate-700 dark:border-slate-600 dark:text-gray-200 dark:hover:bg-slate-600">
                        <Save size={16} /> Export
                    </button>
                </div>
            </div>
        </div>
    </nav>

    <main class="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        <TaskInput />

        <div class="grid grid-cols-1 gap-8 lg:grid-cols-4 items-start">
            <TaskColumn id="TODO" title="To Do" tasks={todos} color="bg-slate-500 shadow-slate-500/50" />
            <TaskColumn id="WAITING" title="In Arbeit" tasks={waiting} color="bg-amber-400 shadow-amber-400/50" />
            <TaskColumn id="REVIEW" title="Review" tasks={review} color="bg-purple-500 shadow-purple-500/50" />
            <TaskColumn id="DONE" title="Done" tasks={done} color="bg-emerald-500 shadow-emerald-500/50" />
        </div>
    </main>
</div>