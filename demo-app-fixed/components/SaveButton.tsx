'use client';
import { useState } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';

export default function SaveButton({ activityId }: { activityId: number }) {
  const [saved, setSaved] = useState(false);
  async function save() {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) { setSaved(true); return; } // demo mode
    const supabase = getBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = '/login'; return; }
    // Runs as the signed-in parent; row-level security only lets them write their own saves.
    const { error } = await supabase.from('saved_activities').insert({ user_id: user.id, activity_id: activityId });
    if (!error) setSaved(true);
  }
  return <button className="save" onClick={save} aria-pressed={saved}>{saved ? 'Saved' : 'Save'}</button>;
}
