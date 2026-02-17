<script lang="ts">
    import "./layout.css"; 
    import { store } from '$lib/stores/tasks';
    import { onMount } from 'svelte';
    import MatterNotesPanel from '$lib/components/MatterNotesPanel.svelte';
    import CommandPalette from '$lib/components/CommandPalette.svelte';

    let { children } = $props();

    onMount(() => {
        // Lädt Daten aus PocketBase & startet Realtime
        store.init();
        
        // Dark Mode Logic
        const unsubscribe = store.subscribe(state => {
            if (state.settings.darkMode) document.documentElement.classList.add('dark');
            else document.documentElement.classList.remove('dark');
        });
        return unsubscribe;
    });
</script>

<CommandPalette />
{@render children()}
<MatterNotesPanel />