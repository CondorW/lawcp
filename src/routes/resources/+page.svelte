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
	import { fade } from 'svelte/transition';

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

	async function copyForContract(res: any) {
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

<div class="min-h-screen bg-gray-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-8 font-sans">
	<div class="max-w-[1200px] mx-auto">
		<div class="flex items-center justify-between mb-8">
			<div class="flex items-center gap-4">
				<a href="/" class="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full"
					><ArrowLeft /></a
				>
				<h1 class="text-3xl font-bold">Ressourcen & Kontakte</h1>
			</div>
			<div class="relative">
				<Search class="absolute left-3 top-2.5 text-gray-400" size={18} />
				<input
					bind:value={filter}
					placeholder="Suchen..."
					class="pl-10 rounded-lg border-gray-300 dark:bg-slate-800 dark:border-slate-600 dark:text-white"
				/>
			</div>
		</div>

		<div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
			<div class="lg:col-span-2 space-y-4">
				{#each list as res (res.id)}
					<div
						class="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow group"
					>
						<div class="flex items-start justify-between w-full">
							<div class="flex gap-4">
								<div
									class={`p-3 rounded-lg ${
										res.type === 'COMPANY'
											? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
											: res.type === 'AUTHORITY'
											? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
											: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
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
								<div>
									<h3 class="font-bold text-lg">{res.name}</h3>
									{#if res.identifier}
										<div class="text-sm text-gray-500 font-mono">{res.identifier}</div>
									{/if}
									
									<div class="text-sm text-gray-600 dark:text-gray-400 mt-2">
										{#if res.seat}
											<div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Sitz: {res.seat}</div>
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

							<div class="flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
								<button
									onclick={() => copyForContract(res)}
									title="Für Vertrag kopieren"
									class={`p-2 rounded-lg border transition-all flex items-center gap-2 ${copiedId === res.id ? 'bg-green-100 text-green-700 border-green-200' : 'text-gray-400 hover:text-amber-600 hover:bg-amber-50 border-transparent hover:border-amber-100'}`}
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
										class="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-transparent hover:border-blue-100"
										><ExternalLink size={18} /></button
									>
								{/if}
								<button
									onclick={() => store.deleteResource(res.id)}
									class="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
									><Trash2 size={18} /></button
								>
							</div>
						</div>

						<div class="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-slate-700 w-full">
							<span
								class="bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200 dark:border-slate-600 uppercase tracking-wide"
								title="Erstellt von"
							>
								{res.expand?.owner?.shortsign || 'System'}
							</span>
							<span class="text-sm text-gray-500 dark:text-gray-400">
								hinzugefügt am {formatDate(res.created)}
							</span>
						</div>
					</div>
				{:else}
					<div class="text-center py-10 text-gray-400 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-gray-300 dark:border-slate-700">
						Keine Einträge gefunden.
					</div>
				{/each}
			</div>

			<div class="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 h-fit sticky top-10">
				<h2 class="text-xl font-bold mb-6">Neu erstellen</h2>

				<div class="flex gap-2 mb-4 p-1 bg-gray-100 dark:bg-slate-700 rounded-lg">
					<button
						onclick={() => (resType = 'COMPANY')}
						class={`flex-1 py-1.5 text-xs sm:text-sm font-bold rounded-md transition-all ${resType === 'COMPANY' ? 'bg-white dark:bg-slate-600 shadow-sm' : 'text-gray-500'}`}
						>Firma</button
					>
					<button
						onclick={() => (resType = 'PERSON')}
						class={`flex-1 py-1.5 text-xs sm:text-sm font-bold rounded-md transition-all ${resType === 'PERSON' ? 'bg-white dark:bg-slate-600 shadow-sm' : 'text-gray-500'}`}
						>Person</button
					>
					<button
						onclick={() => (resType = 'AUTHORITY')}
						class={`flex-1 py-1.5 text-xs sm:text-sm font-bold rounded-md transition-all ${resType === 'AUTHORITY' ? 'bg-white dark:bg-slate-600 shadow-sm' : 'text-gray-500'}`}
						>Behörde</button
					>
				</div>

				<div class="space-y-4">
					<label class="block">
						<span class="text-xs font-bold text-gray-500 uppercase mb-1 block">Name</span>
						<input
							bind:value={resName}
							class="w-full rounded-md border-gray-300 dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:ring-amber-500 focus:border-amber-500"
							placeholder={resType === 'COMPANY' ? 'Firmenwortlaut' : resType === 'AUTHORITY' ? 'Behördenname' : 'Vor- & Nachname'}
						/>
					</label>

					{#if resType !== 'AUTHORITY'}
						<label class="block">
							<span class="text-xs font-bold text-gray-500 uppercase mb-1 block"
								>{resType === 'COMPANY' ? 'HR-Nummer (FL...)' : 'Geburtsdatum'}</span
							>
							<input
								bind:value={resId}
								class="w-full rounded-md border-gray-300 dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:ring-amber-500 focus:border-amber-500"
								placeholder={resType === 'COMPANY' ? 'HR-Nummer (FL...)' : 'Geburtsdatum'}
							/>
						</label>
					{/if}

					{#if resType === 'COMPANY'}
						<label class="block">
							<span class="text-xs font-bold text-gray-500 uppercase mb-1 block">Sitz (Gemeinde/Ort)</span>
							<input
								bind:value={resSeat}
								class="w-full rounded-md border-gray-300 dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:ring-amber-500 focus:border-amber-500"
								placeholder="Z.B. Vaduz"
							/>
						</label>
					{/if}

					<div class="space-y-2">
						<label class="block">
							<span class="text-xs font-bold text-gray-500 uppercase mb-1 block">Adresse</span>
							<input
								bind:value={resStreet}
								class="w-full rounded-md border-gray-300 dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:ring-amber-500 focus:border-amber-500"
								placeholder="Straße & Hausnr."
							/>
						</label>
						<div class="flex gap-2">
							<input
								bind:value={resZip}
								class="w-24 rounded-md border-gray-300 dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:ring-amber-500 focus:border-amber-500"
								placeholder="PLZ"
							/>
							<input
								bind:value={resCity}
								class="w-10 flex-1 rounded-md border-gray-300 dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:ring-amber-500 focus:border-amber-500"
								placeholder="Ort"
							/>
						</div>
					</div>

					<button
						onclick={add}
						class="w-full bg-slate-900 dark:bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors mt-2"
					>
						<Plus size={18} class="inline mr-2" /> Speichern
					</button>
				</div>
			</div>
		</div>
	</div>
</div>