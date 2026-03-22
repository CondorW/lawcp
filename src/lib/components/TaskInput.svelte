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
        store.addTask('TODO', inputTitle, inputRef, inputDate);
        
        inputTitle = '';
        inputRef = '';
        inputDate = new Date().toISOString().split('T')[0];
        
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

<div class="rounded-xl border border-amber-200/60 bg-[#FFFDF5] dark:bg-slate-900 dark:border-amber-900/30 p-0.5 shadow-sm transition-all focus-within:ring-2 focus-within:ring-amber-500/20 focus-within:border-amber-400">
    <div class="flex flex-col gap-1 p-1.5 sm:flex-row sm:items-start">
        <div class="relative flex-grow">
            <div class="absolute top-2 left-2 pointer-events-none text-amber-700/50 dark:text-amber-500/50">
                <Plus size={18} />
            </div>
            <textarea 
                id="task-input" 
                bind:value={inputTitle} 
                oninput={resize} 
                onkeydown={onKeyDown} 
                rows="1" 
                placeholder="Neue Aufgabe erfassen..." 
                class="w-full rounded-lg border-0 bg-transparent py-1.5 pl-9 pr-3 text-slate-900 placeholder:text-slate-400 focus:ring-0 text-sm font-medium resize-none overflow-hidden dark:text-slate-100"
            ></textarea>
        </div>
        
        <div class="flex items-center gap-2 border-t border-amber-100 dark:border-slate-800 pt-1.5 sm:border-t-0 sm:pt-0 sm:border-l sm:pl-2">
            
            <input 
                bind:value={inputRef} 
                type="text" 
                placeholder="Ref-Nr."
                class="w-24 rounded-md border-0 bg-white/50 dark:bg-slate-800 py-1 px-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 focus:bg-white focus:ring-1 focus:ring-amber-500/50" 
            />
            
            <input 
                bind:value={inputDate} 
                type="date" 
                class="rounded-md border-0 bg-white/50 dark:bg-slate-800 py-1 px-2 text-xs font-medium text-slate-700 dark:text-slate-300 focus:bg-white focus:ring-1 focus:ring-amber-500/50" 
            />
            
            <button 
                onclick={handleAdd} 
                class="flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-amber-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800 dark:hover:bg-amber-500 transition-all active:scale-95"
            >
                <span>Add</span>
                <CornerDownLeft size={12} class="opacity-60"/>
            </button>
        </div>
    </div>
</div>