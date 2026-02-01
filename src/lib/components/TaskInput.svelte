<script lang="ts">
    import { store } from '$lib/stores/tasks';
    import { Plus } from 'lucide-svelte';

    let inputTitle = '';
    let inputRef = '';
    let inputDate = new Date().toISOString().split('T')[0];

    // Auto-Resize for Textarea
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

<div class="mb-8 rounded-xl border border-gray-200 bg-white p-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
    <div class="flex flex-col gap-2 p-1 sm:flex-row sm:items-start">
        <div class="relative flex-grow">
            <div class="absolute top-3 left-3 pointer-events-none text-gray-400">
                <Plus size={18} />
            </div>
            <textarea
                id="task-input"
                bind:value={inputTitle}
                oninput={resize}
                onkeydown={onKeyDown}
                rows="1"
                placeholder="Neue Aufgabe... (z.B. Klageerwiderung @PA)"
                class="w-full rounded-md border-0 bg-transparent py-2.5 pl-10 pr-4 text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-sm resize-none overflow-hidden"
            ></textarea>
        </div>
        
        <div class="flex items-center gap-2 border-t border-gray-100 pt-2 sm:border-t-0 sm:pt-1 sm:border-l sm:pl-2">
            <input 
                bind:value={inputRef} 
                type="text" 
                placeholder="Ref" 
                class="w-24 rounded-md border-0 bg-gray-50 py-1.5 px-3 text-xs font-mono text-gray-600 focus:bg-white" 
            />
            <input 
                bind:value={inputDate} 
                type="date" 
                class="rounded-md border-0 bg-gray-50 py-1.5 px-3 text-xs text-gray-600 focus:bg-white" 
            />
            <button 
                onclick={handleAdd} 
                class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 transition-colors"
            >
                Enter
            </button>
        </div>
    </div>
</div>