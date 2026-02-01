<script lang="ts">
    import { store, type Task, type Subtask, type SubtaskType } from '$lib/stores/tasks';
    import { Calendar, Trash2, CheckSquare, Square, Search, Mail, Copy, ArrowUpRight } from 'lucide-svelte';
    import { cn, formatDate } from '$lib/utils'; // Import from new utils

    export let task: Task;

    let newSubtaskType: SubtaskType = 'GENERIC'; 
    let dragging = false;
    let isEditingTitle = false;
    let editTitleBuffer = task.title;

    function renderTitleWithTags(title: string) {
        const team = $store.settings.team;
        return title.split(/(\s+)/).map(word => {
            const match = word.match(/^@([a-zA-Z0-9äöüÄÖÜ]+)(.*)/);
            if (match) {
                const tag = match[1];
                const rest = match[2];
                const member = team.find(m => m.shortsign.toLowerCase() === tag.toLowerCase());
                if (member) {
                    return `<span class="inline-block px-1.5 py-0.5 mx-0.5 rounded text-xs font-bold uppercase ${member.color}">@${tag}</span>${rest}`;
                }
            }
            return word;
        }).join('');
    }

    // --- LOGIC ---
    function startEdit() {
        editTitleBuffer = task.title;
        isEditingTitle = true;
        setTimeout(() => document.getElementById(`edit-${task.id}`)?.focus(), 10);
    }
    
    function saveEdit() {
        if (editTitleBuffer.trim() !== task.title) store.updateTaskTitle(task.id, editTitleBuffer);
        isEditingTitle = false;
    }

    async function copyEmail(specificSubtask?: Subtask) {
        const myTag = $store.settings.myShortsign;
        const team = $store.settings.team;
        
        // 1. Greeting: Priorität 1: Leader. Priorität 2: Tag im Title.
        let recipientName = "Kollegen";
        
        const leader = team.find(m => m.isLeader);
        if (leader) {
            recipientName = leader.name;
        } else {
            // Fallback: Suche Tag
            for (const word of task.title.split(' ')) {
                if (word.startsWith('@')) {
                    const tag = word.substring(1).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                    const member = team.find(m => m.shortsign.toLowerCase() === tag);
                    if (member) {
                        recipientName = member.name;
                        break;
                    }
                }
            }
        }

        // 2. Content
        let content = "";
        if (specificSubtask) {
            // Nur Subtask Name
            content = `Anbei darf ich übermitteln:\n- ${specificSubtask.title} (Redline)\n- ${specificSubtask.title} (Cleaned)`;
        } else {
            const docs = task.subtasks.filter(s => s.type === 'DOCUMENT');
            if (docs.length > 0) {
                const list = docs.map((d) => `- ${d.title} (Redline / Cleaned)`).join('\n');
                content = `Anbei darf ich folgende Entwürfe übermitteln:\n${list}`;
            } else {
                content = `Betreffend: ${task.title}`;
            }
        }

        const body = `Lieber ${recipientName},\n\n${content}\n\nBitte um kurze Durchsicht.\n\nLiebe Grüsse\n${myTag}`;
        
        try {
            await navigator.clipboard.writeText(body);
            alert(`E-Mail für ${recipientName} kopiert!`);
        } catch (e) { console.error(e); }
    }
    
    // ... Drag & Drop handlers (same as before) ...
    function onDragStart(e: DragEvent) {
        if(e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', task.id); dragging = true; }
    }
</script>

<div 
    role="listitem"
    class={cn("group relative flex flex-col gap-3 rounded-xl border border-gray-200 bg-white dark:bg-slate-800 dark:border-slate-700 p-5 shadow-sm hover:shadow-md transition-all cursor-move", dragging && "opacity-50")}
    draggable="true"
    ondragstart={onDragStart}
    ondragend={() => dragging = false}
>
    <div class="flex justify-between items-start">
         <span class="text-xs font-bold px-2 py-1 rounded border uppercase tracking-wider text-slate-500 bg-slate-50 border-slate-100 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600 max-w-[120px] truncate">
            {task.matterRef || 'NO-REF'}
        </span>
        <div class="flex gap-2">
            <button onclick={() => copyEmail()} aria-label="Copy Email" class="text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 p-1"><Mail size={16}/></button>
            <button onclick={() => store.deleteTask(task.id)} aria-label="Delete" class="text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>
        </div>
    </div>
    
    <div class="min-h-[28px]">
        {#if isEditingTitle}
            <textarea
                id={`edit-${task.id}`}
                bind:value={editTitleBuffer}
                onblur={saveEdit}
                onkeydown={(e) => { if(e.key === 'Enter') saveEdit(); }}
                class="w-full text-base font-medium text-gray-900 bg-gray-50 border border-blue-300 rounded p-1 focus:ring-2 focus:ring-blue-500 outline-none resize-none dark:bg-slate-700 dark:text-white"
                rows="2"
            ></textarea>
        {:else}
            <div 
                role="button" tabindex="0" onclick={startEdit} onkeydown={(e) => e.key === 'Enter' && startEdit()}
                class="text-base font-medium text-gray-900 leading-snug cursor-text hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-slate-700 rounded p-1 -m-1"
            >
                {@html renderTitleWithTags(task.title)}
            </div>
        {/if}
    </div>

    <div class="space-y-3 my-2 border-t border-gray-100 dark:border-slate-700 pt-3">
        {#each task.subtasks || [] as sub (sub.id)}
            <div class="bg-gray-50/80 dark:bg-slate-900/50 rounded-lg p-2 text-sm border border-gray-100 dark:border-slate-700">
                <div class="flex items-center gap-2 mb-1">
                    <button onclick={() => store.toggleSubtask(task.id, sub.id)} class="text-gray-400 hover:text-blue-600 flex-shrink-0">
                        {#if sub.done}<CheckSquare size={16} class="text-blue-500" />{:else}<Square size={16} />{/if}
                    </button>
                    
                    {#if sub.type === 'DOCUMENT'}<span class="px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 rounded text-[10px] font-bold">DOC</span>{/if}
                    {#if sub.type === 'RESEARCH'}<span class="px-1.5 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200 rounded text-[10px] font-bold">RES</span>{/if}
                    {#if sub.type === 'EMAIL'}<span class="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200 rounded text-[10px] font-bold">MAIL</span>{/if}
                    
                    <input type="text" value={sub.title} onchange={(e) => store.updateSubtaskTitle(task.id, sub.id, e.currentTarget.value)}
                        class={cn("flex-grow bg-transparent border-0 p-0 text-sm focus:ring-0 text-gray-700 dark:text-gray-300 font-medium", sub.done && "line-through text-gray-400")} />
                    
                    {#if sub.type === 'EMAIL'}<button onclick={() => copyEmail(sub)} class="text-gray-300 hover:text-yellow-600"><Copy size={14}/></button>{/if}
                </div>
                
                {#if !sub.done}
                    {#if sub.type === 'DOCUMENT'}
                        <div class="pl-7 flex gap-3 mt-1.5">
                            <button onclick={() => navigator.clipboard.writeText(task.title + " - " + sub.title + " Redline")} class="text-xs text-gray-400 hover:text-blue-600 flex items-center gap-1"><Copy size={12}/> Redline</button>
                            <button onclick={() => navigator.clipboard.writeText(task.title + " - " + sub.title + " Cleaned")} class="text-xs text-gray-400 hover:text-green-600 flex items-center gap-1"><Copy size={12}/> Cleaned</button>
                        </div>
                    {/if}
                    {/if}
            </div>
        {/each}

        <div class="flex gap-2 items-center mt-3 opacity-60 focus-within:opacity-100 hover:opacity-100 transition-opacity">
            <select bind:value={newSubtaskType} class="text-xs bg-gray-100 dark:bg-slate-700 border-0 rounded px-2 py-1 text-gray-600 dark:text-gray-300 cursor-pointer focus:ring-0">
                <option value="GENERIC">Task</option>
                <option value="DOCUMENT">Doc</option>
                <option value="RESEARCH">Res</option>
                <option value="EMAIL">Mail</option>
            </select>
            <input type="text" placeholder="Neuer Subtask..." class="flex-grow bg-transparent border-0 p-0 text-sm placeholder:text-gray-400 focus:ring-0 text-gray-700 dark:text-gray-300"
                onkeydown={(e) => { if(e.key === 'Enter' && e.currentTarget.value) { store.addSubtask(task.id, e.currentTarget.value, newSubtaskType); e.currentTarget.value=''; } }} />
        </div>
    </div>

    <div class="flex items-center justify-between border-t border-gray-100 dark:border-slate-700 pt-3 mt-1">
        <div class="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-blue-600 transition-colors relative group/date">
            <Calendar size={14} />
            <span>{formatDate(task.dueDate)}</span>
            <input type="date" value={task.dueDate} onchange={(e) => store.updateDate(task.id, e.currentTarget.value)} 
                class="absolute inset-0 opacity-0 cursor-pointer w-full" />
        </div>
    </div>
</div>