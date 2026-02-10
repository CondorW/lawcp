<script lang="ts">
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { store } from '$lib/stores/tasks';
    import { Search, Calendar, LayoutGrid, GitBranch, Building2, Moon, Sun, Command, FileText } from 'lucide-svelte';
    import { fade, scale } from 'svelte/transition';
    import { onMount } from 'svelte';

    let open = false;
    let query = '';
    let selectedIndex = 0;
    let inputEl: HTMLInputElement;

    $: actions = [
        { id: 'board', title: 'Board öffnen', icon: LayoutGrid, action: () => goto('/') },
        { id: 'calendar', title: 'Kalender öffnen', icon: Calendar, action: () => goto('/calendar') },
        { id: 'workflow', title: 'Workflow Designer', icon: GitBranch, action: () => goto('/workflow') },
        { id: 'resources', title: 'Ressourcen & Kontakte', icon: Building2, action: () => goto('/resources') },
        { 
            id: 'theme', 
            title: $store.settings.darkMode ? 'Light Mode aktivieren' : 'Dark Mode aktivieren', 
            icon: $store.settings.darkMode ? Sun : Moon, 
            action: () => store.toggleDarkMode() 
        }
    ];

    $: taskResults = query.trim().length > 0 
        ? $store.tasks.filter(t => 
            t.title.toLowerCase().includes(query.toLowerCase()) || 
            (t.matterRef && t.matterRef.toLowerCase().includes(query.toLowerCase()))
          ).slice(0, 5).map(t => ({
              id: t.id,
              title: `${t.matterRef ? t.matterRef + ': ' : ''}${t.title}`,
              icon: FileText,
              action: () => { 
                  goto('/'); 
                  // alert(`Springe zu Task: ${t.title}`); 
              }
          }))
        : [];

    $: filtered = [...actions.filter(a => a.title.toLowerCase().includes(query.toLowerCase())), ...taskResults];

    function toggle() {
        open = !open;
        if (open) {
            query = '';
            selectedIndex = 0;
            setTimeout(() => inputEl?.focus(), 50);
        }
    }

    function execute(item: any) {
        item.action();
        open = false;
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            toggle();
        }

        if (!open) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = (selectedIndex + 1) % filtered.length;
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = (selectedIndex - 1 + filtered.length) % filtered.length;
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filtered[selectedIndex]) execute(filtered[selectedIndex]);
        } else if (e.key === 'Escape') {
            open = false;
        }
    }

    onMount(() => {
        window.addEventListener('keydown', handleKeydown);
        return () => window.removeEventListener('keydown', handleKeydown);
    });
</script>

{#if ($page.url.pathname as string) !== '/login'}
    <button 
        onclick={toggle}
        class="fixed bottom-6 left-6 z-40 bg-slate-900 dark:bg-amber-600 text-white px-4 py-3 rounded-full shadow-xl hover:scale-105 transition-transform flex items-center gap-3 font-bold border border-slate-700 dark:border-amber-500 group"
        title="Befehlspalette öffnen (Strg+K)"
    >
        <Search size={20} />
        <span class="hidden md:inline">Suche / Befehle</span>
        <div class="flex items-center gap-1 text-[10px] bg-white/20 px-1.5 py-0.5 rounded ml-2 font-mono group-hover:bg-white/30 transition-colors">
            <Command size={10} /> K
        </div>
    </button>
{/if}

{#if open}
    <div class="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] p-4 font-sans" transition:fade={{ duration: 100 }}>
        <div 
            class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
            onclick={() => open = false} 
            onkeydown={(e) => { if(e.key === 'Escape') open = false; }}
            role="button" 
            tabindex="-1"
        ></div>

        <div 
            class="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[60vh]"
            transition:scale={{ duration: 150, start: 0.95 }}
        >
            <div class="flex items-center gap-3 p-4 border-b border-slate-100 dark:border-slate-800">
                <Search class="text-slate-400" size={20} />
                <input 
                    bind:this={inputEl}
                    bind:value={query}
                    type="text" 
                    placeholder="Wonach suchen Sie?" 
                    class="flex-1 bg-transparent border-none focus:ring-0 text-lg text-slate-900 dark:text-white placeholder:text-slate-400 p-0"
                />
                <button onclick={() => open = false} class="text-xs font-bold bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">ESC</button>
            </div>

            <div class="overflow-y-auto p-2">
                {#if filtered.length === 0}
                    <div class="p-4 text-center text-slate-500 text-sm">Keine Ergebnisse gefunden.</div>
                {:else}
                    {#each filtered as item, i}
                        <button 
                            class={`w-full text-left flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${i === selectedIndex ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-100' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                            onclick={() => execute(item)}
                            onmouseenter={() => selectedIndex = i}
                        >
                            <svelte:component this={item.icon} size={18} class={i === selectedIndex ? 'text-amber-600' : 'text-slate-400'} />
                            <span class="font-medium">{item.title}</span>
                            {#if i === selectedIndex}
                                <span class="ml-auto text-xs text-amber-600 font-bold">↵ Enter</span>
                            {/if}
                        </button>
                    {/each}
                {/if}
            </div>
            
            <div class="p-2 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 flex justify-between px-4">
                <span><strong>↑↓</strong> zum Wählen</span>
                <span><strong>LawganizedLWA</strong> Command Center</span>
            </div>
        </div>
    </div>
{/if}