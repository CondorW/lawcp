<script lang="ts">
    import { store } from '$lib/stores/tasks';
    // NEU: Filter Icon importieren
    import { Settings, Save, LayoutGrid, Calendar, GitBranch, Building2, Upload, Filter } from 'lucide-svelte';
    import TaskInput from '$lib/components/TaskInput.svelte';
    import TaskColumn from '$lib/components/TaskColumn.svelte';

    // NEU: State für den Referenz-Filter
    let refFilter = '';

    const byDate = (a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();

    // NEU: Zentrale Filter-Funktion
    $: matchesFilter = (t: any) => {
        if (!refFilter.trim()) return true;
        return t.matterRef && t.matterRef.toLowerCase().includes(refFilter.toLowerCase());
    };

    // Listen jetzt zusätzlich nach 'matchesFilter' gefiltert
    $: todos = $store.tasks.filter(t => t.status === 'TODO' && matchesFilter(t)).sort(byDate);
    $: waiting = $store.tasks.filter(t => t.status === 'WAITING' && matchesFilter(t)).sort(byDate);
    $: review = $store.tasks.filter(t => t.status === 'REVIEW' && matchesFilter(t)).sort(byDate);
    $: done = $store.tasks.filter(t => t.status === 'DONE' && matchesFilter(t)).sort(byDate);

    // --- Import Logik (aus vorherigem Schritt beibehalten) ---
    let fileInput: HTMLInputElement;
    function triggerImport() { fileInput.click(); }
    async function handleFileSelect(e: Event) {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        if (!file) return;
        const text = await file.text();
        const success = store.importData(text);
        if (success) alert("Daten erfolgreich importiert!");
        else alert("Fehler beim Import.");
        target.value = '';
    }
</script>

<div class="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20 font-sans">
    <nav class="sticky top-0 z-50 bg-slate-900 text-white shadow-lg border-b border-slate-800">
        <div class="mx-auto max-w-[1800px] px-4 sm:px-6 lg:px-8">
            <div class="flex h-16 justify-between items-center">
                <div class="flex items-center gap-10">
                    <div class="flex items-center gap-2.5">
                        <div class="flex h-9 w-9 items-center justify-center rounded bg-amber-600 text-white font-serif font-bold text-xl shadow-sm">L</div>
                        <span class="text-xl font-bold tracking-tight text-white font-serif">Law<span class="text-amber-500">CP</span></span>
                    </div>

                    <div class="hidden md:flex items-center gap-1">
                        <a href="/" class="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium bg-slate-800 text-white shadow-inner">
                            <LayoutGrid size={16} /> Board
                        </a>
                        <a href="/calendar" class="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
                            <Calendar size={16} /> Kalender
                        </a>
                        <a href="/workflow" class="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
                            <GitBranch size={16} /> Workflow
                        </a>
                        <a href="/resources" class="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
                            <Building2 size={16} /> Ressourcen
                        </a>
                    </div>
                </div>

                <div class="flex items-center gap-3">
                    <div class="relative hidden lg:block group">
                        <Filter class="absolute left-2.5 top-1.5 text-slate-500 group-focus-within:text-amber-500 transition-colors" size={14}/>
                        <input 
                            type="text" 
                            bind:value={refFilter} 
                            placeholder="Ref-Filter..." 
                            class="pl-8 pr-3 py-1.5 rounded-md border border-slate-600 bg-slate-800 text-xs text-white placeholder:text-slate-400 focus:ring-1 focus:ring-amber-500 outline-none w-32 focus:w-48 transition-all"
                        />
                    </div>

                    <input type="file" accept=".json" class="hidden" bind:this={fileInput} onchange={handleFileSelect} />
                    <button onclick={triggerImport} class="hidden sm:flex items-center gap-2 rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 hover:text-white hover:border-slate-500 transition-all uppercase tracking-wide">
                        <Upload size={14} /> Import
                    </button>

                    <button onclick={() => store.exportData()} class="hidden sm:flex items-center gap-2 rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 hover:text-white hover:border-slate-500 transition-all uppercase tracking-wide">
                        <Save size={14} /> Export
                    </button>
                    
                    <a href="/settings" class="p-2 text-slate-400 hover:text-white transition-colors hover:bg-slate-800 rounded-full">
                        <Settings size={20} />
                    </a>
                </div>
            </div>
        </div>
    </nav>

    <main class="mx-auto max-w-[1800px] px-4 py-8 sm:px-6 lg:px-8">
        {#if refFilter}
            <div class="mb-6 flex items-center gap-2 text-sm text-slate-500 bg-amber-50 dark:bg-amber-900/20 p-2 rounded border border-amber-200 dark:border-amber-800 w-fit mx-auto">
                <Filter size={14} class="text-amber-600"/>
                <span>Gefiltert nach: <strong>{refFilter}</strong></span>
                <button onclick={() => refFilter = ''} class="ml-2 hover:text-red-500 font-bold">✕</button>
            </div>
        {/if}

        <div class="max-w-4xl mx-auto mb-12">
            <TaskInput />
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-4 items-start divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            
            <div class="p-4 bg-slate-50/50 dark:bg-slate-900/50 min-h-[600px]">
                <TaskColumn id="TODO" title="To Do" tasks={todos} color="bg-slate-600" />
            </div>
            
            <div class="p-4 bg-white dark:bg-slate-900 min-h-[600px]">
                <TaskColumn id="WAITING" title="In Arbeit" tasks={waiting} color="bg-amber-500" />
            </div>
            
            <div class="p-4 bg-slate-50/50 dark:bg-slate-900/50 min-h-[600px]">
                <TaskColumn id="REVIEW" title="Review" tasks={review} color="bg-purple-600" />
            </div>
            
            <div class="p-4 bg-white dark:bg-slate-900 min-h-[600px]">
                <TaskColumn id="DONE" title="Abgeschlossen" tasks={done} color="bg-emerald-600" />
            </div>

        </div>
    </main>
</div>