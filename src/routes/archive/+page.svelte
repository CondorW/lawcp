<script lang="ts">
    import { store } from '$lib/stores/tasks';
    import TaskCard from '$lib/components/TaskCard.svelte';
    import { Search, Archive, ArrowLeft } from 'lucide-svelte';
    
    let searchQuery = '';
    
    $: archivedTasks = $store.tasks.filter(t => 
        t.archived && t.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
</script>

<svelte:head>
    <title>Archiv | Lawganized</title>
</svelte:head>

<!-- LAYOUT: min-h-screen mit p-6 lg:p-8 -->
<div class="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-6 lg:p-8 font-sans">
    
    <!-- LAYOUT: Auf 1600px verbreitert -->
    <div class="max-w-[1600px] mx-auto">
        
        <!-- HEADER-BEREICH: Identisch zur Ressourcen-Seite -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div class="flex items-center gap-4">
                <a href="/" class="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors" title="Zurück zum Board">
                    <ArrowLeft size={24} />
                </a>
                <h1 class="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
                    <Archive size={28} class="text-blue-600 dark:text-blue-500" /> 
                    Archiv
                </h1>
            </div>
            
            <div class="relative w-full sm:w-80">
                <Search class="absolute left-3.5 top-3 text-slate-400" size={18} />
                <!-- TYPOGRAPHY: text-sm (14px) -->
                <input 
                    type="text" 
                    bind:value={searchQuery} 
                    placeholder="Im Archiv suchen..." 
                    class="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow text-slate-900 dark:text-white" 
                />
            </div>
        </div>

        {#if archivedTasks.length === 0}
            <!-- EMPTY STATE: Identisch zur Abrechnungs-Seite -->
            <div class="flex flex-col items-center justify-center py-24 text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 shadow-sm">
                <Archive size={56} class="mb-5 opacity-20" />
                <h3 class="text-base font-bold text-slate-700 dark:text-slate-300 mb-2">Keine Aufgaben im Archiv</h3>
                <p class="text-sm font-medium max-w-sm text-center">
                    Aufgaben, die du archivierst, tauchen hier auf und können jederzeit wiederhergestellt werden.
                </p>
            </div>
        {:else}
            <!-- GRID LAYOUT: Bis zu 4 Spalten auf sehr großen Bildschirmen. items-start verhindert unschönes vertikales Strecken der Karten -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-start">
                {#each archivedTasks as task (task.id)}
                    <TaskCard {task} />
                {/each}
            </div>
        {/if}
        
    </div>
</div>