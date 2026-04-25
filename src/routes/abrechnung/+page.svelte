<script lang="ts">
    import { store } from '$lib/stores/tasks';
    import { pb } from '$lib/pocketbase';
    import { ArrowLeft, Banknote, Clock, FileDown, Briefcase, Plus, X, Pencil, Trash2 } from 'lucide-svelte';
    import type { Task, TimeLog, Subtask } from '$lib/types';
    import { fade, scale } from 'svelte/transition';

    $: myId = pb.authStore.model?.id || '';

    let filterMode = 'TODAY'; 

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

    type EnrichedTimeLog = TimeLog & { taskId: string, taskTitle: string, matterRef: string };

    $: aggregatedLogs = $store.tasks.reduce((acc: EnrichedTimeLog[], task: Task) => {
        if (!task.timeLogs || !Array.isArray(task.timeLogs)) return acc;
        
        const myLogsForTask = task.timeLogs.filter(log => log.userId === myId && isDateInRange(log.date, filterMode));
        const enriched = myLogsForTask.map(log => ({ 
            ...log, 
            taskId: task.id, 
            taskTitle: task.title, 
            matterRef: task.matterRef || 'NO-REF' 
        }));
        return [...acc, ...enriched];
    }, []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    $: totalMinutes = aggregatedLogs.reduce((sum, log) => sum + log.minutes, 0);
    $: totalHours = (totalMinutes / 60).toFixed(1);

    // --- Manual Log Modal State ---
    let showManualLog = false;
    let editLogId = '';
    let logTaskId = '';
    let logDate = new Date().toISOString().split('T')[0];
    let logMinutes = 15;
    let logNote = '';

    $: myTasksForDropdown = $store.tasks.filter(t => !t.archived && (t.owner === myId || t.assignees?.includes(myId)));

    function getTodayCompletedSubtasks(subtasks: Subtask[] | undefined): Subtask[] {
        if (!subtasks || !Array.isArray(subtasks)) return [];
        let completedToday: Subtask[] = [];
        const startOfToday = new Date(new Date().setHours(0,0,0,0)).getTime();

        for (const sub of subtasks) {
            if (sub.done && sub.completedAt && new Date(sub.completedAt).getTime() >= startOfToday) {
                completedToday.push(sub);
            }
            if (sub.subtasks && sub.subtasks.length > 0) {
                completedToday = [...completedToday, ...getTodayCompletedSubtasks(sub.subtasks)];
            }
        }
        return completedToday;
    }

    $: selectedTask = $store.tasks.find(t => t.id === logTaskId);
    $: recommendedNotes = (() => {
        if (!selectedTask) return [];
        let recs: string[] = [];
        const startOfToday = new Date(new Date().setHours(0,0,0,0)).getTime();
        
        const safeTask = selectedTask as Task & { updated?: string };
        const dateString = safeTask.updated || selectedTask.createdAt || new Date().toISOString();
        if (selectedTask.status === 'DONE' && new Date(dateString).getTime() >= startOfToday) {
            recs.push(`Abschluss: ${selectedTask.title}`);
        }
        
        const subsDone = getTodayCompletedSubtasks(selectedTask.subtasks);
        subsDone.forEach(sub => recs.push(sub.title));
        
        return recs;
    })();

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
        editLogId = log.id;
        logTaskId = log.taskId;
        logMinutes = log.minutes;
        logNote = log.note || '';
        logDate = new Date(log.date).toISOString().split('T')[0];
        showManualLog = true;
    }

    function saveManualLog() {
        if (!logTaskId || logMinutes <= 0) return;
        
        if (editLogId) {
            store.updateTimeLog(logTaskId, editLogId, logMinutes, logNote.trim(), logDate);
        } else {
            store.addTimeLog(logTaskId, logMinutes, logNote.trim(), logDate);
        }
        
        showManualLog = false;
    }

    function deleteLog(log: EnrichedTimeLog) {
        if(confirm('Möchtest du diese Buchung wirklich löschen?')) {
            store.deleteTimeLog(log.taskId, log.id);
        }
    }

    // --- MS EXCEL IDIOTENSICHERUNG ---
    function exportToCSV() {
        if (aggregatedLogs.length === 0) return;

        const headers = ['Datum', 'Zeit', 'Dauer (Minuten)', 'Aktenzeichen', 'Aufgabe', 'Bemerkung'];
        const rows = aggregatedLogs.map(log => {
            const d = new Date(log.date);
            return [
                d.toLocaleDateString('de-DE'),
                d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
                log.minutes,
                `"${log.matterRef}"`, 
                `"${log.taskTitle.replace(/"/g, '""')}"`,
                `"${(log.note || '').replace(/"/g, '""')}"`
            ].join(';');
        });

        // "sep=;" zwingt Excel dazu, das Semikolon als Trennzeichen zu nutzen, egal welche Sprache eingestellt ist.
        const csvContent = ["sep=;", headers.join(';'), ...rows].join('\n');
        
        // \uFEFF ist der BOM, der Excel zwingt, UTF-8 (Umlaute) zu lesen
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `Zeiterfassung_${filterMode}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
</script>

<div class="h-screen overflow-hidden flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
    
    <div class="shrink-0 relative py-4 px-6 lg:px-8 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center shadow-sm z-10">
        <div class="flex items-center gap-4">
            <a href="/" class="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700">
                <ArrowLeft size={20} />
            </a>
            <div>
                <h1 class="text-xl font-bold tracking-tight flex items-center gap-2">
                    <Clock class="text-blue-600" size={24}/> Zeiterfassung
                </h1>
            </div>
        </div>

        <div class="flex items-center gap-4">
            <div class="hidden md:flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                <button onclick={() => filterMode = 'TODAY'} class="px-3 py-1 text-xs font-bold rounded-md transition-colors {filterMode === 'TODAY' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}">Heute</button>
                <button onclick={() => filterMode = 'WEEK'} class="px-3 py-1 text-xs font-bold rounded-md transition-colors {filterMode === 'WEEK' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}">7 Tage</button>
                <button onclick={() => filterMode = 'MONTH'} class="px-3 py-1 text-xs font-bold rounded-md transition-colors {filterMode === 'MONTH' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}">Monat</button>
                <button onclick={() => filterMode = 'ALL'} class="px-3 py-1 text-xs font-bold rounded-md transition-colors {filterMode === 'ALL' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}">Alle</button>
            </div>

            <button onclick={openCreateModal} class="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-lg font-bold text-sm shadow-sm transition-colors" title="Zeit buchen">
                <Plus size={16} /> Buchen
            </button>

            <button onclick={exportToCSV} class="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm shadow-sm transition-colors" title="Als CSV exportieren">
                <FileDown size={16} /> Export
            </button>
        </div>
    </div>

    <div class="flex-1 overflow-auto custom-scrollbar p-6 lg:p-8">
        <div class="max-w-5xl mx-auto">
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div class="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                    <div>
                        <div class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Gefilterte Zeit</div>
                        <div class="text-3xl font-bold text-slate-800 dark:text-white">{totalHours} <span class="text-lg font-medium text-slate-500">Stunden</span></div>
                    </div>
                    <div class="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-full">
                        <Clock size={28} />
                    </div>
                </div>
                <div class="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                    <div>
                        <div class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Erfasste Einträge</div>
                        <div class="text-3xl font-bold text-slate-800 dark:text-white">{aggregatedLogs.length}</div>
                    </div>
                    <div class="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-full">
                        <Banknote size={28} />
                    </div>
                </div>
            </div>

            {#if aggregatedLogs.length === 0}
                <div class="flex flex-col items-center justify-center py-20 text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 border-dashed">
                    <Briefcase size={48} class="mb-4 opacity-20" />
                    <p class="text-lg font-medium">Keine Einträge in diesem Zeitraum.</p>
                    <p class="text-sm mt-1">Buche Zeiten über den Button oben rechts.</p>
                </div>
            {:else}
                <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div class="overflow-x-auto">
                        <table class="w-full text-left text-sm whitespace-nowrap">
                            <thead class="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                                <tr>
                                    <th class="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">Datum</th>
                                    <th class="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">Dauer</th>
                                    <th class="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">REF</th>
                                    <th class="px-4 py-3 font-bold uppercase tracking-wider text-[10px] w-full">Task / Tätigkeit</th>
                                    <th class="px-4 py-3 font-bold uppercase tracking-wider text-[10px] text-right">Aktion</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                                {#each aggregatedLogs as log}
                                    <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                                        <td class="px-4 py-3 align-top">
                                            <div class="font-medium text-slate-900 dark:text-white">{new Date(log.date).toLocaleDateString('de-DE')}</div>
                                            <div class="text-xs text-slate-500">{new Date(log.date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div>
                                        </td>
                                        <td class="px-4 py-3 align-top">
                                            <span class="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-bold text-xs border border-blue-100 dark:border-blue-800/50">
                                                <Clock size={12} /> {log.minutes}m
                                            </span>
                                        </td>
                                        <td class="px-4 py-3 align-top">
                                            <span class="text-[10px] font-bold px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded uppercase tracking-wider">
                                                {log.matterRef}
                                            </span>
                                        </td>
                                        <td class="px-4 py-3 whitespace-normal">
                                            <div class="font-medium text-slate-900 dark:text-white mb-0.5">{log.taskTitle}</div>
                                            {#if log.note}
                                                <div class="text-xs text-slate-500 italic">"{log.note}"</div>
                                            {/if}
                                        </td>
                                        <td class="px-4 py-3 align-top text-right">
                                            <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onclick={() => openEditModal(log)} class="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors" title="Bearbeiten">
                                                    <Pencil size={14} />
                                                </button>
                                                <button onclick={() => deleteLog(log)} class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors" title="Löschen">
                                                    <Trash2 size={14} />
                                                </button>
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
    </div>
</div>

{#if showManualLog}
    <div class="fixed inset-0 z-[9999] flex items-center justify-center p-4" role="dialog" aria-modal="true" transition:fade={{ duration: 150 }}>
        <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onclick={(e) => { e.stopPropagation(); showManualLog = false; }} onkeydown={(e) => e.key === 'Escape' && (showManualLog = false)} role="button" tabindex="-1"></div>
        
        <div class="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md p-6 space-y-5" transition:scale={{ duration: 200, start: 0.95 }}>
            <div class="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 class="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    {#if editLogId}
                        <Pencil size={18} class="text-blue-500" /> Zeit bearbeiten
                    {:else}
                        <Plus size={18} class="text-blue-500" /> Zeit buchen
                    {/if}
                </h3>
                <button onclick={() => showManualLog = false} class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 outline-none"><X size={20}/></button>
            </div>
            
            <div class="space-y-4">
                <div>
                    <label for="taskSelect" class="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Für welche Aufgabe?</label>
                    <select id="taskSelect" bind:value={logTaskId} disabled={!!editLogId} class="w-full rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-50">
                        <option value="" disabled selected>Bitte wählen...</option>
                        {#each myTasksForDropdown as t}
                            <option value={t.id}>[{t.matterRef || 'NO-REF'}] {t.title}</option>
                        {/each}
                    </select>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label for="logDateInput" class="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Datum</label>
                        <input id="logDateInput" type="date" bind:value={logDate} class="w-full rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 focus:ring-2 focus:ring-blue-500 dark:[color-scheme:dark] outline-none text-sm" />
                    </div>

                    <div>
                        <label for="logMinutesInput" class="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Dauer (Minuten)</label>
                        <input id="logMinutesInput" type="number" bind:value={logMinutes} min="1" class="w-full rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                    </div>
                </div>
                
                <div class="flex gap-2">
                    <button onclick={() => logMinutes = 15} class="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700 text-xs font-bold transition-colors">+15m</button>
                    <button onclick={() => logMinutes = 30} class="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700 text-xs font-bold transition-colors">+30m</button>
                    <button onclick={() => logMinutes = 60} class="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700 text-xs font-bold transition-colors">+1h</button>
                </div>

                <div>
                    <label for="logNoteInput" class="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Tätigkeit / Bemerkung</label>
                    <textarea id="logNoteInput" bind:value={logNote} rows="2" class="w-full rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 focus:ring-2 focus:ring-blue-500 outline-none resize-none text-sm" placeholder="Was wurde gemacht?"></textarea>
                    
                    {#if recommendedNotes.length > 0 && !editLogId}
                        <div class="mt-3">
                            <span class="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-wider block mb-1.5">Ausgeführte Teilschritte:</span>
                            <div class="flex flex-wrap gap-1.5">
                                {#each recommendedNotes as rec}
                                    <button type="button" onclick={() => appendToNote(rec)} class="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 rounded-lg text-[11px] font-medium transition-colors text-left max-w-full truncate">
                                        + {@html rec}
                                    </button>
                                {/each}
                            </div>
                        </div>
                    {/if}
                </div>
            </div>
            
            <div class="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button onclick={() => showManualLog = false} class="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-colors outline-none">Abbrechen</button>
                <button onclick={saveManualLog} disabled={!logTaskId || logMinutes <= 0} class="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors outline-none">Speichern</button>
            </div>
        </div>
    </div>
{/if}