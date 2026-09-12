<script lang="ts">
	import './layout.css';
	import { store } from '$lib/stores/tasks';
	import { onMount } from 'svelte';
	import { pb } from '$lib/pocketbase';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import MatterNotesPanel from '$lib/components/MatterNotesPanel.svelte';
	import CommandPalette from '$lib/components/CommandPalette.svelte';

	let { children } = $props();
	onMount(() => {
		// 1. Sofort-Check beim Laden der Seite (z.B. Refresh F5)
		if (pb.authStore.isValid) {
			void store.init();
		} else if ($page.url.pathname !== '/login') {
			goto(resolve('/login'));
		}

		// 2. Listener für Login/Logout (WICHTIG für den Wechsel von Login -> Dashboard)
		const unsubscribeAuth = pb.authStore.onChange(() => {
			if (pb.authStore.isValid) {
				// User hat sich gerade eingeloggt -> Daten laden!
				void store.init();
			} else {
				// Cleanup also covers expired or externally cleared sessions.
				void store.resetSession().finally(() => goto(resolve('/login')));
			}
		});

		// Dark Mode Logic
		const unsubscribeStore = store.subscribe((state) => {
			if (state.settings.darkMode) document.documentElement.classList.add('dark');
			else document.documentElement.classList.remove('dark');
		});

		return () => {
			unsubscribeStore();
			unsubscribeAuth();
			void store.resetSession();
		};
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
