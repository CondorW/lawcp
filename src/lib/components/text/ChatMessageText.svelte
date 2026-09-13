<script lang="ts">
	type SegmentKind = 'text' | 'mention' | 'quote' | 'strong';
	interface Segment {
		kind: SegmentKind;
		value: string;
	}

	let { text }: { text: string } = $props();

	let segments = $derived.by((): Segment[] => {
		const result: Segment[] = [];
		const tokenPattern = /(\*\*[^*\n]+\*\*|"[^"\n]+"|@[\p{L}\p{N}_-]+)/gu;
		let cursor = 0;

		for (const match of text.matchAll(tokenPattern)) {
			const index = match.index;
			if (index > cursor) result.push({ kind: 'text', value: text.slice(cursor, index) });

			const token = match[0];
			if (token.startsWith('**')) {
				result.push({ kind: 'strong', value: token.slice(2, -2) });
			} else if (token.startsWith('@')) {
				result.push({ kind: 'mention', value: token });
			} else {
				result.push({ kind: 'quote', value: token });
			}
			cursor = index + token.length;
		}

		if (cursor < text.length) result.push({ kind: 'text', value: text.slice(cursor) });
		return result;
	});
</script>

<span class="whitespace-pre-wrap">
	{#each segments as segment, index (index)}
		{#if segment.kind === 'mention'}
			<span class="rounded bg-black/10 px-1.5 py-0.5 font-bold dark:bg-white/10"
				>{segment.value}</span
			>
		{:else if segment.kind === 'quote'}
			<span class="rounded bg-black/10 px-1.5 py-0.5 font-medium italic dark:bg-white/10"
				>{segment.value}</span
			>
		{:else if segment.kind === 'strong'}
			<strong>{segment.value}</strong>
		{:else}{segment.value}{/if}
	{/each}
</span>
