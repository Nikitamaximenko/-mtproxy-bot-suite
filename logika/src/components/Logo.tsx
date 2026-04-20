import { clsx } from 'clsx'

type Props = { className?: string; size?: 'sm' | 'md' | 'lg' }

export function Logo({ className, size = 'md' }: Props) {
  const text = size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-xl md:text-2xl' : 'text-base'
  return (
    <span
      className={clsx(
        'font-medium tracking-[-0.04em] text-foreground',
        text,
        className,
      )}
    >
      ЛОГИКА<span className="text-accent">.</span>
    </span>
  )
}
