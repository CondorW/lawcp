<script lang="ts">
    import { store } from '$lib/stores/tasks';
    import type { Task, Subtask, SubtaskType } from '$lib/types';
    import { Calendar, Trash2, CheckSquare, Square, Mail, Copy, Flag, Search, ArrowUpRight, X } from 'lucide-svelte';
    import { cn, formatDate } from '$lib/utils';
    import { scale, fade } from 'svelte/transition';

    export let task: Task;

    let newSubtaskType: SubtaskType = 'GENERIC'; 
    let newSubtaskTitle = '';
    let dragging = false;
    let isEditingTitle = false;
    let editTitleBuffer = task.title;

    // Reschedule State
    let showReschedule = false;
    let rescheduleDate = task.dueDate;

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
        // Prevent drag if modal is open or interacting with inputs
        if ((e.target as HTMLElement).tagName === 'INPUT' || showReschedule) { e.preventDefault(); return; }
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
    function autosize(node: HTMLTextAreaElement) {
        const resize = () => {
            node.style.height = 'auto';
            node.style.height = node.scrollHeight + 'px';
        };
        node.addEventListener('input', resize);
        
        // Initialer Resize (Verzögert, damit Value gerendert ist)
        setTimeout(resize, 0); 
        
        return {
            destroy() { node.removeEventListener('input', resize); }
        };
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
         <span class="text-xs font-bold px-2 py-1 rounded border uppercase tracking-wider text-slate-500 bg-slate-50 border-slate-100 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600 max-w-[120px] truncate">
            {task.matterRef || 'NO-REF'}
        </span>
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
            <div role="button" tabindex="0" onclick={startEdit}
                class={cn("text-base font-medium text-gray-900 leading-snug cursor-text hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-slate-700 rounded p-1 -m-1 break-words", task.status === 'DONE' && "line-through text-gray-500 dark:text-gray-500")}>
                {@html renderTitleWithTags(task.title)}
            </div>
        {/if}
    </div>

    <div class="space-y-3 my-2 border-t border-gray-100 dark:border-slate-700 pt-3">
        {#each task.subtasks || [] as sub (sub.id)}
            <div class="bg-gray-50/80 dark:bg-slate-900/50 rounded-lg p-2 text-sm border border-gray-100 dark:border-slate-700 flex flex-col gap-1 group/sub">
                <div class="flex items-start gap-2">
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
                        <label class="text-xs font-bold text-slate-400 uppercase">Neues Datum</label>
                        <input 
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