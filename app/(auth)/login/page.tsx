import { redirect } from 'next/navigation'

// Sign-in is handled via modal on the landing page
export default function LoginPage() {
  redirect('/')
}
