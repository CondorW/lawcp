<script lang="ts">
	import { store } from '$lib/stores/tasks';
	import { resolve } from '$app/paths';
	import type { Subtask } from '$lib/types';
	import {
		ArrowLeft,
		Plus,
		Move,
		CornerDownRight,
		CheckCircle2,
		CheckSquare,
		Printer
	} from 'lucide-svelte';
	import { autosize } from '$lib/actions';

	let selectedTaskId: string | null = null;
	let container: HTMLDivElement;

	// --- Der lokale Drag-State für 60 FPS Performance ---
	let draggingSubId: string | null = null;
	let localDragX = 0;
	let localDragY = 0;
	let linkingSourceId: string | null = null;
	let mouseX = 0;
	let mouseY = 0;

	$: selectedTask = $store.tasks.find((t) => t.id === selectedTaskId);

	type FlatSubtask = Subtask & { level: number };

	function flattenSubtasks(subs: Subtask[] | undefined, level = 0): FlatSubtask[] {
		if (!subs) return [];
		return subs.reduce((acc: FlatSubtask[], sub) => {
			return [...acc, { ...sub, level }, ...flattenSubtasks(sub.subtasks, level + 1)];
		}, []);
	}

	// Die echte Wahrheit aus der Datenbank
	$: flattenedSubs = selectedTask ? flattenSubtasks(selectedTask.subtasks) : [];

	// Wir verschmelzen die Datenbank-Wahrheit in Echtzeit mit unserer lokalen Maus-Position
	$: renderSubs = flattenedSubs.map((sub) => {
		if (sub.id === draggingSubId) {
			return { ...sub, x: localDragX, y: localDragY };
		}
		return sub;
	});

	function autoCenterUnplaced(taskId: string) {
		if (!container) return;
		const task = $store.tasks.find((t) => t.id === taskId);
		if (!task) return;

		const subs = flattenSubtasks(task.subtasks);
		const unplaced = subs.filter((s) => !s.x && !s.y);

		if (unplaced.length > 0) {
			const rect = container.getBoundingClientRect();
			const cx = rect.width > 0 ? Math.round(rect.width / 2) - 110 : 400;
			const cy = rect.height > 0 ? Math.round(rect.height / 2) - 45 : 300;

			unplaced.forEach((sub, i) => {
				const nx = cx + ((i * 35) % 200);
				const ny = cy + ((i * 35) % 200);
				store.updateSubtaskPos(taskId, sub.id, nx, ny);
			});
		}
	}

	function getCurve(x1: number, y1: number, x2: number, y2: number) {
		const c1x = x1 + (x2 - x1) / 2;
		const c1y = y1;
		const c2x = x1 + (x2 - x1) / 2;
		const c2y = y2;
		return `M ${x1} ${y1} C ${c1x} ${c1y} ${c2x} ${c2y} ${x2} ${y2}`;
	}

	function addStep() {
		if (!selectedTaskId || !container) return;
		const rect = container.getBoundingClientRect();
		let x = Math.round(rect.width / 2 - 110);
		let y = Math.round(rect.height / 2 - 45);

		const stepCount = flattenedSubs.length;
		x += (stepCount * 25) % 150;
		y += (stepCount * 25) % 150;

		store.addSubtask(selectedTaskId, 'Neuer Schritt', 'GENERIC', x, y);
	}

	function onCanvasMouseMove(e: MouseEvent) {
		if (!container) return;
		const rect = container.getBoundingClientRect();
		mouseX = e.clientX - rect.left;
		mouseY = e.clientY - rect.top;

		if (draggingSubId && selectedTaskId) {
			localDragX = Math.round((mouseX - 110) / 20) * 20;
			localDragY = Math.round((mouseY - 20) / 20) * 20;
		}
	}

	function startDrag(e: MouseEvent, sub: FlatSubtask) {
		const target = e.target as HTMLElement;
		if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON')
			return;

		e.stopPropagation();
		draggingSubId = sub.id;
		localDragX = sub.x || 0;
		localDragY = sub.y || 0;
	}

	function handleMouseUp() {
		if (draggingSubId && selectedTaskId) {
			store.updateSubtaskPos(selectedTaskId, draggingSubId, localDragX, localDragY);
		}
		draggingSubId = null;
	}

	function startLink(e: MouseEvent, subId: string) {
		e.stopPropagation();
		linkingSourceId = subId;
	}

	function finishLink(e: MouseEvent, targetId: string) {
		e.stopPropagation();
		if (selectedTaskId && linkingSourceId && linkingSourceId !== targetId) {
			store.connectSubtasks(selectedTaskId, linkingSourceId, targetId);
			linkingSourceId = null;
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			draggingSubId = null;
			linkingSourceId = null;
		}
	}

	function printWorkflow() {
		window.print();
	}
</script>

<svelte:head>
	<style>
		@media print {
			@page {
				size: A4 landscape;
				margin: 10mm;
			}
		}
	</style>
</svelte:head>

<div
	class="flex min-h-screen overflow-hidden bg-slate-100 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100 print:bg-white print:text-black"
>
	<!-- SIDEBAR -->
	<div
		class="z-20 flex w-80 shrink-0 flex-col border-r border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 print:hidden"
	>
		<div
			class="flex items-center gap-3 border-b border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900"
		>
			<a
				href={resolve('/')}
				class="rounded-full p-2 transition-colors hover:bg-slate-200 dark:hover:bg-slate-800"
			>
				<ArrowLeft size={20} />
			</a>
			<h1 class="text-lg font-bold">Prozess Designer</h1>
		</div>
		<div class="custom-scrollbar flex-1 space-y-3 overflow-y-auto p-4">
			{#each $store.tasks as task (task.id)}
				<button
					onclick={() => {
						selectedTaskId = task.id;
						draggingSubId = null;
						linkingSourceId = null;
						setTimeout(() => autoCenterUnplaced(task.id), 10);
					}}
					class={`group w-full rounded-xl border p-3.5 text-left transition-all duration-200 outline-none ${selectedTaskId === task.id ? 'border-brand-500 bg-brand-50 shadow-sm ring-1 ring-brand-500 dark:bg-brand-900/20' : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:bg-slate-800'}`}
				>
					<div class="mb-1.5 flex items-center justify-between">
						<span
							class={`text-[11px] font-bold tracking-wider uppercase ${selectedTaskId === task.id ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 group-hover:text-brand-500'}`}
							>{task.matterRef || 'REF'}</span
						>
					</div>
					<!-- TYPOGRAPHY: text-sm (14px) -->
					<div
						class={`truncate text-sm font-bold ${selectedTaskId === task.id ? 'text-brand-900 dark:text-brand-100' : 'text-slate-700 dark:text-slate-300'}`}
					>
						{task.title}
					</div>
				</button>
			{/each}
		</div>
	</div>

	<!-- CANVAS -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
	<div
		role="application"
		class="relative flex-1 cursor-crosshair overflow-hidden bg-slate-50/50 dark:bg-slate-950 print:absolute print:inset-0 print:overflow-visible print:bg-transparent"
		bind:this={container}
		onmousemove={onCanvasMouseMove}
		onmouseup={handleMouseUp}
		onclick={() => {
			linkingSourceId = null;
		}}
		tabindex="0"
		onkeydown={handleKeyDown}
	>
		<div
			class="pointer-events-none absolute inset-0 opacity-5 dark:opacity-20 print:hidden"
			style="background-image: radial-gradient(#64748b 1px, transparent 1px); background-size: 20px 20px;"
		></div>

		{#if !selectedTask}
			<div
				class="absolute inset-0 flex flex-col items-center justify-center text-slate-400 print:hidden"
			>
				<p class="text-base font-medium">Wähle links eine Aufgabe aus.</p>
			</div>
		{:else}
			<!-- ACTION BUTTONS -->
			<div class="absolute top-6 left-6 z-30 flex gap-4 print:hidden">
				<!-- BRANDING: Royal brand (brand-600) -->
				<button
					onclick={(e) => {
						e.stopPropagation();
						addStep();
					}}
					class="flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-colors outline-none hover:bg-brand-700 focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
				>
					<Plus size={18} /> Schritt hinzufügen
				</button>
				<button
					onclick={(e) => {
						e.stopPropagation();
						printWorkflow();
					}}
					class="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-lg transition-colors outline-none hover:bg-slate-50 focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
					title="Diagramm drucken"
				>
					<Printer size={18} /> Drucken
				</button>

				<div
					class="flex items-center rounded-full border border-slate-200 bg-white/90 px-5 py-2.5 text-xs font-bold tracking-wide text-slate-500 uppercase shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-800/90"
				>
					Drag: Bewegen • Rechts: Start Link • Links: Ende Link
				</div>
			</div>

			<!-- PRINT HEADER -->
			<div class="absolute top-0 left-0 z-0 hidden p-8 print:block">
				<h1 class="mb-1 font-serif text-3xl font-bold">Workflow: {selectedTask.title}</h1>
				<p class="font-bold tracking-widest text-slate-500">
					{selectedTask.matterRef || 'KEINE REF'}
				</p>
			</div>

			<!-- SVG PATHS -->
			<svg
				class="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible print:h-[200vh] print:w-[200vw]"
			>
				<defs>
					<marker
						id="arrow"
						markerWidth="10"
						markerHeight="10"
						refX="6"
						refY="3"
						orient="auto"
						markerUnits="strokeWidth"
					>
						<path d="M0,0 L0,6 L9,3 z" fill="#94a3b8" class="print:fill-black" />
					</marker>
					<!-- BRANDING: Royal brand (#003DA5 -> brand-600) -->
					<marker
						id="arrow-active"
						markerWidth="10"
						markerHeight="10"
						refX="6"
						refY="3"
						orient="auto"
						markerUnits="strokeWidth"
					>
						<path d="M0,0 L0,6 L9,3 z" fill="#2563eb" />
					</marker>
				</defs>

				{#each renderSubs as source (source.id)}
					{#each source.next as targetId (targetId)}
						{@const target = renderSubs.find((s) => s.id === targetId)}
						{#if target}
							{@const pathData = getCurve(source.x + 220, source.y + 40, target.x, target.y + 40)}

							<!-- Hitbox for Hover/Delete -->
							<!-- BRANDING: Löschen (Hover) leuchtet Ruby Red (rose-500) -->
							<path
								role="button"
								tabindex="0"
								d={pathData}
								stroke="transparent"
								stroke-width="15"
								fill="none"
								class="pointer-events-auto cursor-pointer transition-colors hover:stroke-rose-500/30 focus:stroke-rose-500/30 focus:outline-none print:hidden"
								onclick={(e) => {
									e.stopPropagation();
									if (selectedTaskId) store.disconnectSubtasks(selectedTaskId, source.id, targetId);
								}}
								onkeydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										e.stopPropagation();
										if (selectedTaskId)
											store.disconnectSubtasks(selectedTaskId, source.id, targetId);
									}
								}}
							>
								<title>Klick oder Enter zum Löschen</title>
							</path>

							<!-- Visible Path -->
							<path
								d={pathData}
								stroke={source.done && target.done ? '#10b981' : '#cbd5e1'}
								class="print:stroke-slate-500"
								stroke-width="2"
								fill="none"
								marker-end="url(#arrow)"
							/>
						{/if}
					{/each}
				{/each}

				<!-- Active Linking Path -->
				{#if linkingSourceId}
					{@const src = renderSubs.find((s) => s.id === linkingSourceId)}
					{#if src}
						<!-- BRANDING: Royal brand (#003DA5 -> brand-600) -->
						<path
							d={getCurve(src.x + 220, src.y + 40, mouseX, mouseY)}
							stroke="#2563eb"
							stroke-width="2"
							stroke-dasharray="5,5"
							fill="none"
							marker-end="url(#arrow-active)"
						/>
					{/if}
				{/if}
			</svg>

			<!-- NODES (Karten) -->
			{#each renderSubs as sub (sub.id)}
				<div
					role="button"
					tabindex="0"
					class={`group absolute z-10 w-[220px] shadow-lg transition-colors duration-200 print:border-black print:shadow-none
                    ${linkingSourceId === sub.id ? 'border-brand-500 ring-4 ring-brand-500/20' : 'hover:border-brand-400'} 
                    ${sub.level > 0 ? 'rounded-tl-3xl rounded-tr-sm rounded-br-3xl rounded-bl-sm border-[2px] border-dashed' : 'rounded-xl border border-slate-200 dark:border-slate-700'}
                    ${sub.done ? 'border-emerald-500/50 bg-slate-50 opacity-80 grayscale-[0.2] dark:bg-slate-900 print:border-slate-300 print:bg-white' : 'bg-white dark:bg-slate-800 print:border-black'} `}
					style="left: {sub.x || 0}px; top: {sub.y || 0}px;"
					onmousedown={(e) => startDrag(e, sub)}
				>
					<!-- Header der Karte -->
					<div
						class={`flex cursor-move items-center justify-between border-b px-3 py-2 transition-colors print:border-black
                        ${sub.level > 0 ? 'rounded-tl-3xl rounded-tr-sm' : 'rounded-t-xl'} 
                        ${sub.done ? 'border-emerald-100 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-900/20 print:border-slate-300 print:bg-transparent' : 'border-slate-100 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50 print:border-black print:bg-transparent'} `}
					>
						<div class="flex items-center gap-1.5 pl-1">
							{#if sub.done}
								<CheckCircle2
									size={14}
									class="text-emerald-600 dark:text-emerald-500 print:text-slate-400"
								/>
							{:else if sub.level > 0}
								<CornerDownRight size={12} class="text-slate-400 print:text-black" />
							{/if}
							<!-- TYPOGRAPHY: text-[11px] -->
							<span
								class={`text-[11px] font-bold tracking-wider uppercase ${sub.done ? 'text-emerald-600 dark:text-emerald-500 print:text-slate-400' : 'text-slate-500 print:text-black'}`}
							>
								{sub.type === 'GENERIC' ? (sub.level > 0 ? 'Unterschritt' : 'Schritt') : sub.type}
							</span>
						</div>
						<div class="flex items-center gap-2 print:hidden">
							<button
								onclick={(e) => {
									e.stopPropagation();
									store.toggleSubtask(selectedTaskId!, sub.id);
								}}
								class="text-slate-300 transition-colors hover:text-emerald-500"
								title="Erledigt markieren"
							>
								<CheckSquare size={14} class={sub.done ? 'text-emerald-500' : ''} />
							</button>
							<Move size={14} class="text-slate-300" />
						</div>
					</div>

					<!-- Text-Area der Karte -->
					<div class="p-3">
						<!-- TYPOGRAPHY: text-sm (14px) -->
						<textarea
							use:autosize
							value={sub.title}
							onchange={(e) =>
								store.updateSubtaskTitle(selectedTaskId!, sub.id, e.currentTarget.value)}
							rows="1"
							spellcheck="false"
							class={`block min-h-[20px] w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-sm font-bold break-words whitespace-pre-wrap transition-colors focus:ring-0 ${sub.done ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-200 print:text-black'} `}
						></textarea>
					</div>

					<!-- Input Port (Ziel) -->
					<button
						class="absolute top-10 -left-3 z-20 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-2 border-slate-300 bg-slate-100 shadow-sm transition-all outline-none hover:scale-125 hover:border-emerald-500 focus:ring-2 focus:ring-emerald-500 dark:border-slate-500 dark:bg-slate-700 print:hidden"
						onclick={(e) => finishLink(e, sub.id)}
						title="Eingang (Ziel)"
					>
						<div class="h-1.5 w-1.5 rounded-full bg-slate-400"></div>
					</button>

					<!-- Output Port (Start) -->
					<button
						class={`absolute top-10 -right-3 z-20 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-2 shadow-sm transition-all outline-none hover:scale-125 focus:ring-2 focus:ring-brand-500 print:hidden
                        ${linkingSourceId === sub.id ? 'border-brand-600 bg-brand-600' : 'border-slate-300 bg-slate-100 hover:border-brand-500 dark:border-slate-500 dark:bg-slate-700'}`}
						onclick={(e) => startLink(e, sub.id)}
						title="Ausgang (Start)"
					>
						<div
							class={`h-1.5 w-1.5 rounded-full ${linkingSourceId === sub.id ? 'bg-white' : 'bg-slate-400'}`}
						></div>
					</button>
				</div>
			{/each}
		{/if}
	</div>
</div>
