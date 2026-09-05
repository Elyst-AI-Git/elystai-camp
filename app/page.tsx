'use client'

import {useEffect, useState, type FormEvent, type ReactNode} from 'react'
import WeeklyKpiPanel from '../components/WeeklyKpiPanel'
import ReviewScreen from '../components/ReviewScreen'
import {CampProvider, useCamp} from '../lib/context'
import {addDays, characterState, consistencyDays, type CharacterState} from '../lib/activity'
import {categoryLabel, taskCategories} from '../lib/category'
import {daysOverdue, runwayWeeks, todayISO} from '../lib/finance'
import type {Category, Owner, Person, SlipReason, Sprint, Task, TaskStatus, Tier} from '../lib/types'
import FinanceScreen from '../components/FinanceScreen'
import CalendarScreen, {TodayCalendarStrip} from '../components/CalendarScreen'
import SelectMenu from '../components/SelectMenu'
import LeadsScreen from '../components/LeadsScreen'

const navigation = ['Today', 'Calendar', 'Money', 'Leads', 'Review'] as const
const personName: Record<Person, string> = {nihal: 'Nihal', shirin: 'Shirin'}
const categories: Category[] = taskCategories
type MutationResult = {error: string | null}

function formatDate(value: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-IN', options).format(new Date(`${value}T12:00:00`))
}

function mondayISO(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T12:00:00`)
  const day = date.getDay()
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1))
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function sprintDayOptions(sprint: Sprint, currentDate: string): Array<{value: string; label: string}> {
  const start = new Date(`${sprint.startDate}T12:00:00`)
  const end = new Date(`${sprint.endDate}T12:00:00`)
  const days: string[] = []
  if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end >= start) {
    const cursor = new Date(start)
    let count = 0
    while (cursor <= end && count < 31) {
      days.push(todayISO(cursor))
      cursor.setDate(cursor.getDate() + 1)
      count += 1
    }
  }
  if (!days.includes(currentDate)) days.unshift(currentDate)
  return days.map((day) => ({value: day, label: formatDate(day, {weekday: 'short', day: 'numeric', month: 'short'})}))
}

function Avatar({owner}: {owner: Owner | Person}) {
  const person = owner === 'nihal' || owner === 'shirin' ? owner : undefined
  return <span className={`avatar ${owner}`}>{person ? <img src={`/avatars/${person}-dp.png`} alt=""/> : owner === 'both' ? 'N+S' : '•'}</span>
}

function Character({person, state}: {person: Person; state: CharacterState}) {
  const [missing, setMissing] = useState(false)
  const source = `/avatars/${person}-${state}.png`
  const collageWorking = person === 'shirin' && state === 'working'
  useEffect(() => setMissing(false), [source])
  return <div className={`character ${person} ${state} ${collageWorking ? 'scene-collage' : ''}`}>{missing ? <span className="fallback-avatar">{personName[person]} · {state}</span> : <img src={source} alt={`${personName[person]} ${state}`} onError={() => setMissing(true)}/>}</div>
}

type NavigationItem = typeof navigation[number]

function NavIcon({item}: {item: NavigationItem}) {
  if (item === 'Today') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 10.5 12 3l8.5 7.5"/><path d="M5.5 9.5V21h13V9.5M9.5 21v-6h5v6"/></svg>
  if (item === 'Calendar') return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M7.5 3.5v4M16.5 3.5v4M3.5 9.5h17M7.5 13h.01M12 13h.01M16.5 13h.01M7.5 16.5h.01M12 16.5h.01M16.5 16.5h.01"/></svg>
  if (item === 'Money') return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M14.5 8.5c-.6-.6-1.4-.9-2.4-.9-1.4 0-2.4.7-2.4 1.8 0 2.7 5.2 1.1 5.2 3.8 0 1.1-1 1.9-2.5 1.9-1.1 0-2-.3-2.7-1M12 6.4v11.2"/></svg>
  if (item === 'Leads') return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="8" r="3.2"/><circle cx="16.5" cy="9.5" r="2.5"/><path d="M2.8 19.5c.4-3.4 2.2-5.2 5.2-5.2s4.8 1.8 5.2 5.2M14 15c2.9-.2 5 1.2 5.7 4.5"/></svg>
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2M4 12h1.5M18.5 12H20"/></svg>
}

function ProfileIdentity({compact = false}: {compact?: boolean}) {
  const {currentPerson, isRemoteConfigured, setPreviewPerson, logout} = useCamp()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function signOut() {
    setBusy(true); setMessage('')
    try {
      const result = await logout()
      if (result.error) { setMessage(result.error); return }
      if (isRemoteConfigured) window.location.assign('/login')
    } catch { setMessage('Could not sign out') } finally { setBusy(false) }
  }

  const switchPreview = () => { if (!isRemoteConfigured) setPreviewPerson(currentPerson === 'nihal' ? 'shirin' : 'nihal') }
  return <div className={`profile-identity profile-${currentPerson} ${compact ? 'compact' : ''}`}><button type="button" className="profile-person" aria-label={isRemoteConfigured ? `${personName[currentPerson]} profile` : `Switch to ${currentPerson === 'nihal' ? 'Shirin' : 'Nihal'}`} onClick={switchPreview}><Avatar owner={currentPerson}/><span className="profile-copy"><b>{personName[currentPerson]}</b></span></button><button type="button" className="profile-logout" aria-label="Log out" disabled={busy} onClick={() => void signOut()}>{busy ? '…' : '↪'}</button>{message && <small className="profile-message" role="status">{message}</small>}</div>
}

function SprintPicker() {
  const {sprints, activeSprintId, setActiveSprint} = useCamp()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function change(id: string) {
    if (id === activeSprintId) return
    setBusy(true); setMessage('')
    try {
      const result = await setActiveSprint(id)
      if (result.error) setMessage(result.error)
    } catch { setMessage('Could not switch sprint') } finally { setBusy(false) }
  }
  return <><div className="sprint-picker"><label><span>Working sprint</span><SelectMenu value={activeSprintId} options={sprints.map((sprint) => ({value:sprint.id,label:sprint.name}))} ariaLabel="Working sprint" disabled={busy} onChange={(id) => void change(id)}/></label><button type="button" className="text-button" onClick={() => {setMessage('');setOpen(true)}}>+ Sprint</button>{message && <small role="status">{message}</small>}</div>{open && <NewSprintModal onClose={() => setOpen(false)}/>}</>
}

function Shell() {
  const {view, setView, currentDate, isRemoteConfigured, authStatus, isLoading, loadError} = useCamp()
  if (isRemoteConfigured && (authStatus === 'loading' || isLoading)) return <main className="app-status"><p className="eyebrow">Camp</p><h1>Checking your workspace…</h1></main>
  if (isRemoteConfigured && authStatus === 'error') return <main className="app-status"><p className="eyebrow">Camp</p><h1>Workspace unavailable</h1><p>Camp could not verify your sign-in. Refresh and try again.</p>{loadError && <small>{loadError}</small>}</main>
  if (isRemoteConfigured && authStatus === 'signed-out') return null
  const liveDate = formatDate(currentDate, {weekday: 'long', day: 'numeric', month: 'long'})
  return <div className="shell">{loadError && <div className="data-warning" role="status">{loadError}</div>}<aside className="side"><div className="logo"><div className="logo-main"><img src="/icon.svg" alt=""/><span>camp</span></div><div className="logo-by"><span>by</span><img src="/brand/elyst-ai-wordmark.png" alt="Elyst AI"/></div></div><nav>{navigation.map((item) => <button type="button" className={view === item ? 'active' : ''} onClick={() => setView(item)} key={item}><span className="nav-icon"><NavIcon item={item}/></span>{item}</button>)}</nav><ProfileIdentity/></aside><main><header className="top"><div><p className="eyebrow">Elyst AI · {liveDate}</p><h1>{view}</h1></div><div className="top-actions">{(view === 'Today' || view === 'Review') && <SprintPicker/>}<div className="mobile-profile"><ProfileIdentity compact/></div></div></header>{view === 'Today' ? <Today/> : view === 'Calendar' ? <CalendarScreen/> : view === 'Money' ? <FinanceScreen/> : view === 'Leads' ? <LeadsScreen/> : <ReviewScreen/>}</main><nav className="bottom-nav">{navigation.map((item) => <button type="button" className={view === item ? 'active' : ''} onClick={() => setView(item)} key={item}>{item}</button>)}</nav></div>
}

function TaskDayNavigator({date, today, onChange}: {date: string; today: string; onChange: (date: string) => void}) {
  const oldest = addDays(today, -6)
  const canPrevious = date > oldest
  const canNext = date < today
  const daysAgo = Math.max(0, Math.round((new Date(`${today}T12:00:00`).getTime() - new Date(`${date}T12:00:00`).getTime()) / 86400000))
  const label = date === today ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo} days ago`
  return <section className="task-day-nav" aria-label="Task day history"><button type="button" className="task-day-arrow" aria-label="Previous task day" disabled={!canPrevious} onClick={() => onChange(addDays(date, -1))}>‹</button><div><p className="eyebrow">Task history · last 7 days</p><strong>{formatDate(date, {weekday: 'long', day: 'numeric', month: 'short'})}</strong><span>{label}{date === today ? ' · updates open' : ' · read-only'}</span></div><button type="button" className="task-day-arrow" aria-label="Next task day" disabled={!canNext} onClick={() => onChange(addDays(date, 1))}>›</button></section>
}

function Today() {
  const {tasks, metrics, transactions, invoices, settings, sprints, activeSprintId, currentDate, previewPerson, setView} = useCamp()
  const [taskDate, setTaskDate] = useState(currentDate)
  useEffect(() => { setTaskDate(currentDate) }, [currentDate])
  const sprint = sprints.find((item) => item.id === activeSprintId) ?? sprints.find((item) => item.isActive) ?? sprints[0]
  if (!sprint) return <section className="review-empty"><p className="eyebrow">Today</p><h2>No active sprint yet.</h2></section>
  const calls = metrics.filter((metric) => metric.sprintId === sprint.id && metric.key === 'calls_booked').reduce((sum, metric) => sum + metric.value, 0)
  const completed = tasks.filter((task) => task.sprintId === sprint.id && task.status === 'done').length
  const weeklyTasks = tasks.filter((task) => task.sprintId === sprint.id)
  const completionRate = weeklyTasks.length ? completed / weeklyTasks.length : 0
  const date = new Date(`${currentDate}T12:00:00`)
  const sprintEnd = new Date(`${sprint.endDate}T12:00:00`)
  const daysLeft = Number.isNaN(sprintEnd.getTime()) ? 0 : Math.max(0, Math.floor((sprintEnd.getTime() - date.getTime()) / 86400000))
  const overdue = invoices.find((invoice) => daysOverdue(invoice) >= 14)
  // Insights belong to the active sprint; an old carried task should not
  // interrupt today's prompt after the sprint has changed.
  const blocked = weeklyTasks.find((task) => task.status === 'blocked' && Math.floor((new Date(`${currentDate}T12:00:00`).getTime() - new Date(`${task.day}T12:00:00`).getTime()) / 86400000) > 2)
  const waiting = weeklyTasks.find((task) => task.status === 'waiting' && Math.floor((new Date(`${currentDate}T12:00:00`).getTime() - new Date(`${task.day}T12:00:00`).getTime()) / 86400000) > 3)
  const runway = runwayWeeks(transactions, settings)
  const insight: [string, string, string] = runway !== null && runway < 8 ? ['coral', 'Runway is under 8 weeks. Review spend.', 'Review spend'] : overdue ? ['coral', `${overdue.party} is ${daysOverdue(overdue)} days overdue. Chase it.`, 'Open invoices'] : daysLeft <= 3 && calls === 0 ? ['coral', `${daysLeft} days left and no calls booked. Change the week.`, 'Change the week'] : completionRate > .8 && calls === 0 ? ['butter', `You’ve closed ${Math.round(completionRate * 100)}% of tasks and booked no calls this week.`, 'Change the week'] : blocked ? ['butter', `Blocked work needs a next step. Ask ${blocked.waitingOn || 'for help'}.`, 'Check handoff'] : waiting ? ['butter', `${waiting.waitingOn || 'A reply'} has been waiting ${Math.max(1, Math.floor((new Date(`${currentDate}T12:00:00`).getTime() - new Date(`${waiting.day}T12:00:00`).getTime()) / 86400000))} days.`, 'Check handoff'] : ['mint', 'On track. Keep the next Must clear.', 'Keep moving']
  const insightTarget = insight[2] === 'Open invoices' || insight[2] === 'Review spend'
    ? 'Money'
    : insight[2] === 'Change the week'
      ? 'Calendar'
      : 'Today'
  const laneOrder: Person[] = previewPerson === 'shirin' ? ['shirin', 'nihal'] : ['nihal', 'shirin']
  return <><section className="number-hero"><div className="hero-copy"><div className="number"><strong>{calls}</strong><span>/ {sprint.targetCalls}</span></div><h2>Audit calls booked</h2><p className="hero-sprint">{sprint.name}</p><p className="hero-week">Week ends Sunday · {daysLeft} day{daysLeft === 1 ? '' : 's'} left</p></div><div className="hero-right"><div className="hero-progress"><div className="arc" style={{'--progress': `${sprint.targetCalls ? Math.min(100, calls / sprint.targetCalls * 100) : 0}%`} as React.CSSProperties}><span>{calls}/{sprint.targetCalls}</span></div><p className="hero-goal">Goal: {sprint.goal}</p></div><CallLogger sprintId={sprint.id} calls={calls}/></div></section><section className={`insight ${insight[0]}`}><span className="insight-star">✦</span><div><p className="eyebrow">A useful nudge</p><h3>{insight[1]}</h3></div><button type="button" className="button dark" onClick={() => setView(insightTarget)}>{insight[2]} ›</button></section><TaskDayNavigator date={taskDate} today={currentDate} onChange={setTaskDate}/><section className="lane-wrap">{laneOrder.map((person) => <Lane person={person} sprint={sprint} date={taskDate} key={person}/>)}</section><TodayCalendarStrip/><WeeklyKpiPanel/></>
}

function CallLogger({sprintId, calls}: {sprintId: string; calls: number}) {
  const {currentPerson, currentDate, metrics, addMetric, removeMetric} = useCamp()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function adjust(delta: number) {
    if (busy) return
    setBusy(true); setMessage('')
    try {
      if (delta < 0) {
        const existing = [...metrics].reverse().find((metric) => metric.sprintId === sprintId && metric.date === currentDate && metric.key === 'calls_booked' && metric.loggedBy === currentPerson)
        if (!existing) { setMessage('No call to remove today.'); return }
        const result = await removeMetric(existing.id)
        setMessage(result.error ?? 'Call removed')
      } else {
        const result = await addMetric({id: crypto.randomUUID(), sprintId, date: currentDate, key: 'calls_booked', value: 1, loggedBy: currentPerson})
        setMessage(result.error ?? 'Call logged')
      }
    } catch { setMessage('Could not log call') } finally { setBusy(false) }
  }
  return <div className="call-logger"><span className="call-label">Book calls</span><div className="stepper call-stepper"><button type="button" aria-label="Remove booked call" disabled={busy || calls === 0} onClick={() => void adjust(-1)}>−</button><strong>{calls}</strong><button type="button" aria-label="Add booked call" disabled={busy} onClick={() => void adjust(1)}>+</button></div><small>{message || `As ${currentPerson === 'nihal' ? 'Nihal' : 'Shirin'}`}</small></div>
}

function Lane({person, sprint, date}: {person: Person; sprint: Sprint; date: string}) {
  const {tasks, metrics, invoices, restDays, dailyHours, currentDate, previewPerson, setPreviewPerson, toggleTask, addTask, updateTask, deleteTask, reorderTasks, saveDailyHours, toggleRestDay} = useCamp()
  const editableDay = date === currentDate || date === addDays(currentDate, -1)
  const detailsEditable = date === currentDate
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [hoursBusy, setHoursBusy] = useState(false)
  const [restBusy, setRestBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [ordering, setOrdering] = useState(false)
  const [addTier, setAddTier] = useState<Tier>('must')
  const [addCategory, setAddCategory] = useState<Category>('services')
  const [addDay, setAddDay] = useState(date)
  useEffect(() => { setAddDay(date); setAdding(false); setMessage('') }, [date])

  const personTasks = tasks.filter((task) => task.sprintId === sprint.id && task.day === date && task.owner === person)
  const must = personTasks.filter((task) => task.tier === 'must')
  const stretch = personTasks.filter((task) => task.tier === 'stretch')
  const done = must.filter((task) => task.status === 'done').length
  const totalDone = personTasks.filter((task) => task.status === 'done').length
  const state = characterState({tasks, restDays, metrics, invoices, sprint, person, today: date})
  const isRestDay = restDays.some((entry) => entry.person === person && entry.date === date)
  const existingHours = dailyHours.find((entry) => entry.person === person && entry.date === date)?.hours
  const [hoursDraft, setHoursDraft] = useState(existingHours === undefined ? '' : String(existingHours))
  useEffect(() => { setHoursDraft(existingHours === undefined ? '' : String(existingHours)) }, [existingHours])

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage('')
    const form = new FormData(event.currentTarget)
    const title = String(form.get('title') ?? '').trim()
    if (!title) { setMessage('Give this task a title.'); return }
    let tier = addTier
    const targetMustCount = tasks.filter((task) => task.sprintId === sprint.id && task.owner === person && task.day === addDay && task.tier === 'must').length
    if (tier === 'must' && targetMustCount >= 5) {
      if (!window.confirm('Musts are capped at five for that day. Add this task as Stretch instead?')) return
      tier = 'stretch'
    }
    setBusy(true)
    try {
      const result = await addTask({id: crypto.randomUUID(), sprintId: sprint.id, owner: person, title, day: addDay, tier, category: addCategory, status: 'open', carriedCount: 0})
      if (result.error) { setMessage(result.error); return }
      setAdding(false)
    } catch { setMessage('Could not save task') } finally { setBusy(false) }
  }

  async function saveHours(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage('')
    if (!editableDay) { setMessage('History is read-only.'); return }
    const hours = Number(hoursDraft)
    if (!Number.isFinite(hours) || hours < 0 || hours > 24) { setMessage('Hours must be between 0 and 24.'); return }
    setHoursBusy(true)
    try {
      const result = await saveDailyHours(person, date, hours)
      if (result.error) setMessage(result.error); else setMessage('Hours saved')
    } catch { setMessage('Could not save daily hours') } finally { setHoursBusy(false) }
  }

  async function toggleRest() {
    if (!editableDay) { setMessage('History is read-only.'); return }
    setRestBusy(true); setMessage('')
    try {
      const result = await toggleRestDay(person, date)
      if (result.error) setMessage(result.error); else setMessage(isRestDay ? 'Rest day removed' : 'Rest day marked')
    } catch { setMessage('Could not update rest day') } finally { setRestBusy(false) }
  }

  const sortOrder = (a: Task, b: Task) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  const taskGroup = (task: Task): 'urgent' | 'must' | 'stretch' => task.status === 'waiting' || task.status === 'blocked' ? 'urgent' : task.tier
  const groupTasks = (group: 'urgent' | 'must' | 'stretch') => personTasks.filter((task) => taskGroup(task) === group).sort(sortOrder)
  const priorityTasks = [...groupTasks('urgent'), ...groupTasks('must'), ...groupTasks('stretch')]

  async function reorder(draggedId: string | null, targetId: string) {
    if (!draggedId || draggedId === targetId || !detailsEditable || ordering) return
    const dragged = personTasks.find((task) => task.id === draggedId)
    const target = personTasks.find((task) => task.id === targetId)
    if (!dragged || !target) return
    const draggedGroup = taskGroup(dragged)
    const targetGroup = taskGroup(target)
    if (draggedGroup !== targetGroup) {
      setMessage(draggedGroup === 'urgent' || targetGroup === 'urgent' ? 'Pinned work stays at the top.' : 'Reorder within Important or Stretch tasks.')
      setDraggingId(null)
      return
    }
    const ordered = groupTasks(draggedGroup)
    const fromIndex = ordered.findIndex((task) => task.id === draggedId)
    const toIndex = ordered.findIndex((task) => task.id === targetId)
    if (fromIndex < 0 || toIndex < 0) return
    const [moved] = ordered.splice(fromIndex, 1)
    ordered.splice(toIndex, 0, moved)
    setOrdering(true); setMessage('')
    try {
      const result = await reorderTasks(ordered.map((task, index) => ({id: task.id, sortOrder: index})))
      if (result.error) setMessage(result.error)
    } catch { setMessage('Could not reorder tasks') } finally { setOrdering(false); setDraggingId(null) }
  }
  const activeDay = !isRestDay
  const hoursLabel = date === currentDate ? 'Hours today' : `Hours on ${formatDate(date, {weekday: 'short', day: 'numeric', month: 'short'})}`
  const availableTaskDays = sprintDayOptions(sprint, date).filter((option) => option.value >= addDays(currentDate, -1))

  return <section className={`lane ${previewPerson === person ? 'selected' : 'secondary'}`}>
    <div className={`lane-top ${activeDay ? 'active-day' : 'inactive-day'}`} role="button" tabIndex={0} aria-label={`View ${personName[person]}'s profile`} onClick={() => setPreviewPerson(person)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setPreviewPerson(person) } }}>
      <Character person={person} state={state}/>
      <div><p className="eyebrow">{personName[person]}</p><h2>{done} / {must.length} important</h2><small>{totalDone} / {must.length + stretch.length} total tasks</small></div>
      <span className={`rest-dot ${isRestDay ? 'is-rest' : ''}`} title={isRestDay ? 'Rest day' : 'Work day'}>●</span>
    </div>
    <div className="lane-meta">
      <form className="hours-form" noValidate onSubmit={(event) => void saveHours(event)}>
        <label>{hoursLabel}<div className="hours-stepper"><button type="button" aria-label={`Decrease ${personName[person]} hours`} disabled={!editableDay || hoursBusy || Number(hoursDraft || 0) <= 0} onClick={() => setHoursDraft(String(Math.max(0, Number(hoursDraft || 0) - .5)))}>−</button><input aria-label={`${personName[person]} hours`} inputMode="decimal" type="number" min="0" max="24" step="0.5" value={hoursDraft} onChange={(event) => setHoursDraft(event.target.value)} placeholder="0" disabled={!editableDay || hoursBusy}/><button type="button" aria-label={`Increase ${personName[person]} hours`} disabled={!editableDay || hoursBusy || Number(hoursDraft || 0) >= 24} onClick={() => setHoursDraft(String(Math.min(24, Number(hoursDraft || 0) + .5)))}>+</button></div></label>
        <button type="submit" className="text-button" disabled={!editableDay || hoursBusy}>{hoursBusy ? 'Saving…' : 'Save hours'}</button>
      </form>
      <button type="button" className="rest-toggle" disabled={!editableDay || restBusy} onClick={() => void toggleRest()}>{restBusy ? 'Saving…' : isRestDay ? 'Remove rest day' : 'Mark rest day'}</button>
    </div>
    <div className="lane-tasks" onDragOver={(event) => { if (detailsEditable) event.preventDefault() }}>{priorityTasks.map((task) => <TaskRow key={task.id} task={task} tasks={tasks} editable={editableDay} detailsEditable={detailsEditable} isDraggable={detailsEditable && !ordering} dragging={draggingId === task.id} onDragStart={setDraggingId} onDragEnd={() => setDraggingId(null)} onDrop={(targetId) => void reorder(draggingId, targetId)} toggle={() => toggleTask(task.id)} update={(patch) => updateTask(task.id, patch)} remove={() => deleteTask(task.id)}/>)}</div>
    {detailsEditable ? adding ? <form className="inline-form" noValidate onSubmit={(event) => void add(event)}><input name="title" autoFocus placeholder="What needs doing?"/><SelectMenu value={addDay} options={availableTaskDays} ariaLabel={`${personName[person]} task day`} name="day" onChange={setAddDay}/><SelectMenu value={addTier} options={[{value:'must',label:'Important'},{value:'stretch',label:'Stretch'}]} ariaLabel={`${personName[person]} task type`} name="tier" onChange={(value) => setAddTier(value)}/><SelectMenu value={addCategory} options={categories.map((category) => ({value:category,label:categoryLabel(category)}))} ariaLabel={`${personName[person]} task category`} name="category" onChange={(value) => setAddCategory(value)}/><button type="submit" className="button dark" disabled={busy}>{busy ? 'Adding…' : 'Add'}</button></form> : <button type="button" className="add-line" onClick={() => { setMessage(''); setAdding(true) }}>+ Add task</button> : <small className="history-lock">{editableDay ? 'Yesterday is status-only. You can update completion, but not task details.' : 'History is read-only. Only today and yesterday can be updated.'}</small>}
    {message && <small className="task-error" role="status">{message}</small>}
    <details className="lane-details"><summary>Work hours</summary><ConsistencyHeatmap person={person} tasks={tasks} restDays={restDays} currentDate={currentDate}/><PrivateHours person={person} dailyHours={dailyHours} currentDate={currentDate}/></details>
  </section>
}

function TaskRow({task, tasks, editable = true, detailsEditable, isDraggable = false, dragging = false, onDragStart, onDragEnd, onDrop, toggle, update, remove}: {task: Task; tasks: Task[]; editable?: boolean; detailsEditable?: boolean; isDraggable?: boolean; dragging?: boolean; onDragStart?: (id: string) => void; onDragEnd?: () => void; onDrop?: (id: string) => void; toggle: () => Promise<MutationResult>; update: (patch: Partial<Task>) => Promise<MutationResult>; remove: () => Promise<MutationResult>}) {
  const [menu, setMenu] = useState(false); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [editing, setEditing] = useState(false); const [slipPending, setSlipPending] = useState<Partial<Task> | null>(null)
  async function run(action: () => Promise<MutationResult>): Promise<boolean> { setBusy(true); setMessage(''); try { const result = await action(); if (result.error) { setMessage(result.error); return false }; setMenu(false); return true } catch { setMessage('Could not save task'); return false } finally { setBusy(false) } }
  async function saveEdit(patch: Partial<Task>) { if (await run(() => update(patch))) setEditing(false) }
  async function confirmMove(reason: SlipReason) { if (!slipPending) return; const patch = {...slipPending, slipReason: reason}; setSlipPending(null); if (await run(() => update(patch))) setEditing(false) }
  const blockedTitle = task.blockedBy ? tasks.find((item) => item.id === task.blockedBy)?.title : undefined
  const canEditDetails = detailsEditable ?? editable
  return <article draggable={isDraggable} className={`task-row ${task.status} ${task.tier === 'must' ? 'important' : 'stretch'} ${task.carriedCount >= 2 ? 'carried' : ''} ${editable ? '' : 'read-only'} ${editable && !canEditDetails ? 'status-only' : ''} ${dragging ? 'dragging' : ''}`} title={!editable ? 'History is read-only' : !canEditDetails ? 'Yesterday: completion only' : undefined} onDragStart={() => onDragStart?.(task.id)} onDragEnd={() => onDragEnd?.()} onDragOver={(event) => { if (isDraggable) event.preventDefault() }} onDrop={(event) => { if (isDraggable) { event.preventDefault(); onDrop?.(task.id) } }}><button type="button" className="checkbox" disabled={busy || !editable} aria-label={editable ? `Mark ${task.title} ${task.status === 'done' ? 'open' : 'done'}` : `${task.title} is read-only`} onClick={() => void run(toggle)}>{task.status === 'done' ? '✓' : ''}</button><div className="task-copy"><b>{task.title}</b><small><span className={`task-tier-label ${task.tier === 'must' ? 'important' : ''}`}>{task.tier === 'must' ? 'Important' : 'Stretch'}</span> · {categoryLabel(task.category)} {task.waitingOn && `· waiting on ${task.waitingOn}`}</small>{task.status === 'blocked' && <em>Blocked · {blockedTitle ?? task.waitingOn ?? 'needs a handoff'}</em>}{task.carriedCount >= 2 && <em>moved {task.carriedCount}×</em>}{message && <small className="task-error" role="status">{message}</small>}</div><Avatar owner={task.owner}/>{canEditDetails && <button type="button" className="more" disabled={busy} aria-label={`Actions for ${task.title}`} onClick={() => setMenu((open) => !open)}>•••</button>}{canEditDetails && menu && <div className="task-menu"><button type="button" disabled={busy} onClick={() => {setMenu(false);setEditing(true)}}>Edit task</button><button type="button" disabled={busy} onClick={() => void run(remove)}>Delete</button></div>}{canEditDetails && editing && <TaskEditor task={task} tasks={tasks} busy={busy} onClose={() => setEditing(false)} onRequestMove={(patch) => setSlipPending(patch)} onSave={(patch) => void saveEdit(patch)}/>} {canEditDetails && slipPending && <SlipPicker busy={busy} onPick={(reason) => void confirmMove(reason)} onClose={() => setSlipPending(null)}/>}</article>
}

function TaskEditor({task, tasks, busy, onClose, onRequestMove, onSave}: {task: Task; tasks: Task[]; busy: boolean; onClose: () => void; onRequestMove: (patch: Partial<Task>) => void; onSave: (patch: Partial<Task>) => void}) {
  const existingBlockedTitle = task.blockedBy ? tasks.find((item) => item.id === task.blockedBy)?.title : ''
  const [title, setTitle] = useState(task.title); const [notes, setNotes] = useState(task.notes ?? ''); const [owner, setOwner] = useState<Owner>(task.owner); const [category, setCategory] = useState<Category>(task.category); const [status, setStatus] = useState<TaskStatus>(task.status); const [waitingOn, setWaitingOn] = useState(task.waitingOn ?? ''); const [blockedBy, setBlockedBy] = useState(existingBlockedTitle ?? ''); const [day, setDay] = useState(task.day)
  function taskPatch(): Partial<Task> { const clean = title.trim(); const linked = tasks.find((item) => item.id !== task.id && item.title.toLowerCase() === blockedBy.trim().toLowerCase()); return {title: clean, notes: notes.trim() || undefined, owner, category, status, waitingOn: status === 'waiting' ? waitingOn.trim() || 'A reply' : status === 'blocked' ? blockedBy.trim() || undefined : undefined, blockedBy: status === 'blocked' ? linked?.id : undefined} }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!title.trim()) return; const formDay = String(new FormData(event.currentTarget).get('day') ?? day); const patch = taskPatch(); if (formDay !== task.day && task.tier === 'must') { onRequestMove({...patch, day: formDay}); return } onSave({...patch, ...(formDay !== task.day ? {day: formDay} : {})}) }
  return <Modal title="Edit task" close={onClose} closeDisabled={busy}><form className="task-editor-form" noValidate onSubmit={submit}><label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} autoFocus/></label><label>Notes <span className="optional">optional</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3}/></label><div className="task-editor-two"><label>Owner<SelectMenu value={owner} options={[{value:'nihal',label:'Nihal'},{value:'shirin',label:'Shirin'},{value:'either',label:'Either'},{value:'both',label:'Both'}]} ariaLabel="Task owner" onChange={(value) => setOwner(value)}/></label><label>Category<SelectMenu value={category} options={categories.map((item) => ({value:item,label:categoryLabel(item)}))} ariaLabel="Task category" onChange={(value) => setCategory(value)}/></label></div><label>Status<SelectMenu value={status} options={[{value:'open',label:'Open'},{value:'done',label:'Done'},{value:'waiting',label:'Waiting'},{value:'blocked',label:'Blocked'}]} ariaLabel="Task status" onChange={(value) => setStatus(value)}/></label>{status === 'waiting' && <label>Waiting on<input value={waitingOn} onChange={(event) => setWaitingOn(event.target.value)} placeholder="Person or thing"/></label>}{status === 'blocked' && <label>Blocked by / context<input value={blockedBy} onChange={(event) => setBlockedBy(event.target.value)} placeholder="Task title or context"/></label>}<label>Day<input name="day" type="date" value={day} onChange={(event) => setDay(event.target.value)} /></label><div className="modal-form-actions"><button type="button" className="button quiet" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" className="button dark" disabled={busy || !title.trim()}>{busy ? 'Saving…' : 'Save changes'}</button></div></form></Modal>
}

function NewSprintModal({onClose}: {onClose: () => void}) {
  const {currentDate, addSprint} = useCamp()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('')
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    const startDate = String(form.get('startDate') ?? '')
    const endDate = String(form.get('endDate') ?? '')
    const goal = String(form.get('goal') ?? '').trim()
    const targetCalls = Number(form.get('targetCalls'))
    const startWeekday = new Date(`${startDate}T12:00:00`).getDay()
    const endWeekday = new Date(`${endDate}T12:00:00`).getDay()
    if (!name || !startDate || !endDate || !goal || !Number.isInteger(targetCalls) || targetCalls < 0 || endDate < startDate) { setError('Complete the sprint details with a valid date range.'); return }
    if (startWeekday !== 1 || endWeekday !== 0) { setError('Camp weeks run Monday to Sunday.'); return }
    setBusy(true)
    try {
      const result = await addSprint({id: crypto.randomUUID(),name,startDate,endDate,goal,targetCalls,isActive:true})
      if (result.error) { setError(result.error); return }
      onClose()
    } catch { setError('Could not save sprint') } finally { setBusy(false) }
  }
  const startDefault = mondayISO(currentDate)
  return <Modal title="Start a sprint" close={onClose} closeDisabled={busy}>{error && <p className="login-error" role="alert">{error}</p>}<form className="task-editor-form" noValidate onSubmit={(event) => void submit(event)}><label>Name<input name="name" autoFocus placeholder="Sprint 2"/></label><div className="task-editor-two"><label>Starts<input name="startDate" type="date" defaultValue={startDefault}/></label><label>Ends<input name="endDate" type="date" defaultValue={addDays(startDefault,6)}/></label></div><label>Goal<input name="goal" placeholder="What needs to move?"/></label><label>Audit-call target<input name="targetCalls" type="number" min="0" step="1" defaultValue="2"/></label><div className="modal-form-actions"><button type="button" className="button quiet" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" className="button dark" disabled={busy}>{busy ? 'Saving…' : 'Start sprint'}</button></div></form></Modal>
}

function ConsistencyHeatmap({person, tasks, restDays, currentDate}: {person: Person; tasks: Task[]; restDays: ReturnType<typeof useCamp>['restDays']; currentDate: string}) {
  const cells = consistencyDays(tasks, restDays, person, currentDate, 14)
  return <div className="consistency-block"><div className="consistency-head"><span>Last two weeks</span><small>Green means every important task closed</small></div><div className="heatmap" aria-label={`${personName[person]} consistency heatmap`}>{cells.map((cell) => <span className={`heat-cell ${cell.tone}`} title={`${formatDate(cell.date,{day:'numeric',month:'short'})}: ${cell.tone === 'all' ? 'all important tasks closed' : cell.tone === 'some' ? 'some important tasks closed' : cell.tone === 'rest' ? 'rest day' : 'no important tasks closed'}`} key={cell.date}/>)}</div></div>
}

function PrivateHours({person, dailyHours, currentDate}: {person: Person; dailyHours: ReturnType<typeof useCamp>['dailyHours']; currentDate: string}) {
  const entries = Array.from({length: 7}, (_, index) => { const date = addDays(currentDate, index - 6); return {date, hours: dailyHours.find((entry) => entry.person === person && entry.date === date)?.hours ?? 0} }); const max = Math.max(1, ...entries.map((entry) => entry.hours))
  const total = entries.reduce((sum, entry) => sum + entry.hours, 0)
  return <div className="private-hours"><div className="consistency-head"><span>Hours logged</span><strong className="hours-total">{total}h</strong></div><div className="hours-bars">{entries.map((entry) => <div className="hours-bar" key={entry.date} title={`${formatDate(entry.date,{day:'numeric',month:'short'})}: ${entry.hours} hours`}><i style={{height: `${Math.max(entry.hours ? 8 : 2, entry.hours / max * 100)}%`}}/><small>{entry.hours}h · {formatDate(entry.date,{weekday:'short'}).slice(0, 1)}</small></div>)}</div></div>
}

function SlipPicker({busy, onPick, onClose}: {busy: boolean; onPick: (reason: SlipReason) => void | Promise<void>; onClose: () => void}) { const reasons: Array<[SlipReason,string]> = [['unclear_next_step','Next step unclear'],['waiting_on_someone','Waiting on someone'],['underestimated','Underestimated'],['interrupted','Interrupted'],['energy','Energy'],['reprioritised','Reprioritised'],['forgot','Forgot'],['scope_grew','Scope grew'],['no_longer_valid','No longer valid']]; return <Modal title="Why did this Must move?" close={onClose} closeDisabled={busy}><p className="modal-copy">Pick one reason. This helps Friday’s review stay honest.</p><div className="reason-list">{reasons.map(([reason,label]) => <button type="button" disabled={busy} onClick={() => void onPick(reason)} key={reason}>{busy ? 'Saving…' : label}</button>)}</div></Modal> }

function Modal({title, children, close, closeDisabled = false}: {title: string; children: ReactNode; close: () => void; closeDisabled?: boolean}) { return <div className="modal-bg"><section className="modal"><button type="button" className="modal-close" onClick={close} disabled={closeDisabled}>×</button><p className="eyebrow">Camp</p><h2>{title}</h2>{children}</section></div> }

export default function Page() { return <CampProvider><Shell/></CampProvider> }
