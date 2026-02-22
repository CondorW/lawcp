import PocketBase from 'pocketbase';
import { writable } from 'svelte/store';

// Vite injiziert die Variable aus der jeweiligen Umgebung (lokal oder DO).
// Ist die Variable leer (wie standardmäßig auf deinem lokalen Rechner),
// greift automatisch das logische ODER (||) und verbindet zum Emulator.
const pbUrl = import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090';

// Initialisierung der PocketBase Instanz mit der ermittelten URL
export const pb = new PocketBase(pbUrl);

// Reaktiver Store für den aktuell eingeloggten Benutzer
export const currentUser = writable(pb.authStore.model);

// Synchronisation des Stores bei Login/Logout
pb.authStore.onChange((auth) => {
    currentUser.set(pb.authStore.model);
});