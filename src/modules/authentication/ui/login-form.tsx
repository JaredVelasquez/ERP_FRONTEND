import { useSession } from '@/app/providers/session'
import { useState, type FormEvent } from 'react'
import { Button } from '@/shared/ui/button'
import { SelectField, TextField } from '@/shared/ui/fields'
import { Form, FormNotice } from '@/shared/ui/form-layout'
import { useFieldSet } from '@/shared/hooks/use-field-set'
import { listLoginCompanies, loginWithPassword, readCurrentSession, type LoginCompany } from '../api'
import { loginMessages } from '../messages'

type LoginFormProps = {
  onSignedIn?: () => void
}

export function LoginForm({ onSignedIn }: LoginFormProps) {
  const { signIn } = useSession()
  const [notice, setNotice] = useState<string | null>(null)
  const [reveal, setReveal] = useState(0)
  const [companies, setCompanies] = useState<LoginCompany[]>([])
  const [selectedCompany, setSelectedCompany] = useState('')
  const [busy, setBusy] = useState(false)
  const { report, ready } = useFieldSet(['email', 'password'])
  const failed = notice === loginMessages.failed

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setReveal((current) => current + 1)
    if (!ready) {
      return
    }
    const data = new FormData(event.currentTarget)
    const email = String(data.get('email') ?? '')
    const password = String(data.get('password') ?? '')
    setBusy(true)
    try {
      let companyId = selectedCompany
      if (companies.length === 0) {
        const available = await listLoginCompanies(email, password)
        if (available.length > 1) {
          setCompanies(available)
          setNotice(loginMessages.chooseCompany)
          return
        }
        companyId = available[0]?.companyId ?? ''
      }
      if (companies.length > 1 && companyId === '') {
        setNotice(loginMessages.chooseCompany)
        return
      }
      const session = await loginWithPassword({
        email,
        password,
        companyId,
      })
      const current = await readCurrentSession().catch(() => null)
      signIn({
        userId: session.userId,
        role: session.role,
        grants: session.grants,
        companyName: session.companyName,
        companyId: session.companyId,
        logoUrl: current?.logoUrl ?? null,
      })
      setNotice(loginMessages.signedIn)
      onSignedIn?.()
    } catch {
      setNotice(loginMessages.failed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="login-card">
      <div className="login-form-panel">
        <div className="login-identity" aria-label={loginMessages.kicker}>
          <img className="login-symbol login-logo" src="/brand/michelle-market-light.jpeg" alt="" />
          <strong>{loginMessages.kicker}</strong>
        </div>
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
        {companies.length > 1 ? <SelectField
          id="companyId"
          name="companyId"
          label={loginMessages.company}
          hint={loginMessages.chooseCompany}
          value={selectedCompany}
          onValue={setSelectedCompany}
          options={[{ value: '', label: loginMessages.chooseCompanyOption }, ...companies.map((company) => ({ value: company.companyId, label: company.companyName }))]}
        /> : null}
        <Button type="submit" block disabled={!ready || busy}>
          {loginMessages.submit}
        </Button>
        {notice ? <FormNotice tone={failed ? 'error' : 'ok'}>{notice}</FormNotice> : null}
        </Form>
      </div>
      <aside className="login-showcase" aria-hidden="true">
        <div className="showcase-orbit showcase-orbit--one" />
        <div className="showcase-orbit showcase-orbit--two" />
        <img className="showcase-emblem showcase-logo" src="/brand/michelle-market-dark.jpeg" alt="" />
        <div className="showcase-copy">
          <span>MICHELLE MARKET</span>
          <p>Tu espacio de trabajo para la operación diaria.</p>
        </div>
      </aside>
    </section>
  )
}
