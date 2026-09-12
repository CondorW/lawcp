<script lang="ts">
	import { store } from '$lib/stores/tasks';
	import type { Task } from '$lib/types';
	import { ArrowLeft, ChevronLeft, ChevronRight, Calendar, Plus, X } from 'lucide-svelte';
	import { fade, scale } from 'svelte/transition';
	import { resolve } from '$app/paths';

	let currentDate = new Date();
	let year = currentDate.getFullYear();
	let month = currentDate.getMonth();

	// Modal State
	let showModal = false;
	let newTaskTitle = '';
	let newTaskRef = '';
	let newTaskDate = '';

	// Drag & Drop State
	let draggingTaskId: string | null = null;
	let dragOverDate: string | null = null;

	const monthNames = [
		'Jänner',
		'Februar',
		'März',
		'April',
		'Mai',
		'Juni',
		'Juli',
		'August',
		'September',
		'Oktober',
		'November',
		'Dezember'
	];

	type CalendarCell =
		| { type: 'empty'; id: string; dateStr?: undefined; dayNum?: undefined; tasks?: undefined }
		| { type: 'day'; dayNum: number; dateStr: string; tasks: Task[]; id?: undefined };

	function nextMonth() {
		if (month === 11) {
			month = 0;
			year++;
		} else {
			month++;
		}
		currentDate = new Date(year, month, 1);
	}

	function prevMonth() {
		if (month === 0) {
			month = 11;
			year--;
		} else {
			month--;
		}
		currentDate = new Date(year, month, 1);
	}

	$: tasksByDate = $store.tasks.reduce(
		(acc, task) => {
			if (!task.dueDate) return acc;
			if (!acc[task.dueDate]) acc[task.dueDate] = [];
			acc[task.dueDate].push(task);
			return acc;
		},
		{} as Record<string, Task[]>
	);

	$: calendarDays = (() => {
		const daysInMonth = new Date(year, month + 1, 0).getDate();
		const startDayIndex = (new Date(year, month, 1).getDay() + 6) % 7;
		const days: CalendarCell[] = [];

		for (let i = 0; i < startDayIndex; i++) {
			days.push({ type: 'empty', id: `empty-${i}` });
		}

		for (let i = 1; i <= daysInMonth; i++) {
			const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
			const tasks = tasksByDate[dateStr] || [];
			days.push({ type: 'day', dayNum: i, dateStr, tasks });
		}

		return days;
	})();

	// --- Modal Logic ---
	function openAddModal(dateStr: string) {
		newTaskDate = dateStr;
		newTaskTitle = '';
		newTaskRef = '';
		showModal = true;
		setTimeout(() => document.getElementById('new-task-input')?.focus(), 50);
	}

	function closeModal() {
		showModal = false;
	}

	function saveTask() {
		if (!newTaskTitle.trim()) return;
		store.addTask('TODO', newTaskTitle, newTaskRef, newTaskDate);
		closeModal();
	}

	function handleModalKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') saveTask();
		if (e.key === 'Escape') closeModal();
	}

	function onDayKeyDown(e: KeyboardEvent, dateStr: string) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			openAddModal(dateStr);
		}
	}

	// --- Drag & Drop Logic ---
	function handleDragStart(e: DragEvent, taskId: string) {
		draggingTaskId = taskId;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', taskId);
			e.dataTransfer.setDragImage(e.target as Element, 0, 0);
		}
	}

	function handleDragOver(e: DragEvent, dateStr: string) {
		e.preventDefault();
		dragOverDate = dateStr;
	}

	function handleDrop(e: DragEvent, dateStr: string) {
		e.preventDefault();
		dragOverDate = null;
		const taskId = e.dataTransfer?.getData('text/plain');
		if (taskId && taskId === draggingTaskId) {
			store.updateDate(taskId, dateStr);
		}
		draggingTaskId = null;
	}
</script>

<!-- LAYOUT FIX: h-screen und overflow-hidden garantieren, dass die Seite niemals vertikal scrollt -->
<div
	class="flex h-screen flex-col overflow-hidden bg-slate-50 p-4 font-sans text-slate-900 lg:p-6 dark:bg-slate-950 dark:text-slate-100"
>
	<div class="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col">
		<!-- HEADER (Kompakter gemacht) -->
		<div class="mb-4 flex shrink-0 flex-col justify-between gap-4 sm:flex-row sm:items-center">
			<div class="flex items-center gap-4">
				<a
					href={resolve('/')}
					class="rounded-full p-2 transition-colors hover:bg-slate-200 dark:hover:bg-slate-800"
				>
					<ArrowLeft size={24} />
				</a>
				<!-- KONTRAST FIX: brand-600 im Light Mode, brand-400 im Dark Mode für perfekten Kontrast -->
				<h1
					class="flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white"
				>
					<Calendar size={28} class="text-brand-600 dark:text-brand-400" />
					{monthNames[month]} <span class="text-slate-400">{year}</span>
				</h1>
			</div>

			<div class="flex gap-2">
				<button
					onclick={prevMonth}
					class="rounded-lg border border-slate-300 bg-white p-2 shadow-sm transition-colors outline-none hover:bg-slate-50 focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800 dark:focus:ring-brand-400"
				>
					<ChevronLeft size={20} />
				</button>
				<button
					onclick={nextMonth}
					class="rounded-lg border border-slate-300 bg-white p-2 shadow-sm transition-colors outline-none hover:bg-slate-50 focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800 dark:focus:ring-brand-400"
				>
					<ChevronRight size={20} />
				</button>
			</div>
		</div>

		<!-- KALENDER BEREICH: Nimmt den restlichen Platz ein (flex-1) -->
		<div
			class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm select-none dark:border-slate-800 dark:bg-slate-900"
		>
			<!-- Wochentage (Kopfzeile) -->
			<div
				class="grid shrink-0 grid-cols-7 border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50"
			>
				{#each ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as dayName (dayName)}
					<div class="py-2.5 text-center text-xs font-bold tracking-wider text-slate-500 uppercase">
						{dayName}
					</div>
				{/each}
			</div>

			<!-- Kalender Grid: auto-rows-fr sorgt dafür, dass sich die Zellen den Platz perfekt aufteilen -->
			<div
				class="grid min-h-0 flex-1 auto-rows-fr grid-cols-7 gap-px bg-slate-200 dark:border-slate-800"
			>
				{#each calendarDays as cell (cell.type === 'day' ? cell.dateStr : cell.id)}
					{#if cell.type === 'empty'}
						<div class="bg-slate-50/50 dark:bg-slate-900/50"></div>
					{:else}
						<div
							class={`group relative flex min-h-0 cursor-pointer flex-col bg-white p-2 transition-all focus:ring-2 focus:ring-brand-500 focus:outline-none focus:ring-inset dark:bg-slate-900 dark:focus:ring-brand-400 ${dragOverDate === cell.dateStr ? 'bg-brand-50/50 ring-2 ring-brand-500 ring-inset dark:bg-brand-900/20 dark:ring-brand-400' : 'hover:bg-slate-50 dark:hover:bg-slate-800/80'}`}
							onclick={() => openAddModal(cell.dateStr!)}
							onkeydown={(e) => onDayKeyDown(e, cell.dateStr!)}
							ondragover={(e) => handleDragOver(e, cell.dateStr!)}
							ondrop={(e) => handleDrop(e, cell.dateStr!)}
							role="button"
							tabindex="0"
						>
							<div class="mb-1.5 flex shrink-0 items-start justify-between">
								<span
									class={`text-sm font-bold transition-colors ${dragOverDate === cell.dateStr ? 'scale-110 text-brand-600 dark:text-brand-400' : 'text-slate-400 group-hover:text-brand-600 dark:group-hover:text-brand-400'}`}
									>{cell.dayNum}</span
								>
								<div
									class="text-brand-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-brand-400"
								>
									<Plus size={16} />
								</div>
							</div>

							<!-- Tasks-Container scrollt in sich selbst, wenn nötig -->
							<div class="custom-scrollbar min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
								{#each cell.tasks as task (task.id)}
									<div
										class={`cursor-grab rounded-md border-l-[3px] border-slate-300 bg-slate-100 px-2 py-1.5 shadow-sm transition-all hover:border-brand-600 active:cursor-grabbing dark:border-slate-600 dark:bg-slate-800 dark:hover:border-brand-400 ${draggingTaskId === task.id ? 'scale-95 opacity-50' : ''}`}
										title={task.title}
										role="button"
										tabindex="0"
										draggable="true"
										ondragstart={(e) => handleDragStart(e, task.id)}
										onclick={(e) => e.stopPropagation()}
										onkeydown={(e) => e.stopPropagation()}
									>
										{#if task.matterRef}
											<span
												class="mb-0.5 inline-block max-w-full truncate rounded bg-slate-200 px-1 py-0.5 text-[10px] font-bold tracking-wider text-slate-600 uppercase dark:bg-slate-700 dark:text-slate-300"
											>
												{task.matterRef}
											</span>
										{/if}
										<div
											class="line-clamp-2 text-xs leading-tight font-medium text-slate-800 dark:text-slate-200"
										>
											{task.title}
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				{/each}
			</div>
		</div>
	</div>

	<!-- Modal-Bereich -->
	{#if showModal}
		<div
			class="fixed inset-0 z-[9999] flex items-center justify-center p-4"
			transition:fade={{ duration: 150 }}
		>
			<div
				class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
				onclick={closeModal}
				onkeydown={(e) => e.key === 'Escape' && closeModal()}
				role="button"
				tabindex="-1"
			></div>

			<div
				class="relative w-full max-w-lg space-y-6 rounded-xl border border-slate-200 bg-white p-8 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
				transition:scale={{ duration: 200, start: 0.95 }}
			>
				<div
					class="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800"
				>
					<h3 class="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-white">
						<Plus size={20} class="text-brand-600 dark:text-brand-400" /> Schnelleingabe
					</h3>
					<button
						onclick={closeModal}
						class="text-slate-400 outline-none hover:text-slate-600 dark:hover:text-slate-200"
					>
						<X size={24} />
					</button>
				</div>

				<div class="space-y-5">
					<div>
						<label
							class="mb-2 block text-xs font-bold text-slate-500 uppercase"
							for="new-task-input">Aufgabe</label
						>
						<input
							id="new-task-input"
							type="text"
							bind:value={newTaskTitle}
							placeholder="Was ist zu tun?"
							class="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-brand-400"
							onkeydown={handleModalKeydown}
						/>
					</div>

					<div class="grid grid-cols-2 gap-5">
						<div>
							<label
								class="mb-2 block text-xs font-bold text-slate-500 uppercase"
								for="new-task-date">Frist (Intern)</label
							>
							<input
								id="new-task-date"
								type="date"
								bind:value={newTaskDate}
								class="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:[color-scheme:dark] dark:focus:ring-brand-400"
							/>
						</div>
						<div>
							<label
								class="mb-2 block text-xs font-bold text-slate-500 uppercase"
								for="new-task-ref">Aktenzeichen / Ref.</label
							>
							<input
								id="new-task-ref"
								type="text"
								bind:value={newTaskRef}
								placeholder="Optional"
								class="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 uppercase shadow-sm outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-brand-400"
								onkeydown={handleModalKeydown}
							/>
						</div>
					</div>
				</div>

				<div class="flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
					<button
						onclick={closeModal}
						class="rounded-lg bg-slate-100 px-5 py-2.5 text-sm font-bold text-slate-600 transition-colors outline-none hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
					>
						Abbrechen
					</button>
					<button
						onclick={saveTask}
						disabled={!newTaskTitle.trim()}
						class="flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-colors outline-none hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<Plus size={18} /> Speichern
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
