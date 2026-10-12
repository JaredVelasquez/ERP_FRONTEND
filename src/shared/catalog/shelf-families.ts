export const shelfFamilies = [
  { value: 'Pan', label: 'Pan', mark: 'Pn' },
  { value: 'Lácteos', label: 'Lácteos', mark: 'Lc' },
  { value: 'Abarrotes', label: 'Abarrotes', mark: 'Ab' },
  { value: 'Bebidas', label: 'Bebidas', mark: 'Be' },
  { value: 'Limpieza', label: 'Limpieza', mark: 'Li' },
] as const

export function shelfFamily(value: unknown): string {
  if (typeof value !== 'string') {
    return ''
  }
  const found = shelfFamilies.find((family) => family.value === value)
  if (found === undefined) {
    return ''
  }
  return found.value
}
