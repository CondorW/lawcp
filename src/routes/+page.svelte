<script lang="ts">
    import { store } from '$lib/stores/tasks';
    // FIX: Upload Icon hinzugefügt
    import { Settings, Save, LayoutGrid, Calendar, GitBranch, Building2, Upload } from 'lucide-svelte';
    import TaskInput from '$lib/components/TaskInput.svelte';
    import TaskColumn from '$lib/components/TaskColumn.svelte';

    const byDate = (a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();

    $: todos = $store.tasks.filter(t => t.status === 'TODO').sort(byDate);
    $: waiting = $store.tasks.filter(t => t.status === 'WAITING').sort(byDate);
    $: review = $store.tasks.filter(t => t.status === 'REVIEW').sort(byDate);
    $: done = $store.tasks.filter(t => t.status === 'DONE').sort(byDate);

    // --- Import Logik ---
    let fileInput: HTMLInputElement;

    function triggerImport() {
        fileInput.click();
    }

    async function handleFileSelect(e: Event) {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        if (!file) return;

        const text = await file.text();
        const success = store.importData(text);
        if (success) {
            alert("Daten erfolgreich importiert!");
        } else {
            alert("Fehler: Die Datei ist beschädigt oder hat das falsche Format.");
        }
        target.value = ''; // Reset
    }
</script>

<div class="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20 font-sans">
    <nav class="sticky top-0 z-50 bg-slate-900 text-white shadow-lg border-b border-slate-800">
        <div class="mx-auto max-w-[1800px] px-4 sm:px-6 lg:px-8">
            <div class="flex h-16 justify-between items-center">
                <div class="flex items-center gap-10">
                    <div class="flex items-center gap-2.5">
                        <div class="flex h-9 w-9 items-center justify-center rounded bg-amber-600 text-white font-bold text-xl shadow-sm">L</div>
                        <span class="text-xl font-bold tracking-tight text-white">Lawganized<span class="text-amber-500">LWA</span></span>
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
                    <input 
                        type="file" 
                        accept=".json" 
                        class="hidden" 
                        bind:this={fileInput} 
                        onchange={handleFileSelect} 
                    />
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