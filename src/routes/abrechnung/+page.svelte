<script lang="ts">
	import { store } from '$lib/stores/tasks';
	import { pb } from '$lib/pocketbase';
	import { ArrowLeft, Banknote, Clock, FileDown, Briefcase, Plus, X, Pencil, Trash2, CheckSquare, Users, User } from 'lucide-svelte';
	import type { Task, TimeLog, Subtask } from '$lib/types';
	import { fade, scale } from 'svelte/transition';
	import { renderTitleWithTags } from '$lib/utils';

	// === AUTH & TEAM ===
	let myId = $derived(pb.authStore.model?.id || '');
	let isTeamLeader = $derived(!pb.authStore.model?.teamLeader);
	
	function getLeaderId(userField: any): string | null {
		if (!userField) return null;
		if (Array.isArray(userField)) return userField.length > 0 ? userField[0] : null;
		if (typeof userField === 'string' && userField.trim() !== '') return userField;
		return null;
	}
	let myTeamMemberIds = $derived($store.firmUsers.filter(u => getLeaderId(u.teamLeader) === myId).map(u => u.id));

	// === VIEW STATES ===
	let filterMode = $state('TODAY');
	let viewMode = $state<'ME' | 'TEAM'>('ME');

	function isDateInRange(dateStr: string, mode: string): boolean {
		if (mode === 'ALL') return true;
		const date = new Date(dateStr);
		const now = new Date();
		const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
		
		if (mode === 'TODAY') return date.getTime() >= startOfToday;
		if (mode === 'WEEK') return date.getTime() >= startOfToday - (7 * 24 * 60 * 60 * 1000);
		if (mode === 'MONTH') return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
		return true;
	}

	type EnrichedTimeLog = TimeLog & { taskId: string, taskTitle: string, matterRef: string, userSign: string };

	function getUserSign(userId: string) {
		const user = $store.firmUsers.find(u => u.id === userId);
		return user?.shortsign || 'Unbekannt';
	}

	let aggregatedLogs = $derived($store.tasks.reduce((acc: EnrichedTimeLog[], task: Task) => {
		if (!task.timeLogs || !Array.isArray(task.timeLogs)) return acc;
		
		const relevantLogsForTask = task.timeLogs.filter(log => {
			if (!isDateInRange(log.date, filterMode)) return false;
			if (viewMode === 'ME') return log.userId === myId;
			if (viewMode === 'TEAM') return myTeamMemberIds.includes(log.userId);
			return false;
		});

		const enriched = relevantLogsForTask.map(log => ({
			...log,
			taskId: task.id,
			taskTitle: task.title,
			matterRef: task.matterRef || 'NO-REF',
			userSign: getUserSign(log.userId)
		}));
		return [...acc, ...enriched];
	}, []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

	let totalMinutes = $derived(aggregatedLogs.reduce((sum, log) => sum + log.minutes, 0));
	let totalHours = $derived((totalMinutes / 60).toFixed(1));

	// --- Manual Log Modal State ---
	let showManualLog = $state(false);
	let editLogId = $state('');
	let logTaskId = $state('');
	let logDate = $state(new Date().toISOString().split('T')[0]);
	let logMinutes = $state(15);
	let logNote = $state('');

	let myTasksForDropdown = $derived($store.tasks.filter(t => !t.archived && (t.owner === myId || t.assignees?.includes(myId))));

	function getTodayCompletedSubtasks(subtasks: Subtask[] | undefined): Subtask[] {
		if (!subtasks || !Array.isArray(subtasks)) return [];
		let completedToday: Subtask[] = [];
		const startOfToday = new Date(new Date().setHours(0,0,0,0)).getTime();
		
		for (const sub of subtasks) {
			// FIX: Typ-Sicherheit 'as string' erzwingt, dass TypeScript das als validen Date-Parameter akzeptiert
			if (sub.done && sub.completedAt && new Date(sub.completedAt as string).getTime() >= startOfToday) {
				completedToday.push(sub);
			}
			if (sub.subtasks && sub.subtasks.length > 0) {
				completedToday = [...completedToday, ...getTodayCompletedSubtasks(sub.subtasks)];
			}
		}
		return completedToday;
	}

	type GroupedCompletedTasks = { taskId: string; taskTitle: string; matterRef: string; latestTime: number; subtasks: Subtask[]; };
	
	let groupedTodayTasks = $derived($store.tasks.reduce((acc: GroupedCompletedTasks[], task: Task) => {
		
		// KUGELSICHERE VERSION: Fängt undefined, null und fehlerhafte Arrays sauber ab
		const isRelevantTask = viewMode === 'TEAM' 
			? ((task.owner && myTeamMemberIds.includes(task.owner)) || (Array.isArray(task.assignees) && task.assignees.some(a => myTeamMemberIds.includes(a))))
			: (task.owner === myId || (Array.isArray(task.assignees) && task.assignees.includes(myId)));

		if (!isRelevantTask) return acc;

		const subsDone = getTodayCompletedSubtasks(task.subtasks);
		
		if (subsDone.length > 0) {
			subsDone.sort((a, b) => {
				const timeA = a.completedAt ? new Date(a.completedAt as string).getTime() : 0;
				const timeB = b.completedAt ? new Date(b.completedAt as string).getTime() : 0;
				return timeB - timeA;
			});
			acc.push({
				taskId: task.id,
				taskTitle: task.title,
				matterRef: task.matterRef || 'NO-REF',
				latestTime: subsDone[0].completedAt ? new Date(subsDone[0].completedAt as string).getTime() : 0,
				subtasks: subsDone
			});
		}
		return acc;
	}, []).sort((a, b) => b.latestTime - a.latestTime));

	let selectedTask = $derived($store.tasks.find(t => t.id === logTaskId));
	
	let recommendedNotes = $derived((() => {
		if (!selectedTask) return [];
		let recs: string[] = [];
		const startOfToday = new Date(new Date().setHours(0,0,0,0)).getTime();
		
		const safeTask = selectedTask as Task & { updated?: string };
		const dateString: string = safeTask.updated ?? selectedTask.createdAt ?? new Date().toISOString();
		
		if (selectedTask.status === 'DONE' && new Date(dateString).getTime() >= startOfToday) {
			recs.push(`Abschluss: ${selectedTask.title}`);
		}
		
		const subsDone = getTodayCompletedSubtasks(selectedTask.subtasks);
		subsDone.forEach(sub => recs.push(sub.title));
		return recs;
	})());

	function appendToNote(text: string) {
		const cleanText = text.replace(/<[^>]*>?/gm, '');
		if (logNote) {
			logNote += `\n- ${cleanText}`;
		} else {
			logNote = `- ${cleanText}`;
		}
	}

	function openCreateModal() {
		editLogId = '';
		logTaskId = '';
		logMinutes = 15;
		logNote = '';
		logDate = new Date().toISOString().split('T')[0];
		showManualLog = true;
	}

	function openEditModal(log: EnrichedTimeLog) {
		const id = log.id;
		if (!id) return; // FIX: Strict Null-Check 
		editLogId = id;
		logTaskId = log.taskId;
		logMinutes = log.minutes;
		logNote = log.note || '';
		logDate = new Date(log.date).toISOString().split('T')[0]; 
		showManualLog = true;
	}

	function saveManualLog() {
		if (!logTaskId || logMinutes <= 0) return;
		
		const now = new Date();
		const dateObj = new Date(logDate);
		dateObj.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
		const fullIsoDateString = dateObj.toISOString();

		if (editLogId) {
			store.updateTimeLog(logTaskId, editLogId, logMinutes, logNote.trim(), fullIsoDateString);
		} else {
			store.addTimeLog(logTaskId, logMinutes, logNote.trim(), fullIsoDateString);
		}
		showManualLog = false;
	}

	function deleteLog(log: EnrichedTimeLog) {
		const id = log.id;
		if (!id) return; // FIX: Strict Null-Check für Linter 
		if(confirm('Möchtest du diese Buchung wirklich löschen?')) {
			store.deleteTimeLog(log.taskId, id);
		}
	}

	function exportToCSV() {
		if (aggregatedLogs.length === 0) return;
		
		const headers = ['Datum', 'Zeit', 'Dauer (Minuten)', 'Mitarbeiter', 'Aktenzeichen', 'Aufgabe', 'Bemerkung'];
		
		const rows = aggregatedLogs.map(log => {
			const d = new Date(log.date);
			return [
				d.toLocaleDateString('de-DE'),
				d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
				log.minutes,
				`"${log.userSign}"`,
				`"${log.matterRef}"`,
				`"${log.taskTitle.replace(/"/g, '""')}"`,
				`"${(log.note || '').replace(/"/g, '""')}"`
			].join(';');
		});

		const csvContent = ["sep=;", headers.join(';'), ...rows].join('\n');
		const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.setAttribute('href', url);
		link.setAttribute('download', `Zeiterfassung_${viewMode}_${filterMode}_${new Date().toISOString().split('T')[0]}.csv`);
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}
</script>

<div class="h-screen overflow-hidden flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
	<div class="shrink-0 relative py-4 px-6 lg:px-8 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap gap-4 justify-between items-center shadow-sm z-10">
		<div class="flex items-center gap-4">
			<a href="/" class="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700">
				<ArrowLeft size={24} />
			</a>
			<div>
				<h1 class="text-xl font-bold tracking-tight flex items-center gap-2">
					<Clock class="text-brand-600" size={24}/> Zeiterfassung
				</h1>
			</div>
		</div>

		<div class="flex items-center gap-4 flex-wrap">
			{#if isTeamLeader && myTeamMemberIds.length > 0}
				<div class="hidden md:flex bg-brand-50 dark:bg-slate-800 p-1.5 rounded-lg border border-brand-200 dark:border-slate-700">
					<button onclick={() => viewMode = 'ME'} class="px-4 py-1.5 text-sm font-bold rounded-md transition-colors flex items-center gap-2 {viewMode === 'ME' ? 'bg-white dark:bg-slate-600 shadow-sm text-brand-700 dark:text-white' : 'text-slate-500 hover:text-brand-600 dark:hover:text-slate-300'}">
						<User size={16} /> Meine
					</button>
					<button onclick={() => viewMode = 'TEAM'} class="px-4 py-1.5 text-sm font-bold rounded-md transition-colors flex items-center gap-2 {viewMode === 'TEAM' ? 'bg-white dark:bg-slate-600 shadow-sm text-brand-700 dark:text-white' : 'text-slate-500 hover:text-brand-600 dark:hover:text-slate-300'}">
						<Users size={16} /> Team
					</button>
				</div>
			{/if}

			<div class="hidden md:flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
				<button onclick={() => filterMode = 'TODAY'} class="px-4 py-1.5 text-sm font-bold rounded-md transition-colors {filterMode === 'TODAY' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}">Heute</button>
				<button onclick={() => filterMode = 'WEEK'} class="px-4 py-1.5 text-sm font-bold rounded-md transition-colors {filterMode === 'WEEK' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}">7 Tage</button>
				<button onclick={() => filterMode = 'MONTH'} class="px-4 py-1.5 text-sm font-bold rounded-md transition-colors {filterMode === 'MONTH' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}">Monat</button>
				<button onclick={() => filterMode = 'ALL'} class="px-4 py-1.5 text-sm font-bold rounded-md transition-colors {filterMode === 'ALL' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}">Alle</button>
			</div>

			<button onclick={openCreateModal} class="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-lg font-bold text-sm shadow-sm transition-colors" title="Zeit buchen">
				<Plus size={18} /> Buchen
			</button>
			<button onclick={exportToCSV} class="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-bold text-sm shadow-sm transition-colors" title="Als CSV exportieren">
				<FileDown size={18} /> Export
			</button>
		</div>
	</div>

	<div class="flex-1 overflow-auto custom-scrollbar p-6 lg:p-8">
		<div class="max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-8">
			<div class="flex-1 min-w-0">
				<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
					<div class="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
						<div>
							<div class="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1.5">Gefilterte Zeit {viewMode === 'TEAM' ? '(Team)' : ''}</div>
							<div class="text-4xl font-bold text-slate-800 dark:text-white">{totalHours} <span class="text-xl font-medium text-slate-500">Stunden</span></div>
						</div>
						<div class="p-4 bg-brand-50 dark:bg-brand-900/20 text-brand-600 rounded-full">
							<Clock size={32} />
						</div>
					</div>
					<div class="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
						<div>
							<div class="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1.5">Erfasste Einträge {viewMode === 'TEAM' ? '(Team)' : ''}</div>
							<div class="text-4xl font-bold text-slate-800 dark:text-white">{aggregatedLogs.length}</div>
						</div>
						<div class="p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-full">
							<Banknote size={32} />
						</div>
					</div>
				</div>

				{#if aggregatedLogs.length === 0}
					<div class="flex flex-col items-center justify-center py-24 text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 border-dashed">
						<Briefcase size={56} class="mb-5 opacity-20" />
						<p class="text-xl font-medium">Keine Einträge in diesem Zeitraum gefunden.</p>
						<p class="text-base mt-2">Buche Zeiten über den Button oben rechts.</p>
					</div>
				{:else}
					<div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
						<div class="overflow-x-auto">
							<table class="w-full text-left text-sm whitespace-nowrap">
								<thead class="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
									<tr>
										<th class="px-6 py-4 font-bold uppercase tracking-wider text-xs">Datum</th>
										<th class="px-6 py-4 font-bold uppercase tracking-wider text-xs">Dauer</th>
										{#if viewMode === 'TEAM'}
											<th class="px-6 py-4 font-bold uppercase tracking-wider text-xs">Mitarbeiter</th>
										{/if}
										<th class="px-6 py-4 font-bold uppercase tracking-wider text-xs">REF</th>
										<th class="px-6 py-4 font-bold uppercase tracking-wider text-xs w-full">Task / Tätigkeit</th>
										<th class="px-6 py-4 font-bold uppercase tracking-wider text-xs text-right">Aktion</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-slate-100 dark:divide-slate-800">
									{#each aggregatedLogs as log}
										<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
											<td class="px-6 py-4 align-top">
												<div class="font-medium text-sm text-slate-900 dark:text-white mb-0.5">{new Date(log.date).toLocaleDateString('de-DE')}</div>
												<div class="text-xs text-slate-500">{new Date(log.date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</div>
											</td>
											<td class="px-6 py-4 align-top">
												<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 font-bold text-sm border border-brand-100 dark:border-brand-800/50">
													<Clock size={14} /> {log.minutes}m
												</span>
											</td>
											{#if viewMode === 'TEAM'}
												<td class="px-6 py-4 align-top">
													<span class="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">{log.userSign}</span>
												</td>
											{/if}
											<td class="px-6 py-4 align-top">
												<span class="text-[11px] font-bold px-2 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded uppercase tracking-wider">
													{log.matterRef}
												</span>
											</td>
											<td class="px-6 py-4 whitespace-normal">
												<div class="font-bold text-sm text-slate-900 dark:text-white mb-1">{log.taskTitle}</div>
												{#if log.note}
													<div class="text-sm text-slate-600 dark:text-slate-400 italic leading-relaxed">"{log.note}"</div>
												{/if}
											</td>
											<td class="px-6 py-4 align-top text-right">
												<div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
													{#if log.userId === myId}
														<button onclick={() => openEditModal(log)} class="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-md transition-colors" title="Bearbeiten">
															<Pencil size={16} />
														</button>
														<button onclick={() => deleteLog(log)} class="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-md transition-colors" title="Löschen">
															<Trash2 size={16} />
														</button>
													{/if}
												</div>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				{/if}
			</div>

			<aside class="w-full lg:w-[480px] shrink-0 flex flex-col gap-6">
				<div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sticky top-0">
					<h3 class="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
						<CheckSquare size={20} class="text-emerald-500" />
						Heute erledigt {viewMode === 'TEAM' ? 'im Team' : ''}
					</h3>
					
					{#if groupedTodayTasks.length === 0}
						<div class="text-center py-8">
							<p class="text-sm text-slate-400 italic">Noch keine Teilschritte heute abgehakt.</p>
						</div>
					{:else}
						<div class="space-y-8 max-h-[calc(100vh-250px)] overflow-y-auto custom-scrollbar pr-4">
							{#each groupedTodayTasks as group}
								<div class="relative pl-5 border-l-[3px] border-emerald-200 dark:border-emerald-800/50">
									{#if group.matterRef !== 'NO-REF'}
										<div class="mb-2">
											<span class="text-[11px] font-bold px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded uppercase tracking-wider">
												{group.matterRef}
											</span>
										</div>
									{/if}
									<div class="text-sm font-bold text-slate-800 dark:text-slate-200 leading-snug mb-3 line-clamp-3">
										{group.taskTitle}
									</div>
									<div class="space-y-3">
										{#each group.subtasks as sub}
											<div class="flex items-start gap-2.5">
												<span class="text-emerald-500 text-base mt-[-1px] shrink-0">↳</span>
												<div class="min-w-0">
													{#if sub.completedAt}
														<span class="text-xs font-bold text-slate-400 block mb-1">
															{new Date(sub.completedAt as string).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
														</span>
													{/if}
													<p class="text-sm font-medium text-slate-700 dark:text-slate-300 leading-snug break-words">
														{@html renderTitleWithTags(sub.title, $store.settings.team)}
													</p>
												</div>
											</div>
										{/each}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</aside>
		</div>
	</div>
</div>

{#if showManualLog}
	<div class="fixed inset-0 z-[9999] flex items-center justify-center p-4" role="dialog" aria-modal="true" transition:fade={{ duration: 150 }}>
		<div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onclick={(e) => { e.stopPropagation(); showManualLog = false; }} onkeydown={(e) => e.key === 'Escape' && (showManualLog = false)} role="button" tabindex="-1"></div>
		<div class="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg p-8 space-y-6" transition:scale={{ duration: 200, start: 0.95 }}>
			<div class="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
				<h3 class="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
					{#if editLogId}
						<Pencil size={20} class="text-brand-600" /> Zeit bearbeiten
					{:else}
						<Plus size={20} class="text-brand-600" /> Zeit buchen
					{/if}
				</h3>
				<button onclick={() => showManualLog = false} class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 outline-none"><X size={24}/></button>
			</div>
			<div class="space-y-5">
				<div>
					<label for="taskSelect" class="text-xs font-bold text-slate-500 uppercase mb-2 block">Für welche Aufgabe?</label>
					<select id="taskSelect" bind:value={logTaskId} disabled={!!editLogId} class="w-full rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-slate-900 dark:text-white p-3 focus:ring-2 focus:ring-brand-500 outline-none text-sm disabled:opacity-50">
						<option value="" disabled selected>Bitte wählen...</option>
						{#each myTasksForDropdown as t}
							<option value={t.id}>[{t.matterRef || 'NO-REF'}] {t.title}</option>
						{/each}
					</select>
				</div>
				
				<div class="grid grid-cols-2 gap-5">
					<div>
						<label for="logDateInput" class="text-xs font-bold text-slate-500 uppercase mb-2 block">Datum</label>
						<input id="logDateInput" type="date" bind:value={logDate} class="w-full rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-slate-900 dark:text-white p-3 focus:ring-2 focus:ring-brand-500 dark:[color-scheme:dark] outline-none text-sm" />
					</div>
					<div>
						<label for="logMinutesInput" class="text-xs font-bold text-slate-500 uppercase mb-2 block">Dauer (Minuten)</label>
						<input id="logMinutesInput" type="number" bind:value={logMinutes} min="1" class="w-full rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-slate-900 dark:text-white p-3 focus:ring-2 focus:ring-brand-500 outline-none text-sm" />
					</div>
				</div>
				
				<div class="flex gap-3">
					<button onclick={() => logMinutes = 15} class="flex-1 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-bold transition-colors">+15m</button>
					<button onclick={() => logMinutes = 30} class="flex-1 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-bold transition-colors">+30m</button>
					<button onclick={() => logMinutes = 60} class="flex-1 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-bold transition-colors">+1h</button>
				</div>
				
				<div>
					<label for="logNoteInput" class="text-xs font-bold text-slate-500 uppercase mb-2 block">Tätigkeit / Bemerkung</label>
					<textarea id="logNoteInput" bind:value={logNote} rows="3" class="w-full rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-slate-900 dark:text-white p-3 focus:ring-2 focus:ring-brand-500 outline-none resize-none text-sm leading-relaxed" placeholder="Was wurde gemacht?"></textarea>
					
					{#if recommendedNotes.length > 0 && !editLogId}
						<div class="mt-4">
							<span class="text-xs font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-wider block mb-2">Ausgeführte Teilschritte:</span>
							<div class="flex flex-wrap gap-2">
								{#each recommendedNotes as rec}
									<button type="button" onclick={() => appendToNote(rec)} class="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 rounded-lg text-xs font-medium transition-colors text-left max-w-full truncate">
										+ {@html rec}
									</button>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			</div>
			<div class="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
				<button onclick={() => showManualLog = false} class="px-5 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors outline-none bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg">Abbrechen</button>
				<button onclick={saveManualLog} disabled={!logTaskId || logMinutes <= 0} class="px-6 py-2.5 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors outline-none">Speichern</button>
			</div>
		</div>
	</div>
{/if}