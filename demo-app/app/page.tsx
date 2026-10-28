import ActivityCard from '@/components/ActivityCard';
import { demoActivities, categories } from '@/lib/demoData';
export default function Home() {
  return (
    <>
      <h1>This week near 94110</h1>
      <div className="chips">{categories.map(c => <span className="chip" key={c}>{c}</span>)}</div>
      <div className="grid">{demoActivities.map(a => <ActivityCard key={a.id} a={a} />)}</div>
    </>
  );
}
