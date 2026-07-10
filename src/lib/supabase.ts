import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'public' },
  auth: { autoRefreshToken: true, persistSession: false },
  global: {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  }
});

export const getAudioUrl = (music4allId: string) =>
  `${supabaseUrl}/storage/v1/object/public/audio_preview/${music4allId}.mp3`;

export const getAlbumImageUrl = (music4allId: string) =>
  `${supabaseUrl}/storage/v1/object/public/album_image/${music4allId}.jpg`;
