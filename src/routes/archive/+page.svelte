<script lang="ts">
    import { store } from '$lib/stores/tasks';
    import TaskCard from '$lib/components/TaskCard.svelte';
    import { Search, Archive, ArrowLeft } from 'lucide-svelte';

    let searchQuery = '';

    $: archivedTasks = $store.tasks.filter(t => t.archived && t.title.toLowerCase().includes(searchQuery.toLowerCase()));
</script>

<svelte:head>
    <title>Archiv | Lawganized</title>
</svelte:head>

<div class="p-6 max-w-7xl mx-auto space-y-6 h-full flex flex-col">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="flex items-center gap-4">
            <a href="/" class="p-2 -ml-2 rounded-full text-slate-400 hover:text-slate-900 hover:bg-slate-200 dark:hover:text-white dark:hover:bg-slate-800 transition-colors" title="Zurück zum Board">
                <ArrowLeft size={20} />
            </a>
            <h1 class="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Archive size={24} class="text-blue-500" /> 
                Archivierte Aufgaben
            </h1>
        </div>
        
        <div class="relative w-full md:w-72">
            <Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
                type="text" 
                bind:value={searchQuery} 
                placeholder="Im Archiv suchen..." 
                class="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
            />
        </div>
    </div>

    {#if archivedTasks.length === 0}
        <div class="flex-grow flex flex-col items-center justify-center text-center py-16 px-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
            <Archive size={48} class="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
            <h3 class="text-lg font-medium text-slate-900 dark:text-white">Keine Aufgaben im Archiv</h3>
            <p class="text-slate-500 mt-1 max-w-sm">
                Aufgaben, die du archivierst, tauchen hier auf und können jederzeit wiederhergestellt werden.
            </p>
        </div>
    {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-max">
            {#each archivedTasks as task (task.id)}
                <TaskCard {task} />
            {/each}
        </div>
    {/if}
</div>