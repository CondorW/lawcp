import { pb } from '$lib/pocketbase';
import type { RecordModel } from 'pocketbase';

export interface ChatMessage {
	id: string;
	text: string;
	senderId: string;
	senderName: string;
	senderSign: string;
	teamId: string;
	created: string;
	isSystem: boolean;
	audioUrl?: string;
}

class ChatStore {
	// SVELTE 5 RUNE: State ist jetzt global und direkt reaktiv
	messages = $state<ChatMessage[]>([]);
	private initialized = false;

	async init() {
		if (this.initialized) return;
		const user = pb.authStore.model;
		if (!user) return;
		
		const teamId = user.teamLeader || user.id;

		try {
			// Lade die Historie aus PocketBase
			const records = await pb.collection('chat_messages').getFullList({
				filter: `teamId = "${teamId}"`,
				sort: 'created', // Älteste zuerst, damit unten die neusten stehen
				expand: 'senderId'
			});
			
			this.messages = records.map(r => this.mapRecordToMessage(r));
			this.initialized = true;

			// Realtime-Abonnement für Nachrichten von anderen Teammitgliedern
			pb.collection('chat_messages').subscribe('*', (e) => {
				if (e.action === 'create' && e.record.teamId === teamId) {
					const newMsg = this.mapRecordToMessage(e.record);
					// Verhindern, dass unsere eigenen (bereits hinzugefügten) Nachrichten doppelt auftauchen
					if (!this.messages.some(m => m.id === newMsg.id)) {
						this.messages.push(newMsg);
					}
				}
			}, { expand: 'senderId' });

		} catch (err) {
			console.error("Chat Init Error. Gibt es die Collection 'chat_messages' in PocketBase?", err);
		}
	}

	private mapRecordToMessage(r: any): ChatMessage {
		return {
			id: r.id,
			text: r.text,
			senderId: r.senderId,
			senderName: r.expand?.senderId?.name || 'System',
			senderSign: r.expand?.senderId?.shortsign || 'SYS',
			teamId: r.teamId,
			created: r.created,
			isSystem: r.isSystem,
			audioUrl: r.audio ? pb.files.getUrl(r, r.audio) : undefined
		};
	}

	async sendMessage(text: string, audioBlob?: Blob) {
		const user = pb.authStore.model;
		if (!user) return;
		const teamId = user.teamLeader || user.id;

		const formData = new FormData();
		formData.append('text', text);
		formData.append('senderId', user.id);
		formData.append('teamId', teamId);
		formData.append('isSystem', 'false');
		if (audioBlob) formData.append('audio', audioBlob);

		try {
			// Speichern in PocketBase
			const record = await pb.collection('chat_messages').create(formData, { expand: 'senderId' });
			
			// Optimistic UI: Sofort lokal hinzufügen, um Latenz zu vermeiden
			const newMsg = this.mapRecordToMessage(record);
			if (!this.messages.some(m => m.id === newMsg.id)) {
				this.messages.push(newMsg);
			}
		} catch (err) {
			console.error("Fehler beim Senden der Nachricht an PocketBase:", err);
		}
	}

	async sendReviewPing(caseTitle: string, subtaskTitle: string) {
		const user = pb.authStore.model;
		if (!user) return;
		const teamId = user.teamLeader || user.id;

		const text = `Review Anfrage von @${user.shortsign}: Der Task **${subtaskTitle}** in der Akte "${caseTitle}" ist bereit zur Prüfung.`;

		try {
			const record = await pb.collection('chat_messages').create({
				text,
				senderId: user.id,
				teamId: teamId,
				isSystem: true
			}, { expand: 'senderId' });
			
			const newMsg = this.mapRecordToMessage(record);
			if (!this.messages.some(m => m.id === newMsg.id)) {
				this.messages.push(newMsg);
			}
		} catch(err) {
			console.error("System Ping Error:", err);
		}
	}
}

export const chatStore = new ChatStore();