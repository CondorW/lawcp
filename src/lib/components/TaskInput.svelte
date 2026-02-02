<script lang="ts">
    import { store } from '$lib/stores/tasks';
    import { Plus, CornerDownLeft } from 'lucide-svelte';

    let inputTitle = '';
    let inputRef = '';
    let inputDate = new Date().toISOString().split('T')[0];

    function resize(e: Event) {
        const target = e.target as HTMLTextAreaElement;
        target.style.height = 'auto';
        target.style.height = target.scrollHeight + 'px';
    }

    function handleAdd() {
        if (!inputTitle.trim()) return;
        store.addTask(inputTitle, inputRef, inputDate);
        inputTitle = '';
        inputRef = '';
        const textarea = document.getElementById('task-input') as HTMLTextAreaElement;
        if(textarea) textarea.style.height = 'auto';
    }

    function onKeyDown(e: KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleAdd();
        }
    }
</script>

<div class="mb-10 rounded-xl border border-amber-200/60 bg-[#FFFDF5] dark:bg-slate-900 dark:border-amber-900/30 p-1 shadow-sm transition-all focus-within:ring-2 focus-within:ring-amber-500/20 focus-within:border-amber-400">
    <div class="flex flex-col gap-2 p-2 sm:flex-row sm:items-start">
        <div class="relative flex-grow">
            <div class="absolute top-3 left-3 pointer-events-none text-amber-700/50 dark:text-amber-500/50">
                <Plus size={20} />
            </div>
            <textarea
                id="task-input"
                bind:value={inputTitle}
                oninput={resize}
                onkeydown={onKeyDown}
                rows="1"
                placeholder="Neue Aufgabe erfassen..."
                class="w-full rounded-lg border-0 bg-transparent py-2.5 pl-12 pr-4 text-slate-900 placeholder:text-slate-400 focus:ring-0 text-base font-medium resize-none overflow-hidden dark:text-slate-100"
            ></textarea>
        </div>
        
        <div class="flex items-center gap-2 border-t border-amber-100 dark:border-slate-800 pt-2 sm:border-t-0 sm:pt-1 sm:border-l sm:pl-3">
            <input 
                bind:value={inputRef} 
                type="text" 
                placeholder="Ref-Nr." 
                class="w-28 rounded-md border-0 bg-white/50 dark:bg-slate-800 py-1.5 px-3 text-xs font-mono text-slate-600 dark:text-slate-400 focus:bg-white focus:ring-1 focus:ring-amber-500/50" 
            />
            <input 
                bind:value={inputDate} 
                type="date" 
                class="rounded-md border-0 bg-white/50 dark:bg-slate-800 py-1.5 px-3 text-xs text-slate-600 dark:text-slate-400 focus:bg-white focus:ring-1 focus:ring-amber-500/50" 
            />
            <button 
                onclick={handleAdd} 
                class="flex items-center gap-2 rounded-lg bg-slate-900 dark:bg-amber-600 px-5 py-2 text-sm font-bold text-white shadow-md hover:bg-slate-800 dark:hover:bg-amber-500 transition-all active:scale-95"
            >
                <span>Add</span> <CornerDownLeft size={14} class="opacity-60"/>
            </button>
        </div>
    </div>
</div>