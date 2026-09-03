'use client'

import {useMemo, useState, type FormEvent} from 'react'
import {useCamp} from '../lib/context'
import type {Metric, Person, WeeklyGoal} from '../lib/types'
import SelectMenu from './SelectMenu'

const PEOPLE: Person[] = ['nihal', 'shirin']
const PERSON_NAME: Record<Person, string> = {nihal: 'Nihal', shirin: 'Shirin'}
const COLORS = ['mint', 'sky', 'lilac', 'butter', 'coral'] as const
const CONTENT_KEYS = [
  {key: 'posts_published', label: 'Posts'},
  {key: 'reels_published', label: 'Reels'},
  {key: 'articles_published', label: 'Articles'},
] as const
type ContentKey = typeof CONTENT_KEYS[number]['key']

export default function WeeklyKpiPanel() {
  const {weeklyGoals, metrics, sprints, activeSprintId, currentPerson, currentDate, addMetric, removeMetric, addWeeklyGoal, updateWeeklyGoal, deleteWeeklyGoal, adjustWeeklyGoal} = useCamp()
  const sprint = useMemo(() => sprints.find((item) => item.id === activeSprintId) ?? sprints.find((item) => item.isActive) ?? sprints[0], [activeSprintId, sprints])
  const [editor, setEditor] = useState<{person: Person; goal?: WeeklyGoal} | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const weekStart = useMemo(() => monday(currentDate), [currentDate])
  const weekEnd = addDays(weekStart, 6)

  function contentValue(person: Person, key: ContentKey): number {
    return metrics
      .filter((metric) => metric.sprintId === sprint?.id && metric.loggedBy === person && metric.key === key && metric.date >= weekStart && metric.date <= weekEnd)
      .reduce((sum, metric) => sum + metric.value, 0)
  }

  function contentTotal(person: Person): number {
    return CONTENT_KEYS.reduce((sum, item) => sum + contentValue(person, item.key), 0)
  }

  async function adjust(id: string, delta: number) {
    setBusy(id); setMessage('')
    try {
      const result = await adjustWeeklyGoal(id, delta)
      if (result.error) setMessage(result.error)
    } catch {
      setMessage('Could not update weekly goal')
    } finally {
      setBusy(null)
    }
  }

  async function save(goal: WeeklyGoal) {
    setBusy(goal.id); setMessage('')
    try {
      const result = editor?.goal ? await updateWeeklyGoal(goal.id, goal) : await addWeeklyGoal(goal)
      if (result.error) { setMessage(result.error); return }
      setEditor(null); setMessage('Weekly goal saved.')
    } catch {
      setMessage('Could not save weekly goal')
    } finally {
      setBusy(null)
    }
  }

  async function remove(goal: WeeklyGoal) {
    if (!window.confirm(`Remove “${goal.title}” from ${PERSON_NAME[goal.person]}'s goals?`)) return
    setBusy(goal.id); setMessage('')
    try {
      const result = await deleteWeeklyGoal(goal.id)
      if (result.error) setMessage(result.error); else setMessage('Weekly goal removed.')
    } catch {
      setMessage('Could not remove weekly goal')
    } finally {
      setBusy(null)
    }
  }

  async function adjustContent(person: Person, key: ContentKey, delta: number) {
    const busyKey = `${person}:${key}`
    setBusy(busyKey); setMessage('')
    try {
      if (delta < 0) {
        const existing = [...metrics].reverse().find((metric) => metric.sprintId === sprint?.id && metric.loggedBy === person && metric.key === key && metric.date >= weekStart && metric.date <= weekEnd)
        if (!existing) { setMessage(`No ${CONTENT_KEYS.find((item) => item.key === key)?.label.toLowerCase()} logged for ${PERSON_NAME[person]} this week.`); return }
        const result = await removeMetric(existing.id)
        if (result.error) setMessage(result.error)
      } else if (sprint) {
        const metric: Metric = {id: crypto.randomUUID(), sprintId: sprint.id, date: currentDate, key, value: 1, loggedBy: person}
        const result = await addMetric(metric)
        if (result.error) setMessage(result.error)
      }
    } catch {
      setMessage('Could not update content')
    } finally {
      setBusy(null)
    }
  }

  return <section className="kpi-panel">
    <div className="kpi-panel-head"><div><p className="eyebrow">Weekly goals</p><h2>Keep the motion visible.</h2></div><span className="kpi-logged-by">Week of {weekStart}</span></div>
    <section className="content-person-grid" aria-label="Content published by person">
      {PEOPLE.map((person) => <article className={`content-person ${currentPerson === person ? 'is-current' : ''}`} key={person}>
        <header><div className="content-person-identity"><span className={`avatar ${person}`}><img src={`/avatars/${person}-dp.png`} alt=""/></span><div><p className="eyebrow">{PERSON_NAME[person]}</p><h3>Content this week</h3></div></div><strong className="content-person-total">{contentTotal(person)}</strong></header>
        <div className="content-breakdown">{CONTENT_KEYS.map((item) => { const value = contentValue(person, item.key); const key = `${person}:${item.key}`; return <div className="content-breakdown-item" key={item.key}><span>{item.label}</span><div className="content-stepper"><button type="button" aria-label={`Decrease ${PERSON_NAME[person]} ${item.label}`} disabled={busy === key || value === 0} onClick={() => void adjustContent(person, item.key, -1)}>−</button><strong>{value}</strong><button type="button" aria-label={`Increase ${PERSON_NAME[person]} ${item.label}`} disabled={busy === key} onClick={() => void adjustContent(person, item.key, 1)}>+</button></div></div> })}</div>
      </article>)}
    </section>
    <div className="goal-person-grid">{PEOPLE.map((person) => <article className={`goal-person ${currentPerson === person ? 'is-current' : ''}`} key={person}><header><div><p className="eyebrow">{PERSON_NAME[person]}</p><h3>{currentPerson === person ? 'Your goals' : `${PERSON_NAME[person]}'s goals`}</h3></div><button type="button" className="button quiet goal-add" onClick={() => sprint && setEditor({person})}>+ Add goal</button></header><div className="goal-list">{weeklyGoals.filter((goal) => goal.sprintId === sprint?.id && goal.person === person).map((goal) => <div className={`goal-card ${goal.color}`} key={goal.id}><div className="goal-card-copy"><b>{goal.title}</b>{goal.description && <small>{goal.description}</small>}{goal.target !== undefined && <em>{goal.value} / {goal.target}</em>}</div><div className="goal-card-actions"><div className="stepper"><button type="button" aria-label={`Decrease ${goal.title}`} disabled={busy === goal.id || goal.value <= 0} onClick={() => void adjust(goal.id, -1)}>−</button><strong>{goal.value}</strong><button type="button" aria-label={`Increase ${goal.title}`} disabled={busy === goal.id} onClick={() => void adjust(goal.id, 1)}>+</button></div><button type="button" className="icon-button" aria-label={`Edit ${goal.title}`} disabled={busy === goal.id} onClick={() => setEditor({person, goal})}>✎</button><button type="button" className="icon-button danger" aria-label={`Delete ${goal.title}`} disabled={busy === goal.id} onClick={() => void remove(goal)}>×</button></div></div>)}</div></article>)}</div>
    {message && <p className="kpi-message" role="status">{message}</p>}
    {editor && sprint && <GoalEditor person={editor.person} sprintId={sprint.id} goal={editor.goal} busy={busy !== null} onClose={() => setEditor(null)} onSave={(goal) => void save(goal)} />}
  </section>
}

function monday(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T12:00:00`)
  const day = date.getDay(); date.setDate(date.getDate() - (day === 0 ? 6 : day - 1))
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function addDays(value: string, amount: number): string {
  const date = new Date(`${value.slice(0, 10)}T12:00:00`); date.setDate(date.getDate() + amount)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function GoalEditor({person, sprintId, goal, busy, onClose, onSave}: {person: Person; sprintId: string; goal?: WeeklyGoal; busy: boolean; onClose: () => void; onSave: (goal: WeeklyGoal) => void}) {
  const [title, setTitle] = useState(goal?.title ?? '')
  const [description, setDescription] = useState(goal?.description ?? '')
  const [target, setTarget] = useState(goal?.target === undefined ? '' : String(goal.target))
  const [color, setColor] = useState<WeeklyGoal['color']>(goal?.color ?? 'mint')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const clean = title.trim(); const parsedTarget = target.trim() ? Number(target) : undefined
    if (!clean || (parsedTarget !== undefined && (!Number.isInteger(parsedTarget) || parsedTarget < 0))) return
    onSave({id: goal?.id ?? crypto.randomUUID(), sprintId, person, title: clean, description: description.trim() || undefined, color, target: parsedTarget, value: goal?.value ?? 0, weekStart: goal?.weekStart})
  }
  return <div className="modal-bg"><section className="modal goal-modal"><button type="button" className="modal-close" onClick={onClose} disabled={busy}>×</button><p className="eyebrow">Weekly goal</p><h2>{goal ? 'Edit goal' : `Add ${person === 'nihal' ? 'Nihal' : 'Shirin'} goal`}</h2><form className="task-editor-form" noValidate onSubmit={submit}><label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} autoFocus placeholder="What should move?"/></label><label>Description <span className="optional">optional</span><textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="How will you recognise it?"/></label><div className="task-editor-two"><label>Target <span className="optional">optional</span><input type="number" min="0" step="1" value={target} onChange={(event) => setTarget(event.target.value)} placeholder="No target"/></label><label>Colour<SelectMenu value={color} options={COLORS.map((item) => ({value: item, label: item[0].toUpperCase() + item.slice(1)}))} ariaLabel="Goal colour" onChange={(value) => setColor(value)}/></label></div><div className="modal-form-actions"><button type="button" className="button quiet" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" className="button dark" disabled={busy || !title.trim()}>{busy ? 'Saving…' : 'Save goal'}</button></div></form></section></div>
}
