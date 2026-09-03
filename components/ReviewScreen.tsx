'use client'

import {useMemo} from 'react'
import {addDays} from '../lib/activity'
import {useCamp} from '../lib/context'
import type {Person} from '../lib/types'

const PEOPLE: Person[] = ['nihal', 'shirin']
const PERSON_NAME: Record<Person, string> = {nihal: 'Nihal', shirin: 'Shirin'}
const CONTENT_KEYS = [
  {key: 'posts_published', label: 'Posts'},
  {key: 'reels_published', label: 'Reels'},
  {key: 'articles_published', label: 'Articles'},
] as const
type ContentKey = typeof CONTENT_KEYS[number]['key']

function monday(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T12:00:00`)
  const day = date.getDay()
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1))
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function displayDate(value: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-IN', options).format(new Date(`${value}T12:00:00`))
}

export default function ReviewScreen() {
  const {tasks, metrics, dailyHours, restDays, weeklyGoals, sprints, activeSprintId, currentDate} = useCamp()
  const sprint = useMemo(() => sprints.find((item) => item.id === activeSprintId) ?? sprints.find((item) => item.isActive) ?? [...sprints].sort((a, b) => b.endDate.localeCompare(a.endDate))[0], [activeSprintId, sprints])
  const days = useMemo(() => sprint ? Array.from({length: 7}, (_, index) => addDays(sprint.startDate ? monday(sprint.startDate) : monday(currentDate), index)) : [], [currentDate, sprint])
  if (!sprint) return <section className="review-screen"><section className="review-empty"><p className="eyebrow">Review</p><h2>No sprint to review yet.</h2></section></section>

  const sprintTasks = tasks.filter((task) => task.sprintId === sprint.id)
  const contentValue = (person: Person, key: ContentKey) => metrics.filter((metric) => metric.sprintId === sprint.id && metric.loggedBy === person && metric.key === key && metric.date >= days[0] && metric.date <= days[6]).reduce((sum, metric) => sum + metric.value, 0)
  const contentTotal = (person: Person) => CONTENT_KEYS.reduce((sum, item) => sum + contentValue(person, item.key), 0)

  return <section className="review-screen">
    <section className="review-hero"><div><p className="eyebrow light">Sprint review · {sprint.name}</p><h2>Did the week move?</h2><p>{sprint.goal} · {displayDate(days[0], {day: 'numeric', month: 'short'})} – {displayDate(days[6], {day: 'numeric', month: 'short', year: 'numeric'})}</p></div><div className="review-hero-content"><span>Content this week</span>{PEOPLE.map((person) => <div className="review-hero-person" key={person}><span className={`avatar ${person}`}><img src={`/avatars/${person}-dp.png`} alt=""/></span><b>{PERSON_NAME[person]}</b><strong>{contentTotal(person)}</strong></div>)}</div></section>

    <section className="review-panel review-goal-checklist"><div className="review-panel-head"><div><p className="eyebrow">Sprint goals</p><h2>Nihal and Shirin’s commitments</h2></div><span className="count-pill">{sprint.name}</span></div><div className="review-goal-grid">{PEOPLE.map((person) => { const personTasks = sprintTasks.filter((task) => task.owner === person && task.tier === 'must'); const done = personTasks.filter((task) => task.status === 'done').length; const hit = personTasks.length > 0 && done === personTasks.length; return <article className={`review-goal-card ${hit ? 'hit' : ''}`} key={person}><div className="review-goal-check">{hit ? '✓' : '·'}</div><div><p className="eyebrow">{PERSON_NAME[person]}</p><h3>{sprint.goal}</h3><p>{hit ? 'Goal hit' : `${done} of ${personTasks.length} important tasks closed`}</p></div></article>})}</div></section>

    <section className="review-panel review-weekly-goals"><div className="review-panel-head"><div><p className="eyebrow">Weekly goals</p><h2>Personal goals for this week</h2></div><span className="count-pill">Editable on Today</span></div><div className="review-goal-grid">{PEOPLE.map((person) => <article className="review-weekly-person" key={person}><header><span className={`avatar ${person}`}><img src={`/avatars/${person}-dp.png`} alt=""/></span><h3>{PERSON_NAME[person]}</h3></header>{weeklyGoals.filter((goal) => goal.sprintId === sprint.id && goal.person === person).map((goal) => { const hit = goal.target !== undefined && goal.value >= goal.target; return <div className={`review-weekly-row ${hit ? 'hit' : ''}`} key={goal.id}><span>{hit ? '✓' : '·'}</span><div><b>{goal.title}</b>{goal.description && <small>{goal.description}</small>}</div><strong>{goal.target === undefined ? goal.value : `${goal.value}/${goal.target}`}</strong></div> })}</article>)}</div></section>

    <section className="review-panel review-content-breakdown"><div className="review-panel-head"><div><p className="eyebrow">Content by person</p><h2>Posts, reels, and articles</h2></div><span className="count-pill">Resets Monday</span></div><div className="content-person-grid">{PEOPLE.map((person) => <article className="content-person" key={person}><header><div className="content-person-identity"><span className={`avatar ${person}`}><img src={`/avatars/${person}-dp.png`} alt=""/></span><div><p className="eyebrow">{PERSON_NAME[person]}</p><h3>Total this week</h3></div></div><strong className="content-person-total">{contentTotal(person)}</strong></header><div className="content-breakdown">{CONTENT_KEYS.map((item) => <div className="content-breakdown-item" key={item.key}><span>{item.label}</span><strong>{contentValue(person, item.key)}</strong></div>)}</div></article>)}</div></section>

    <section className="review-panel review-hours"><div className="review-panel-head"><div><p className="eyebrow">Work hours</p><h2>Hours by day</h2></div><span className="count-pill">Selected sprint week</span></div><div className="hours-review-table"><div className="hours-review-head"><span>Day</span><span>Nihal</span><span>Shirin</span></div>{days.map((day) => <div className="hours-review-row" key={day}><span>{displayDate(day, {weekday: 'short', day: 'numeric', month: 'short'})}</span><HoursValue entries={dailyHours} restDays={restDays} person="nihal" date={day}/><HoursValue entries={dailyHours} restDays={restDays} person="shirin" date={day}/></div>)}</div></section>
  </section>
}

function HoursValue({entries, restDays, person, date}: {entries: ReturnType<typeof useCamp>['dailyHours']; restDays: ReturnType<typeof useCamp>['restDays']; person: Person; date: string}) {
  const hours = hoursFor(entries, person, date)
  const rest = restDays.some((entry) => entry.person === person && entry.date === date)
  return <div className="hours-review-value"><strong>{hours}h</strong>{rest && <small>Rest day</small>}</div>
}

function hoursFor(entries: ReturnType<typeof useCamp>['dailyHours'], person: Person, date: string): number {
  return entries.find((entry) => entry.person === person && entry.date === date)?.hours ?? 0
}
