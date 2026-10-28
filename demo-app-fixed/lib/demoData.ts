export type Activity = { id: number; title: string; category: string; age_min: number; age_max: number; address: string; price_cents: number; starts_at: string };
export const demoActivities: Activity[] = [
  { id: 1, title: 'Saturday Tide-Pool Walk', category: 'Outdoors', age_min: 4, age_max: 10, address: 'North Beach Lot B', price_cents: 0, starts_at: '2026-11-07T09:30:00-07:00' },
  { id: 2, title: 'Intro to Clay for Little Hands', category: 'Arts', age_min: 3, age_max: 6, address: 'Maple Street Studio', price_cents: 1800, starts_at: '2026-11-08T10:00:00-07:00' },
  { id: 3, title: 'Junior Robotics Club', category: 'STEM', age_min: 8, age_max: 12, address: 'Eastside Library, Room 2', price_cents: 1200, starts_at: '2026-11-09T15:30:00-07:00' },
  { id: 4, title: 'Toddler Story & Song', category: 'Reading', age_min: 1, age_max: 4, address: 'Central Library', price_cents: 0, starts_at: '2026-11-10T10:30:00-07:00' },
  { id: 5, title: 'Family Bike Skills Morning', category: 'Sports', age_min: 5, age_max: 12, address: 'Riverside Park Pavilion', price_cents: 500, starts_at: '2026-11-11T09:00:00-07:00' },
  { id: 6, title: 'Kids Cooking: Pizza Night', category: 'Cooking', age_min: 6, age_max: 11, address: 'Community Kitchen', price_cents: 2500, starts_at: '2026-11-12T17:00:00-07:00' },
];
export const categories = ['All', 'Outdoors', 'Arts', 'STEM', 'Reading', 'Sports', 'Cooking', 'Music', 'Free this weekend', 'Indoor', 'Under 5'];
