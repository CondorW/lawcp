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
	import ToastHost from '$lib/components/ToastHost.svelte';
	import { toastStore } from '$lib/stores/toasts';

	let { children } = $props();

	onMount(() => {
		// Prüft beim direkten Aufruf oder nach einem Browser-Refresh die vorhandene Session.
		if (pb.authStore.isValid) {
			void store.init();
		} else if ($page.url.pathname !== '/login') {
			void goto(resolve('/login'));
		}

		// Reagiert auch auf Login, Logout und extern abgelaufene Sessions.
		const unsubscribeAuth = pb.authStore.onChange(() => {
			if (pb.authStore.isValid) {
				void store.init();
			} else {
				toastStore.clear();
				void store.resetSession().finally(() => goto(resolve('/login')));
			}
		});

		const unsubscribeStore = store.subscribe((state) => {
			if (state.settings.darkMode) document.documentElement.classList.add('dark');
			else document.documentElement.classList.remove('dark');
		});

		return () => {
			unsubscribeStore();
			unsubscribeAuth();
			toastStore.clear();
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

<ToastHost />