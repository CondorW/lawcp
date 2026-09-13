<script lang="ts">
	import type { TeamMember } from '$lib/types';
	import { cn } from '$lib/utils';

	interface Props {
		text: string;
		team?: TeamMember[];
	}

	type Segment =
		| { kind: 'text'; value: string }
		| { kind: 'mention'; value: string; color: string };

	let { text, team = [] }: Props = $props();

	let segments = $derived.by((): Segment[] => {
		if (!text) return [];

		return text.split(/(\s+)/).flatMap((part): Segment[] => {
			const match = part.match(/^@([\p{L}\p{N}_-]+)(.*)$/u);
			if (!match) return [{ kind: 'text', value: part }];

			const [, shortsign, suffix] = match;
			const member = team.find(
				(candidate) => candidate.shortsign.toLocaleLowerCase() === shortsign.toLocaleLowerCase()
			);
			const mention: Segment = {
				kind: 'mention',
				value: `@${shortsign}`,
				color: member?.color ?? 'bg-gray-200 text-gray-800'
			};

			return suffix ? [mention, { kind: 'text', value: suffix }] : [mention];
		});
	});
</script>

{#each segments as segment, index (index)}
	{#if segment.kind === 'mention'}
		<span
			class={cn(
				'mx-0.5 inline-block rounded px-1.5 py-0.5 text-xs font-bold uppercase',
				segment.color
			)}>{segment.value}</span
		>
	{:else}{segment.value}{/if}
{/each}
