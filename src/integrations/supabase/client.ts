import {createClient} from '@supabase/supabase-js';
import type {Database} from './types';
const url=import.meta.env['VITE_SUPABASE_URL']||'https://kfvwswptvxadnfivpmep.supabase.co';
const key=import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY']||'sb_publishable_iTdSP8j1QD1Nli9kmMExGA_q8yW3HKR';
export const supabase=createClient<Database>(url||'https://not-configured.supabase.co',key||'not-configured');
