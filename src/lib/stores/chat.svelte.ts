import { browser } from '$app/environment';
import { getPrimaryRelationId } from '$lib/domain/users';
import { pb } from '$lib/pocketbase';
import { z } from 'zod';

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
	isNew?: boolean;
}

const ChatRecordSchema = z
	.object({
		id: z.string(),
		text: z.string().default(''),
		senderId: z.string(),
		teamId: z.string(),
		created: z.string(),
		isSystem: z.boolean().default(false),
		audio: z.string().optional(),
		expand: z
			.object({
				senderId: z
					.object({
						name: z.string().optional(),
						shortsign: z.string().optional()
					})
					.optional()
			})
			.optional()
	})
	.loose();

type Unsubscribe = () => void;

class ChatStore {
	messages = $state<ChatMessage[]>([]);
	unreadCount = $state(0);
	isChatOpen = $state(false);

	private initialized = false;
	private initialization: Promise<void> | null = null;
	private generation = 0;
	private sessionKey: string | null = null;
	private teamId: string | null = null;
	private userId: string | null = null;
	private unsubscribe: Unsubscribe | null = null;
	private lastReadTime = 0;

	async init(): Promise<void> {
		const user = pb.authStore.model;
		if (!pb.authStore.isValid || !user?.id) {
			await this.reset();
			return;
		}

		const teamId = getPrimaryRelationId(user.teamLeader) ?? user.id;
		const sessionKey = `${user.id}:${teamId}`;
		if (this.sessionKey === sessionKey && this.initialized) return;
		if (this.sessionKey === sessionKey && this.initialization) return this.initialization;

		const oldUnsubscribe = this.unsubscribe;
		this.unsubscribe = null;
		this.clearState();
		this.sessionKey = sessionKey;
		this.userId = user.id;
		this.teamId = teamId;
		const generation = ++this.generation;

		this.initialization = this.initializeSession(
			generation,
			user.id,
			teamId,
			oldUnsubscribe
		).finally(() => {
			if (this.generation === generation) this.initialization = null;
		});

		return this.initialization;
	}

	async reset(): Promise<void> {
		this.generation += 1;
		const unsubscribe = this.unsubscribe;
		this.unsubscribe = null;
		this.sessionKey = null;
		this.teamId = null;
		this.userId = null;
		this.initialization = null;
		this.clearState();

		if (unsubscribe) {
			try {
				unsubscribe();
			} catch (error) {
				console.error('Chat-Abonnement konnte nicht beendet werden:', error);
			}
		}
	}

	markAsRead(): void {
		if (!browser || !this.teamId) return;

		this.unreadCount = 0;
		this.lastReadTime = Date.now();
		localStorage.setItem(this.readStorageKey(this.teamId), this.lastReadTime.toString());
	}

	async sendMessage(text: string, audioBlob?: Blob): Promise<void> {
		const user = pb.authStore.model;
		if (!pb.authStore.isValid || !user?.id) return;
		const teamId = getPrimaryRelationId(user.teamLeader) ?? user.id;

		const formData = new FormData();
		formData.append('text', text);
		formData.append('senderId', user.id);
		formData.append('teamId', teamId);
		formData.append('isSystem', 'false');
		if (audioBlob) formData.append('audio', audioBlob);

		try {
			const record = await pb
				.collection('chat_messages')
				.create(formData, { expand: 'senderId', requestKey: null });
			this.appendIfCurrent(record, user.id, teamId);
		} catch (error) {
			console.error('Nachricht konnte nicht gesendet werden:', error);
		}
	}

	async sendReviewPing(caseTitle: string, subtaskTitle: string): Promise<void> {
		const user = pb.authStore.model;
		if (!pb.authStore.isValid || !user?.id) return;
		const teamId = getPrimaryRelationId(user.teamLeader) ?? user.id;
		const shortsign = typeof user.shortsign === 'string' ? user.shortsign : 'ME';
		const text = `Review Anfrage von @${shortsign}: Der Task **${subtaskTitle}** in der Akte "${caseTitle}" ist bereit zur Prüfung.`;

		try {
			const record = await pb.collection('chat_messages').create(
				{
					text,
					senderId: user.id,
					teamId,
					isSystem: true
				},
				{ expand: 'senderId', requestKey: null }
			);
			this.appendIfCurrent(record, user.id, teamId);
		} catch (error) {
			console.error('Review-Hinweis konnte nicht gesendet werden:', error);
		}
	}

	private async initializeSession(
		generation: number,
		userId: string,
		teamId: string,
		oldUnsubscribe: Unsubscribe | null
	): Promise<void> {
		if (oldUnsubscribe) oldUnsubscribe();
		if (browser) {
			const stored = localStorage.getItem(this.readStorageKey(teamId));
			this.lastReadTime = stored ? Number.parseInt(stored, 10) || 0 : 0;
		}

		try {
			const records = await pb.collection('chat_messages').getFullList({
				filter: pb.filter('teamId = {:teamId}', { teamId }),
				sort: 'created',
				expand: 'senderId',
				requestKey: null
			});
			if (!this.isCurrentSession(generation, userId, teamId)) return;

			this.messages = records.flatMap((record) => {
				const message = this.tryMapRecord(record, userId);
				return message ? [message] : [];
			});
			this.unreadCount = this.messages.filter((message) => message.isNew).length;

			const unsubscribe = await pb.collection('chat_messages').subscribe(
				'*',
				(event) => {
					if (
						event.action !== 'create' ||
						!this.isCurrentSession(generation, userId, teamId) ||
						event.record.teamId !== teamId
					) {
						return;
					}

					const message = this.tryMapRecord(event.record, userId);
					if (!message || this.messages.some((candidate) => candidate.id === message.id)) return;

					message.isNew =
						new Date(message.created).getTime() > this.lastReadTime && message.senderId !== userId;
					this.messages.push(message);
					if (message.isNew && !this.isChatOpen) this.unreadCount += 1;
				},
				{ expand: 'senderId' }
			);

			if (!this.isCurrentSession(generation, userId, teamId)) {
				unsubscribe();
				return;
			}
			this.unsubscribe = unsubscribe;
			this.initialized = true;
		} catch (error) {
			if (this.generation === generation)
				console.error('Chat konnte nicht initialisiert werden:', error);
		}
	}

	private appendIfCurrent(record: unknown, userId: string, teamId: string): void {
		if (this.userId !== userId || this.teamId !== teamId) return;
		const message = this.tryMapRecord(record, userId);
		if (message && !this.messages.some((candidate) => candidate.id === message.id)) {
			this.messages.push(message);
		}
	}

	private tryMapRecord(input: unknown, myUserId: string): ChatMessage | null {
		const parsed = ChatRecordSchema.safeParse(input);
		if (!parsed.success) {
			console.error('Ungültige Chat-Nachricht von PocketBase:', parsed.error);
			return null;
		}

		const record = parsed.data;
		return {
			id: record.id,
			text: record.text,
			senderId: record.senderId,
			senderName: record.expand?.senderId?.name ?? 'System',
			senderSign: record.expand?.senderId?.shortsign ?? 'SYS',
			teamId: record.teamId,
			created: record.created,
			isSystem: record.isSystem,
			audioUrl: record.audio ? pb.files.getURL(record, record.audio) : undefined,
			isNew: new Date(record.created).getTime() > this.lastReadTime && record.senderId !== myUserId
		};
	}

	private isCurrentSession(generation: number, userId: string, teamId: string): boolean {
		return (
			this.generation === generation &&
			this.userId === userId &&
			this.teamId === teamId &&
			pb.authStore.isValid
		);
	}

	private clearState(): void {
		this.messages = [];
		this.unreadCount = 0;
		this.isChatOpen = false;
		this.lastReadTime = 0;
		this.initialized = false;
	}

	private readStorageKey(teamId: string): string {
		return `lawcp_chat_read_${teamId}`;
	}
}

export const chatStore = new ChatStore();
