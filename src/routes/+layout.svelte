<script lang="ts">
    import "./layout.css"; 
    import { store } from '$lib/stores/tasks';
    import { onMount, onDestroy } from 'svelte';
    import { pb } from '$lib/pocketbase';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import MatterNotesPanel from '$lib/components/MatterNotesPanel.svelte';
    import CommandPalette from '$lib/components/CommandPalette.svelte';

    let { children } = $props();
    let unsubscribeAuth: () => void;

    onMount(() => {
        // 1. Sofort-Check beim Laden der Seite (z.B. Refresh F5)
        if (pb.authStore.isValid) {
            store.init();
        } else if ($page.url.pathname !== '/login') {
            goto('/login');
        }

        // 2. Listener für Login/Logout (WICHTIG für den Wechsel von Login -> Dashboard)
        unsubscribeAuth = pb.authStore.onChange((token, model) => {
            if (pb.authStore.isValid) {
                // User hat sich gerade eingeloggt -> Daten laden!
                store.init();
            } else {
                // User hat sich ausgeloggt -> Weg hier
                goto('/login');
            }
        });

        // Dark Mode Logic
        const unsubscribeStore = store.subscribe(state => {
            if (state.settings.darkMode) document.documentElement.classList.add('dark');
            else document.documentElement.classList.remove('dark');
        });

        return () => {
            unsubscribeStore();
        };
    });

    onDestroy(() => {
        if (unsubscribeAuth) unsubscribeAuth();
    });
</script>

{#if $page.url.pathname === '/login'}
    {@render children()}
{:else}
    <div class="app-layout">
        <CommandPalette />
        {@render children()}
        <MatterNotesPanel />
    </div>
{/if}