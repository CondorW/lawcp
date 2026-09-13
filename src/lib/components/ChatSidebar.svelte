<script lang="ts">
	import { chatStore } from '$lib/stores/chat.svelte';
	import { store } from '$lib/stores/tasks';
	import { pb } from '$lib/pocketbase';
	import { X, Send, Mic, MessageSquare, AlertCircle, Square, Trash2 } from 'lucide-svelte';
	import { fly, fade } from 'svelte/transition';
	import { onMount, tick, untrack } from 'svelte';
	import ChatMessageText from '$lib/components/text/ChatMessageText.svelte';
	import type { FirmUser } from '$lib/types';
	import { toastStore } from '$lib/stores/toasts';
	
	let { isOpen = $bindable(false) } = $props();

	let inputText = $state('');

	// FIX: DOM Referenzen mit $state(...) um Linter zu befriedigen und Reaktivität zu garantieren
	let scrollContainer = $state<HTMLElement | null>(null);
	let textareaEl = $state<HTMLTextAreaElement | null>(null);

	let showMentions = $state(false);
	let mentionQuery = $state('');
	let mentionIndex = $state(0);
	let mentionStartIdx = $state(-1);

	type RecordState = 'idle' | 'recording' | 'preview';
	let recordState = $state<RecordState>('idle');
	let mediaRecorder = $state<MediaRecorder | null>(null);
	let audioChunks: Blob[] = [];
	let previewAudioBlob = $state<Blob | null>(null);
	let previewAudioUrl = $state<string | null>(null);

	let mentionableUsers = $derived($store.firmUsers.filter((u) => u.shortsign));
	let filteredMentions = $derived(
		showMentions
			? mentionableUsers
					.filter(
						(u) =>
							u.shortsign?.toLowerCase().includes(mentionQuery) ||
							u.name?.toLowerCase().includes(mentionQuery)
					)
					.slice(0, 5)
			: []
	);

	onMount(() => {
		void chatStore.init();
	});

	$effect(() => {
		const open = isOpen;

		// Store-Änderungen dürfen keine Abhängigkeiten dieses Effects werden.
		untrack(() => {
			chatStore.isChatOpen = open;
			if (open) chatStore.markAsRead();
		});

		if (open) scrollToLatestMessage();
	});

	let msgLen = $derived(chatStore.messages.length);
	$effect(() => {
		if (msgLen > 0 && isOpen) scrollToLatestMessage();
	});

	function scrollToLatestMessage(): void {
		void tick().then(() => {
			setTimeout(() => {
				if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;
			}, 50);
		});
	}

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
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true,
					sampleRate: 48000
				}
			});

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
				stream.getTracks().forEach((track) => track.stop());
				mediaRecorder = null;
				recordState = 'preview';
			};

			mediaRecorder.start();
			recordState = 'recording';
		} catch (err) {
			console.error('Mikrofon-Zugriff verweigert:', err);
			toastStore.error(
				'Mikrofon nicht verfügbar',
				'Bitte erlaube den Mikrofon-Zugriff im Browser, um Sprachnachrichten aufzunehmen.'
			);
		}
	}

	function stopRecording() {
		if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
	}

	function handleInput() {
		if (!textareaEl) return;
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

	function insertMention(user: FirmUser) {
		const shortsign = user.shortsign;
		if (!textareaEl || !shortsign) return;
		const before = inputText.slice(0, mentionStartIdx);
		const after = inputText.slice(textareaEl.selectionStart);
		inputText = before + `@${shortsign} ` + after;
		showMentions = false;

		setTimeout(() => {
			if (textareaEl) {
				textareaEl.focus();
				textareaEl.selectionStart = textareaEl.selectionEnd = before.length + shortsign.length + 2;
			}
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
</script>

{#if isOpen}
	<div
		class="fixed inset-0 z-[150] bg-slate-900/40 backdrop-blur-sm lg:hidden"
		transition:fade={{ duration: 150 }}
		onclick={() => (isOpen = false)}
		role="button"
		tabindex="-1"
		onkeydown={(e) => e.key === 'Escape' && (isOpen = false)}
	></div>

	<div
		class="fixed inset-y-0 right-0 z-[200] flex w-full flex-col border-l border-slate-200 bg-white shadow-2xl sm:w-[400px] dark:border-slate-800 dark:bg-slate-900"
		transition:fly={{ x: '100%', duration: 250, opacity: 1 }}
	>
		<div
			class="z-10 flex shrink-0 items-center justify-between border-b border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
		>
			<div class="flex items-center gap-2 text-slate-800 dark:text-white">
				<MessageSquare class="text-brand-600 dark:text-brand-400" size={20} />
				<h2 class="text-lg font-bold">Team Chat</h2>
			</div>
			<button
				onclick={() => (isOpen = false)}
				class="rounded-lg p-2 text-slate-400 transition-colors outline-none hover:bg-slate-100 hover:text-slate-600 focus:ring-2 focus:ring-brand-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
			>
				<X size={20} />
			</button>
		</div>

		<div
			bind:this={scrollContainer}
			class="custom-scrollbar flex-1 space-y-4 overflow-y-auto bg-slate-50/50 p-4 dark:bg-slate-950/50"
		>
			{#if chatStore.messages.length === 0}
				<div class="flex h-full flex-col items-center justify-center text-slate-400">
					<MessageSquare size={32} class="mb-2 opacity-50" />
					<p class="text-sm font-medium">Noch keine Nachrichten im Team.</p>
				</div>
			{/if}

			{#each chatStore.messages as msg (msg.id)}
				{#if msg.isSystem}
					<div
						class="relative mx-4 flex items-start gap-2 rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900 shadow-sm dark:border-brand-800/50 dark:bg-brand-900/10 dark:text-brand-100"
					>
						{#if msg.isNew}
							<span
								class="absolute -top-2 -right-2 animate-pulse rounded bg-rose-500 px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-white uppercase shadow-sm"
								>Neu</span
							>
						{/if}
						<AlertCircle size={16} class="mt-0.5 shrink-0 text-brand-600 dark:text-brand-400" />
						<div class="leading-snug"><ChatMessageText text={msg.text} /></div>
					</div>
				{:else}
					<div class={`flex flex-col ${msg.senderId === myId ? 'items-end' : 'items-start'}`}>
						<span
							class="mb-1 flex items-center gap-1.5 px-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase"
						>
							{msg.senderSign} • {new Date(msg.created).toLocaleTimeString('de-DE', {
								hour: '2-digit',
								minute: '2-digit'
							})}
							{#if msg.isNew}
								<span
									class="animate-pulse rounded-sm bg-rose-100 px-1.5 py-0.5 text-[8px] font-bold text-rose-600 dark:bg-rose-900/40 dark:text-rose-400"
									>Neu</span
								>
							{/if}
						</span>

						<div
							class={`max-w-[85%] rounded-xl border px-3.5 py-2.5 text-sm leading-snug shadow-sm ${msg.senderId === myId ? 'rounded-tr-sm border-brand-200 bg-brand-100 text-brand-900 dark:border-brand-800 dark:bg-brand-900/40 dark:text-brand-50' : 'rounded-tl-sm border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white'}`}
						>
							{#if msg.audioUrl}
								<audio controls src={msg.audioUrl} class="h-9 max-w-[220px] outline-none"></audio>
							{:else}
								<ChatMessageText text={msg.text} />
							{/if}
						</div>
					</div>
				{/if}
			{/each}
		</div>

		<div
			class="relative shrink-0 border-t border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
		>
			{#if showMentions && filteredMentions.length > 0}
				<div
					class="animate-in fade-in slide-in-from-bottom-2 absolute bottom-full left-3 z-50 mb-2 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl duration-150 dark:border-slate-700 dark:bg-slate-800"
				>
					{#each filteredMentions as user, i (user.id)}
						<button
							class={`flex w-full items-center gap-3 border-l-2 px-3 py-2.5 text-left text-sm transition-all outline-none ${i === mentionIndex ? 'border-brand-500 bg-slate-50 text-slate-900 dark:bg-slate-700/50 dark:text-white' : 'border-transparent text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'}`}
							onclick={() => insertMention(user)}
							onmouseenter={() => (mentionIndex = i)}
						>
							<span
								class={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${i === mentionIndex ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-400' : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}
							>
								{user.shortsign}
							</span>
							<span class="truncate font-medium">{user.name || user.email}</span>
							{#if i === mentionIndex}
								<span
									class="ml-auto text-[10px] font-bold tracking-widest text-brand-600 uppercase dark:text-brand-400"
									>Enter</span
								>
							{/if}
						</button>
					{/each}
				</div>
			{/if}

			<div
				class="flex min-h-[46px] items-end gap-2 rounded-xl border border-slate-200 bg-slate-100 p-1.5 transition-all focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500 dark:border-slate-700 dark:bg-slate-800"
			>
				{#if recordState === 'idle'}
					<button
						class="shrink-0 rounded-lg p-2 text-slate-400 transition-colors outline-none hover:bg-slate-200 hover:text-brand-600 dark:hover:bg-slate-700"
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
						class="max-h-32 flex-1 resize-none border-0 bg-transparent px-1 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-0 dark:text-white"
						rows="1"
					></textarea>

					<button
						onclick={handleSend}
						disabled={!inputText.trim()}
						class="shrink-0 rounded-lg bg-brand-600 p-2 text-white transition-colors outline-none hover:bg-brand-500 focus:ring-2 focus:ring-brand-400 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<Send size={18} />
					</button>
				{:else if recordState === 'recording'}
					<button
						class="shrink-0 animate-pulse rounded-lg bg-rose-100 p-2 text-rose-600 transition-colors outline-none hover:bg-rose-200 dark:bg-rose-900/30"
						onclick={stopRecording}
						title="Aufnahme stoppen"
					>
						<Square size={20} class="fill-current" />
					</button>

					<div class="flex flex-1 items-center justify-center px-1 py-2">
						<span
							class="animate-pulse text-sm font-bold tracking-wide text-rose-600 dark:text-rose-400"
							>Aufnahme läuft...</span
						>
					</div>
					<div class="w-10 shrink-0 p-2"></div>
				{:else if recordState === 'preview'}
					<button
						class="shrink-0 rounded-lg p-2 text-slate-400 transition-colors outline-none hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30"
						onclick={discardVoiceMessage}
						title="Verwerfen"
					>
						<Trash2 size={20} />
					</button>

					<div class="flex flex-1 items-center justify-center py-1">
						{#if previewAudioUrl}
							<audio src={previewAudioUrl} controls class="h-8 w-full max-w-[220px] outline-none"
							></audio>
						{/if}
					</div>

					<button
						onclick={sendVoiceMessage}
						class="shrink-0 rounded-lg bg-brand-600 p-2 text-white transition-colors outline-none hover:bg-brand-500 focus:ring-2 focus:ring-brand-400 focus:ring-offset-1"
						title="Senden"
					>
						<Send size={18} />
					</button>
				{/if}
			</div>

			<div
				class="mt-1.5 text-center text-[9px] font-medium tracking-widest text-slate-400 uppercase"
			>
				Strg+Enter für Zeile • Enter zum Senden
			</div>
		</div>
	</div>
{/if}