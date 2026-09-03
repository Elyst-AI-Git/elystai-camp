import {createBrowserClient} from '@supabase/ssr';
export function createAnonClient(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;if(!url||!key)return null;try{return createBrowserClient(url,key)}catch{return null}}
