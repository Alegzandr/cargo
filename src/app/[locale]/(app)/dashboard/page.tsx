import { redirect } from 'next/navigation';

// /dashboard is the authenticated entry point. The Send page is the working
// surface, so we land users there. Auth gating happens in (app)/layout.tsx.
export default function DashboardPage(): never {
  redirect('/dashboard/send');
}
