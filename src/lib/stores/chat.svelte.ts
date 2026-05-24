import { pb } from '$lib/pocketbase';
import { browser } from '$app/environment';

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
	isNew?: boolean; // NEU: Flag für ungelesene Nachrichten
}

class ChatStore {
	messages = $state<ChatMessage[]>([]);
	unreadCount = $state(0);
	isChatOpen = $state(false);
	
	private initialized = false;
	private lastReadTime = 0; // Speichert den Unix-Timestamp des letzten Besuchs

	async init() {
		if (this.initialized) return;
		const user = pb.authStore.model;
		if (!user) return;
		
		const teamId = user.teamLeader || user.id;

		// Lade den letzten Besuchs-Zeitstempel aus dem Browser
		if (browser) {
			const stored = localStorage.getItem(`lawcp_chat_read_${teamId}`);
			this.lastReadTime = stored ? parseInt(stored, 10) : 0;
		}

		try {
			const records = await pb.collection('chat_messages').getFullList({
				filter: `teamId = "${teamId}"`,
				sort: 'created',
				expand: 'senderId'
			});
			
			let unread = 0;
			this.messages = records.map(r => {
				const msg = this.mapRecordToMessage(r, user.id);
				if (msg.isNew) unread++;
				return msg;
			});
			
			this.unreadCount = unread;
			this.initialized = true;

			pb.collection('chat_messages').subscribe('*', (e) => {
				if (e.action === 'create' && e.record.teamId === teamId) {
					const newMsg = this.mapRecordToMessage(e.record, user.id);
					
					// Wenn die Nachricht reinkommt, während der Chat zu ist, ist sie garantiert neu
					if (new Date(newMsg.created).getTime() > this.lastReadTime && newMsg.senderId !== user.id) {
						newMsg.isNew = true;
					}

					if (!this.messages.some(m => m.id === newMsg.id)) {
						this.messages.push(newMsg);
						
						if (newMsg.isNew && !this.isChatOpen) {
							this.unreadCount++;
						}
					}
				}
			}, { expand: 'senderId' });

		} catch (err) {
			console.error("Chat Init Error:", err);
		}
	}

	private mapRecordToMessage(r: any, myUserId: string): ChatMessage {
		const createdTime = new Date(r.created).getTime();
		// Prüft, ob die Nachricht nach dem letzten Besuch geschrieben wurde UND nicht von mir selbst ist
		const isNew = createdTime > this.lastReadTime && r.senderId !== myUserId;

		return {
			id: r.id,
			text: r.text,
			senderId: r.senderId,
			senderName: r.expand?.senderId?.name || 'System',
			senderSign: r.expand?.senderId?.shortsign || 'SYS',
			teamId: r.teamId,
			created: r.created,
			isSystem: r.isSystem,
			audioUrl: r.audio ? pb.files.getUrl(r, r.audio) : undefined,
			isNew
		};
	}

	// Wird aufgerufen, wenn die Sidebar öffnet
	markAsRead() {
		if (!browser) return;
		const user = pb.authStore.model;
		if (!user) return;
		const teamId = user.teamLeader || user.id;

		this.unreadCount = 0;
		this.lastReadTime = Date.now();
		localStorage.setItem(`lawcp_chat_read_${teamId}`, this.lastReadTime.toString());
		
		// Die isNew Flags in this.messages bleiben für die aktuelle Sitzung erhalten (damit man sieht, was neu war).
		// Beim Neuladen der Seite sind sie dann weg.
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
			const record = await pb.collection('chat_messages').create(formData, { expand: 'senderId' });
			const newMsg = this.mapRecordToMessage(record, user.id);
			if (!this.messages.some(m => m.id === newMsg.id)) {
				this.messages.push(newMsg);
			}
		} catch (err) {
			console.error("Fehler beim Senden:", err);
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
			
			const newMsg = this.mapRecordToMessage(record, user.id);
			if (!this.messages.some(m => m.id === newMsg.id)) {
				this.messages.push(newMsg);
			}
		} catch(err) {
			console.error("System Ping Error:", err);
		}
	}
}

export const chatStore = new ChatStore();