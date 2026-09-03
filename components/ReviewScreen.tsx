'use client'

import {useEffect, useMemo, useState, type FormEvent} from 'react'
import {addDays} from '../lib/activity'
import {useCamp} from '../lib/context'
import type {Metric, Person, SlipReason, Task} from '../lib/types'

const PEOPLE: Person[] = ['nihal', 'shirin']
const PERSON_NAME: Record<Person, string> = {nihal: 'Nihal', shirin: 'Shirin'}
const CONTENT_KEYS = [
  {key: 'posts_published', label: 'Posts'},
  {key: 'reels_published', label: 'Reels'},
  {key: 'articles_published', label: 'Articles'},
] as const
type ContentKey = typeof CONTENT_KEYS[number]['key']

const REVIEW_METRICS: Array<{key: Metric['key']; label: string; color: string}> = [
  {key: 'calls_booked', label: 'Audit calls booked', color: 'mint'},
  {key: 'connections_sent', label: 'Connections sent', color: 'sky'},
  {key: 'posts_published', label: 'Posts published', color: 'lilac'},
  {key: 'audits_delivered', label: 'Audits delivered', color: 'butter'},
  {key: 'proposals_sent', label: 'Proposals sent', color: 'coral'},
]

const SLIP_REASONS: Array<[SlipReason, string]> = [
  ['unclear_next_step', 'Next step unclear'],
  ['waiting_on_someone', 'Waiting on someone'],
  ['underestimated', 'Underestimated'],
  ['interrupted', 'Interrupted'],
  ['energy', 'Energy'],
  ['reprioritised', 'Reprioritised'],
  ['forgot', 'Forgot'],
  ['scope_grew', 'Scope grew'],
  ['no_longer_valid', 'No longer valid'],
]

function displayDate(value: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-IN', options).format(new Date(`${value}T12:00:00`))
}

function metricTotal(metrics: Metric[], sprintId: string, key: Metric['key'], start: string, end: string, person?: Person): number {
  return metrics.filter((metric) => metric.sprintId === sprintId && metric.key === key && metric.date >= start && metric.date <= end && (!person || metric.loggedBy === person)).reduce((sum, metric) => sum + metric.value, 0)
}

function TaskList({tasks, empty}: {tasks: Task[]; empty: string}) {
  if (!tasks.length) return <p className="review-empty-copy">{empty}</p>
  return <div className="review-task-list">{tasks.map((task) => <div className={`review-task ${task.status}`} key={task.id}><span className="review-task-dot">{task.status === 'done' ? '✓' : '·'}</span><div><b>{task.title}</b><small>{task.status === 'done' ? 'Shipped' : task.status === 'waiting' ? `Waiting on ${task.waitingOn ?? 'a reply'}` : task.status === 'blocked' ? `Blocked${task.waitingOn ? ` · ${task.waitingOn}` : ''}` : 'Still open'}{task.carriedCount > 0 ? ` · moved ${task.carriedCount}×` : ''}</small></div></div>)}</div>
}

function HoursValue({hours, rest}: {hours: number; rest: boolean}) {
  return <div className="hours-review-value"><strong>{hours}h</strong>{rest && <small>Rest day</small>}</div>
}

export default function ReviewScreen() {
  const {tasks, metrics, slipReasons, dailyHours, restDays, weeklyGoals, sprints, activeSprintId, currentDate, saveSprintChanges} = useCamp()
  const sprint = useMemo(() => sprints.find((item) => item.id === activeSprintId) ?? sprints.find((item) => item.isActive) ?? [...sprints].sort((a, b) => b.endDate.localeCompare(a.endDate))[0], [activeSprintId, sprints])
  const days = useMemo(() => {
    if (!sprint) return []
    const start = sprint.startDate || currentDate
    const end = sprint.endDate || start
    const startAt = new Date(`${start.slice(0, 10)}T12:00:00`)
    const endAt = new Date(`${end.slice(0, 10)}T12:00:00`)
    const duration = Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())
      ? 7
      : Math.max(1, Math.min(31, Math.floor((endAt.getTime() - startAt.getTime()) / 86400000) + 1))
    return Array.from({length: duration}, (_, index) => addDays(start.slice(0, 10), index))
  }, [currentDate, sprint])
  const [changes, setChanges] = useState('')
  const [saveBusy, setSaveBusy] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  useEffect(() => {
    setChanges(sprint?.changesNextSprint ?? '')
    setSaveMessage('')
  }, [sprint?.id, sprint?.changesNextSprint])

  if (!sprint) return <section className="review-screen"><section className="review-empty"><p className="eyebrow">Review</p><h2>No sprint to review yet.</h2><p>Start a sprint from the selector above, then this page will track what moved.</p></section></section>

  const sprintTasks = tasks.filter((task) => task.sprintId === sprint.id)
  const sprintStart = sprint.startDate || days[0]
  const sprintEnd = sprint.endDate || days[days.length - 1]
  const contentValue = (person: Person, key: ContentKey) => metricTotal(metrics, sprint.id, key, sprintStart, sprintEnd, person)
  const contentTotal = (person: Person) => CONTENT_KEYS.reduce((sum, item) => sum + contentValue(person, item.key), 0)
  const shipped = (person: Person) => sprintTasks.filter((task) => task.owner === person && task.status === 'done')
  const slipped = (person: Person) => sprintTasks.filter((task) => task.owner === person && (task.status !== 'done' || task.carriedCount > 0))
  const carried = [...sprintTasks].filter((task) => task.carriedCount > 0).sort((a, b) => b.carriedCount - a.carriedCount)
  const reasonCounts = useMemo(() => {
    const counts = new Map<SlipReason, number>(SLIP_REASONS.map(([reason]) => [reason, 0]))
    slipReasons.forEach((reason) => {
      if ((reason.movedFromDay >= sprintStart && reason.movedFromDay <= sprintEnd) || (reason.movedToDay >= sprintStart && reason.movedToDay <= sprintEnd)) counts.set(reason.reason, (counts.get(reason.reason) ?? 0) + 1)
    })
    return SLIP_REASONS.map(([reason, label]) => ({reason, label, count: counts.get(reason) ?? 0}))
  }, [slipReasons, sprintStart, sprintEnd])
  const maxReason = Math.max(1, ...reasonCounts.map((item) => item.count))
  const previousSprint = useMemo(() => [...sprints].filter((item) => item.id !== sprint.id && item.endDate < sprint.startDate).sort((a, b) => b.endDate.localeCompare(a.endDate))[0], [sprints, sprint.id, sprint.startDate])

  async function saveReflection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaveBusy(true)
    setSaveMessage('')
    try {
      const result = await saveSprintChanges(sprint.id, changes.trim())
      setSaveMessage(result.error ?? 'Saved for the next sprint')
    } catch {
      setSaveMessage('Could not save the sprint reflection')
    } finally {
      setSaveBusy(false)
    }
  }

  return <section className="review-screen">
    <section className="review-hero"><div><p className="eyebrow light">Sprint review · {sprint.name}</p><h2>Did the week move?</h2><p>{sprint.goal} · {displayDate(sprintStart, {day: 'numeric', month: 'short'})} – {displayDate(sprintEnd, {day: 'numeric', month: 'short', year: 'numeric'})}</p></div><div className="review-hero-content"><span>Content this week</span>{PEOPLE.map((person) => <div className="review-hero-person" key={person}><span className={`avatar ${person}`}><img src={`/avatars/${person}-dp.png`} alt=""/></span><b>{PERSON_NAME[person]}</b><strong>{contentTotal(person)}</strong></div>)}</div></section>

    {previousSprint?.changesNextSprint && <section className="review-reminder"><span>Last sprint’s change</span><p>{previousSprint.changesNextSprint}</p></section>}

    <section className="review-panel review-goal-checklist"><div className="review-panel-head"><div><p className="eyebrow">Sprint goals</p><h2>Nihal and Shirin’s commitments</h2></div><span className="count-pill">{sprint.name}</span></div><div className="review-goal-grid">{PEOPLE.map((person) => { const personTasks = sprintTasks.filter((task) => task.owner === person && task.tier === 'must'); const done = personTasks.filter((task) => task.status === 'done').length; const hit = personTasks.length > 0 && done === personTasks.length; return <article className={`review-goal-card ${hit ? 'hit' : ''}`} key={person}><div className="review-goal-check">{hit ? '✓' : '·'}</div><div><p className="eyebrow">{PERSON_NAME[person]}</p><h3>{sprint.goal}</h3><p>{hit ? 'Goal hit' : `${done} of ${personTasks.length} important tasks closed`}</p></div></article>})}</div></section>

    <section className="review-panel review-weekly-goals"><div className="review-panel-head"><div><p className="eyebrow">Weekly goals</p><h2>Personal goals for this week</h2></div><span className="count-pill">Editable on Today</span></div><div className="review-goal-grid">{PEOPLE.map((person) => <article className="review-weekly-person" key={person}><header><span className={`avatar ${person}`}><img src={`/avatars/${person}-dp.png`} alt=""/></span><h3>{PERSON_NAME[person]}</h3></header>{weeklyGoals.filter((goal) => goal.sprintId === sprint.id && goal.person === person).map((goal) => { const hit = goal.target !== undefined && goal.value >= goal.target; return <div className={`review-weekly-row ${hit ? 'hit' : ''}`} key={goal.id}><span>{hit ? '✓' : '·'}</span><div><b>{goal.title}</b>{goal.description && <small>{goal.description}</small>}</div><strong>{goal.target === undefined ? goal.value : `${goal.value}/${goal.target}`}</strong></div> })}{weeklyGoals.every((goal) => goal.sprintId !== sprint.id || goal.person !== person) && <p className="review-empty-copy">No personal goals added yet.</p>}</article>)}</div></section>

    <section className="review-panel review-content-breakdown"><div className="review-panel-head"><div><p className="eyebrow">Content by person</p><h2>Posts, reels, and articles</h2></div><span className="count-pill">Resets Monday</span></div><div className="content-person-grid">{PEOPLE.map((person) => <article className={`content-person ${person}`} key={person}><header><div className="content-person-identity"><span className={`avatar ${person}`}><img src={`/avatars/${person}-dp.png`} alt=""/></span><div><p className="eyebrow">{PERSON_NAME[person]}</p><h3>Total this week</h3></div></div><strong className="content-person-total">{contentTotal(person)}</strong></header><div className="content-breakdown">{CONTENT_KEYS.map((item) => <div className="content-breakdown-item" key={item.key}><span>{item.label}</span><strong>{contentValue(person, item.key)}</strong></div>)}</div></article>)}</div></section>

    <section className="review-main-grid"><article className="review-panel"><div className="review-panel-head"><div><p className="eyebrow">What moved</p><h2>Shipped and slipped</h2></div></div><div className="review-person-grid">{PEOPLE.map((person) => <article className="review-person" key={person}><header><span className={`avatar ${person}`}><img src={`/avatars/${person}-dp.png`} alt=""/></span><h2>{PERSON_NAME[person]}</h2></header><div className="review-person-section"><p className="review-label">Shipped</p><TaskList tasks={shipped(person)} empty="Nothing marked done yet."/></div><div className="review-person-section"><p className="review-label">Still open or carried</p><TaskList tasks={slipped(person)} empty="Nothing slipped."/></div></article>)}</div></article><article className="review-panel"><div className="review-panel-head"><div><p className="eyebrow">Why work moved</p><h2>Slip reasons</h2></div><span className="count-pill">{reasonCounts.reduce((sum, item) => sum + item.count, 0)} moves</span></div><div className="review-reasons">{reasonCounts.map((item) => <div className="review-reason-row" key={item.reason}><span>{item.label}</span><i><b style={{width: `${item.count / maxReason * 100}%`}}/></i><strong>{item.count}</strong></div>)}</div>{reasonCounts.every((item) => item.count === 0) && <p className="review-empty-copy review-reasons-empty">No Must moves logged for this sprint.</p>}<div className="review-person-section carried-section"><p className="review-label">Highest carry-over</p>{carried.length ? <div className="carried-list">{carried.slice(0, 5).map((task) => <div className="carried-row" key={task.id}><div><b>{task.title}</b><small>{task.owner === 'nihal' ? 'Nihal' : task.owner === 'shirin' ? 'Shirin' : 'Shared'}</small></div><strong>moved {task.carriedCount}×</strong></div>)}</div> : <p className="review-empty-copy">No carried tasks yet.</p>}</div></article></section>

    <section className="review-panel review-metrics"><div className="review-panel-head"><div><p className="eyebrow">Sprint signals</p><h2>Metrics against target</h2></div><span className="count-pill">{sprint.name}</span></div><div className="review-metric-list">{REVIEW_METRICS.map((item) => { const value = metricTotal(metrics, sprint.id, item.key, sprintStart, sprintEnd); const target = item.key === 'calls_booked' ? sprint.targetCalls : undefined; return <div className={`review-metric-row ${item.color}`} key={item.key}><span>{item.label}</span><strong>{target === undefined ? value : `${value} / ${target}`}</strong><small>{target === undefined ? 'Running count' : 'Sprint target'}</small></div> })}</div></section>

    <section className="review-panel review-hours"><div className="review-panel-head"><div><p className="eyebrow">Work hours</p><h2>Hours by day</h2></div><span className="count-pill">Selected sprint week</span></div><div className="hours-review-table"><div className="hours-review-head"><span>Day</span><span>Nihal</span><span>Shirin</span></div>{days.map((day) => <div className="hours-review-row" key={day}><span>{displayDate(day, {weekday: 'short', day: 'numeric', month: 'short'})}</span><HoursValue hours={dailyHours.find((entry) => entry.person === 'nihal' && entry.date === day)?.hours ?? 0} rest={restDays.some((entry) => entry.person === 'nihal' && entry.date === day)}/><HoursValue hours={dailyHours.find((entry) => entry.person === 'shirin' && entry.date === day)?.hours ?? 0} rest={restDays.some((entry) => entry.person === 'shirin' && entry.date === day)}/></div>)}</div></section>

    <form className="review-reflection" noValidate onSubmit={(event) => void saveReflection(event)}><div><p className="eyebrow">Next sprint</p><h2>What are we changing next sprint?</h2><p>Keep one concrete change visible when the next week starts.</p></div><textarea value={changes} onChange={(event) => setChanges(event.target.value)} placeholder="One change we will test next week…" aria-label="What are we changing next sprint?"/><div className="reflection-actions"><span className="review-save-message" role="status">{saveMessage}</span><button className="button dark" type="submit" disabled={saveBusy}>{saveBusy ? 'Saving…' : 'Save reflection'}</button></div></form>
  </section>
}
