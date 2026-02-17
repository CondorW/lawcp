<script lang="ts">
    import { pb } from '$lib/pocketbase';
    import { goto } from '$app/navigation';
    import { User, Lock, ArrowRight } from 'lucide-svelte';

    let email = '';
    let password = '';
    let loading = false;
    let error = '';

    async function login() {
        loading = true;
        error = '';
        try {
            await pb.collection('users').authWithPassword(email, password);
            // If successful, redirect to dashboard
            goto('/');
        } catch (e: any) {
            console.error(e);
            error = "Login fehlgeschlagen. E-Mail oder Passwort falsch.";
        } finally {
            loading = false;
        }
    }
</script>

<div class="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
    <div class="w-full max-w-md bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        
        <div class="bg-slate-900 p-6 text-center">
            <h1 class="text-2xl font-bold text-white tracking-tight">LawCP</h1>
            <p class="text-slate-400 text-sm mt-1">Kanzlei Productivity Suite</p>
        </div>

        <div class="p-8 space-y-6">
            {#if error}
                <div class="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium text-center border border-red-100">
                    {error}
                </div>
            {/if}

            <div class="space-y-4">
                <div class="relative">
                    <User class="absolute left-3 top-3 text-slate-400" size={18} />
                    <input 
                        bind:value={email} 
                        type="email" 
                        placeholder="E-Mail Adresse" 
                        class="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white"
                    />
                </div>
                <div class="relative">
                    <Lock class="absolute left-3 top-3 text-slate-400" size={18} />
                    <input 
                        bind:value={password} 
                        type="password" 
                        placeholder="Passwort" 
                        onkeydown={(e) => e.key === 'Enter' && login()}
                        class="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white"
                    />
                </div>
            </div>

            <button 
                onclick={login} 
                disabled={loading}
                class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {#if loading}
                    <span>Lade...</span>
                {:else}
                    <span>Anmelden</span>
                    <ArrowRight size={18} />
                {/if}
            </button>
        </div>
    </div>
</div>