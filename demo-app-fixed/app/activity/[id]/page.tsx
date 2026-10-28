import { demoActivities } from '@/lib/demoData';
import SaveButton from '@/components/SaveButton';
export default async function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = demoActivities.find(x => String(x.id) === id);
  if (!a) return <p>Not found</p>;
  return (<article className="card"><h1>{a.title}</h1><p>{a.address}</p><SaveButton activityId={a.id} /></article>);
}
