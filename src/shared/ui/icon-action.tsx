import type { ButtonHTMLAttributes } from 'react'
import { Icon, type IconName } from './icon'

type IconActionProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'title' | 'className'> & {
  label: string
  icon: IconName
  variant?: 'quiet' | 'primary'
  className?: string
}

export function IconAction({ label, icon, variant = 'quiet', className = '', type = 'button', ...props }: IconActionProps) {
  return <button type={type} className={`icon-action icon-action--${variant}${className ? ` ${className}` : ''}`} aria-label={label} title={label} data-tooltip={label} {...props}><Icon name={icon} /></button>
}
