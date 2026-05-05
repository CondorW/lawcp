<script lang="ts">
	import { store } from '$lib/stores/tasks';
	import type { Task } from '$lib/types';
	import { cn, renderTitleWithTags } from '$lib/utils';
	import { autosize } from '$lib/actions';

	export let task: Task;

	let isEditing = false;
	let buffer = '';

	function startEdit() {
		buffer = task.title;
		isEditing = true;
		setTimeout(() => document.getElementById(`title-edit-${task.id}`)?.focus(), 10);
	}

	function saveEdit() {
		if (buffer.trim() !== task.title) store.updateTaskTitle(task.id, buffer);
		isEditing = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') saveEdit();
		if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
			e.preventDefault();
			saveEdit();
			setTimeout(() => document.getElementById(`new-subtask-${task.id}`)?.focus(), 50);
		}
	}
</script>

<div class="min-h-[18px]">
	{#if isEditing}
		<!-- `text-inherit` forces the textarea to match the wrapper size exactly -->
		<textarea 
			id={`title-edit-${task.id}`} 
			use:autosize 
			bind:value={buffer} 
			onblur={saveEdit} 
			onkeydown={handleKeydown} 
			class="w-full font-bold text-inherit text-slate-900 bg-slate-50 border border-blue-400 rounded px-1.5 py-0.5 resize-none overflow-hidden dark:bg-slate-700 dark:text-white block focus:ring-2 focus:ring-blue-500 outline-none leading-tight" 
			rows="1" 
			spellcheck="false"
		></textarea>
	{:else}
		<div 
			role="button" 
			tabindex="0" 
			onclick={startEdit} 
			onkeydown={(e) => { if (e.key === 'Enter') startEdit(); }} 
			class={cn("font-bold text-inherit text-slate-900 leading-snug cursor-text hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-700/50 rounded -mx-1 px-1 break-words", task.status === 'DONE' && "line-through text-slate-500")}
		>
			{@html renderTitleWithTags(task.title, $store.settings.team)}
		</div>
	{/if}
</div>