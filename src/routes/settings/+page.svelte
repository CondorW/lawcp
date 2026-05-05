<script lang="ts">
	import { store } from '$lib/stores/tasks';
	import { pb } from '$lib/pocketbase';
	import { ArrowLeft, Moon, Sun, LogOut, User, Users, Crown } from 'lucide-svelte';

	$: currentUser = pb.authStore.model;

	// FIX: Robuste Helfer-Funktion, die sowohl Arrays als auch Strings aus PocketBase sicher handhabt
	function getLeaderId(userField: any): string | null {
		if (!userField) return null;
		if (Array.isArray(userField)) return userField.length > 0 ? userField[0] : null;
		if (typeof userField === 'string' && userField.trim() !== '') return userField;
		return null;
	}

	// FIX: Strikte Team-Isolation
	$: myTeamMembers = $store.firmUsers.filter(u => {
		if (!currentUser) return false;
		
		// 1. Man sieht sich immer selbst
		if (u.id === currentUser.id) return true;

		const myLeaderId = getLeaderId(currentUser.teamLeader);
		const theirLeaderId = getLeaderId(u.teamLeader);

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
		const aIsLeader = !getLeaderId(a.teamLeader);
		const bIsLeader = !getLeaderId(b.teamLeader);
		if (aIsLeader && !bIsLeader) return -1;
		if (!aIsLeader && bIsLeader) return 1;
		return (a.shortsign || '').localeCompare(b.shortsign || '');
	});
</script>

<div class="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-6 lg:p-8 font-sans transition-colors">
	
	<div class="max-w-3xl mx-auto bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 lg:p-10">
		
		<!-- HEADER -->
		<div class="flex items-center justify-between mb-10 pb-6 border-b border-slate-100 dark:border-slate-800">
			<div class="flex items-center gap-4">
				<a href="/" class="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 transition-colors">
					<ArrowLeft size={24} />
				</a>
				<h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Einstellungen</h1>
			</div>
			
			<button 
				onclick={() => store.toggleDarkMode()} 
				class="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-bold text-sm shadow-sm outline-none focus:ring-2 focus:ring-brand-500"
			>
				{#if $store.settings.darkMode}
					<Sun size={18} class="text-yellow-500 dark:text-yellow-400"/> <span>Light Mode</span>
				{:else}
					<Moon size={18} class="text-brand-600 dark:text-brand-400"/> <span>Dark Mode</span>
				{/if}
			</button>
		</div>

		<!-- MEIN PROFIL -->
		<section class="mb-12">
			<h2 class="text-lg font-bold mb-5 flex items-center gap-2 text-slate-800 dark:text-slate-200">
				<User size={20} class="text-brand-600 dark:text-brand-400" /> Mein Profil
			</h2>
			
			<div class="bg-slate-50/50 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-8">
					<div>
						<p class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Name</p>
						<p class="font-bold text-base text-slate-900 dark:text-white">{currentUser?.name || 'Unbekannt'}</p>
					</div>
					<div>
						<p class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">E-Mail</p>
						<p class="font-bold text-base text-slate-900 dark:text-white">{currentUser?.email || 'Keine E-Mail hinterlegt'}</p>
					</div>
					<div>
						<p class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Kürzel</p>
						<span class="inline-block bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 px-3 py-1 rounded-md text-sm font-bold uppercase tracking-wider shadow-sm text-slate-800 dark:text-slate-200">
							{currentUser?.shortsign || $store.settings.myShortsign}
						</span>
					</div>
					<div>
						<p class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Rolle</p>
						<p class="font-bold text-base text-yellow-600 dark:text-yellow-500">
							{!getLeaderId(currentUser?.teamLeader) ? 'Teamleiter' : 'Teammitglied'}
						</p>
					</div>
				</div>
			</div>
		</section>

		<!-- MEIN TEAM -->
		<section>
			<h2 class="text-lg font-bold mb-3 flex items-center gap-2 text-slate-800 dark:text-slate-200">
				<Users size={20} class="text-brand-600 dark:text-brand-400" /> Mein Team
			</h2>
			<p class="text-sm text-slate-500 dark:text-slate-400 mb-6">
				Hier siehst du ausschließlich Mitglieder deines direkten Teams. Rollenverwaltung erfolgt zentral durch die Administration.
			</p>
			
			<div class="space-y-3 mb-10">
				{#each sortedTeam as user}
					{@const isLeader = !getLeaderId(user.teamLeader)}
					<div class={`flex items-center justify-between p-4 rounded-xl border transition-colors ${currentUser?.id === user.id ? 'bg-brand-50/50 border-brand-200 dark:bg-brand-900/20 dark:border-brand-800/50' : 'bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'}`}>
						
						<div class="flex items-center gap-4">
							<div class="relative">
								{#if isLeader}
									<!-- BRANDING: Gold für die Krone -->
									<div class="absolute -top-3 -right-2 text-yellow-500 drop-shadow-sm rotate-12" title="Teamleiter">
										<Crown size={18} fill="currentColor" />
									</div>
								{/if}
								<span class={`border px-3.5 py-2 rounded-lg text-sm font-bold uppercase tracking-wide shadow-sm ${isLeader ? 'bg-yellow-50 border-yellow-300 text-yellow-700 dark:bg-yellow-900/30 dark:border-yellow-700 dark:text-yellow-400' : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300'}`}>
									{user.shortsign || '?'}
								</span>
							</div>
							
							<div>
								<div class="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2.5">
									{user.name || user.email?.split('@')[0] || 'Unbekannt'}
									
									{#if currentUser?.id === user.id}
										<!-- BRANDING: Royal brand für 'Du' -->
										<span class="text-[10px] bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-400 px-2 py-0.5 rounded uppercase tracking-wider font-bold">Du</span>
									{/if}
									
									{#if isLeader}
										<!-- BRANDING: Gold für Leader-Tag -->
										<span class="text-[10px] bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400 px-2 py-0.5 rounded uppercase tracking-wider font-bold">Leader</span>
									{/if}
								</div>
								
								{#if user.email}
									<div class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{user.email}</div>
								{/if}
							</div>
						</div>
					</div>
				{:else}
					<div class="text-center py-10 text-slate-400 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl font-medium">
						Keine weiteren Team-Mitarbeiter gefunden.
					</div>
				{/each}
			</div>
		</section>

		<!-- LOGOUT -->
		<div class="pt-6 border-t border-slate-100 dark:border-slate-800">
			<!-- BRANDING: Ruby Red (rose-600) für destruktive Aktionen -->
			<button 
				onclick={() => store.logout()} 
				class="w-full flex items-center justify-center gap-2 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 py-3.5 rounded-lg font-bold text-sm hover:bg-rose-600 hover:text-white dark:hover:bg-rose-500 transition-all shadow-sm outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-1"
			>
				<LogOut size={18} /> Abmelden
			</button>
		</div>

	</div>
</div>