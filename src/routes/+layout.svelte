<script lang="ts">
    // FIX: Importiere layout.css statt app.css
    import "./layout.css"; 
    import { store } from '$lib/stores/tasks';
    import { onMount } from 'svelte';

    let { children } = $props();

    onMount(() => {
        // Dark Mode Logic beim Starten initialisieren
        const unsubscribe = store.subscribe(state => {
            if (state.settings.darkMode) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        });
        return unsubscribe;
    });
</script>

{@render children()}