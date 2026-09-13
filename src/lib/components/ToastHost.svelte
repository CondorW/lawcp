<script lang="ts">
	import { toastStore, type ToastTone } from '$lib/stores/toasts';
	import { AlertTriangle, CheckCircle2, CircleX, Info, X } from 'lucide-svelte';
	import { fade, fly } from 'svelte/transition';

	function panelClasses(tone: ToastTone): string {
		switch (tone) {
			case 'success':
				return 'border-emerald-200 bg-white dark:border-emerald-800 dark:bg-slate-900';
			case 'warning':
				return 'border-amber-200 bg-white dark:border-amber-800 dark:bg-slate-900';
			case 'danger':
			case 'error':
				return 'border-rose-200 bg-white dark:border-rose-800 dark:bg-slate-900';
			default:
				return 'border-brand-200 bg-white dark:border-brand-800 dark:bg-slate-900';
		}
	}

	function iconClasses(tone: ToastTone): string {
		switch (tone) {
			case 'success':
				return 'text-emerald-500';
			case 'warning':
				return 'text-amber-500';
			case 'danger':
			case 'error':
				return 'text-rose-500';
			default:
				return 'text-brand-500';
		}
	}

	function confirmButtonClasses(tone: ToastTone): string {
		return tone === 'warning'
			? 'bg-amber-500 text-white hover:bg-amber-600 focus:ring-amber-500'
			: 'bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-500';
	}
</script>

<aside
	class="pointer-events-none fixed inset-x-3 top-3 z-[500] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4 sm:w-[380px]"
	aria-label="Benachrichtigungen"
	aria-live="polite"
>
	{#each $toastStore as toast (toast.id)}
		<div
			class={`pointer-events-auto w-full rounded-xl border p-4 shadow-xl ${panelClasses(toast.tone)}`}
			role={toast.confirmLabel ? 'alertdialog' : toast.tone === 'error' ? 'alert' : 'status'}
			aria-labelledby={`${toast.id}-title`}
			aria-describedby={toast.message ? `${toast.id}-message` : undefined}
			in:fly={{ x: 28, duration: 180 }}
			out:fade={{ duration: 120 }}
		>
			<div class="flex items-start gap-3">
				<div class={`mt-0.5 shrink-0 ${iconClasses(toast.tone)}`}>
					{#if toast.tone === 'success'}
						<CheckCircle2 size={19} />
					{:else if toast.tone === 'warning' || toast.tone === 'danger'}
						<AlertTriangle size={19} />
					{:else if toast.tone === 'error'}
						<CircleX size={19} />
					{:else}
						<Info size={19} />
					{/if}
				</div>

				<div class="min-w-0 flex-1">
					<p id={`${toast.id}-title`} class="text-sm font-semibold text-slate-900 dark:text-white">
						{toast.title}
					</p>

					{#if toast.message}
						<p
							id={`${toast.id}-message`}
							class="mt-1 text-sm leading-snug text-slate-600 dark:text-slate-300"
						>
							{toast.message}
						</p>
					{/if}
				</div>

				<button
					type="button"
					class="-m-1 shrink-0 rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:ring-2 focus:ring-brand-500 focus:outline-none dark:hover:bg-slate-800 dark:hover:text-slate-200"
					onclick={() => toastStore.dismiss(toast.id)}
					aria-label="Benachrichtigung schließen"
				>
					<X size={17} />
				</button>
			</div>

			{#if toast.confirmLabel}
				<div class="mt-3 flex justify-end gap-2">
					<button
						type="button"
						class="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 focus:ring-2 focus:ring-slate-400 focus:outline-none dark:text-slate-300 dark:hover:bg-slate-800"
						onclick={() => toastStore.dismiss(toast.id)}
					>
						{toast.cancelLabel}
					</button>

					<button
						type="button"
						class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none dark:focus:ring-offset-slate-900 ${confirmButtonClasses(toast.tone)}`}
						onclick={() => toastStore.accept(toast.id)}
					>
						{toast.confirmLabel}
					</button>
				</div>
			{/if}
		</div>
	{/each}
</aside>