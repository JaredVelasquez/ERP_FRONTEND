import { useState, type FormEvent } from 'react'
import { useFieldSet } from '@/shared/hooks/use-field-set'
import { Button } from '@/shared/ui/button'
import { DateField } from '@/shared/ui/date-field'
import { CheckField, SelectField, TextField } from '@/shared/ui/fields'
import { Form, FormActions, FormNotice, FormSection } from '@/shared/ui/form-layout'
import { Panel } from '@/shared/ui/ops'
import { downloadVoucherPdf, saveSignedVoucher } from '../api'
import { signVoucherLocally, voucherFormIssue } from '../domain/sign-voucher'
import { voucherMessages } from '../messages'
import { SignaturePad } from './signature-pad'

type VoucherFormProps = {
  companyId?: string | null
  onSigned?: () => void
}

const paperFields = ['amount', 'reference', 'holder', 'institution', 'dni', 'phone', 'occurredOn', 'bankReference', 'acceptedDeclaration'] as const

export function VoucherForm({ companyId = null, onSigned }: VoucherFormProps) {
  const [serviceType, setServiceType] = useState<string>(voucherMessages.services[0].value)
  const [signature, setSignature] = useState('')
  const [signatureTouched, setSignatureTouched] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [voucherId, setVoucherId] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [reveal, setReveal] = useState(0)
  const { report, ready } = useFieldSet(paperFields)
  const signatureValid = signature.startsWith('data:image/')
  const showSignatureError = (signatureTouched || reveal > 0) && !signatureValid
  const otherService = serviceType === 'otro'

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setReveal((current) => current + 1)
    setSignatureTouched(true)
    const data = new FormData(event.currentTarget)
    const input = {
      bankReference: String(data.get('bankReference') ?? ''),
      moneyMovementId: String(data.get('moneyMovementId') ?? ''),
      signature,
      acceptedDeclaration: data.get('acceptedDeclaration') === 'on',
    }
    const issue = voucherFormIssue(input)
    const serviceNote = String(data.get('serviceNote') ?? '')
    if (issue !== null || !ready || !signatureValid) {
      setNotice(null)
      setFailed(false)
      return
    }
    if (otherService && serviceNote.trim() === '') {
      setNotice(null)
      setFailed(false)
      return
    }
    if (companyId === null || companyId.trim() === '') {
      setFailed(true)
      setNotice(voucherMessages.saveFailed)
      return
    }
    const currency = currencyOf(String(data.get('currency') ?? ''))
    const amount = Number(String(data.get('amount') ?? ''))
    if (currency === null || !Number.isFinite(amount)) {
      setFailed(true)
      setNotice(voucherMessages.saveFailed)
      return
    }
    const prepared = signVoucherLocally(input)
    setPending(true)
    setFailed(false)
    setNotice(null)
    try {
      const saved = await saveSignedVoucher({
        companyId,
        serviceType: String(data.get('serviceType') ?? ''),
        serviceNote: serviceNote.trim(),
        amount,
        currency,
        reference: String(data.get('reference') ?? ''),
        holder: String(data.get('holder') ?? ''),
        institution: String(data.get('institution') ?? ''),
        dni: String(data.get('dni') ?? ''),
        phone: String(data.get('phone') ?? ''),
        occurredOn: String(data.get('occurredOn') ?? ''),
        acceptedDeclaration: input.acceptedDeclaration,
        signature,
        bankReference: prepared.bankReference,
        moneyMovementId: prepared.moneyMovementId,
      })
      setVoucherId(saved.id)
      setNotice(voucherMessages.saved)
      onSigned?.()
    } catch (error) {
      setVoucherId(null)
      setFailed(true)
      setNotice(error instanceof Error && error.message !== '' ? error.message : voucherMessages.saveFailed)
    } finally {
      setPending(false)
    }
  }

  async function onDownload() {
    if (companyId === null || voucherId === null) {
      return
    }
    try {
      await downloadVoucherPdf(companyId, voucherId)
    } catch (error) {
      setFailed(true)
      setNotice(error instanceof Error && error.message !== '' ? error.message : voucherMessages.saveFailed)
    }
  }

  return (
    <Panel>
      <header className="voucher-sheet">
        <h2 className="voucher-sheet-title">{voucherMessages.formTitle}</h2>
        <p className="voucher-sheet-subtitle">{voucherMessages.formSubtitle}</p>
      </header>
      <div className="voucher-form">
        <Form
          onSubmit={(event) => {
            void onSubmit(event)
          }}
        >
          <FormSection title={voucherMessages.serviceType}>
            <div className="voucher-heading-field">
            <SelectField
              id="serviceType"
              name="serviceType"
              label={voucherMessages.serviceType}
              wide
              value={serviceType}
              onValue={setServiceType}
              options={voucherMessages.services.map((service) => ({ value: service.value, label: service.label }))}
            />
            </div>
            {otherService ? (
              <TextField
                id="serviceNote"
                name="serviceNote"
                label={voucherMessages.serviceNote}
                wide
                required
                requiredMessage={voucherMessages.issues['service-note']}
                reveal={reveal}
              />
            ) : null}
            <TextField
              id="amount"
              name="amount"
              label={voucherMessages.amount}
              inputMode="decimal"
              defaultValue="500.00"
              required
              requiredMessage={voucherMessages.saveFailed}
              field="amount"
              report={report}
              reveal={reveal}
            />
            <SelectField
              id="currency"
              name="currency"
              label={voucherMessages.currency}
              defaultValue="HNL"
              options={[
                { value: 'HNL', label: 'Lempiras' },
                { value: 'USD', label: 'Dólares' },
              ]}
            />
            <TextField
              id="reference"
              name="reference"
              label={voucherMessages.account}
              wide
              defaultValue="CMP-DEV-001"
              required
              requiredMessage={voucherMessages.saveFailed}
              field="reference"
              report={report}
              reveal={reveal}
            />
            <TextField
              id="holder"
              name="holder"
              label={voucherMessages.holder}
              wide
              defaultValue="Cliente de desarrollo"
              required
              requiredMessage={voucherMessages.saveFailed}
              field="holder"
              report={report}
              reveal={reveal}
            />
            <TextField
              id="institution"
              name="institution"
              label={voucherMessages.institution}
              wide
              defaultValue="Ficohsa"
              required
              requiredMessage={voucherMessages.saveFailed}
              field="institution"
              report={report}
              reveal={reveal}
            />
            <TextField
              id="dni"
              name="dni"
              label={voucherMessages.dni}
              defaultValue="0801199000001"
              required
              requiredMessage={voucherMessages.saveFailed}
              field="dni"
              report={report}
              reveal={reveal}
            />
            <TextField
              id="phone"
              name="phone"
              type="tel"
              label={voucherMessages.phone}
              defaultValue="9999-0000"
              required
              requiredMessage={voucherMessages.saveFailed}
              field="phone"
              report={report}
              reveal={reveal}
            />
            <DateField
              id="occurredOn"
              name="occurredOn"
              label={voucherMessages.occurredOn}
              defaultValue="2026-10-04"
              required
              requiredMessage={voucherMessages.dateRequired}
              field="occurredOn"
              report={report}
              reveal={reveal}
            />
          </FormSection>
          <FormSection title={voucherMessages.signature}>
            <div className="voucher-heading-field">
            <SignaturePad
              onChange={setSignature}
              onLeave={() => setSignatureTouched(true)}
              error={showSignatureError ? voucherMessages.issues.signature : null}
            />
            </div>
            <CheckField
              name="acceptedDeclaration"
              label={voucherMessages.declaration}
              wide
              required
              requiredMessage={voucherMessages.issues.declaration}
              field="acceptedDeclaration"
              report={report}
              reveal={reveal}
            />
          </FormSection>
          <div className="voucher-quiet-section">
            <FormSection title={voucherMessages.registry}>
              <TextField
                id="bankReference"
                name="bankReference"
                label={voucherMessages.bankReference}
                required
                requiredMessage={voucherMessages.issues['bank-reference']}
                field="bankReference"
                report={report}
                reveal={reveal}
              />
              <TextField
                id="moneyMovementId"
                name="moneyMovementId"
                label={voucherMessages.moneyMovement}
                hint={voucherMessages.movementHint}
              />
            </FormSection>
          </div>
          <FormActions>
            <Button type="submit" disabled={pending || !ready || !signatureValid}>
              {voucherMessages.sign}
            </Button>
            {voucherId ? (
              <Button
                type="button"
                variant="quiet"
                onClick={() => {
                  void onDownload()
                }}
              >
                {voucherMessages.download}
              </Button>
            ) : null}
          </FormActions>
          {notice ? <FormNotice tone={failed ? 'error' : 'ok'}>{notice}</FormNotice> : null}
        </Form>
      </div>
    </Panel>
  )
}

function currencyOf(value: string): 'HNL' | 'USD' | null {
  if (value === 'HNL' || value === 'USD') {
    return value
  }
  return null
}
