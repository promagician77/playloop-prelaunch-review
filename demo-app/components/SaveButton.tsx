'use client';
import { useState } from 'react';
import { getAdminClient } from '@/lib/supabase/admin';

export default function SaveButton({ activityId, userId }: { activityId: number; userId?: string }) {
  const [saved, setSaved] = useState(false);
  async function save() {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) { setSaved(true); return; } // demo mode
    await getAdminClient().from('saved_activities').insert({ user_id: userId, activity_id: activityId });
    setSaved(true);
  }
  return <button className="save" onClick={save} aria-pressed={saved}>{saved ? 'Saved' : 'Save'}</button>;
}
