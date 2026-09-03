'use client'

import {useEffect, useRef, useState, type KeyboardEvent} from 'react'

export type SelectOption<T extends string> = {value: T; label: string}

type SelectMenuProps<T extends string> = {
  value: T
  options: SelectOption<T>[]
  onChange: (value: T) => void
  ariaLabel: string
  name?: string
  disabled?: boolean
  className?: string
}

export default function SelectMenu<T extends string>({value, options, onChange, ariaLabel, name, disabled = false, className = ''}: SelectMenuProps<T>) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const selected = options.find((option) => option.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function choose(next: T) {
    onChange(next)
    setOpen(false)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setOpen(true)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
    }
  }

  return <div className={`select-menu ${className}`} ref={root}>
    {name && <input type="hidden" name={name} value={value}/>} 
    <button type="button" className="select-trigger" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} disabled={disabled} onClick={() => setOpen((current) => !current)} onKeyDown={handleKeyDown}>
      <span>{selected?.label ?? ''}</span><i aria-hidden="true">⌄</i>
    </button>
    {open && <div className="select-menu-list" role="listbox" aria-label={ariaLabel}>
      {options.map((option) => <button type="button" role="option" aria-selected={option.value === value} className={`select-option ${option.value === value ? 'selected' : ''}`} key={option.value} onClick={() => choose(option.value)}>{option.label}</button>)}
    </div>}
  </div>
}
