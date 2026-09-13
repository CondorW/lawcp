<script lang="ts">
	import { store } from '$lib/stores/tasks';
	import {
		ArrowLeft,
		Plus,
		Search,
		Building2,
		User,
		Landmark,
		Trash2,
		ExternalLink,
		Copy,
		Check
	} from 'lucide-svelte';
	import type { Resource } from '$lib/types';
	import { resolve } from '$app/paths';
	import { toastStore } from '$lib/stores/toasts';
	
	let filter = '';
	let resType: 'COMPANY' | 'PERSON' | 'AUTHORITY' = 'COMPANY';
	let resName = '';
	let resId = '';
	let resSeat = '';
	let resStreet = '';
	let resZip = '';
	let resCity = '';
	let copiedId: string | null = null;

	async function add() {
		if (!resName) return;
		await store.addResource({
			type: resType,
			name: resName,
			identifier: resId,
			seat: resSeat,
			street: resStreet,
			zip: resZip,
			city: resCity,
			address: `${resStreet}, ${resZip} ${resCity}`
		});

		// Reset
		resName = '';
		resId = '';
		resSeat = '';
		resStreet = '';
		resZip = '';
		resCity = '';
	}

	function searchHR(name: string) {
		window.open(
			`https://www.handelsregister.li/cr-portal/suche/suche.xhtml?query=${encodeURIComponent(name)}`,
			'_blank'
		);
	}

	async function copyForContract(res: Resource) {
		let addressPart = '';
		if (res.street || res.city) {
			addressPart = `${res.street || ''}, ${res.zip || ''} ${res.city || ''}`;
		} else {
			addressPart = res.address || 'k.A.';
		}
		addressPart = addressPart.replace(/,\s*,/g, ',').trim();

		let text = '';
		let idPart = res.identifier ? `, ${res.identifier}` : '';

		if (res.type === 'COMPANY') {
			const seatText = res.seat ? ` mit dem Sitz in ${res.seat} und` : ' mit';
			text = `${res.name}${idPart}${seatText} der Geschäftsanschrift ${addressPart}`;
		} else if (res.type === 'AUTHORITY') {
			text = `${res.name}, ${addressPart}`;
		} else {
			text = `${res.name}${idPart} mit der Adresse ${addressPart}`;
		}
		text = text.replace(/\s+/g, ' ').trim();

		try {
			await navigator.clipboard.writeText(text);
			copiedId = res.id;
			setTimeout(() => (copiedId = null), 2000);
		} catch (e) {
			console.error('Copy failed', e);
		}
	}

	async function deleteResource(res: Resource): Promise<void> {
		const confirmed = await toastStore.confirm({
			title: 'Ressource endgültig löschen?',
			message: `„${res.name}“ wird aus den Ressourcen entfernt.`,
			confirmLabel: 'Löschen',
			tone: 'danger'
		});
		if (confirmed) await store.deleteResource(res.id);
	}

	function formatDate(dateString: string | undefined) {
		if (!dateString) return 'Unbekannt';
		return new Date(dateString).toLocaleDateString('de-DE', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric'
		});
	}

	$: list = $store.resources
		? $store.resources.filter((r) => r.name.toLowerCase().includes(filter.toLowerCase()))
		: [];
</script>

<div
	class="min-h-screen bg-slate-50 p-6 font-sans text-slate-900 lg:p-8 dark:bg-slate-950 dark:text-slate-100"
>
	<div class="mx-auto max-w-[1600px]">
		<div class="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
			<div class="flex items-center gap-4">
				<a
					href={resolve('/')}
					class="rounded-full p-2 transition-colors hover:bg-slate-200 dark:hover:bg-slate-800"
				>
					<ArrowLeft size={24} />
				</a>
				<h1 class="text-2xl font-bold tracking-tight sm:text-3xl">Ressourcen & Kontakte</h1>
			</div>

			<div class="relative w-full sm:w-80">
				<Search class="absolute top-3 left-3.5 text-slate-400" size={18} />
				<input
					bind:value={filter}
					placeholder="Suchen..."
					class="w-full rounded-lg border border-slate-300 bg-white py-2.5 pr-4 pl-10 text-sm text-slate-900 transition-shadow outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
				/>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
			<div class="space-y-4 lg:col-span-2">
				{#each list as res (res.id)}
					<div
						class="group flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
					>
						<div class="flex w-full items-start justify-between gap-4">
							<div class="flex min-w-0 gap-4">
								<div
									class={`shrink-0 rounded-lg p-3.5 ${
										res.type === 'COMPANY'
											? 'bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400'
											: res.type === 'AUTHORITY'
												? 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'
												: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'
									}`}
								>
									{#if res.type === 'COMPANY'}
										<Building2 size={24} />
									{:else if res.type === 'AUTHORITY'}
										<Landmark size={24} />
									{:else}
										<User size={24} />
									{/if}
								</div>
								<div class="min-w-0">
									<h3 class="truncate text-base font-bold text-slate-900 dark:text-white">
										{res.name}
									</h3>
									{#if res.identifier}
										<div class="mt-0.5 font-mono text-sm text-slate-500">{res.identifier}</div>
									{/if}
									<div class="mt-2 space-y-0.5 text-sm text-slate-600 dark:text-slate-400">
										{#if res.seat}
											<div class="mb-1 text-xs font-bold tracking-wider text-slate-400 uppercase">
												Sitz: {res.seat}
											</div>
										{/if}
										{#if res.street || res.city}
											<div>{res.street || ''}</div>
											<div>{res.zip || ''} {res.city || ''}</div>
										{:else if res.address}
											<div class="whitespace-pre-line">{res.address}</div>
										{/if}
									</div>
								</div>
							</div>

							<div
								class="flex shrink-0 gap-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
							>
								<button
									onclick={() => copyForContract(res)}
									title="Für Vertrag kopieren"
									class={`flex items-center gap-2 rounded-lg border p-2 transition-all ${copiedId === res.id ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-800 dark:bg-emerald-900/30' : 'border-transparent text-slate-400 hover:border-brand-100 hover:bg-brand-50 hover:text-brand-600 dark:hover:border-slate-700 dark:hover:bg-slate-800'}`}
								>
									{#if copiedId === res.id}
										<Check size={18} />
									{:else}
										<Copy size={18} />
									{/if}
								</button>
								{#if res.type === 'COMPANY'}
									<button
										onclick={() => searchHR(res.name)}
										title="Im HR suchen"
										class="rounded-lg border border-transparent p-2 text-slate-400 hover:border-brand-100 hover:bg-brand-50 hover:text-brand-600 dark:hover:border-slate-700 dark:hover:bg-slate-800"
									>
										<ExternalLink size={18} />
									</button>
								{/if}
								<button
									onclick={() => void deleteResource(res)}
									title="Ressource löschen"
									class="rounded-lg border border-transparent p-2 text-slate-400 hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600 dark:hover:border-slate-700 dark:hover:bg-slate-800"
								>
									<Trash2 size={18} />
								</button>
							</div>
						</div>

						<div
							class="mt-1 flex w-full items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800"
						>
							<span
								class="rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-bold tracking-wide text-slate-500 uppercase dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
								title="Erstellt von"
							>
								{res.expand?.owner?.shortsign || 'System'}
							</span>
							<span class="text-xs font-medium text-slate-400">
								hinzugefügt am {formatDate(res.created)}
							</span>
						</div>
					</div>
				{:else}
					<div
						class="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-slate-400 dark:border-slate-700 dark:bg-slate-900"
					>
						<p class="text-base font-medium">Keine Einträge gefunden.</p>
					</div>
				{/each}
			</div>

			<div
				class="sticky top-6 h-fit rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8 dark:border-slate-800 dark:bg-slate-900"
			>
				<h2 class="mb-6 text-base font-bold text-slate-800 dark:text-white">
					Neuer Kontakt / Ressource
				</h2>

				<div class="mb-6 flex gap-2 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
					<button
						onclick={() => (resType = 'COMPANY')}
						class={`flex-1 rounded-md py-2 text-sm font-bold transition-all ${resType === 'COMPANY' ? 'bg-white text-brand-600 shadow-sm dark:bg-slate-700 dark:text-brand-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
						>Firma</button
					>
					<button
						onclick={() => (resType = 'PERSON')}
						class={`flex-1 rounded-md py-2 text-sm font-bold transition-all ${resType === 'PERSON' ? 'bg-white text-yellow-600 shadow-sm dark:bg-slate-700 dark:text-yellow-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
						>Person</button
					>
					<button
						onclick={() => (resType = 'AUTHORITY')}
						class={`flex-1 rounded-md py-2 text-sm font-bold transition-all ${resType === 'AUTHORITY' ? 'bg-white text-rose-600 shadow-sm dark:bg-slate-700 dark:text-rose-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
						>Behörde</button
					>
				</div>

				<div class="space-y-5">
					<label class="block">
						<span class="mb-2 block text-xs font-bold tracking-wider text-slate-500 uppercase"
							>Name</span
						>
						<input
							bind:value={resName}
							class="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
							placeholder={resType === 'COMPANY'
								? 'Firmenwortlaut'
								: resType === 'AUTHORITY'
									? 'Behördenname'
									: 'Vor- & Nachname'}
						/>
					</label>

					{#if resType !== 'AUTHORITY'}
						<label class="block">
							<span class="mb-2 block text-xs font-bold tracking-wider text-slate-500 uppercase"
								>{resType === 'COMPANY' ? 'HR-Nummer (FL...)' : 'Geburtsdatum'}</span
							>
							<input
								bind:value={resId}
								class="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
								placeholder={resType === 'COMPANY' ? 'z.B. FL-0002.123.456-7' : 'TT.MM.JJJJ'}
							/>
						</label>
					{/if}

					{#if resType === 'COMPANY'}
						<label class="block">
							<span class="mb-2 block text-xs font-bold tracking-wider text-slate-500 uppercase"
								>Sitz (Gemeinde)</span
							>
							<input
								bind:value={resSeat}
								class="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
								placeholder="z.B. Vaduz"
							/>
						</label>
					{/if}

					<div class="space-y-3">
						<label class="block">
							<span class="mb-2 block text-xs font-bold tracking-wider text-slate-500 uppercase"
								>Adresse</span
							>
							<input
								bind:value={resStreet}
								class="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
								placeholder="Straße & Hausnr."
							/>
						</label>
						<div class="flex gap-3">
							<input
								bind:value={resZip}
								class="w-28 rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
								placeholder="PLZ"
							/>
							<input
								bind:value={resCity}
								class="flex-1 rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
								placeholder="Ort"
							/>
						</div>
					</div>

					<button
						onclick={add}
						disabled={!resName}
						class="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<Plus size={18} /> Speichern
					</button>
				</div>
			</div>
		</div>
	</div>
</div>