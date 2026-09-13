<script lang="ts">
	import { goto, afterNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { store } from '$lib/stores/tasks';
	import {
		Search,
		Calendar,
		LayoutGrid,
		GitBranch,
		Building2,
		Moon,
		Sun,
		Command,
		FileText,
		PlusCircle
	} from 'lucide-svelte';
	import { fade, scale } from 'svelte/transition';
	import { onMount, tick } from 'svelte';

	type PaletteItem = {
		id: string;
		title: string;
		icon: typeof Search;
		action: () => void | Promise<void>;
	};

	let open = $state(false);
	let query = $state('');
	let selectedIndex = $state(0);

	// FIX 1: Linter meckert nicht mehr, da als $state deklariert
	let inputEl = $state<HTMLInputElement | null>(null);
	let pendingFocus = $state(false);

	afterNavigate(async () => {
		if (pendingFocus) {
			pendingFocus = false;
			await tick();
			requestAnimationFrame(() => {
				const input = document.getElementById('nav-task-title');
				if (input) input.focus();
			});
		}
	});

	let actions = $derived<PaletteItem[]>([
		{
			id: 'new-task',
			title: 'Neuen Case erfassen',
			icon: PlusCircle,
			action: async () => {
				open = false;
				if ($page.url.pathname !== '/') {
					pendingFocus = true;
					await goto(resolve('/'));
				} else {
					await tick();
					const input = document.getElementById('nav-task-title');
					if (input) input.focus();
				}
			}
		},
		{ id: 'board', title: 'Board öffnen', icon: LayoutGrid, action: () => goto(resolve('/')) },
		{
			id: 'calendar',
			title: 'Kalender öffnen',
			icon: Calendar,
			action: () => goto(resolve('/calendar'))
		},
		{
			id: 'workflow',
			title: 'Workflow Designer',
			icon: GitBranch,
			action: () => goto(resolve('/workflow'))
		},
		{
			id: 'resources',
			title: 'Ressourcen & Kontakte',
			icon: Building2,
			action: () => goto(resolve('/resources'))
		},
		{
			id: 'theme',
			title: $store.settings.darkMode ? 'Light Mode aktivieren' : 'Dark Mode aktivieren',
			icon: $store.settings.darkMode ? Sun : Moon,
			action: () => store.toggleDarkMode()
		}
	]);

	let taskResults = $derived<PaletteItem[]>(
		query.trim().length > 0
			? $store.tasks
					.filter(
						(t) =>
							t.title.toLowerCase().includes(query.toLowerCase()) ||
							(t.matterRef && t.matterRef.toLowerCase().includes(query.toLowerCase()))
					)
					.slice(0, 5)
					.map((t) => ({
						id: t.id,
						title: `${t.matterRef ? t.matterRef + ': ' : ''}${t.title}`,
						icon: FileText,
						action: async () => {
							open = false; // Palette sofort schließen

							if ($page.url.pathname !== '/') {
								await goto(resolve('/'));
								await tick();
							}

							// Wir feuern das Event doppelt: Einmal sofort, und als Backup noch einmal leicht verzögert,
							// falls der DOM durch einen Page-Load (goto) noch blockiert ist.
							window.dispatchEvent(new CustomEvent('lawganized-focus-task', { detail: t.id }));
							setTimeout(() => {
								window.dispatchEvent(new CustomEvent('lawganized-focus-task', { detail: t.id }));
							}, 150);
						}
					}))
			: []
	);

	let filtered = $derived([
		...actions.filter((a) => a.title.toLowerCase().includes(query.toLowerCase())),
		...taskResults
	]);

	function toggle() {
		open = !open;
		if (open) {
			query = '';
			selectedIndex = 0;
			setTimeout(() => inputEl?.focus(), 10);
		}
	}

	function execute(item: PaletteItem) {
		item.action();
		open = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if ((e.key === 'j' || e.key === 'f') && (e.metaKey || e.ctrlKey)) {
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
		class="group fixed bottom-6 left-6 z-40 flex items-center gap-3 rounded-full border border-brand-500 bg-brand-600 px-4 py-3 font-bold text-white shadow-xl shadow-brand-900/20 transition-all outline-none hover:scale-105 hover:bg-brand-700 focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 focus:ring-offset-slate-50 dark:focus:ring-offset-slate-900 print:hidden"
		title="Befehlspalette öffnen (Strg+J oder Strg+F)"
	>
		<Search size={20} />
		<span class="hidden md:inline">Suche / Befehle</span>
		<div
			class="ml-2 flex items-center gap-1 rounded bg-white/20 px-1.5 py-0.5 font-mono text-[10px] transition-colors group-hover:bg-white/30"
		>
			<Command size={10} /> F
		</div>
	</button>
{/if}

{#if open}
	<div
		class="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-[15vh] font-sans print:hidden"
		transition:fade={{ duration: 100 }}
	>
		<div
			class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
			onclick={() => (open = false)}
			onkeydown={(e) => {
				if (e.key === 'Escape') open = false;
			}}
			role="button"
			tabindex="-1"
		></div>

		<div
			class="relative flex max-h-[60vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
			transition:scale={{ duration: 150, start: 0.95 }}
		>
			<div class="flex items-center gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
				<Search class="text-brand-600 dark:text-brand-400" size={20} />
				<input
					bind:this={inputEl}
					bind:value={query}
					type="text"
					placeholder="Suchen oder Befehl eingeben..."
					class="flex-1 border-none bg-transparent p-0 text-lg font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:ring-0 dark:text-white"
				/>
				<button
					onclick={() => (open = false)}
					class="rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500 transition-colors hover:text-slate-700 dark:bg-slate-800 dark:hover:text-slate-300"
					>ESC</button
				>
			</div>

			<div class="overflow-y-auto p-2">
				{#if filtered.length === 0}
					<div class="p-4 text-center text-sm font-medium text-slate-500">
						Keine Ergebnisse gefunden.
					</div>
				{:else}
					{#each filtered as item, i (item.id)}
						{@const Icon = item.icon}
						<button
							class={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors outline-none ${i === selectedIndex ? 'bg-brand-50 text-brand-900 dark:bg-brand-900/20 dark:text-brand-100' : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'}`}
							onclick={() => execute(item)}
							onmouseenter={() => (selectedIndex = i)}
						>
							<Icon
								size={18}
								class={i === selectedIndex
									? 'text-brand-600 dark:text-brand-400'
									: 'text-slate-400'}
							/>
							<span class="text-sm font-medium">{item.title}</span>
							{#if i === selectedIndex}
								<span class="ml-auto text-xs font-bold text-brand-600 dark:text-brand-400"
									>↵ Enter</span
								>
							{/if}
						</button>
					{/each}
				{/if}
			</div>

			<div
				class="flex justify-between border-t border-slate-100 bg-slate-50 p-2 px-4 text-[10px] font-medium tracking-wider text-slate-400 uppercase dark:border-slate-800 dark:bg-slate-950"
			>
				<span><strong>↑↓</strong> zum Wählen</span>
				<span><strong>LAWganized</strong> Cmd</span>
			</div>
		</div>
	</div>
{/if}
