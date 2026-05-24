<script lang="ts">
	import { chatStore } from '$lib/stores/chat.svelte';
	import { store } from '$lib/stores/tasks';
	import { pb } from '$lib/pocketbase';
	import { X, Send, Mic, MessageSquare, AlertCircle, Square, Trash2 } from 'lucide-svelte';
	import { fly, fade } from 'svelte/transition';
	import { onMount, tick } from 'svelte';

	let { isOpen = $bindable(false) } = $props();
	
	let inputText = $state('');
	let scrollContainer: HTMLElement;
	let textareaEl: HTMLTextAreaElement;

	// Mentions State
	let showMentions = $state(false);
	let mentionQuery = $state('');
	let mentionIndex = $state(0);
	let mentionStartIdx = $state(-1);

	// VOICE RECORDING & PREVIEW STATE
	type RecordState = 'idle' | 'recording' | 'preview';
	let recordState = $state<RecordState>('idle');
	let mediaRecorder = $state<MediaRecorder | null>(null);
	let audioChunks: Blob[] = [];
	let previewAudioBlob = $state<Blob | null>(null);
	let previewAudioUrl = $state<string | null>(null);

	let mentionableUsers = $derived($store.firmUsers.filter(u => u.shortsign));
	let filteredMentions = $derived(
		showMentions 
		? mentionableUsers.filter(u => 
			u.shortsign?.toLowerCase().includes(mentionQuery) || 
			u.name?.toLowerCase().includes(mentionQuery)
		  ).slice(0, 5) 
		: []
	);

	onMount(() => {
		chatStore.init();
	});

	$effect(() => {
		if (chatStore.messages.length > 0 && scrollContainer) {
			tick().then(() => {
				scrollContainer.scrollTop = scrollContainer.scrollHeight;
			});
		}
	});

	const myId = pb.authStore.model?.id;

	function handleSend() {
		if (!inputText.trim()) return;
		chatStore.sendMessage(inputText);
		inputText = '';
		showMentions = false;
	}

	function sendVoiceMessage() {
		if (!previewAudioBlob) return;
		chatStore.sendMessage('🎤 Sprachnachricht', previewAudioBlob);
		discardVoiceMessage();
	}

	function discardVoiceMessage() {
		if (previewAudioUrl) URL.revokeObjectURL(previewAudioUrl);
		previewAudioBlob = null;
		previewAudioUrl = null;
		recordState = 'idle';
		audioChunks = [];
	}

	async function startRecording() {
		try {
			// FIX: Erzwingt Studio-ähnliche Audioverbesserungen vom Browser/OS
			const stream = await navigator.mediaDevices.getUserMedia({ 
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true,
					sampleRate: 48000
				} 
			});

			// FIX: Nutzt den hochwertigen Opus-Codec für WebM, falls vom Browser unterstützt
			const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
				? { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 128000 } 
				: undefined;

			mediaRecorder = new MediaRecorder(stream, options);
			audioChunks = [];

			mediaRecorder.ondataavailable = (e) => {
				if (e.data.size > 0) audioChunks.push(e.data);
			};

			mediaRecorder.onstop = () => {
				previewAudioBlob = new Blob(audioChunks, { type: 'audio/webm' });
				previewAudioUrl = URL.createObjectURL(previewAudioBlob);
				
				// Stream hart beenden (entfernt den roten Recording-Punkt im Tab)
				stream.getTracks().forEach(track => track.stop());
				mediaRecorder = null;
				recordState = 'preview'; // Wechsel in den Preview-Modus
			};

			mediaRecorder.start();
			recordState = 'recording';
		} catch (err) {
			console.error("Mikrofon-Zugriff verweigert oder Hardware fehlerhaft:", err);
			alert("Bitte erlaube den Mikrofon-Zugriff im Browser, um Sprachnachrichten aufzunehmen.");
		}
	}

	function stopRecording() {
		if (mediaRecorder && mediaRecorder.state !== 'inactive') {
			mediaRecorder.stop();
		}
	}

	function handleInput() {
		const text = inputText;
		const cursorPos = textareaEl.selectionStart;

		const textBeforeCursor = text.slice(0, cursorPos);
		const match = textBeforeCursor.match(/(?:^|\s)@(\w*)$/);

		if (match) {
			showMentions = true;
			mentionQuery = match[1].toLowerCase();
			mentionStartIdx = match.index === 0 ? 0 : match.index! + 1;
			mentionIndex = 0;
		} else {
			showMentions = false;
		}
	}

	function insertMention(user: any) {
		const before = inputText.slice(0, mentionStartIdx);
		const after = inputText.slice(textareaEl.selectionStart);
		inputText = before + `@${user.shortsign} ` + after;
		showMentions = false;
		
		setTimeout(() => {
			textareaEl.focus();
			textareaEl.selectionStart = textareaEl.selectionEnd = before.length + user.shortsign.length + 2;
		}, 10);
	}

	function onKeydown(e: KeyboardEvent) {
		if (showMentions && filteredMentions.length > 0) {
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				mentionIndex = (mentionIndex + 1) % filteredMentions.length;
				return;
			} else if (e.key === 'ArrowUp') {
				e.preventDefault();
				mentionIndex = (mentionIndex - 1 + filteredMentions.length) % filteredMentions.length;
				return;
			} else if (e.key === 'Enter' || e.key === 'Tab') {
				e.preventDefault();
				insertMention(filteredMentions[mentionIndex]);
				return;
			} else if (e.key === 'Escape') {
				showMentions = false;
				return;
			}
		}

		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	}

	function formatMessage(text: string) {
		let formatted = text
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;");
		
		formatted = formatted.replace(/@(\w+)/g, "<span class='bg-black/10 dark:bg-white/10 font-bold px-1.5 py-0.5 rounded'>@$1</span>");
		formatted = formatted.replace(/"([^"]+)"/g, "<span class='bg-black/10 dark:bg-white/10 italic font-medium px-1.5 py-0.5 rounded'>&quot;$1&quot;</span>");
		formatted = formatted.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

		return formatted;
	}
</script>

{#if isOpen}
	<div 
		class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[150] lg:hidden"
		transition:fade={{ duration: 150 }}
		onclick={() => isOpen = false}
		role="button"
		tabindex="-1"
		onkeydown={(e) => e.key === 'Escape' && (isOpen = false)}
	></div>

	<div 
		class="fixed inset-y-0 right-0 w-full sm:w-[400px] bg-white dark:bg-slate-900 shadow-2xl z-[200] border-l border-slate-200 dark:border-slate-800 flex flex-col"
		transition:fly={{ x: '100%', duration: 250, opacity: 1 }}
	>
		<div class="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
			<div class="flex items-center gap-2 text-slate-800 dark:text-white">
				<MessageSquare class="text-brand-600 dark:text-brand-400" size={20} />
				<h2 class="font-bold text-lg">Team Chat</h2>
			</div>
			<button onclick={() => isOpen = false} class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors outline-none focus:ring-2 focus:ring-brand-500">
				<X size={20} />
			</button>
		</div>

		<div bind:this={scrollContainer} class="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/50 dark:bg-slate-950/50">
			{#if chatStore.messages.length === 0}
				<div class="h-full flex flex-col items-center justify-center text-slate-400">
					<MessageSquare size={32} class="mb-2 opacity-50" />
					<p class="text-sm font-medium">Noch keine Nachrichten im Team.</p>
				</div>
			{/if}

			{#each chatStore.messages as msg}
				{#if msg.isSystem}
					<div class="flex items-start gap-2 bg-brand-50 dark:bg-brand-900/10 border border-brand-200 dark:border-brand-800/50 p-3 rounded-lg text-sm text-brand-900 dark:text-brand-100 shadow-sm mx-4">
						<AlertCircle size={16} class="text-brand-600 dark:text-brand-400 shrink-0 mt-0.5" />
						<div class="leading-snug">{@html formatMessage(msg.text)}</div>
					</div>
				{:else}
					<div class={`flex flex-col ${msg.senderId === myId ? 'items-end' : 'items-start'}`}>
						<span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">
							{msg.senderSign} • {new Date(msg.created).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
						</span>
						
						<div class={`px-3.5 py-2.5 rounded-xl max-w-[85%] text-sm shadow-sm leading-snug border ${msg.senderId === myId ? 'bg-brand-100 dark:bg-brand-900/40 text-brand-900 dark:text-brand-50 border-brand-200 dark:border-brand-800 rounded-tr-sm' : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-200 dark:border-slate-700 rounded-tl-sm'}`}>
							{#if msg.audioUrl}
								<audio controls src={msg.audioUrl} class="max-w-[220px] h-9 outline-none"></audio>
							{:else}
								{@html formatMessage(msg.text)}
							{/if}
						</div>
					</div>
				{/if}
			{/each}
		</div>

		<div class="relative p-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
			
			{#if showMentions && filteredMentions.length > 0}
				<div class="absolute bottom-full left-3 mb-2 w-64 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
					{#each filteredMentions as user, i}
						<button
							class={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-3 outline-none transition-all border-l-2 ${i === mentionIndex ? 'bg-slate-50 dark:bg-slate-700/50 border-brand-500 text-slate-900 dark:text-white' : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
							onclick={() => insertMention(user)}
							onmouseenter={() => mentionIndex = i}
						>
							<span class={`font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-[10px] ${i === mentionIndex ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-400' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
								{user.shortsign}
							</span>
							<span class="truncate font-medium">{user.name || user.email}</span>
							{#if i === mentionIndex}
								<span class="ml-auto text-[10px] text-brand-600 dark:text-brand-400 font-bold uppercase tracking-widest">Enter</span>
							{/if}
						</button>
					{/each}
				</div>
			{/if}

			<div class="flex items-end gap-2 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-1.5 focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-brand-500 transition-all min-h-[46px]">
				
				{#if recordState === 'idle'}
					<button 
						class="p-2 shrink-0 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors outline-none"
						onclick={startRecording}
						title="Voice Message aufnehmen"
					>
						<Mic size={20} />
					</button>
					
					<textarea 
						bind:this={textareaEl}
						bind:value={inputText}
						oninput={handleInput}
						onkeydown={onKeydown}
						placeholder="Nachricht... (@Name oder &quot;Akte&quot;)"
						class="flex-1 max-h-32 bg-transparent border-0 focus:ring-0 resize-none py-2.5 px-1 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none"
						rows="1"
					></textarea>

					<button 
						onclick={handleSend}
						disabled={!inputText.trim()}
						class="p-2 shrink-0 bg-brand-600 hover:bg-brand-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-1"
					>
						<Send size={18} />
					</button>

				{:else if recordState === 'recording'}
					<button 
						class="p-2 shrink-0 rounded-lg text-rose-600 bg-rose-100 dark:bg-rose-900/30 hover:bg-rose-200 transition-colors outline-none animate-pulse"
						onclick={stopRecording}
						title="Aufnahme stoppen"
					>
						<Square size={20} class="fill-current" />
					</button>
					
					<div class="flex-1 flex items-center justify-center py-2 px-1">
						<span class="text-sm font-bold text-rose-600 dark:text-rose-400 animate-pulse tracking-wide">
							Aufnahme läuft...
						</span>
					</div>

					<div class="p-2 shrink-0 w-10"></div> {:else if recordState === 'preview'}
					<button 
						class="p-2 shrink-0 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors outline-none"
						onclick={discardVoiceMessage}
						title="Verwerfen"
					>
						<Trash2 size={20} />
					</button>
					
					<div class="flex-1 flex items-center justify-center py-1">
						{#if previewAudioUrl}
							<audio src={previewAudioUrl} controls class="w-full h-8 max-w-[220px] outline-none"></audio>
						{/if}
					</div>

					<button 
						onclick={sendVoiceMessage}
						class="p-2 shrink-0 bg-brand-600 hover:bg-brand-500 text-white rounded-lg transition-colors outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-1"
						title="Senden"
					>
						<Send size={18} />
					</button>
				{/if}

			</div>
			
			<div class="text-center mt-1.5 text-[9px] text-slate-400 font-medium uppercase tracking-widest">
				Strg+Enter für Zeile • Enter zum Senden
			</div>
		</div>
	</div>
{/if}