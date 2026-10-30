export interface ItemPickerOption {
  id: string
  name: string
  details: string
  value?: string
}

export function ItemPickerResults({ options, onSelect }: { options: readonly ItemPickerOption[]; onSelect: (id: string) => void }) {
  return <ul className="item-picker-results" role="listbox" aria-label="Artículos encontrados">
    {options.map((option) => <li key={option.id}>
      <button type="button" role="option" aria-selected="false" className="item-picker-option" onClick={() => onSelect(option.id)}>
        <span className="item-picker-option__identity"><strong>{option.name}</strong><small>{option.details}</small></span>
        {option.value ? <span className="item-picker-option__value">{option.value}</span> : null}
      </button>
    </li>)}
  </ul>
}
