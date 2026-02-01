<script lang="ts">
    import { store } from '$lib/stores/tasks';
    import { ArrowLeft, Plus, Search, Building2, User, Trash2, ExternalLink } from 'lucide-svelte';

    let filter = '';
    let resType: 'COMPANY' | 'PERSON' = 'COMPANY';
    let resName = '';
    let resId = '';
    let resAddress = '';

    function add() {
        if (!resName) return;
        store.addResource({ type: resType, name: resName, identifier: resId, address: resAddress });
        resName = ''; resId = ''; resAddress = '';
    }

    function searchHR(name: string) {
        window.open(`https://www.handelsregister.li/cr-portal/suche/suche.xhtml?query=${encodeURIComponent(name)}`, '_blank');
    }

    $: list = $store.resources.filter(r => r.name.toLowerCase().includes(filter.toLowerCase()));
</script>

<div class="min-h-screen bg-gray-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-8 font-sans">
    <div class="max-w-[1200px] mx-auto">
        <div class="flex items-center justify-between mb-8">
            <div class="flex items-center gap-4">
                <a href="/" class="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full"><ArrowLeft /></a>
                <h1 class="text-3xl font-bold">Ressourcen & Kontakte</h1>
            </div>
            <div class="relative">
                <Search class="absolute left-3 top-2.5 text-gray-400" size={18} />
                <input bind:value={filter} placeholder="Suchen..." class="pl-10 rounded-lg border-gray-300 dark:bg-slate-800 dark:border-slate-600 dark:text-white" />
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div class="lg:col-span-2 space-y-4">
                {#each list as res (res.id)}
                    <div class="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 flex items-start justify-between shadow-sm hover:shadow-md transition-shadow">
                        <div class="flex gap-4">
                            <div class={`p-3 rounded-lg ${res.type === 'COMPANY' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'}`}>
                                {#if res.type === 'COMPANY'}<Building2 size={24}/>{:else}<User size={24}/>{/if}
                            </div>
                            <div>
                                <h3 class="font-bold text-lg">{res.name}</h3>
                                {#if res.identifier}<div class="text-sm text-gray-500 font-mono">{res.identifier}</div>{/if}
                                {#if res.address}<div class="text-sm text-gray-600 dark:text-gray-400 mt-1">{res.address}</div>{/if}
                            </div>
                        </div>
                        <div class="flex gap-2">
                            {#if res.type === 'COMPANY'}
                                <button onclick={() => searchHR(res.name)} title="Im HR suchen" class="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-transparent hover:border-blue-100"><ExternalLink size={18}/></button>
                            {/if}
                            <button onclick={() => store.deleteResource(res.id)} class="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 size={18}/></button>
                        </div>
                    </div>
                {:else}
                    <div class="text-center py-10 text-gray-400 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-gray-300 dark:border-slate-700">Keine Einträge gefunden.</div>
                {/each}
            </div>

            <div class="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 h-fit sticky top-10">
                <h2 class="text-xl font-bold mb-6">Neu erstellen</h2>
                
                <div class="flex gap-2 mb-4 p-1 bg-gray-100 dark:bg-slate-700 rounded-lg">
                    <button onclick={() => resType = 'COMPANY'} class={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all ${resType === 'COMPANY' ? 'bg-white dark:bg-slate-600 shadow-sm' : 'text-gray-500'}`}>Firma</button>
                    <button onclick={() => resType = 'PERSON'} class={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all ${resType === 'PERSON' ? 'bg-white dark:bg-slate-600 shadow-sm' : 'text-gray-500'}`}>Person</button>
                </div>

                <div class="space-y-4">
                    <label class="block">
                        <span class="text-xs font-bold text-gray-500 uppercase mb-1 block">Name</span>
                        <input bind:value={resName} class="w-full rounded-md border-gray-300 dark:bg-slate-700 dark:border-slate-600" placeholder={resType === 'COMPANY' ? 'Firmenwortlaut' : 'Vor- & Nachname'} />
                    </label>
                    <label class="block">
                        <span class="text-xs font-bold text-gray-500 uppercase mb-1 block">{resType === 'COMPANY' ? 'Firmennummer (FL-000...)' : 'Geburtsdatum'}</span>
                        <input bind:value={resId} class="w-full rounded-md border-gray-300 dark:bg-slate-700 dark:border-slate-600" />
                    </label>
                    <label class="block">
                        <span class="text-xs font-bold text-gray-500 uppercase mb-1 block">Adresse</span>
                        <textarea bind:value={resAddress} rows="2" class="w-full rounded-md border-gray-300 dark:bg-slate-700 dark:border-slate-600"></textarea>
                    </label>

                    <button onclick={add} class="w-full bg-slate-900 dark:bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors">
                        <Plus size={18} class="inline mr-2"/> Speichern
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>