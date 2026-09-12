<script lang="ts">
	import { store } from '$lib/stores/tasks';
	import { X, BrainCircuit, Save, Loader2 } from 'lucide-svelte';
	import { fly } from 'svelte/transition';

	const activeMatterStore = store.activeMatter;

	let activeRef = $state<string | null>(null);
	let noteContent = $state('');
	let contextId = $state<string | undefined>(undefined);
	let isLoading = $state(false);
	let isSaving = $state(false);

	$effect(() => {
		const newRef = $activeMatterStore;
		if (newRef !== activeRef) {
			activeRef = newRef;
			if (activeRef) {
				loadContext(activeRef);
			} else {
				noteContent = '';
				contextId = undefined;
			}
		}
	});

	async function loadContext(ref: string) {
		isLoading = true;
		const record = await store.fetchContext(ref);
		if (record) {
			contextId = record.id;
			noteContent = record.content;
		} else {
			contextId = undefined;
			noteContent = '';
		}
		isLoading = false;
	}

	async function save() {
		if (!activeRef) return;
		isSaving = true;
		const record = await store.saveContext(activeRef, noteContent, contextId);
		if (record && !contextId) {
			contextId = record.id;
		}
		isSaving = false;
	}

	function close() {
		store.closeMatterNotes();
	}

	async function saveAndClose() {
		await save();
		close();
	}

	function onKeyDown(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
			e.preventDefault();
			saveAndClose();
		}
	}
</script>

{#if activeRef}
	<div class="fixed inset-0 z-[100] flex justify-end font-sans">
		<div
			class="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity"
			onclick={saveAndClose}
			onkeydown={(e) => e.key === 'Escape' && close()}
			role="button"
			tabindex="-1"
			transition:fly={{ duration: 200, opacity: 0 }}
		></div>
		<div
			class="relative flex h-full w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
			transition:fly={{ x: 400, duration: 300 }}
		>
			<div
				class="flex items-center justify-between border-b border-slate-100 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900"
			>
				<div class="flex items-center gap-3">
					<div
						class="rounded-lg bg-purple-100 p-2 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300"
					>
						<BrainCircuit size={24} />
					</div>
					<div>
						<h2 class="text-lg font-bold text-slate-900 dark:text-white">Aktennotizen</h2>
						<div class="font-mono text-xs tracking-wider text-slate-500 uppercase">{activeRef}</div>
					</div>
				</div>
				<button
					onclick={saveAndClose}
					class="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
				>
					<X size={20} />
				</button>
			</div>

			<div class="relative flex-1 overflow-y-auto bg-white p-6 dark:bg-slate-900">
				{#if isLoading}
					<div
						class="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 transition-opacity dark:bg-slate-900/80"
					>
						<Loader2 size={32} class="mb-2 animate-spin text-purple-500" />
						<span class="text-sm font-medium text-slate-500">Lade Aktennotizen...</span>
					</div>
				{/if}
				<!-- svelte-ignore a11y_autofocus -->
				<textarea
					bind:value={noteContent}
					onkeydown={onKeyDown}
					autofocus
					class="h-full w-full resize-none border-0 bg-transparent text-base leading-relaxed text-slate-700 outline-none placeholder:text-slate-400 focus:ring-0 dark:text-slate-300"
					placeholder="Brain Dump: Strategie, Notizen... (Strg+Enter zum Schließen)"
					spellcheck="false"
				></textarea>
			</div>

			<div
				class="flex items-center justify-between border-t border-slate-100 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900"
			>
				<span class="flex items-center gap-1 text-xs text-slate-400">
					{#if isSaving}
						<Loader2 size={12} class="animate-spin text-purple-500" /> Synchronisiere...
					{:else}
						Gesichert.
					{/if}
				</span>
				<button
					onclick={saveAndClose}
					disabled={isSaving || isLoading}
					class="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 font-bold text-white shadow-lg transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-purple-600 dark:hover:bg-purple-500"
				>
					<Save size={16} /> Speichern
				</button>
			</div>
		</div>
	</div>
{/if}
