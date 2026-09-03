import type {Category} from './types'

/** One semantic palette shared by tasks, calendar blocks, and future views. */
export const categoryPalette: Record<Category, string> = {
  outbound: 'var(--lilac)',
  website: 'var(--sky)',
  content: 'var(--mint)',
  training: 'var(--butter)',
  delivery: 'var(--coral)',
  admin: 'var(--line)',
  services: 'var(--mint)',
  upskilling: 'var(--lilac)',
  other: 'var(--surface-muted)',
}

export const categoryLabel = (category: Category): string => {
  if (category === 'outbound' || category === 'delivery' || category === 'services') return 'Services'
  if (category === 'admin') return 'Other'
  return category[0].toUpperCase() + category.slice(1)
}

export const taskCategories: Category[] = ['services', 'content', 'website', 'training', 'upskilling', 'other']

/** Includes legacy values so existing rows remain editable without changing category on save. */
export const allCategories: Category[] = ['services', 'content', 'website', 'training', 'upskilling', 'other', 'outbound', 'delivery', 'admin']
