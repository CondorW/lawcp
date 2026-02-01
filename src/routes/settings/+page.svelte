<script lang="ts">
    import { store } from '$lib/stores/tasks';
    import { Trash2, ArrowLeft, Moon, Sun, Crown, Plus } from 'lucide-svelte'; // Added Plus import

    let myTag = $store.settings.myShortsign;
    let newName = '';
    let newShort = '';
    let newColor = 'bg-blue-100 text-blue-800';

    const colors = [
        { label: 'Blue', val: 'bg-blue-100 text-blue-800' },
        { label: 'Green', val: 'bg-green-100 text-green-800' },
        { label: 'Purple', val: 'bg-purple-100 text-purple-800' },
        { label: 'Red', val: 'bg-red-100 text-red-800' },
        { label: 'Orange', val: 'bg-orange-100 text-orange-800' },
    ];

    function saveMySettings() {
        store.updateSettings({ ...$store.settings, myShortsign: myTag });
        alert("Einstellungen gespeichert!");
    }

    function addMember() {
        if (!newName || !newShort) return;
        store.addTeamMember(newName, newShort, newColor);
        newName = ''; newShort = '';
    }
</script>

<div class="min-h-screen bg-gray-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-8 font-sans transition-colors">
    <div class="max-w-3xl mx-auto bg-white dark:bg-slate-800 rounded-xl shadow-md border border-gray-200 dark:border-slate-700 p-8">
        
        <div class="flex items-center justify-between mb-8">
            <div class="flex items-center gap-4">
                <a href="/" class="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full text-gray-500 dark:text-gray-400"><ArrowLeft size={24} /></a>
                <h1 class="text-3xl font-bold tracking-tight">Konfiguration</h1>
            </div>
            <button onclick={() => store.toggleDarkMode()} class="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors font-medium">
                {#if $store.settings.darkMode}
                    <Sun size={20} class="text-yellow-400"/> <span>Light</span>
                {:else}
                    <Moon size={20} class="text-slate-600"/> <span>Dark</span>
                {/if}
            </button>
        </div>

        <section class="mb-12 border-b border-gray-100 dark:border-slate-700 pb-10">
            <h2 class="text-xl font-bold mb-4 flex items-center gap-2">Mein Profil</h2>
            <div class="flex items-end gap-4">
                <div class="flex-1">
                    <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Mein Kürzel (für E-Mail Signatur)
                        <input bind:value={myTag} type="text" class="mt-2 w-full rounded-lg border-gray-300 dark:border-slate-600 dark:bg-slate-700/50 dark:text-white p-3 text-lg shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                    </label>
                </div>
                <button onclick={saveMySettings} class="bg-slate-900 dark:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors">Speichern</button>
            </div>
        </section>

        <section>
            <h2 class="text-xl font-bold mb-6">Das Team & Leader</h2>
            <p class="text-gray-500 dark:text-gray-400 mb-6">Definiere, wer der Team-Leader ist. E-Mails werden standardmäßig an den Leader adressiert.</p>

            <div class="space-y-4 mb-8">
                {#each $store.settings.team as member}
                    <div class="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700/30 rounded-xl border border-gray-100 dark:border-slate-600">
                        <div class="flex items-center gap-4">
                            <button 
                                onclick={() => store.setTeamLeader(member.id)}
                                class={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm font-bold transition-all ${member.isLeader 
                                    ? 'bg-yellow-100 border-yellow-300 text-yellow-700 dark:bg-yellow-900/30 dark:border-yellow-600 dark:text-yellow-400' 
                                    : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300 dark:bg-slate-800 dark:border-slate-600 dark:hover:border-slate-500'}`}
                            >
                                <Crown size={16} fill={member.isLeader ? "currentColor" : "none"} />
                                {member.isLeader ? 'Leader' : 'Set as Leader'}
                            </button>
                            
                            <div class="flex items-center gap-3">
                                <span class={`px-2 py-1 rounded text-sm font-bold ${member.color}`}>@{member.shortsign}</span>
                                <span class="text-lg font-medium dark:text-white">{member.name}</span>
                            </div>
                        </div>
                        <button onclick={() => store.removeTeamMember(member.id)} class="text-gray-400 hover:text-red-500 p-2"><Trash2 size={20} /></button>
                    </div>
                {:else}
                    <div class="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-xl">Keine Teammitglieder. Füge unten welche hinzu.</div>
                {/each}
            </div>

            <div class="bg-blue-50 dark:bg-slate-700/50 p-6 rounded-xl border border-blue-100 dark:border-slate-600">
                <h3 class="text-md font-bold mb-4 dark:text-white">Neues Mitglied hinzufügen</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <input bind:value={newName} placeholder="Name (z.B. Dr. Müller)" class="rounded-lg border-gray-300 dark:bg-slate-800 dark:border-slate-600 dark:text-white p-2.5" />
                    <input bind:value={newShort} placeholder="Kürzel (z.B. DM)" class="rounded-lg border-gray-300 dark:bg-slate-800 dark:border-slate-600 dark:text-white p-2.5" />
                </div>
                <div class="flex gap-3 mb-6">
                    {#each colors as c}
                        <button 
                            onclick={() => newColor = c.val} 
                            class={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${newColor === c.val ? 'border-slate-900 dark:border-white ring-2 ring-offset-2 ring-blue-200 dark:ring-offset-slate-800' : 'border-transparent'} ${c.val.split(' ')[0]}`}
                            title={c.label}
                        ></button>
                    {/each}
                </div>
                <button onclick={addMember} class="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-500 py-3 rounded-lg font-bold text-slate-700 dark:text-white hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                    <Plus size={18} class="inline mr-2"/> Hinzufügen
                </button>
            </div>
        </section>
    </div>
</div>