import { redirect } from 'next/navigation'

// Redirect /agents/new to /builder/new
export default function NewAgentPage() {
  redirect('/builder/new')
}
