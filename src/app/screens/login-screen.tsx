import { LoginForm } from '@/modules/authentication'
import { useNavigate } from '@tanstack/react-router'

export function LoginScreen() {
  const navigate = useNavigate()

  return <LoginForm onSignedIn={() => void navigate({ to: '/dashboard' })} />
}
