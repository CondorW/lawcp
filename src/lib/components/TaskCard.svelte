<script lang="ts">
    import { store } from '$lib/stores/tasks';
    import type { Task, Subtask, SubtaskType } from '$lib/types';
    import { Calendar, Trash2, CheckSquare, Square, Mail, Copy, Flag, Search, ArrowUpRight, X, ListPlus, CornerDownRight, Check } from 'lucide-svelte';
    import { cn, formatDate } from '$lib/utils';
    import { scale, fade } from 'svelte/transition';

    export let task: Task;

    let newSubtaskType: SubtaskType = 'GENERIC'; 
    let newSubtaskTitle = '';
    let dragging = false;
    let isEditingTitle = false;
    let editTitleBuffer = task.title;
    let isEditingRef = false;
    let editRefBuffer = task.matterRef || '';

    // Reschedule State
    let showReschedule = false;
    let rescheduleDate = task.dueDate;

    // NEW: Sub-Subtask Inline Adding State
    let addingSubId: string | null = null;
    let newSubStepTitle = '';

    function renderTitleWithTags(title: string) {
        const team = $store.settings.team;
        return title.split(/(\s+)/).map(word => {
            const match = word.match(/^@([a-zA-Z0-9äöüÄÖÜ]+)(.*)/);
            if (match) {
                const tag = match[1];
                const rest = match[2];
                const member = team.find(m => m.shortsign.toLowerCase() === tag.toLowerCase());
                if (member) return `<span class="inline-block px-1.5 py-0.5 mx-0.5 rounded text-xs font-bold uppercase ${member.color}">@${tag}</span>${rest}`;
            }
            return word;
        }).join('');
    }

    // Actions
    function startEdit() { editTitleBuffer = task.title; isEditingTitle = true; setTimeout(() => document.getElementById(`edit-${task.id}`)?.focus(), 10); }
    function saveEdit() { if (editTitleBuffer.trim() !== task.title) store.updateTaskTitle(task.id, editTitleBuffer); isEditingTitle = false; }
    
    function handleFlag(e: Event) {
        const input = e.currentTarget as HTMLInputElement;
        e.stopPropagation();
        store.toggleFlag(task.id, input.value ? input.value : null);
    }

    function handleAddSubtask() {
        if (!newSubtaskTitle.trim()) return;
        store.addSubtask(task.id, newSubtaskTitle, newSubtaskType);
        newSubtaskTitle = '';
    }

    // FIX: Neue Streamlined Funktion (nur State setzen)
    function startAddSubStep(subId: string) {
        addingSubId = subId;
        newSubStepTitle = '';
        // Focus wird über die Action 'focusOnMount' gelöst
    }

    function cancelAddSubStep() {
        addingSubId = null;
        newSubStepTitle = '';
    }

    function startEditRef() {
        editRefBuffer = task.matterRef || '';
        isEditingRef = true;
        setTimeout(() => document.getElementById(`edit-ref-${task.id}`)?.focus(), 10);
    }

    function saveEditRef() {
        // Nur speichern, wenn sich was geändert hat
        if (editRefBuffer !== task.matterRef) {
            store.updateTaskRef(task.id, editRefBuffer);
        }
        isEditingRef = false;
    }

    function confirmAddSubStep(parentSubId: string) {
        if (newSubStepTitle.trim()) {
            store.addSubSubtask(task.id, parentSubId, newSubStepTitle);
        }
        // Reset und Input schließen
        addingSubId = null;
        newSubStepTitle = '';
    }

    function onSubtaskKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter') handleAddSubtask();
    }

    function updateSubtask(subId: string, newTitle: string) {
        if(newTitle.trim()) store.updateSubtaskTitle(task.id, subId, newTitle);
    }

    async function copyEmail(specificSubtask?: Subtask) {
        let recipientName = "Kollegen";
        const team = $store.settings.team;
        const leader = team.find(m => m.isLeader);
        if (leader) recipientName = leader.name;

        const body = `Betreff: ${task.title}\n\nLiebe ${recipientName},\n\n${specificSubtask ? specificSubtask.title : 'Anbei die Dokumente.'}\n\nLG ${$store.settings.myShortsign}`;
        try { await navigator.clipboard.writeText(body); alert("E-Mail kopiert!"); } catch(e) { console.error(e); }
    }

    function onDragStart(e: DragEvent) {
        // Prevent drag on inputs
        if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA' || showReschedule) { e.preventDefault(); return; }
        if(e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', task.id); dragging = true; }
    }
    
    function openResearch(query: string) {
        if (!query) return;
        const q = encodeURIComponent(query);
        const today = new Date().toLocaleDateString('de-DE'); 
        const urls = [
            `https://360.lexisnexis.at/search/${q}?selectedprefilterid=3`,
            `https://www.rechtportal.li/suche?term=${q}`,
            `https://www.ris.bka.gv.at/Ergebnis.wxe?Abfrage=Justiz&SucheNachRechtssatz=True&SucheNachText=False&BisDatum=${today}&ResultPageSize=100&Suchworte=${q}&Position=1`
        ];
        window.open(urls[0], '_blank');
        if (urls.length > 1) {
            urls.slice(1).forEach((url, index) => {
                setTimeout(() => { window.open(url, '_blank'); }, (index + 1) * 800);
            });
        }
    }
    
    function getFullFilename(subtask: Subtask, variant: string) {
        const date = new Date().toLocaleDateString('de-DE', {day: '2-digit', month: '2-digit', year: 'numeric'}).replace(/\./g, '-');
        const cleanTask = task.title.replace(/[^a-zA-Z0-9äöüÄÖÜß ]/g, "").trim();
        const cleanSub = subtask.title.replace(/[^a-zA-Z0-9äöüÄÖÜß ]/g, "").trim();
        return `${date} ${cleanTask} - ${cleanSub} ${variant}`;
    }

    function saveReschedule() {
        if (rescheduleDate && rescheduleDate !== task.dueDate) {
            store.updateDate(task.id, rescheduleDate);
        }
        showReschedule = false;
    }

    function autosize(node: HTMLTextAreaElement) {
        const resize = () => {
            node.style.height = 'auto';
            node.style.height = node.scrollHeight + 'px';
        };
        node.addEventListener('input', resize);
        setTimeout(resize, 0); 
        return {
            destroy() { node.removeEventListener('input', resize); }
        };
    }

    // Action für automatischen Focus beim Einblenden
    function focusOnMount(node: HTMLTextAreaElement) {
        node.focus();
    }
</script>

<div 
    role="listitem"
    class={cn(
        "group relative flex flex-col gap-3 rounded-xl border p-5 shadow-sm transition-all cursor-move",
        task.status === 'DONE' 
            ? "bg-gray-50 dark:bg-slate-800/50 border-gray-100 dark:border-slate-800 opacity-60 grayscale" 
            : "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:shadow-md",
        dragging && "opacity-50"
    )}
    draggable="true"
    ondragstart={onDragStart}
    ondragend={() => dragging = false}
>
    <div class="flex justify-between items-start">
        {#if isEditingRef}
            <input
                id={`edit-ref-${task.id}`}
                type="text"
                bind:value={editRefBuffer}
                onblur={saveEditRef}
                onkeydown={(e) => e.key === 'Enter' && saveEditRef()}
                class="text-xs font-bold px-2 py-1 rounded border uppercase tracking-wider text-slate-900 bg-white border-blue-300 dark:bg-slate-800 dark:text-white dark:border-blue-500 max-w-[120px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="REF"
            />
        {:else}
             <button 
                onclick={startEditRef}
                class="text-xs font-bold px-2 py-1 rounded border uppercase tracking-wider text-slate-500 bg-slate-50 border-slate-100 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600 max-w-[120px] truncate hover:border-amber-400 dark:hover:border-amber-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors text-left"
                title="Referenz bearbeiten"
            >
                {task.matterRef || 'NO-REF'}
            </button>
        {/if}
        <div class="flex gap-1 items-center">
            <div class="relative w-8 h-8 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-slate-700 rounded-full cursor-pointer group/btn">
                <Flag size={16} class={task.flaggedDate ? "text-red-500 fill-red-500" : "text-gray-300 hover:text-red-400"} />
                <input 
                    type="date" 
                    value={task.flaggedDate || ""} 
                    onchange={handleFlag}
                    onclick={(e) => e.stopPropagation()} 
                    class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                    title="Priorität setzen"
                />
            </div>
            <button onclick={() => store.deleteTask(task.id)} class="text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16} /></button>
        </div>
    </div>
    
    <div class="min-h-[28px]">
        {#if isEditingTitle}
            <textarea
                id={`edit-${task.id}`}
                use:autosize
                bind:value={editTitleBuffer}
                onblur={saveEdit}
                onkeydown={(e) => { if(e.key === 'Enter') saveEdit(); }}
                class="w-full text-base font-medium text-gray-900 bg-gray-50 border border-blue-300 rounded p-1 focus:ring-2 focus:ring-blue-500 outline-none resize-none overflow-hidden dark:bg-slate-700 dark:text-white block"
                rows="1"
                spellcheck="false"
            ></textarea>
        {:else}
            <div role="button" tabindex="0" onclick={startEdit} onkeydown={(e) => e.key === 'Enter' && startEdit()}
                class={cn("text-base font-medium text-gray-900 leading-snug cursor-text hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-slate-700 rounded p-1 -m-1 break-words", task.status === 'DONE' && "line-through text-gray-500 dark:text-gray-500")}>
                {@html renderTitleWithTags(task.title)}
            </div>
        {/if}
    </div>

    <div class="space-y-3 my-2 border-t border-gray-100 dark:border-slate-700 pt-3">
        {#each task.subtasks || [] as sub (sub.id)}
            <div class="bg-gray-50/80 dark:bg-slate-900/50 rounded-lg p-2 text-sm border border-gray-100 dark:border-slate-700 flex flex-col gap-1 group/sub">
                <div class="flex items-start gap-2 relative">
                    <button onclick={() => store.toggleSubtask(task.id, sub.id)} class="text-gray-400 hover:text-blue-600 flex-shrink-0 mt-0.5">
                            {#if sub.done}<CheckSquare size={16} class="text-blue-500" />{:else}<Square size={16} />{/if}
                    </button>
                    
                    <div class="flex flex-wrap gap-1 mt-0.5">
                        {#if sub.type === 'DOCUMENT'}<span class="px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 rounded text-[10px] font-bold h-fit">DOC</span>{/if}
                        {#if sub.type === 'RESEARCH'}<span class="px-1.5 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200 rounded text-[10px] font-bold h-fit">RES</span>{/if}
                        {#if sub.type === 'EMAIL'}<span class="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200 rounded text-[10px] font-bold h-fit">MAIL</span>{/if}
                    </div>

                    <textarea 
                        use:autosize
                        value={sub.title} 
                        onchange={(e) => updateSubtask(sub.id, e.currentTarget.value)}
                        rows="1"
                        spellcheck="false"
                        class={cn(
                            "flex-grow bg-transparent border-0 p-0 text-sm focus:ring-0 text-gray-700 dark:text-gray-300 resize-none overflow-hidden leading-snug block min-h-[20px]", 
                            sub.done && "line-through text-gray-400"
                        )}
                    ></textarea>

                    <button 
                        onclick={() => startAddSubStep(sub.id)} 
                        class="text-gray-300 hover:text-amber-600 opacity-0 group-hover/sub:opacity-100 mt-0.5 transition-opacity"
                        title="Unterschritt hinzufügen"
                    >
                        <ListPlus size={14} />
                    </button>

                    {#if sub.type === 'EMAIL'}
                        <button onclick={() => copyEmail(sub)} class="text-gray-300 hover:text-yellow-600 opacity-0 group-hover/sub:opacity-100 mt-0.5"><Copy size={14}/></button>
                    {/if}
                </div>
                
                {#if !sub.done}
                    {#if sub.type === 'DOCUMENT'}
                        <div class="pl-7 flex gap-3">
                            <button onclick={() => navigator.clipboard.writeText(getFullFilename(sub, 'Redline'))} class="text-xs text-gray-400 hover:text-blue-600 flex items-center gap-1"><Copy size={12}/> Redline</button>
                            <button onclick={() => navigator.clipboard.writeText(getFullFilename(sub, 'Cleaned'))} class="text-xs text-gray-400 hover:text-green-600 flex items-center gap-1"><Copy size={12}/> Cleaned</button>
                        </div>
                    {/if}
                    {#if sub.type === 'RESEARCH'}
                        <div class="pl-7">
                             <button onclick={() => openResearch(sub.title)} class="flex items-center gap-1 text-[10px] bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 px-2 py-0.5 rounded hover:border-purple-300 dark:hover:border-purple-500 hover:text-purple-600 w-full justify-center">
                                <Search size={10} /> Multi-Search <ArrowUpRight size={10} />
                            </button>
                        </div>
                    {/if}
                {/if}

                {#if (sub.subtasks && sub.subtasks.length > 0) || addingSubId === sub.id}
                    <div class="pl-4 mt-1 space-y-1 border-l-2 border-slate-200 dark:border-slate-700 ml-2">
                        {#each sub.subtasks || [] as child (child.id)}
                            <div class="flex items-start gap-2 group/child">
                                <div class="text-slate-300 mt-0.5"><CornerDownRight size={12}/></div>
                                <button onclick={() => store.toggleSubtask(task.id, child.id)} class="text-gray-400 hover:text-blue-600 flex-shrink-0 mt-0.5">
                                    {#if child.done}<CheckSquare size={14} class="text-blue-500" />{:else}<Square size={14} />{/if}
                                </button>
                                <textarea 
                                    use:autosize
                                    value={child.title} 
                                    onchange={(e) => updateSubtask(child.id, e.currentTarget.value)}
                                    rows="1"
                                    spellcheck="false"
                                    class={cn(
                                        "flex-grow bg-transparent border-0 p-0 text-xs focus:ring-0 text-gray-600 dark:text-gray-400 resize-none overflow-hidden leading-snug block min-h-[18px]", 
                                        child.done && "line-through text-gray-500"
                                    )}
                                ></textarea>
                            </div>
                        {/each}

                        {#if addingSubId === sub.id}
                            <div class="flex items-start gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                <div class="text-amber-500 mt-0.5"><CornerDownRight size={12}/></div>
                                <div class="flex-grow flex gap-2">
                                    <textarea
                                        use:autosize
                                        use:focusOnMount
                                        bind:value={newSubStepTitle}
                                        onkeydown={(e) => {
                                            if (e.key === 'Enter') { e.preventDefault(); confirmAddSubStep(sub.id); }
                                            if (e.key === 'Escape') cancelAddSubStep();
                                        }}
                                        onblur={() => { if(!newSubStepTitle.trim()) cancelAddSubStep(); }}
                                        rows="1"
                                        placeholder="Unterschritt..."
                                        class="flex-grow bg-white dark:bg-slate-800 border-b border-amber-500 p-0 text-xs focus:ring-0 text-gray-900 dark:text-white resize-none overflow-hidden leading-snug block min-h-[18px] placeholder:text-slate-400"
                                    ></textarea>
                                    <button onclick={() => confirmAddSubStep(sub.id)} class="text-amber-600 hover:text-amber-700"><Check size={14}/></button>
                                    <button onclick={cancelAddSubStep} class="text-slate-400 hover:text-slate-600"><X size={14}/></button>
                                </div>
                            </div>
                        {/if}
                    </div>
                {/if}
            </div>
        {/each}

        <div class="flex gap-2 items-center mt-3 pt-1 relative z-20">
            <select bind:value={newSubtaskType} class="text-xs bg-gray-100 dark:bg-slate-700 border-0 rounded px-2 py-1 text-gray-600 dark:text-gray-300 cursor-pointer focus:ring-0">
                <option value="GENERIC">Task</option>
                <option value="DOCUMENT">Doc</option>
                <option value="RESEARCH">Res</option>
                <option value="EMAIL">Mail</option>
            </select>
            <input 
                type="text" 
                bind:value={newSubtaskTitle}
                placeholder="Neuer Subtask... (Enter)" 
                class="flex-grow bg-transparent border-b border-transparent focus:border-blue-500 p-1 text-sm placeholder:text-gray-400 focus:ring-0 text-gray-700 dark:text-gray-300"
                onkeydown={onSubtaskKeydown} 
            />
        </div>
    </div>

    <div class="relative flex items-center justify-between border-t border-gray-100 dark:border-slate-700 pt-3 mt-1">
        
        <button 
            class="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-blue-600 transition-colors w-full text-left"
            onclick={(e) => { e.stopPropagation(); showReschedule = true; rescheduleDate = task.dueDate; }}
        >
            <Calendar size={14} />
            <span>{formatDate(task.dueDate)}</span>
            {#if task.flaggedDate}
                <span class="ml-auto text-red-500 font-bold bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded flex items-center gap-1">
                    <Flag size={10} fill="currentColor"/> {formatDate(task.flaggedDate)}
                </span>
            {/if}
        </button>

        {#if showReschedule}
            <div class="fixed inset-0 z-[9999] flex items-center justify-center p-4" role="dialog" aria-modal="true" transition:fade={{ duration: 150 }}>
                <div 
                    class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                    onclick={() => showReschedule = false} 
                    onkeydown={(e) => e.key === 'Escape' && (showReschedule = false)}
                    role="button" tabindex="-1"
                ></div>
                
                <div class="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-sm p-5 space-y-4" transition:scale={{ duration: 200, start: 0.95 }}>
                    <div class="flex justify-between items-center">
                        <h3 class="text-sm font-bold uppercase text-slate-500 tracking-wider flex items-center gap-2">
                            <Calendar size={16} /> Datum verschieben
                        </h3>
                        <button onclick={() => showReschedule = false} class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                            <X size={18}/>
                        </button>
                    </div>
                    
                    <div class="space-y-1">
                        <label for={`reschedule-date-${task.id}`} class="text-xs font-bold text-slate-400 uppercase">Neues Datum</label>
                        <input 
                            id={`reschedule-date-${task.id}`}
                            type="date" 
                            bind:value={rescheduleDate}
                            class="w-full rounded-lg border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 shadow-sm focus:ring-2 focus:ring-amber-500"
                        />
                    </div>

                    <div class="flex justify-end gap-2 pt-2">
                        <button onclick={() => showReschedule = false} class="px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">Abbrechen</button>
                        <button onclick={saveReschedule} class="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md">Speichern</button>
                    </div>
                </div>
            </div>
        {/if}
    </div>
</div>