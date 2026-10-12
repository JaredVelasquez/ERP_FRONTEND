import { useCallback, useState } from 'react'

export type FieldReport = (name: string, valid: boolean) => void

export function useFieldSet(names: readonly string[]) {
  const [flags, setFlags] = useState<Record<string, boolean>>({})
  const report = useCallback<FieldReport>((name, valid) => {
    setFlags((current) => {
      if (current[name] === valid) {
        return current
      }
      return { ...current, [name]: valid }
    })
  }, [])
  const ready = names.every((name) => flags[name] === true)
  return { report, ready }
}
