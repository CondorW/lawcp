<script lang="ts">
	import { store } from '$lib/stores/tasks';
	import type { Task } from '$lib/types';
	import { cn } from '$lib/utils';
	import { autosize } from '$lib/actions';
	import TaggedText from '$lib/components/text/TaggedText.svelte';

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
			class="block w-full resize-none overflow-hidden rounded border border-brand-400 bg-slate-50 px-1.5 py-0.5 leading-tight font-bold text-inherit text-slate-900 outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-700 dark:text-white"
			rows="1"
			spellcheck="false"
		></textarea>
	{:else}
		<div
			role="button"
			tabindex="0"
			onclick={startEdit}
			onkeydown={(e) => {
				if (e.key === 'Enter') startEdit();
			}}
			class={cn(
				'-mx-1 cursor-text rounded px-1 leading-snug font-bold break-words text-inherit text-slate-900 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-700/50',
				task.status === 'DONE' && 'text-slate-500 line-through'
			)}
		>
			<TaggedText text={task.title} team={$store.settings.team} />
		</div>
	{/if}
</div>
