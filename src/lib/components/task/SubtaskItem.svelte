<script lang="ts">
    import { store } from '$lib/stores/tasks';
    import type { Subtask } from '$lib/types';
    // FIX: Trash2 Icon importiert
    import { CheckSquare, Square, Copy, ListPlus, CornerDownRight, Check, X, Trash2 } from 'lucide-svelte';
    import { cn, renderTitleWithTags } from '$lib/utils';
    import { autosize, focusOnMount } from '$lib/actions';

    export let taskId: string;
    export let sub: Subtask;

    let isEditing = false;
    let addingChild = false;
    let newChildTitle = '';

    // -- EDITING THIS SUBTASK --
    function startEdit() {
        isEditing = true;
        setTimeout(() => document.getElementById(`sub-edit-${sub.id}`)?.focus(), 10);
    }

    function stopEdit() {
        isEditing = false;
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
            e.preventDefault();
            stopEdit();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            stopEdit();
            startAddChild();
        }
    }

    // -- ADDING CHILDREN --
    function startAddChild() {
        addingChild = true;
        newChildTitle = '';
    }

    function cancelAddChild() {
        addingChild = false;
        newChildTitle = '';
    }

    function confirmAddChild() {
        if(newChildTitle.trim()) {
            store.addSubSubtask(taskId, sub.id, newChildTitle.trim());
            newChildTitle = '';
        } else {
            cancelAddChild();
        }
    }

    async function copyEmail() {
        const team = $store.settings.team;
        const leader = team.find(m => m.isLeader);
        const recipientName = leader ? leader.name : "Kollegen";
        const body = `Liebe ${recipientName},\n\n${sub.title}\n\nLG`;
        try {
            await navigator.clipboard.writeText(body);
            alert("E-Mail kopiert!");
        } catch(e) {
            console.error(e);
        }
    }

    function getFullFilename(variant: string) {
        const date = new Date().toLocaleDateString('de-DE', {day: '2-digit', month: '2-digit', year: 'numeric'}).replace(/\./g, '-');
        const cleanSub = sub.title.replace(/[^a-zA-Z0-9äöüÄÖÜß ]/g, "").trim();
        return `${date} - ${cleanSub} ${variant}`;
    }
</script>

<div class="bg-gray-50/80 dark:bg-slate-900/50 rounded-lg p-2 text-sm border border-gray-100 dark:border-slate-700 flex flex-col gap-1 group/sub">
    
    <div class="flex items-start gap-2 relative w-full">
        <button onclick={() => store.toggleSubtask(taskId, sub.id)} class="text-gray-400 hover:text-blue-600 flex-shrink-0 mt-0.5">
            {#if sub.done}<CheckSquare size={16} class="text-blue-500" />{:else}<Square size={16} />{/if}
        </button>

        {#if isEditing}
            <textarea
                id={`sub-edit-${sub.id}`}
                use:autosize
                value={sub.title}
                onchange={(e) => store.updateSubtaskTitle(taskId, sub.id, e.currentTarget.value)}
                onblur={stopEdit}
                onkeydown={handleKeyDown}
                rows="1"
                spellcheck="false"
                class="flex-grow min-w-0 w-full bg-white dark:bg-slate-800 border border-blue-300 rounded p-1 text-sm focus:ring-0 resize-none overflow-hidden leading-snug block min-h-[20px] whitespace-pre-wrap break-words"
            ></textarea>
        {:else}
            <div
                role="button"
                tabindex="0"
                onclick={startEdit}
                onkeydown={(e) => e.key === 'Enter' && startEdit()}
                class={cn("flex-grow min-w-0 w-full p-0 text-sm leading-snug min-h-[20px] cursor-text break-words whitespace-pre-wrap border border-transparent hover:border-slate-200 rounded px-1 -mx-1", sub.done && "line-through text-gray-400")}
            >
                {@html renderTitleWithTags(sub.title, $store.settings.team)}
            </div>
        {/if}

        <div class="flex-shrink-0 flex gap-0.5 items-center">
            <button onclick={startAddChild} class="text-gray-300 hover:text-amber-600 opacity-0 group-hover/sub:opacity-100 mt-0.5 transition-opacity" title="Subtask hinzufügen">
                <ListPlus size={14} />
            </button>
            {#if sub.type === 'EMAIL'}
                <button onclick={copyEmail} class="text-gray-300 hover:text-yellow-600 opacity-0 group-hover/sub:opacity-100 mt-0.5" title="E-Mail kopieren">
                    <Copy size={14}/>
                </button>
            {/if}
            
            <button 
                onclick={(e) => {
                    e.stopPropagation();
                    store.deleteSubtask(taskId, sub.id);
                }} 
                class="text-gray-300 hover:text-red-500 opacity-0 group-hover/sub:opacity-100 mt-0.5 transition-opacity ml-1" 
                title="Löschen"
            >
                <Trash2 size={14} />
            </button>
        </div>
    </div>

    {#if !sub.done && sub.type === 'DOCUMENT'}
        <div class="pl-7 flex gap-3">
            <button onclick={() => navigator.clipboard.writeText(getFullFilename('Redline'))} class="text-xs text-gray-400 hover:text-blue-600 flex items-center gap-1"><Copy size={12}/> Redline</button>
            <button onclick={() => navigator.clipboard.writeText(getFullFilename('Cleaned'))} class="text-xs text-gray-400 hover:text-green-600 flex items-center gap-1"><Copy size={12}/> Cleaned</button>
        </div>
    {/if}

    {#if (sub.subtasks && sub.subtasks.length > 0) || addingChild}
        <div class="pl-4 mt-1 space-y-1 border-l-2 border-slate-200 dark:border-slate-700 ml-2">
            {#each sub.subtasks || [] as child (child.id)}
                <svelte:self {taskId} sub={child} />
            {/each}

            {#if addingChild}
                <div class="flex items-start gap-2 animate-in fade-in slide-in-from-top-1 duration-200 w-full">
                    <div class="text-amber-500 mt-1.5 flex-shrink-0"><CornerDownRight size={12}/></div>
                    <div class="flex-grow flex gap-2 items-start min-w-0">
                        <textarea
                            use:autosize={newChildTitle}
                            use:focusOnMount
                            bind:value={newChildTitle}
                            onkeydown={(e) => {
                                if(e.key==='Enter'){e.preventDefault(); confirmAddChild();}
                                if(e.key==='Escape') cancelAddChild();
                            }}
                            onblur={() => {
                                if(!newChildTitle.trim()) cancelAddChild();
                            }}
                            rows="1"
                            placeholder="Unterschritt..."
                            class="flex-grow min-w-0 w-full bg-white dark:bg-slate-800 border border-amber-500 rounded p-2 text-xs focus:ring-0 text-gray-900 dark:text-white resize-none overflow-hidden leading-snug block min-h-[32px] shadow-sm whitespace-pre-wrap break-words"
                        ></textarea>
                        <div class="flex-shrink-0 flex gap-1">
                            <button onclick={confirmAddChild} class="text-amber-600 hover:text-amber-700 bg-amber-50 dark:bg-amber-900/20 p-1.5 rounded h-8 w-8 flex items-center justify-center"><Check size={14}/></button>
                            <button onclick={cancelAddChild} class="text-slate-400 hover:text-slate-600 bg-slate-50 dark:bg-slate-800 p-1.5 rounded h-8 w-8 flex items-center justify-center"><X size={14}/></button>
                        </div>
                    </div>
                </div>
            {/if}
        </div>
    {/if}
</div>