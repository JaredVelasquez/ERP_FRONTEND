import { useSession } from '@/app/providers/session'
import { useState, type FormEvent } from 'react'
import { Button } from '@/shared/ui/button'
import { SelectField, TextField } from '@/shared/ui/fields'
import { Form, FormNotice } from '@/shared/ui/form-layout'
import { useFieldSet } from '@/shared/hooks/use-field-set'
import { loginWithPassword, readCurrentSession } from '../api'
import { loginMessages } from '../messages'

type LoginFormProps = {
  onSignedIn?: () => void
}

export function LoginForm({ onSignedIn }: LoginFormProps) {
  const { signIn } = useSession()
  const [notice, setNotice] = useState<string | null>(null)
  const [reveal, setReveal] = useState(0)
  const { report, ready } = useFieldSet(['email', 'password'])
  const failed = notice === loginMessages.failed

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setReveal((current) => current + 1)
    if (!ready) {
      return
    }
    const data = new FormData(event.currentTarget)
    try {
      const session = await loginWithPassword({
        email: String(data.get('email') ?? ''),
        password: String(data.get('password') ?? ''),
        companyId: String(data.get('companyId') ?? ''),
      })
      const current = await readCurrentSession().catch(() => null)
      signIn({
        grants: session.grants,
        companyName: session.companyName,
        companyId: session.companyId,
        logoUrl: current?.logoUrl ?? null,
      })
      setNotice(loginMessages.signedIn)
      onSignedIn?.()
    } catch {
      setNotice(loginMessages.failed)
    }
  }

  return (
    <section className="login-card">
      <h1>{loginMessages.title}</h1>
      <p>{loginMessages.subtitle}</p>
      <Form
        onSubmit={(event) => {
          void onSubmit(event)
        }}
      >
        <TextField
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          label={loginMessages.email}
          required
          requiredMessage={loginMessages.emailRequired}
          invalidMessage={loginMessages.emailInvalid}
          field="email"
          report={report}
          reveal={reveal}
        />
        <TextField
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          label={loginMessages.password}
          required
          requiredMessage={loginMessages.passwordRequired}
          field="password"
          report={report}
          reveal={reveal}
        />
        <SelectField
          id="companyId"
          name="companyId"
          label={loginMessages.company}
          hint={loginMessages.companyHint}
          defaultValue=""
          options={[{ value: '', label: loginMessages.onlyCompany }]}
        />
        <Button type="submit" block disabled={!ready}>
          {loginMessages.submit}
        </Button>
        {notice ? <FormNotice tone={failed ? 'error' : 'ok'}>{notice}</FormNotice> : null}
      </Form>
    </section>
  )
}
