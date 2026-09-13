<script lang="ts">
	import { pb } from '$lib/pocketbase';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { User, Lock, ArrowRight, ShieldCheck } from 'lucide-svelte';

	let email = '';
	let password = '';
	let loading = false;
	let error = '';

	async function login() {
		if (!email || !password) return;
		loading = true;
		error = '';
		try {
			await pb.collection('users').authWithPassword(email, password);
			goto(resolve('/'));
		} catch (caughtError: unknown) {
			console.error(caughtError);
			error = 'Zugriff verweigert. Bitte prüfen Sie Ihre Anmeldedaten.';
		} finally {
			loading = false;
		}
	}
</script>

<div
	class="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 font-sans dark:bg-slate-950"
>
	<div class="mb-8 flex items-center gap-3">
		<div
			class="flex h-12 w-12 items-center justify-center rounded bg-brand-600 font-serif text-2xl font-bold text-white shadow-md"
		>
			L
		</div>
		<span class="font-serif text-3xl font-bold tracking-tight text-slate-900 dark:text-white"
			>LAW<span class="text-brand-600">Ganized</span></span
		>
	</div>

	<div
		class="w-full max-w-[400px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none"
	>
		<div class="p-8">
			<h2 class="mb-2 text-xl font-bold text-slate-900 dark:text-white">Willkommen zurück</h2>
			<p class="mb-8 text-sm text-slate-500 dark:text-slate-400">
				Anmeldung zur Kanzlei Productivity Suite
			</p>

			{#if error}
				<div
					class="mb-6 flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
				>
					<span class="h-1.5 w-1.5 animate-pulse rounded-full bg-red-600"></span>
					{error}
				</div>
			{/if}

			<div class="space-y-5">
				<div class="space-y-1.5">
					<label
						for="email"
						class="ml-1 text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400"
						>Benutzername / E-Mail</label
					>
					<div class="group relative">
						<User
							class="absolute top-3 left-3.5 text-slate-400 transition-colors group-focus-within:text-brand-600"
							size={18}
						/>
						<input
							id="email"
							bind:value={email}
							type="email"
							placeholder="kanzlei@email.ch"
							class="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pr-4 pl-11 transition-all outline-none placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
						/>
					</div>
				</div>

				<div class="space-y-1.5">
					<label
						for="password"
						class="ml-1 text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400"
						>Passwort</label
					>
					<div class="group relative">
						<Lock
							class="absolute top-3 left-3.5 text-slate-400 transition-colors group-focus-within:text-brand-600"
							size={18}
						/>
						<input
							id="password"
							bind:value={password}
							type="password"
							placeholder="••••••••"
							onkeydown={(e) => e.key === 'Enter' && login()}
							class="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pr-4 pl-11 transition-all outline-none placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
						/>
					</div>
				</div>
			</div>

			<button
				onclick={login}
				disabled={loading}
				class="mt-10 flex w-full items-center justify-center gap-3 rounded-xl bg-slate-900 py-4 font-bold text-white shadow-lg shadow-slate-200 transition-all hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50 dark:bg-brand-600 dark:shadow-none dark:hover:bg-brand-700"
			>
				{#if loading}
					<div
						class="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white"
					></div>
					<span>Authentifizierung...</span>
				{:else}
					<span>LOGIN</span>
					<ArrowRight size={18} />
				{/if}
			</button>
		</div>

		<div
			class="flex items-center justify-center gap-2 border-t border-slate-100 bg-slate-50 px-8 py-4 dark:border-slate-800 dark:bg-slate-800/50"
		>
			<ShieldCheck size={14} class="text-emerald-600" />
			<span class="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase"
				>End-to-End verschlüsselt</span
			>
		</div>
	</div>

	<p class="mt-8 text-xs tracking-wide text-slate-400">
		&copy; 2026 LAWGanized – Swiss Assets LWA. Alle Rechte vorbehalten.
	</p>
</div>

<style>
	/* Optionale Serifen-Font Einbindung, falls nicht global verfügbar */
	:global(font-serif) {
		font-family: 'Georgia', serif;
	}
</style>
