<script lang="ts">
    import "./layout.css"; 
    import { store } from '$lib/stores/tasks';
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { browser } from '$app/environment';
    
    // NEU: Importieren der Command Palette
    import CommandPalette from '$lib/components/CommandPalette.svelte';

    let { children } = $props();

    onMount(() => {
        const unsubscribe = store.subscribe(state => {
            // Dark Mode Logic
            if (state.settings.darkMode) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }

            // Auth Check (DEAKTIVIERT WEGEN PHISHING FILTER)
            /* if (browser && !state.settings.isAuthenticated && $page.url.pathname !== '/login') {
                goto('/login');
            }
            */
        });
        return unsubscribe;
    });
</script>

<CommandPalette />

{@render children()}