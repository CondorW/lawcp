<script lang="ts">
	import { taskStore, type Task } from '$lib/stores/tasks';
	import { Briefcase, Calendar, Plus, Save, Trash2, History, CheckSquare, Square } from 'lucide-svelte';
	import { clsx } from 'clsx';
    import { twMerge } from 'tailwind-merge';

	let inputTitle = '';
	let inputRef = '';
	let inputDate = new Date().toISOString().split('T')[0];
    let showSnapshots = false;

	function handleAdd() {
		if (!inputTitle) return;
		taskStore.addTask(inputTitle, inputRef, inputDate);
		inputTitle = '';
		inputRef = '';
	}

    // Subtask Handler
    function handleAddSubtask(e: Event, taskId: string) {
        const input = e.target as HTMLInputElement;
        if (e instanceof KeyboardEvent && e.key !== 'Enter') return;
        if (!input.value.trim()) return;
        
        taskStore.addSubtask(taskId, input.value);
        input.value = '';
    }

    const byDate = (a: Task, b: Task) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();

	$: todos = $taskStore.filter((t) => t.status === 'TODO').sort(byDate);
	$: waiting = $taskStore.filter((t) => t.status === 'WAITING').sort(byDate);
	$: review = $taskStore.filter((t) => t.status === 'REVIEW').sort(byDate);
	$: done = $taskStore.filter((t) => t.status === 'DONE').sort(byDate);
    
    // --- DRAG AND DROP ---
    let draggedId: string | null = null;

    function handleDragStart(e: DragEvent, id: string) {
        draggedId = id;
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', id);
        }
    }

    function handleDrop(e: DragEvent, newStatus: Task['status']) {
        e.preventDefault();
        if (draggedId) {
            taskStore.moveTask(draggedId, newStatus);
            draggedId = null;
        }
    }

    function handleDragOver(e: DragEvent) {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    }

    // --- UTILS ---
    function getPriorityColor(p: string) {
        if (p === 'HIGH') return 'text-red-600 bg-red-50 border-red-100';
        if (p === 'MEDIUM') return 'text-blue-600 bg-blue-50 border-blue-100';
        return 'text-slate-500 bg-slate-50 border-slate-100';
    }

    function cn(...inputs: (string | undefined | null | false)[]) {
        return twMerge(clsx(inputs));
    }
    
    // Berechnet Fortschritt (z.B. "1/3")
    function getSubtaskProgress(task: Task) {
        if (!task.subtasks || task.subtasks.length === 0) return null;
        const done = task.subtasks.filter(s => s.done).length;
        return `${done}/${task.subtasks.length}`;
    }
</script>

<div class="min-h-screen bg-gray-50 text-slate-900 pb-20 font-sans">
	<nav class="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur-md">
		<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
			<div class="flex h-16 justify-between items-center">
				<div class="flex items-center gap-2">
					<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white font-bold">L</div>
					<span class="text-lg font-bold tracking-tight text-slate-900">Law<span class="text-blue-600">CP</span></span>
				</div>
                
                <div class="flex items-center gap-2 relative">
                    <button onclick={() => showSnapshots = !showSnapshots} class="p-2 text-gray-500 hover:text-blue-600 transition-colors">
                        <History size={20} />
                    </button>
                    
                    {#if showSnapshots}
                        <div class="absolute top-12 right-0 w-64 bg-white rounded-lg shadow-xl border border-gray-200 p-2 z-50">
                            <h4 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-2">Snapshots</h4>
                            <button onclick={() => { const n = prompt("Name:"); if(n) taskStore.createSnapshot(n); }} class="w-full text-left px-2 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded flex gap-2 items-center mb-2">
                                <Plus size={14}/> Snapshot erstellen
                            </button>
                            <div class="max-h-48 overflow-y-auto space-y-1 border-t border-gray-100 pt-1">
                                {#each taskStore.getSnapshots() as snap}
                                    <button onclick={() => { if(confirm("Restore?")) taskStore.restoreSnapshot(snap); showSnapshots=false; }} class="w-full text-left px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-100 rounded truncate">
                                        {snap}
                                    </button>
                                {:else}
                                    <div class="text-xs text-gray-400 px-2">Keine Backups.</div>
                                {/each}
                            </div>
                        </div>
                    {/if}

					<button onclick={() => taskStore.exportData()} class="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm">
						<Save size={16} /> Export
					</button>
				</div>
			</div>
		</div>
	</nav>

	<main class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
		<div class="mb-10 rounded-xl border border-gray-200 bg-white p-1 shadow-sm focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
			<form onsubmit={(e) => { e.preventDefault(); handleAdd(); }} class="flex flex-col gap-2 p-2 sm:flex-row sm:items-center">
				<div class="relative flex-grow">
                    <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><Plus size={18} /></div>
					<input bind:value={inputTitle} type="text" placeholder="Neue Aufgabe..." class="w-full rounded-md border-0 bg-transparent py-2 pl-10 pr-4 text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-sm" />
				</div>
                <div class="flex items-center gap-2 border-t border-gray-100 pt-2 sm:border-t-0 sm:pt-0 sm:border-l sm:pl-2">
                    <input bind:value={inputRef} type="text" placeholder="Ref" class="w-24 rounded-md border-0 bg-gray-50 py-1.5 px-3 text-xs font-mono text-gray-600 focus:bg-white" />
                    <input bind:value={inputDate} type="date" class="rounded-md border-0 bg-gray-50 py-1.5 px-3 text-xs text-gray-600 focus:bg-white" />
                    <button type="submit" class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800">Enter</button>
                </div>
			</form>
		</div>

		<div class="grid grid-cols-1 gap-6 lg:grid-cols-4 items-start">
			
            <div class="flex flex-col gap-4 min-h-[500px]" ondrop={(e) => handleDrop(e, 'TODO')} ondragover={handleDragOver} role="list">
				<div class="flex items-center justify-between px-1">
					<h3 class="text-sm font-semibold text-gray-900 flex items-center gap-2"><div class="w-2 h-2 rounded-full bg-slate-400"></div> To Do</h3>
					<span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{todos.length}</span>
				</div>
                {#each todos as task (task.id)}
                    <div 
                        role="listitem"
                        class="group relative flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-move active:cursor-grabbing"
                        draggable="true"
                        ondragstart={(e) => handleDragStart(e, task.id)}
                    >
                        <div class="flex justify-between items-start">
                             <span class={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider", getPriorityColor(task.priority))}>{task.matterRef}</span>
                            <button onclick={() => taskStore.deleteTask(task.id)} class="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                        </div>
                        
                        <p class="text-sm font-medium text-gray-900 leading-snug">{task.title}</p>

                        <div class="space-y-1 my-1">
                            {#each task.subtasks || [] as sub (sub.id)}
                                <div class="flex items-center gap-2 group/sub">
                                    <button onclick={() => taskStore.toggleSubtask(task.id, sub.id)} class="text-gray-400 hover:text-blue-600">
                                        {#if sub.done}<CheckSquare size={14} class="text-blue-500" />{:else}<Square size={14} />{/if}
                                    </button>
                                    <span class={cn("text-xs w-full", sub.done ? "line-through text-gray-400" : "text-gray-600")}>{sub.title}</span>
                                </div>
                            {/each}
                            <input 
                                type="text" 
                                placeholder="+ Subtask" 
                                class="w-full bg-transparent border-0 p-0 text-xs placeholder:text-gray-300 focus:ring-0 text-gray-600"
                                onkeydown={(e) => handleAddSubtask(e, task.id)}
                            />
                        </div>

                        <div class="flex items-center justify-between border-t border-gray-50 pt-2 mt-1">
                            <div class="flex items-center gap-1 text-xs text-gray-500">
                                <Calendar size={12} />
                                <input type="date" value={task.dueDate} onchange={(e) => taskStore.updateDate(task.id, e.currentTarget.value)} class="bg-transparent border-0 p-0 text-xs text-gray-500 focus:ring-0 w-24 cursor-pointer"/>
                            </div>
                            {#if getSubtaskProgress(task)}
                                <span class="text-[10px] bg-slate-100 text-slate-500 px-1.5 rounded">{getSubtaskProgress(task)}</span>
                            {/if}
                        </div>
                    </div>
                {/each}
			</div>

            <div class="flex flex-col gap-4 min-h-[500px]" ondrop={(e) => handleDrop(e, 'WAITING')} ondragover={handleDragOver} role="list">
				<div class="flex items-center justify-between px-1">
					<h3 class="text-sm font-semibold text-gray-900 flex items-center gap-2"><div class="w-2 h-2 rounded-full bg-amber-400"></div> In Arbeit</h3>
					<span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{waiting.length}</span>
				</div>
                {#each waiting as task (task.id)}
                    <div role="listitem" class="relative flex flex-col gap-3 rounded-lg border-l-4 border-l-amber-400 border border-y-gray-200 border-r-gray-200 bg-white p-4 shadow-sm cursor-move" draggable="true" ondragstart={(e) => handleDragStart(e, task.id)}>
                        <div class="flex justify-between items-start"><span class="text-xs font-mono text-gray-500">{task.matterRef}</span></div>
                        <p class="text-sm font-medium text-gray-900">{task.title}</p>
                        {#if task.subtasks?.length}
                            <div class="space-y-1">
                                {#each task.subtasks as sub}
                                    <div class="flex items-center gap-2 text-xs text-gray-500">
                                        {#if sub.done}☑{:else}☐{/if} {sub.title}
                                    </div>
                                {/each}
                            </div>
                        {/if}
                        <div class="flex items-center gap-1 text-xs text-gray-400 mt-1">
                            Frist: <input type="date" value={task.dueDate} onchange={(e) => taskStore.updateDate(task.id, e.currentTarget.value)} class="bg-transparent border-0 p-0 text-xs focus:ring-0 w-24"/>
                        </div>
                    </div>
                {/each}
			</div>

            <div class="flex flex-col gap-4 min-h-[500px]" ondrop={(e) => handleDrop(e, 'REVIEW')} ondragover={handleDragOver} role="list">
				<div class="flex items-center justify-between px-1">
					<h3 class="text-sm font-semibold text-gray-900 flex items-center gap-2"><div class="w-2 h-2 rounded-full bg-purple-500"></div> Review</h3>
					<span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{review.length}</span>
				</div>
                 {#each review as task (task.id)}
                    <div role="listitem" class="relative flex flex-col gap-3 rounded-lg border-l-4 border-l-purple-500 border border-y-gray-200 border-r-gray-200 bg-white p-4 shadow-sm cursor-move" draggable="true" ondragstart={(e) => handleDragStart(e, task.id)}>
                        <span class="text-xs font-mono text-gray-500">{task.matterRef}</span>
                        <p class="text-sm font-medium text-gray-900">{task.title}</p>
                    </div>
                {/each}
            </div>

            <div class="flex flex-col gap-4 min-h-[500px]" ondrop={(e) => handleDrop(e, 'DONE')} ondragover={handleDragOver} role="list">
				<div class="flex items-center justify-between px-1">
					<h3 class="text-sm font-semibold text-gray-900 flex items-center gap-2"><div class="w-2 h-2 rounded-full bg-emerald-500"></div> Done</h3>
					<span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{done.length}</span>
				</div>
                <div class="opacity-60 space-y-3">
                    {#each done as task (task.id)}
                        <div role="listitem" class="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-4 cursor-move" draggable="true" ondragstart={(e) => handleDragStart(e, task.id)}>
                            <div class="flex justify-between">
                                <span class="text-xs line-through text-gray-400">{task.matterRef}</span>
                                <button onclick={() => taskStore.deleteTask(task.id)} class="text-gray-400 hover:text-red-500"><Trash2 size={12}/></button>
                            </div>
                            <p class="text-sm text-gray-500 line-through">{task.title}</p>
                        </div>
                    {/each}
                </div>
            </div>

		</div>
	</main>
</div>