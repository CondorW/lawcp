<script lang="ts">
    import { store } from '$lib/stores/tasks';
    import { ArrowLeft, Plus, Search, Building2, User, Landmark, Trash2, ExternalLink, Copy, Check } from 'lucide-svelte';
    import { fade } from 'svelte/transition';

    let filter = '';
    let resType: 'COMPANY' | 'PERSON' | 'AUTHORITY' = 'COMPANY';
    let resName = '';
    let resId = '';
    let resSeat = '';
    let resStreet = '';
    let resZip = '';
    let resCity = '';
    let copiedId: string | null = null;

    async function add() {
        if (!resName) return;
        await store.addResource({
            type: resType,
            name: resName,
            identifier: resId,
            seat: resSeat,
            street: resStreet,
            zip: resZip,
            city: resCity,
            address: `${resStreet}, ${resZip} ${resCity}`
        });

        // Reset
        resName = '';
        resId = '';
        resSeat = '';
        resStreet = '';
        resZip = '';
        resCity = '';
    }

    function searchHR(name: string) {
        window.open(
            `https://www.handelsregister.li/cr-portal/suche/suche.xhtml?query=${encodeURIComponent(name)}`,
            '_blank'
        );
    }

    async function copyForContract(res: any) {
        let addressPart = '';
        if (res.street || res.city) {
            addressPart = `${res.street || ''}, ${res.zip || ''} ${res.city || ''}`;
        } else {
            addressPart = res.address || 'k.A.';
        }
        addressPart = addressPart.replace(/,\s*,/g, ',').trim();

        let text = '';
        let idPart = res.identifier ? `, ${res.identifier}` : '';

        if (res.type === 'COMPANY') {
            const seatText = res.seat ? ` mit dem Sitz in ${res.seat} und` : ' mit';
            text = `${res.name}${idPart}${seatText} der Geschäftsanschrift ${addressPart}`;
        } else if (res.type === 'AUTHORITY') {
            text = `${res.name}, ${addressPart}`;
        } else {
            text = `${res.name}${idPart} mit der Adresse ${addressPart}`;
        }
        text = text.replace(/\s+/g, ' ').trim();

        try {
            await navigator.clipboard.writeText(text);
            copiedId = res.id;
            setTimeout(() => (copiedId = null), 2000);
        } catch (e) {
            console.error('Copy failed', e);
        }
    }

    function formatDate(dateString: string | undefined) {
        if (!dateString) return 'Unbekannt';
        return new Date(dateString).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    $: list = $store.resources
        ? $store.resources.filter((r) => r.name.toLowerCase().includes(filter.toLowerCase()))
        : [];
</script>

<div class="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-6 lg:p-8 font-sans">
    <!-- LAYOUT: Auf 1600px verbreitert -->
    <div class="max-w-[1600px] mx-auto">
        
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div class="flex items-center gap-4">
                <a href="/" class="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                    <ArrowLeft size={24} />
                </a>
                <h1 class="text-2xl sm:text-3xl font-bold tracking-tight">Ressourcen & Kontakte</h1>
            </div>
            
            <div class="relative w-full sm:w-80">
                <Search class="absolute left-3.5 top-3 text-slate-400" size={18} />
                <!-- TYPOGRAPHY: text-sm (14px) -->
                <input bind:value={filter} placeholder="Suchen..." class="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-shadow text-slate-900 dark:text-white" />
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            <!-- Linke Spalte (Liste) -->
            <div class="lg:col-span-2 space-y-4">
                {#each list as res (res.id)}
                    <div class="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow group">
                        <div class="flex items-start justify-between w-full gap-4">
                            <div class="flex gap-4 min-w-0">
                                <!-- BRANDING: Farben je nach Typ (Royal brand, Gold, Ruby Red) -->
                                <div class={`p-3.5 rounded-lg shrink-0 ${
                                    res.type === 'COMPANY' ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400' :
                                    res.type === 'AUTHORITY' ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' :
                                    'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'
                                }`}>
                                    {#if res.type === 'COMPANY'}
                                        <Building2 size={24} />
                                    {:else if res.type === 'AUTHORITY'}
                                        <Landmark size={24} />
                                    {:else}
                                        <User size={24} />
                                    {/if}
                                </div>
                                <div class="min-w-0">
                                    <!-- TYPOGRAPHY: text-base (16px) -->
                                    <h3 class="font-bold text-base text-slate-900 dark:text-white truncate">{res.name}</h3>
                                    {#if res.identifier}
                                        <div class="text-sm text-slate-500 font-mono mt-0.5">{res.identifier}</div>
                                    {/if}
                                    <div class="text-sm text-slate-600 dark:text-slate-400 mt-2 space-y-0.5">
                                        {#if res.seat}
                                            <!-- TYPOGRAPHY: text-xs (12px) -->
                                            <div class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Sitz: {res.seat}</div>
                                        {/if}
                                        {#if res.street || res.city}
                                            <div>{res.street || ''}</div>
                                            <div>{res.zip || ''} {res.city || ''}</div>
                                        {:else if res.address}
                                            <div class="whitespace-pre-line">{res.address}</div>
                                        {/if}
                                    </div>
                                </div>
                            </div>

                            <!-- Aktionen -->
                            <div class="flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                                <!-- BRANDING: Hover ist jetzt Royal brand -->
                                <button onclick={() => copyForContract(res)} title="Für Vertrag kopieren" class={`p-2 rounded-lg border transition-all flex items-center gap-2 ${copiedId === res.id ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-800' : 'text-slate-400 hover:text-brand-600 hover:bg-brand-50 border-transparent hover:border-brand-100 dark:hover:bg-slate-800 dark:hover:border-slate-700'}`}>
                                    {#if copiedId === res.id}
                                        <Check size={18} />
                                    {:else}
                                        <Copy size={18} />
                                    {/if}
                                </button>
                                {#if res.type === 'COMPANY'}
                                    <button onclick={() => searchHR(res.name)} title="Im HR suchen" class="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg border border-transparent hover:border-brand-100 dark:hover:bg-slate-800 dark:hover:border-slate-700">
                                        <ExternalLink size={18} />
                                    </button>
                                {/if}
                                <!-- BRANDING: Trash in Ruby Red -->
                                <button onclick={() => store.deleteResource(res.id)} class="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 border border-transparent hover:border-rose-100 dark:hover:bg-slate-800 dark:hover:border-slate-700">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>

                        <!-- Footer Meta -->
                        <div class="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 w-full mt-1">
                            <!-- TYPOGRAPHY: text-[11px] -->
                            <span class="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[11px] font-bold px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 uppercase tracking-wide" title="Erstellt von">
                                {res.expand?.owner?.shortsign || 'System'}
                            </span>
                            <!-- TYPOGRAPHY: text-xs (12px) -->
                            <span class="text-xs font-medium text-slate-400">
                                hinzugefügt am {formatDate(res.created)}
                            </span>
                        </div>
                    </div>
                {:else}
                    <div class="text-center py-16 text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                        <p class="text-base font-medium">Keine Einträge gefunden.</p>
                    </div>
                {/each}
            </div>

            <!-- Rechte Spalte (Sidebar / Formular) -->
            <div class="bg-white dark:bg-slate-900 p-6 lg:p-8 rounded-xl border border-slate-200 dark:border-slate-800 h-fit sticky top-6 shadow-sm">
                <!-- TYPOGRAPHY: text-base (16px) -->
                <h2 class="text-base font-bold mb-6 text-slate-800 dark:text-white">Neuer Kontakt / Ressource</h2>
                
                <div class="flex gap-2 mb-6 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    <button onclick={() => (resType = 'COMPANY')} class={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${resType === 'COMPANY' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Firma</button>
                    <button onclick={() => (resType = 'PERSON')} class={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${resType === 'PERSON' ? 'bg-white dark:bg-slate-700 text-yellow-600 dark:text-yellow-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Person</button>
                    <button onclick={() => (resType = 'AUTHORITY')} class={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${resType === 'AUTHORITY' ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Behörde</button>
                </div>

                <div class="space-y-5">
                    <label class="block">
                        <span class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Name</span>
                        <input bind:value={resName} class="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none" placeholder={resType === 'COMPANY' ? 'Firmenwortlaut' : resType === 'AUTHORITY' ? 'Behördenname' : 'Vor- & Nachname'} />
                    </label>

                    {#if resType !== 'AUTHORITY'}
                        <label class="block">
                            <span class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">{resType === 'COMPANY' ? 'HR-Nummer (FL...)' : 'Geburtsdatum'}</span>
                            <input bind:value={resId} class="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none" placeholder={resType === 'COMPANY' ? 'z.B. FL-0002.123.456-7' : 'TT.MM.JJJJ'} />
                        </label>
                    {/if}

                    {#if resType === 'COMPANY'}
                        <label class="block">
                            <span class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Sitz (Gemeinde)</span>
                            <input bind:value={resSeat} class="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none" placeholder="z.B. Vaduz" />
                        </label>
                    {/if}

                    <div class="space-y-3">
                        <label class="block">
                            <span class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Adresse</span>
                            <input bind:value={resStreet} class="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none" placeholder="Straße & Hausnr." />
                        </label>
                        <div class="flex gap-3">
                            <input bind:value={resZip} class="w-28 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none" placeholder="PLZ" />
                            <input bind:value={resCity} class="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none" placeholder="Ort" />
                        </div>
                    </div>

                    <!-- BRANDING: Save-Button in Royal brand -->
                    <button onclick={add} disabled={!resName} class="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-lg font-bold text-sm transition-colors mt-4 shadow-sm flex items-center justify-center gap-2">
                        <Plus size={18} /> Speichern
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>