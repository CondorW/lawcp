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
			class="relative w-full max-w-lg bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col" 
			transition:fly={{ x: 400, duration: 300 }}
		>
			<div class="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
				<div class="flex items-center gap-3">
					<div class="p-2 bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300 rounded-lg">
						<BrainCircuit size={24} />
					</div>
					<div>
						<h2 class="text-lg font-bold text-slate-900 dark:text-white">Aktennotizen</h2>
						<div class="text-xs font-mono text-slate-500 uppercase tracking-wider">{activeRef}</div>
					</div>
				</div>
				<button onclick={saveAndClose} class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
					<X size={20} />
				</button>
			</div>

			<div class="flex-1 p-6 overflow-y-auto bg-white dark:bg-slate-900 relative">
				{#if isLoading}
					<div class="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-900/80 z-10 transition-opacity">
						<Loader2 size={32} class="animate-spin text-purple-500 mb-2" />
						<span class="text-sm text-slate-500 font-medium">Lade Aktennotizen...</span>
					</div>
				{/if}
				<!-- svelte-ignore a11y_autofocus -->
				<textarea 
					bind:value={noteContent} 
					onkeydown={onKeyDown} 
					autofocus
					class="w-full h-full resize-none border-0 bg-transparent focus:ring-0 text-base leading-relaxed text-slate-700 dark:text-slate-300 placeholder:text-slate-400 outline-none" 
					placeholder="Brain Dump: Strategie, Notizen... (Strg+Enter zum Schließen)" 
					spellcheck="false"
				></textarea>
			</div>

			<div class="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
				<span class="text-xs text-slate-400 flex items-center gap-1">
					{#if isSaving}
						<Loader2 size={12} class="animate-spin text-purple-500" /> Synchronisiere...
					{:else}
						Gesichert.
					{/if}
				</span>
				<button onclick={saveAndClose} disabled={isSaving || isLoading} class="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-purple-600 text-white rounded-lg font-bold hover:bg-slate-800 dark:hover:bg-purple-500 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
					<Save size={16} /> Speichern
				</button>
			</div>
		</div>
	</div>
{/if}