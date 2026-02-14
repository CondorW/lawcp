<script lang="ts">
    import { store } from '$lib/stores/tasks';
    import { X, BrainCircuit, Save } from 'lucide-svelte';
    import { fly } from 'svelte/transition';
    import { onMount } from 'svelte';

    let activeRef: string | null = null;
    let noteContent = '';

    onMount(() => {
        const unsubscribe = store.activeMatter.subscribe(ref => {
            activeRef = ref;
            if (ref) {
                const note = $store.matterNotes?.find(n => n.ref === ref);
                noteContent = note ? note.content : '';
            }
        });
        return unsubscribe;
    });

    function close() { store.closeMatterNotes(); }
    function save() { if (activeRef) store.updateMatterNote(activeRef, noteContent); }
</script>

{#if activeRef}
    <div class="fixed inset-0 z-[100] flex justify-end font-sans">
        <div 
            class="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity"
            onclick={() => { save(); close(); }}
            role="button" tabindex="-1"
            transition:fly={{ duration: 200, opacity: 0 }}
        ></div>

        <div 
            class="relative w-full max-w-lg bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col"
            transition:fly={{ x: 400, duration: 300 }}
        >
            <div class="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                <div class="flex items-center gap-3">
                    <div class="p-2 bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300 rounded-lg">
                        <BrainCircuit size={24} />
                    </div>
                    <div>
                        <h2 class="text-lg font-bold text-slate-900 dark:text-white">Aktennotizen</h2>
                        <div class="text-xs font-mono text-slate-500 uppercase tracking-wider">{activeRef}</div>
                    </div>
                </div>
                <button onclick={() => { save(); close(); }} class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800">
                    <X size={20} />
                </button>
            </div>

            <div class="flex-1 p-6 overflow-y-auto bg-white dark:bg-slate-900">
                <textarea
                    bind:value={noteContent}
                    class="w-full h-full resize-none border-0 bg-transparent focus:ring-0 text-base leading-relaxed text-slate-700 dark:text-slate-300 placeholder:text-slate-300"
                    placeholder="Brain Dump: Strategie, Telefonnotizen, Gedanken zur Akte..."
                    spellcheck="false"
                ></textarea>
            </div>

            <div class="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
                <span class="text-xs text-slate-400">Speichert lokal.</span>
                <button onclick={save} class="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-purple-600 text-white rounded-lg font-bold hover:bg-slate-800 dark:hover:bg-purple-500 transition-colors shadow-lg">
                    <Save size={16} /> Speichern
                </button>
            </div>
        </div>
    </div>
{/if}