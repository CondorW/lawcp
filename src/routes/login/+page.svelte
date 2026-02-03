<script lang="ts">
    import { store } from '$lib/stores/tasks';
    import { goto } from '$app/navigation';
    import { fade, fly } from 'svelte/transition';
    import { Lock, User, ArrowRight, Loader2, ShieldCheck, AlertCircle } from 'lucide-svelte';

    let username = '';
    let password = '';
    let error = '';
    let isLoading = false;
    let isSuccess = false;

    // Hardcoded Credentials
    const CREDENTIALS: Record<string, string> = {
        'DOW': '0901',
        'LWA': '0807'
    };

    async function handleLogin() {
        if (!username || !password) return;
        
        isLoading = true;
        error = '';

        // Simulate network
        await new Promise(resolve => setTimeout(resolve, 800));

        const shortsign = username.toUpperCase();
        const validPass = CREDENTIALS[shortsign];

        if (validPass && validPass === password) {
            isSuccess = true;
            
            // 1. Ensure User exists in Team
            const currentTeam = $store.settings.team;
            const userExists = currentTeam.find(m => m.shortsign === shortsign);
            
            if (!userExists) {
                // FIX: Use shortsign as name (no First Name mapping)
                store.addTeamMember(shortsign, shortsign, 'bg-slate-600 text-white');
            }

            // 2. Perform Login Action
            store.login(shortsign);

            // 3. Redirect
            setTimeout(() => goto('/'), 600);
        } else {
            error = 'Ungültige Zugangsdaten';
            isLoading = false;
        }
    }
</script>

<div class="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden font-sans text-slate-100">
    <div class="absolute inset-0 z-0">
        <div class="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-[120px]"></div>
        <div class="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-900/20 rounded-full blur-[120px]"></div>
        <div class="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150"></div>
    </div>

    <div in:fly={{ y: 20, duration: 600 }} class="relative z-10 w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-8 sm:p-10">
        <div class="text-center mb-10">
            <div class="flex items-center justify-center gap-3 mb-4">
                <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 text-white font-serif font-bold text-2xl shadow-lg shadow-amber-900/20">L</div>
            </div>
            <h1 class="text-2xl font-bold tracking-tight text-white font-serif">Law<span class="text-amber-500">CP</span> Portal</h1>
            <p class="text-slate-400 text-sm mt-2">Authentifizierung erforderlich</p>
        </div>

        <form onsubmit={(e) => { e.preventDefault(); handleLogin(); }} class="space-y-5">
            <div class="space-y-1.5">
                <label class="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1" for="username">Kürzel</label>
                <div class="relative group">
                    <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-amber-500 transition-colors"><User size={18} /></div>
                    <input id="username" type="text" bind:value={username} placeholder="z.B. XXX" class="w-full pl-10 pr-4 py-3 bg-slate-950/50 border border-slate-700 rounded-xl text-white placeholder:text-slate-600 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all outline-none uppercase font-bold tracking-wide" autocomplete="username" />
                </div>
            </div>

            <div class="space-y-1.5">
                <label class="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1" for="password">Passcode</label>
                <div class="relative group">
                    <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-amber-500 transition-colors"><Lock size={18} /></div>
                    <input id="password" type="password" bind:value={password} placeholder="••••" class="w-full pl-10 pr-4 py-3 bg-slate-950/50 border border-slate-700 rounded-xl text-white placeholder:text-slate-600 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all outline-none font-mono text-lg tracking-widest" />
                </div>
            </div>

            {#if error}
                <div transition:fade class="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 p-3 rounded-lg border border-red-900/30">
                    <AlertCircle size={16} /> <span>{error}</span>
                </div>
            {/if}

            <button type="submit" disabled={isLoading || isSuccess} class={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm uppercase tracking-wide shadow-lg transition-all transform active:scale-95 ${isSuccess ? 'bg-green-600 text-white' : 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white'}`}>
                {#if isLoading}
                    {#if isSuccess}<ShieldCheck size={20} class="animate-bounce" /> Access Granted{:else}<Loader2 size={20} class="animate-spin" /> Verifying...{/if}
                {:else}
                    Login <ArrowRight size={18} />
                {/if}
            </button>
        </form>
        <div class="mt-8 text-center"><p class="text-[10px] text-slate-600 uppercase tracking-widest">Protected System • Authorized Access Only</p></div>
    </div>
</div>