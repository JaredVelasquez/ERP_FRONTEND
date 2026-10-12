import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & {
  variant?: 'primary' | 'quiet'
  block?: boolean
  children: ReactNode
}

const base =
  'inline-flex items-center justify-center min-h-11 rounded-lg px-4 text-sm font-semibold transition-[transform,background-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0157D2] active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100 motion-reduce:transition-none motion-reduce:active:scale-100'

const variants = {
  primary:
    'border-0 bg-[#0157D2] text-white [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#013e96] disabled:bg-[#e6e8ee] disabled:text-[#5c6778]',
  quiet:
    'border border-[#d5d8e0] bg-white text-[#1c2430] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#f7f8fa] disabled:text-[#5c6778]',
} as const

export function Button({ variant = 'primary', block = false, type = 'button', children, ...props }: ButtonProps) {
  const width = block ? 'w-full' : ''
  return (
    <button type={type} className={`${base} ${variants[variant]} ${width}`} {...props}>
      {children}
    </button>
  )
}
