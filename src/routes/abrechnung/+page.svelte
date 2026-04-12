<script lang="ts">
	import { store } from '$lib/stores/tasks';
	import { pb } from '$lib/pocketbase';
	import { ArrowLeft, Banknote, CheckCircle2, Clock, CalendarDays, FileText } from 'lucide-svelte';
	import type { Task, Subtask } from '$lib/types';
	import { renderTitleWithTags } from '$lib/utils';

	$: myId = pb.authStore.model?.id || '';
	
	// Zeitlogik für "Heute"
	$: now = new Date();
	$: startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

	// Rekursive Hilfsfunktion: Findet alle Subtasks eines Baumes, die heute erledigt wurden
	function getTodayCompletedSubtasks(subtasks: Subtask[] | undefined): Subtask[] {
		if (!subtasks || !Array.isArray(subtasks)) return [];
		let completedToday: Subtask[] = [];
		
		for (const sub of subtasks) {
			if (sub.done && sub.completedAt) {
				const compTime = new Date(sub.completedAt).getTime();
				if (compTime >= startOfToday) {
					completedToday.push(sub);
				}
			}
			if (sub.subtasks && sub.subtasks.length > 0) {
				completedToday = [...completedToday, ...getTodayCompletedSubtasks(sub.subtasks)];
			}
		}
		return completedToday;
	}

	// Berechnet die abrechenbaren Posten reaktiv
	$: billableItems = $store.tasks.map(task => {
		// Für die Abrechnung interessieren uns primär unsere eigenen Tasks
		const isMine = task.owner === myId || (task.assignees && task.assignees.includes(myId));
		if (!isMine) return null;

		// FIX: Type Intersection für den Linter und Fallback-Kette für die Daten
		const safeTask = task as Task & { updated?: string; updatedAt?: string; createdAt?: string };
		const dateString = safeTask.updated || safeTask.updatedAt || safeTask.createdAt || new Date().toISOString();
		const taskUpdatedTime = new Date(dateString).getTime();

		const mainTaskDoneToday = task.status === 'DONE' && taskUpdatedTime >= startOfToday;
		const subsDoneToday = getTodayCompletedSubtasks(task.subtasks);

		// Wenn weder die Hauptkarte noch ein Subtask heute erledigt wurden, ignorieren
		if (!mainTaskDoneToday && subsDoneToday.length === 0) return null;

		return {
			task,
			mainTaskDoneToday,
			subsDoneToday
		};
	}).filter(Boolean) as { task: Task, mainTaskDoneToday: boolean, subsDoneToday: Subtask[] }[];

	$: totalBillableEvents = billableItems.reduce((acc, item) => acc + (item.mainTaskDoneToday ? 1 : 0) + item.subsDoneToday.length, 0);
	
	const todayString = new Intl.DateTimeFormat('de-CH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date());
</script>

<div class="h-screen overflow-hidden flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
	
	<div class="shrink-0 relative py-4 px-6 lg:px-8 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center shadow-sm z-10">
		<div class="flex items-center gap-4">
			<a href="/" class="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700">
				<ArrowLeft size={20} />
			</a>
			<div>
				<h1 class="text-xl font-bold tracking-tight flex items-center gap-2">
					<Banknote class="text-emerald-600" size={24}/> Tagesabrechnung
				</h1>
				<div class="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-1.5">
					<CalendarDays size={12}/> {todayString}
				</div>
			</div>
		</div>

		<div class="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-lg">
			<CheckCircle2 size={18} class="text-emerald-600 dark:text-emerald-500"/>
			<span class="text-sm font-bold text-emerald-800 dark:text-emerald-400">
				{totalBillableEvents} <span class="font-normal opacity-80">Aktionen heute</span>
			</span>
		</div>
	</div>

	<div class="flex-1 overflow-auto custom-scrollbar p-6 lg:p-8">
		<div class="max-w-4xl mx-auto space-y-6">
			
			{#if billableItems.length === 0}
				<div class="flex flex-col items-center justify-center py-20 text-slate-400">
					<Clock size={48} class="mb-4 opacity-20" />
					<p class="text-lg font-medium">Noch keine abrechenbaren Leistungen heute.</p>
					<p class="text-sm mt-1">Erledige Aufgaben oder Subtasks, damit sie hier erscheinen.</p>
				</div>
			{:else}
				{#each billableItems as item}
					<div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all hover:shadow-md">
						
						<div class="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-start justify-between gap-4">
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2 mb-1">
									{#if item.task.matterRef}
										<span class="text-[10px] font-bold px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded uppercase tracking-wider">
											{item.task.matterRef}
										</span>
									{/if}
									{#if item.mainTaskDoneToday}
										<span class="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded uppercase tracking-wider flex items-center gap-1">
											<CheckCircle2 size={10}/> Karte Abgeschlossen
										</span>
									{/if}
								</div>
								<h3 class="text-base font-bold text-slate-800 dark:text-slate-100 truncate">
									{item.task.title}
								</h3>
							</div>
						</div>

						{#if item.subsDoneToday.length > 0}
							<div class="p-4 bg-white dark:bg-slate-900">
								<div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
									<FileText size={12}/> Abgehakte Teilschritte
								</div>
								<div class="space-y-2">
									{#each item.subsDoneToday as sub}
										<div class="flex items-start gap-3 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/30">
											<div class="mt-0.5 text-emerald-500 shrink-0">
												<CheckCircle2 size={16} />
											</div>
											<div class="flex-1 min-w-0">
												<div class="text-sm font-medium text-slate-700 dark:text-slate-200 leading-snug">
													{@html renderTitleWithTags(sub.title, $store.settings.team)}
												</div>
												<div class="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
													<Clock size={10}/> {new Date(sub.completedAt || '').toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
												</div>
											</div>
										</div>
									{/each}
								</div>
							</div>
						{/if}

					</div>
				{/each}
			{/if}

		</div>
	</div>
</div>