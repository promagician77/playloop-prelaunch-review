import Link from 'next/link';
import SaveButton from './SaveButton';
import type { Activity } from '@/lib/demoData';

export default function ActivityCard({ a }: { a: Activity }) {
  const when = new Date(a.starts_at).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' });
  return (
    <article className="card">
      <div className="meta"><span className="tag">{a.category}</span><span>Ages {a.age_min}-{a.age_max}</span></div>
      <h3><Link href={`/activity/${a.id}`}>{a.title}</Link></h3>
      <p>{when} · {a.address}</p>
      <div className="row"><b>{a.price_cents ? `$${(a.price_cents / 100).toFixed(2)}` : 'Free'}</b><SaveButton activityId={a.id} /></div>
    </article>
  );
}
