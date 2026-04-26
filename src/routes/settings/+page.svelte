<script lang="ts">
	import { store } from '$lib/stores/tasks';
	import { pb } from '$lib/pocketbase';
	import { ArrowLeft, Moon, Sun, LogOut, User, Users, Crown } from 'lucide-svelte';

	$: currentUser = pb.authStore.model;

	function checkIsLeader(tlField: any) {
		if (!tlField) return true;
		if (tlField === '') return true;
		if (Array.isArray(tlField) && tlField.length === 0) return true;
		return false;
	}

	// FIX: Strikte Team-Isolation. Man sieht nur sich selbst und sein direktes Team.
	$: myTeamMembers = $store.firmUsers.filter(u => {
		if (!currentUser) return false;
		
		// 1. Man sieht sich immer selbst
		if (u.id === currentUser.id) return true;

		// 2. Wenn ich Teamleader bin, sehe ich alle, deren teamLeader meine ID ist
		const iAmLeader = checkIsLeader(currentUser.teamLeader);
		if (iAmLeader) {
			return u.teamLeader === currentUser.id;
		}

		// 3. Wenn ich Associate bin, sehe ich meinen Chef UND alle Kollegen, die denselben Chef haben
		const myLeaderId = currentUser.teamLeader;
		return u.id === myLeaderId || u.teamLeader === myLeaderId;
	});

	$: sortedTeam = [...myTeamMembers].sort((a, b) => {
		const aIsLeader = checkIsLeader(a.teamLeader);
		const bIsLeader = checkIsLeader(b.teamLeader);
		if (aIsLeader && !bIsLeader) return -1;
		if (!aIsLeader && bIsLeader) return 1;
		return (a.shortsign || '').localeCompare(b.shortsign || '');
	});
</script>

<div class="min-h-screen bg-gray-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-8 font-sans transition-colors">
	<div class="max-w-3xl mx-auto bg-white dark:bg-slate-800 rounded-xl shadow-md border border-gray-200 dark:border-slate-700 p-8">
		<div class="flex items-center justify-between mb-8">
			<div class="flex items-center gap-4">
				<a href="/" class="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full text-gray-500 dark:text-gray-400 transition-colors">
					<ArrowLeft size={24} />
				</a>
				<h1 class="text-3xl font-bold tracking-tight">Einstellungen</h1>
			</div>
			<button onclick={() => store.toggleDarkMode()} class="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors font-medium shadow-sm">
				{#if $store.settings.darkMode}
					<Sun size={20} class="text-yellow-400"/>
					<span>Light</span>
				{:else}
					<Moon size={20} class="text-slate-600"/>
					<span>Dark</span>
				{/if}
			</button>
		</div>

		<section class="mb-12 border-b border-gray-100 dark:border-slate-700 pb-10">
			<h2 class="text-xl font-bold mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
				<User size={20} class="text-blue-500" />
				Mein Profil
			</h2>
			<div class="bg-slate-50 dark:bg-slate-700/30 p-6 rounded-xl border border-slate-100 dark:border-slate-600">
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
					<div>
						<p class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Name</p>
						<p class="font-bold text-lg">{currentUser?.name || 'Unbekannt'}</p>
					</div>
					<div>
						<p class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">E-Mail</p>
						<p class="font-bold text-lg">{currentUser?.email || 'Keine E-Mail hinterlegt'}</p>
					</div>
					<div>
						<p class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Kürzel</p>
						<span class="inline-block bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 px-3 py-1 rounded-md font-bold uppercase tracking-wider shadow-sm">
							{currentUser?.shortsign || $store.settings.myShortsign}
						</span>
					</div>
					<div>
						<p class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Rolle</p>
						<p class="font-bold text-lg text-amber-600 dark:text-amber-400">
							{!currentUser?.teamLeader ? 'Teamleiter' : 'Teammitglied'}
						</p>
					</div>
				</div>
			</div>
		</section>

		<section>
			<h2 class="text-xl font-bold mb-4 flex items-center gap-2 text-slate-800 dark:text-slate-200">
				<Users size={20} class="text-purple-500" />
				Mein Team
			</h2>
			<p class="text-sm text-slate-500 dark:text-slate-400 mb-6">
				Die Mitarbeiter- und Rollenverwaltung erfolgt zentral durch die Administration.
			</p>
			
			<div class="space-y-3 mb-8">
				{#each sortedTeam as user}
					{@const isLeader = checkIsLeader(user.teamLeader)}
					<div class={`flex items-center justify-between p-4 rounded-xl border transition-colors ${currentUser?.id === user.id ? 'bg-blue-50/50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800/50' : 'bg-slate-50 dark:bg-slate-700/30 border-slate-100 dark:border-slate-600'}`}>
						<div class="flex items-center gap-4">
							<div class="relative">
								{#if isLeader}
									<div class="absolute -top-3 -right-2 text-amber-500 drop-shadow-sm rotate-12" title="Teamleiter">
										<Crown size={16} fill="currentColor" />
									</div>
								{/if}
								<span class={`border px-3 py-1.5 rounded text-sm font-bold uppercase tracking-wide shadow-sm ${isLeader ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'}`}>
									{user.shortsign || '?'}
								</span>
							</div>
							<div>
								<div class="font-bold text-lg dark:text-white flex items-center gap-2">
									{user.name || user.email?.split('@')[0] || 'Unbekannt'}
									{#if currentUser?.id === user.id}
										<span class="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-2 py-0.5 rounded-full uppercase tracking-wider">Du</span>
									{/if}
									{#if isLeader}
										<span class="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 px-2 py-0.5 rounded-full uppercase tracking-wider">Leader</span>
									{/if}
								</div>
								{#if user.email}
									<div class="text-sm text-slate-500 dark:text-slate-400">{user.email}</div>
								{/if}
							</div>
						</div>
					</div>
				{:else}
					<div class="text-center py-8 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
						Keine weiteren Team-Mitarbeiter gefunden.
					</div>
				{/each}
			</div>
		</section>

		<button onclick={() => store.logout()} class="mt-12 w-full flex items-center justify-center gap-2 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/20 py-3 rounded-lg font-bold hover:bg-red-600 hover:text-white transition-all shadow-sm">
			<LogOut size={18} />
			Abmelden
		</button>
	</div>
</div>