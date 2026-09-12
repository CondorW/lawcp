<script lang="ts">
	import { store } from '$lib/stores/tasks';
	import { pb } from '$lib/pocketbase';
	import { ArrowLeft, Moon, Sun, LogOut, User, Users, Crown } from 'lucide-svelte';
	import { getPrimaryRelationId } from '$lib/domain/users';
	import { resolve } from '$app/paths';

	const currentUser = pb.authStore.model;

	// FIX: Strikte Team-Isolation
	$: myTeamMembers = $store.firmUsers.filter((u) => {
		if (!currentUser) return false;

		// 1. Man sieht sich immer selbst
		if (u.id === currentUser.id) return true;

		const myLeaderId = getPrimaryRelationId(currentUser.teamLeader);
		const theirLeaderId = getPrimaryRelationId(u.teamLeader);

		if (!myLeaderId) {
			// Ich bin Teamleader: Ich sehe nur mich und meine direkten Teammitglieder
			return theirLeaderId === currentUser.id;
		} else {
			// Ich bin Associate: Ich sehe mich, meinen Chef und meine direkten Kollegen
			if (u.id === myLeaderId) return true; // Das ist mein Chef
			if (theirLeaderId === myLeaderId) return true; // Das ist ein Kollege unter demselben Chef
		}

		return false;
	});

	$: sortedTeam = [...myTeamMembers].sort((a, b) => {
		const aIsLeader = !getPrimaryRelationId(a.teamLeader);
		const bIsLeader = !getPrimaryRelationId(b.teamLeader);
		if (aIsLeader && !bIsLeader) return -1;
		if (!aIsLeader && bIsLeader) return 1;
		return (a.shortsign || '').localeCompare(b.shortsign || '');
	});
</script>

<div
	class="min-h-screen bg-slate-50 p-6 font-sans text-slate-900 transition-colors lg:p-8 dark:bg-slate-950 dark:text-slate-100"
>
	<div
		class="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:p-10 dark:border-slate-800 dark:bg-slate-900"
	>
		<!-- HEADER -->
		<div
			class="mb-10 flex items-center justify-between border-b border-slate-100 pb-6 dark:border-slate-800"
		>
			<div class="flex items-center gap-4">
				<a
					href={resolve('/')}
					class="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
				>
					<ArrowLeft size={24} />
				</a>
				<h1 class="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
					Einstellungen
				</h1>
			</div>

			<button
				onclick={() => store.toggleDarkMode()}
				class="flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-bold shadow-sm transition-colors outline-none hover:bg-slate-200 focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:hover:bg-slate-700"
			>
				{#if $store.settings.darkMode}
					<Sun size={18} class="text-yellow-500 dark:text-yellow-400" /> <span>Light Mode</span>
				{:else}
					<Moon size={18} class="text-brand-600 dark:text-brand-400" /> <span>Dark Mode</span>
				{/if}
			</button>
		</div>

		<!-- MEIN PROFIL -->
		<section class="mb-12">
			<h2 class="mb-5 flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-200">
				<User size={20} class="text-brand-600 dark:text-brand-400" /> Mein Profil
			</h2>

			<div
				class="rounded-xl border border-slate-200 bg-slate-50/50 p-6 dark:border-slate-700 dark:bg-slate-800/50"
			>
				<div class="grid grid-cols-1 gap-8 sm:grid-cols-2">
					<div>
						<p
							class="mb-1.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400"
						>
							Name
						</p>
						<p class="text-base font-bold text-slate-900 dark:text-white">
							{currentUser?.name || 'Unbekannt'}
						</p>
					</div>
					<div>
						<p
							class="mb-1.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400"
						>
							E-Mail
						</p>
						<p class="text-base font-bold text-slate-900 dark:text-white">
							{currentUser?.email || 'Keine E-Mail hinterlegt'}
						</p>
					</div>
					<div>
						<p
							class="mb-1.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400"
						>
							Kürzel
						</p>
						<span
							class="inline-block rounded-md border border-slate-300 bg-white px-3 py-1 text-sm font-bold tracking-wider text-slate-800 uppercase shadow-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
						>
							{currentUser?.shortsign || $store.settings.myShortsign}
						</span>
					</div>
					<div>
						<p
							class="mb-1.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400"
						>
							Rolle
						</p>
						<p class="text-base font-bold text-yellow-600 dark:text-yellow-500">
							{!getPrimaryRelationId(currentUser?.teamLeader) ? 'Teamleiter' : 'Teammitglied'}
						</p>
					</div>
				</div>
			</div>
		</section>

		<!-- MEIN TEAM -->
		<section>
			<h2 class="mb-3 flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-200">
				<Users size={20} class="text-brand-600 dark:text-brand-400" /> Mein Team
			</h2>
			<p class="mb-6 text-sm text-slate-500 dark:text-slate-400">
				Hier siehst du ausschließlich Mitglieder deines direkten Teams. Rollenverwaltung erfolgt
				zentral durch die Administration.
			</p>

			<div class="mb-10 space-y-3">
				{#each sortedTeam as user (user.id)}
					{@const isLeader = !getPrimaryRelationId(user.teamLeader)}
					<div
						class={`flex items-center justify-between rounded-xl border p-4 transition-colors ${currentUser?.id === user.id ? 'border-brand-200 bg-brand-50/50 dark:border-brand-800/50 dark:bg-brand-900/20' : 'border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/50'}`}
					>
						<div class="flex items-center gap-4">
							<div class="relative">
								{#if isLeader}
									<!-- BRANDING: Gold für die Krone -->
									<div
										class="absolute -top-3 -right-2 rotate-12 text-yellow-500 drop-shadow-sm"
										title="Teamleiter"
									>
										<Crown size={18} fill="currentColor" />
									</div>
								{/if}
								<span
									class={`rounded-lg border px-3.5 py-2 text-sm font-bold tracking-wide uppercase shadow-sm ${isLeader ? 'border-yellow-300 bg-yellow-50 text-yellow-700 dark:border-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : 'border-slate-300 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300'}`}
								>
									{user.shortsign || '?'}
								</span>
							</div>

							<div>
								<div
									class="flex items-center gap-2.5 text-base font-bold text-slate-900 dark:text-white"
								>
									{user.name || user.email?.split('@')[0] || 'Unbekannt'}

									{#if currentUser?.id === user.id}
										<!-- BRANDING: Royal brand für 'Du' -->
										<span
											class="rounded bg-brand-100 px-2 py-0.5 text-[10px] font-bold tracking-wider text-brand-700 uppercase dark:bg-brand-900/40 dark:text-brand-400"
											>Du</span
										>
									{/if}

									{#if isLeader}
										<!-- BRANDING: Gold für Leader-Tag -->
										<span
											class="rounded bg-yellow-100 px-2 py-0.5 text-[10px] font-bold tracking-wider text-yellow-800 uppercase dark:bg-yellow-900/40 dark:text-yellow-400"
											>Leader</span
										>
									{/if}
								</div>

								{#if user.email}
									<div class="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{user.email}</div>
								{/if}
							</div>
						</div>
					</div>
				{:else}
					<div
						class="text-center py-10 text-slate-400 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl font-medium"
					>
						Keine weiteren Team-Mitarbeiter gefunden.
					</div>
				{/each}
			</div>
		</section>

		<!-- LOGOUT -->
		<div class="border-t border-slate-100 pt-6 dark:border-slate-800">
			<!-- BRANDING: Ruby Red (rose-600) für destruktive Aktionen -->
			<button
				onclick={() => store.logout()}
				class="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 py-3.5 text-sm font-bold text-rose-600 shadow-sm transition-all outline-none hover:bg-rose-600 hover:text-white focus:ring-2 focus:ring-rose-500 focus:ring-offset-1 dark:border-rose-800/50 dark:bg-rose-900/20 dark:text-rose-400 dark:hover:bg-rose-500"
			>
				<LogOut size={18} /> Abmelden
			</button>
		</div>
	</div>
</div>
