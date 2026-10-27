import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & {
  variant?: 'primary' | 'quiet'
  block?: boolean
  children: ReactNode
}

export function Button({ variant = 'primary', block = false, type = 'button', children, ...props }: ButtonProps) {
  return (
    <button type={type} className={`ui-button ui-button--${variant}${block ? ' ui-button--block' : ''}`} {...props}>
      {children}
    </button>
  )
}
