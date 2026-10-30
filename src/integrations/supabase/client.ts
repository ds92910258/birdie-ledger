import {createClient} from '@supabase/supabase-js';
import type {Database} from './types';
const url=import.meta.env['VITE_SUPABASE_URL'];
const key=import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'];
export const supabase=createClient<Database>(url||'https://not-configured.supabase.co',key||'not-configured');
