<script lang="ts">
	import { store } from '$lib/stores/tasks';
	import { Plus, CornerDownLeft } from 'lucide-svelte';

	let inputTitle = '';
	let inputRef = '';
	let inputDate = new Date().toISOString().split('T')[0];

	function resize(e: Event) {
		const target = e.target as HTMLTextAreaElement;
		target.style.height = 'auto';
		target.style.height = target.scrollHeight + 'px';
	}

	function handleAdd() {
		if (!inputTitle.trim()) return;
		store.addTask('TODO', inputTitle, inputRef, inputDate);
		inputTitle = '';
		inputRef = '';
		inputDate = new Date().toISOString().split('T')[0];
		
		const textarea = document.getElementById('task-input') as HTMLTextAreaElement;
		if (textarea) {
			textarea.style.height = 'auto';
			setTimeout(() => textarea.focus(), 10);
		}
	}

	function onKeyDown(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
			e.preventDefault();
			handleAdd();
		}
	}
</script>

<!-- BRANDING: Royal brand Focus States -->
<div class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm transition-all focus-within:ring-2 focus-within:ring-brand-500/20 focus-within:border-brand-400">
	<div class="flex flex-col gap-1 p-1 sm:flex-row sm:items-start">
		
		<div class="relative flex-grow">
			<div class="absolute top-2.5 left-2.5 pointer-events-none text-brand-500 opacity-60">
				<Plus size={18} />
			</div>
			<!-- TYPOGRAPHY: text-sm (14px) -->
			<textarea 
				id="task-input" 
				bind:value={inputTitle} 
				oninput={resize} 
				onkeydown={onKeyDown} 
				rows="1" 
				placeholder="Neue Aufgabe erfassen... (Strg+Enter)" 
				class="w-full rounded-lg border-0 bg-transparent py-2.5 pl-10 pr-3 text-slate-900 placeholder:text-slate-400 focus:ring-0 text-sm font-medium resize-none overflow-hidden dark:text-slate-100"
			></textarea>
		</div>

		<div class="flex items-center gap-2 border-t border-slate-100 dark:border-slate-700 pt-1.5 sm:border-t-0 sm:pt-1.5 sm:border-l sm:pl-2 sm:pr-1">
			<!-- TYPOGRAPHY: text-[11px] -->
			<input 
				bind:value={inputRef} 
				type="text" 
				onkeydown={onKeyDown} 
				placeholder="Ref-Nr." 
				class="w-24 rounded-md border-0 bg-slate-50 dark:bg-slate-900 py-1.5 px-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 focus:bg-brand-50 dark:focus:bg-slate-700 focus:ring-1 focus:ring-brand-500/50 transition-colors" 
			/>
			<!-- TYPOGRAPHY: text-xs (12px) -->
			<input 
				bind:value={inputDate} 
				type="date" 
				onkeydown={onKeyDown} 
				class="rounded-md border-0 bg-slate-50 dark:bg-slate-900 py-1.5 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 focus:bg-brand-50 dark:focus:bg-slate-700 focus:ring-1 focus:ring-brand-500/50 transition-colors dark:[color-scheme:dark]" 
			/>
			
			<!-- BRANDING: Add-Button in Royal brand -->
			<button 
				onclick={handleAdd} 
				title="Strg+Enter zum Speichern" 
				class="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-brand-700 transition-all active:scale-95 outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-1"
			>
				<span>Add</span>
				<CornerDownLeft size={12} class="opacity-60" />
			</button>
		</div>
	</div>
</div>