/**
 * Supabase Realtime — Live sync for PAKFROST WMS
 *
 * Jab bhi koi user pallets/movements/temperature mein change kare,
 * ye module automatically sab connected users ko update bhejta hai.
 *
 * Setup (ek baar karna hai):
 * Supabase Dashboard → Table Editor → pallets/stock_movements/temperature_readings
 * → Realtime toggle ON karo
 */

import { createClient } from '@supabase/supabase-js';

// Supabase public config — ye secrets nahi hain, frontend pe safe hain
const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || 'https://ojupzuhotqohszqpigwx.supabase.co';
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = SUPABASE_ANON
  ? createClient(SUPABASE_URL, SUPABASE_ANON)
  : null;

type RealtimeCallbacks = {
  onPalletsChange:      () => void;
  onMovementsChange:    () => void;
  onTemperatureChange:  () => void;
};

let activeChannel: ReturnType<typeof supabase.channel> | null = null;

/**
 * Supabase Realtime subscribe karo.
 * Jab bhi pallets/movements/temperature mein koi bhi change aaye,
 * callback call hoga — sab users ko foran pata chalega.
 */
export function subscribeRealtime(callbacks: RealtimeCallbacks) {
  if (!supabase) {
    console.warn('Supabase Realtime: VITE_SUPABASE_ANON_KEY missing — falling back to polling');
    return null;
  }

  // Pehle purana channel band karo
  if (activeChannel) {
    supabase.removeChannel(activeChannel);
  }

  activeChannel = supabase
    .channel('pakfrost-live')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'pallets' },
      () => callbacks.onPalletsChange()
    )
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'stock_movements' },
      () => callbacks.onMovementsChange()
    )
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'temperature_readings' },
      () => callbacks.onTemperatureChange()
    )
    .subscribe();

  return activeChannel;
}

/** Logout pe channel band karo */
export function unsubscribeRealtime() {
  if (activeChannel && supabase) {
    supabase.removeChannel(activeChannel);
    activeChannel = null;
  }
}
