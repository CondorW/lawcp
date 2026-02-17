import PocketBase from 'pocketbase';
import { writable } from 'svelte/store';

// Connect to your local server
export const pb = new PocketBase('http://127.0.0.1:8090');

// Store the currently logged-in user
export const currentUser = writable(pb.authStore.model);

// Listen to auth changes (login/logout)
pb.authStore.onChange((auth) => {
    currentUser.set(pb.authStore.model);
});