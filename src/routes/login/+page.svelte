<script lang="ts">
    import { pb } from '$lib/pocketbase';
    import { goto } from '$app/navigation';
    import { User, Lock, ArrowRight, ShieldCheck } from 'lucide-svelte';

    let email = '';
    let password = '';
    let loading = false;
    let error = '';

    async function login() {
        if (!email || !password) return;
        loading = true;
        error = '';
        try {
            await pb.collection('users').authWithPassword(email, password);
            goto('/');
        } catch (e: any) {
            console.error(e);
            error = "Zugriff verweigert. Bitte prüfen Sie Ihre Anmeldedaten.";
        } finally {
            loading = false;
        }
    }
</script>

<div class="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 font-sans">
    
    <div class="flex items-center gap-3 mb-8">
        <div class="flex h-12 w-12 items-center justify-center rounded bg-amber-600 text-white font-serif font-bold text-2xl shadow-md">L</div>
        <span class="text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-serif">LAW<span class="text-amber-600">Ganized</span></span>
    </div>

    <div class="w-full max-w-[400px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl shadow-slate-200/50 dark:shadow-none border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        <div class="p-8">
            <h2 class="text-xl font-bold text-slate-900 dark:text-white mb-2">Willkommen zurück</h2>
            <p class="text-slate-500 dark:text-slate-400 text-sm mb-8">Anmeldung zur Kanzlei Productivity Suite</p>

            {#if error}
                <div class="mb-6 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-xs font-bold border border-red-100 dark:border-red-800 flex items-center gap-2">
                    <span class="h-1.5 w-1.5 rounded-full bg-red-600 animate-pulse"></span>
                    {error}
                </div>
            {/if}

            <div class="space-y-5">
                <div class="space-y-1.5">
                    <label for="email" class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ml-1">Benutzername / E-Mail</label>
                    <div class="relative group">
                        <User class="absolute left-3.5 top-3 text-slate-400 group-focus-within:text-amber-600 transition-colors" size={18} />
                        <input 
                            id="email"
                            bind:value={email} 
                            type="email" 
                            placeholder="kanzlei@email.ch" 
                            class="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none transition-all dark:text-white placeholder:text-slate-400" 
                        />
                    </div>
                </div>

                <div class="space-y-1.5">
                    <label for="password" class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ml-1">Passwort</label>
                    <div class="relative group">
                        <Lock class="absolute left-3.5 top-3 text-slate-400 group-focus-within:text-amber-600 transition-colors" size={18} />
                        <input 
                            id="password"
                            bind:value={password} 
                            type="password" 
                            placeholder="••••••••" 
                            onkeydown={(e) => e.key === 'Enter' && login()}
                            class="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none transition-all dark:text-white placeholder:text-slate-400" 
                        />
                    </div>
                </div>
            </div>

            <button 
                onclick={login} 
                disabled={loading}
                class="w-full mt-10 bg-slate-900 dark:bg-amber-600 hover:bg-slate-800 dark:hover:bg-amber-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition-all shadow-lg shadow-slate-200 dark:shadow-none disabled:opacity-50 active:scale-[0.98]"
            >
                {#if loading}
                    <div class="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Authentifizierung...</span>
                {:else}
                    <span>LOGIN</span>
                    <ArrowRight size={18} />
                {/if}
            </button>
        </div>

        <div class="bg-slate-50 dark:bg-slate-800/50 px-8 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-center items-center gap-2">
            <ShieldCheck size={14} class="text-emerald-600" />
            <span class="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400">End-to-End verschlüsselt</span>
        </div>
    </div>

    <p class="mt-8 text-slate-400 text-xs tracking-wide">
        &copy; 2026 LAWGanized – Swiss Assets LWA. Alle Rechte vorbehalten.
    </p>
</div>

<style>
    /* Optionale Serifen-Font Einbindung, falls nicht global verfügbar */
    :global(font-serif) {
        font-family: 'Georgia', serif;
    }
</style>