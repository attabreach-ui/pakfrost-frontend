/**
 * Supabase Realtime — Live sync for PAKFROST WMS
 *
 * Whenever any user makes changes to pallets/movements/temperature,
 * this module automatically pushes updates to all connected users.
 *
 * Setup (one-time):
 * Supabase Dashboard → Table Editor → pallets/stock_movements/temperature_readings
 * → Turn Realtime toggle ON
 */

import { createClient } from '@supabase/supabase-js';

// Supabase public config — these are not secrets, safe on frontend
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
 * Subscribe to Supabase Realtime.
 * Whenever any change occurs in pallets/movements/temperature,
 * the callback fires — all users are notified immediately.
 */
export function subscribeRealtime(callbacks: RealtimeCallbacks) {
  if (!supabase) {
    console.warn('Supabase Realtime: VITE_SUPABASE_ANON_KEY missing — falling back to polling');
    return null;
  }

  // Close previous channel first
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

/** Unsubscribe channel on logout */
export function unsubscribeRealtime() {
  if (activeChannel && supabase) {
    supabase.removeChannel(activeChannel);
    activeChannel = null;
  }
}
