import { v4 as uuidv4 } from 'uuid';
import type { AppData, Settings } from '$lib/types';

export const login = (state: AppData, shortsign: string) => ({
    ...state, settings: { ...state.settings, isAuthenticated: true, myShortsign: shortsign }
});

export const toggleDarkMode = (state: AppData) => ({
    ...state, settings: { ...state.settings, darkMode: !state.settings.darkMode }
});

export const addTeamMember = (state: AppData, name: string, shortsign: string, color: string) => ({
    ...state, settings: { ...state.settings, team: [...state.settings.team, { id: uuidv4(), name, shortsign, color, isLeader: false }] }
});

// --- NEW FUNCTIONS FOR SETTINGS PAGE ---

export const removeTeamMember = (state: AppData, id: string) => ({
    ...state, settings: { ...state.settings, team: state.settings.team.filter(m => m.id !== id) }
});

export const setTeamLeader = (state: AppData, id: string) => ({
    ...state, settings: { 
        ...state.settings, 
        team: state.settings.team.map(m => ({ ...m, isLeader: m.id === id })) // Sets clicked to true, others to false
    }
});

export const updateSettings = (state: AppData, newSettings: Partial<Settings>) => ({
    ...state, settings: { ...state.settings, ...newSettings }
});

// --- RESOURCES & NOTES ---

export const addResource = (state: AppData, res: any) => ({
    ...state, resources: [...state.resources, { id: uuidv4(), ...res }]
});

export const deleteResource = (state: AppData, id: string) => ({
    ...state, resources: state.resources.filter(r => r.id !== id)
});

export const updateMatterNote = (state: AppData, ref: string, content: string) => {
    const notes = state.matterNotes || [];
    const idx = notes.findIndex(n => n.ref === ref);
    const newNotes = idx >= 0 
        ? notes.map((n, i) => i === idx ? { ...n, content } : n)
        : [...notes, { ref, content }];
    return { ...state, matterNotes: newNotes };
};