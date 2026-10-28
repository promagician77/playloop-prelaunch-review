import { demoActivities } from '@/lib/demoData';
import ActivityCard from '@/components/ActivityCard';
export default function Saved() {
  return (<><h1>Your saved activities</h1><div className="grid">{demoActivities.slice(0, 2).map(a => <ActivityCard key={a.id} a={a} />)}</div></>);
}
