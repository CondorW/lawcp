<script lang="ts">
    import "./layout.css"; 
    import { store } from '$lib/stores/tasks';
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { browser } from '$app/environment';

    let { children } = $props();

    onMount(() => {
        const unsubscribe = store.subscribe(state => {
            // Dark Mode
            if (state.settings.darkMode) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }

            // Auth Check (Redirect to Login)
            if (browser && !state.settings.isAuthenticated && $page.url.pathname !== '/login') {
                goto('/login');
            }
        });
        return unsubscribe;
    });
</script>

{@render children()}