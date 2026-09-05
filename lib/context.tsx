'use client'

import {createContext, useContext, useEffect, useMemo, useState} from 'react'
import {blocks as seedBlocks, dailyHours as seedDailyHours, invoices as seedInvoices, leads as seedLeads, metrics as seedMetrics, personalTransactions as seedPersonalTransactions, reimbursements as seedReimbursements, restDays as seedRestDays, settings as seedSettings, slipReasons as seedSlipReasons, sprints as seedSprints, tasks as seedTasks, transactions as seedTransactions, users, weeklyGoals as seedWeeklyGoals} from './mock/data'
import {createAnonClient} from './supabase/browser'
import {fetchTasks, removeTask, saveTask} from './data/tasks'
import {fetchInvoices, fetchReimbursements, fetchSettings, fetchTransactions, removeLinkedTransaction, saveInvoice, saveReimbursement, saveSettings, saveTransaction} from './data/finance'
import {fetchCalendarBlocks, removeCalendarBlock, saveCalendarBlock} from './data/calendar'
import {fetchMetrics, removeMetric as removeMetricEntry, saveMetric} from './data/metrics'
import {activateSprint, fetchSprints, saveSprint, saveSprintChanges} from './data/sprints'
import {fetchSlipReasons, removeSlipReason, saveSlipReason} from './data/slip-reasons'
import {fetchDailyHours, fetchRestDays, removeRestDay as removeRestDayEntry, saveDailyHours as saveDailyHoursEntry, saveRestDay as saveRestDayEntry} from './data/daily-hours'
import {fetchWeeklyGoals, removeWeeklyGoal, saveWeeklyGoal} from './data/weekly-goals'
import {fetchPersonalTransactions, removePersonalTransaction, savePersonalTransaction} from './data/personal-finance'
import {fetchLeads, removeLead, saveLead} from './data/leads'
import {personForEmail} from './auth/person'
import {addDays} from './activity'
import {todayISO} from './finance'
import type {CalendarBlock, Category, DailyHours, Invoice, Lead, Metric, Owner, Person, PersonalTransaction, Reimbursement, RestDay, Settings, Sprint, Task, TaskSlipReason, TaskStatus, Tier, Transaction, WeeklyGoal} from './types'

type CampState = {
  tasks: Task[]
  metrics: Metric[]
  slipReasons: TaskSlipReason[]
  transactions: Transaction[]
  invoices: Invoice[]
  reimbursements: Reimbursement[]
  blocks: CalendarBlock[]
  dailyHours: DailyHours[]
  restDays: RestDay[]
  weeklyGoals: WeeklyGoal[]
  personalTransactions: PersonalTransaction[]
  leads: Lead[]
  sprints: Sprint[]
  settings: Settings
  activeSprintId: string
  setActiveSprint: (id: string) => Promise<{error: string | null}>
  addSprint: (sprint: Sprint) => Promise<{error: string | null}>
  currentPerson: Person
  previewPerson: Person
  currentDate: string
  isRemoteConfigured: boolean
  authStatus: 'local' | 'loading' | 'signed-in' | 'signed-out' | 'error'
  isLoading: boolean
  loadError: string | null
  view: string
  setView: (view: string) => void
  setPreviewPerson: (person: Person) => void
  logout: () => Promise<{error: string | null}>
  toggleTask: (id: string) => Promise<{error: string | null}>
  addTask: (task: Task) => Promise<{error: string | null}>
  updateTask: (id: string, patch: Partial<Task>) => Promise<{error: string | null}>
  deleteTask: (id: string) => Promise<{error: string | null}>
  moveTask: (id: string, day: string, slip?: Task['slipReason']) => Promise<{error: string | null}>
  reorderTasks: (updates: Array<{id: string; sortOrder: number}>) => Promise<{error: string | null}>
  addMetric: (metric: Metric) => Promise<{error: string | null}>
  removeMetric: (id: string) => Promise<{error: string | null}>
  saveSprintChanges: (id: string, changesNextSprint: string) => Promise<{error: string | null}>
  addTransaction: (transaction: Transaction) => Promise<{error: string | null}>
  updateTransaction: (id: string, patch: Partial<Transaction>) => Promise<{error: string | null}>
  addInvoice: (invoice: Invoice) => Promise<{error: string | null}>
  setInvoiceSent: (id: string) => Promise<{error: string | null}>
  setInvoiceReceived: (id: string, received: boolean) => Promise<{error: string | null}>
  addReimbursement: (reimbursement: Reimbursement) => Promise<{error: string | null}>
  settleReimbursement: (id: string, settled: boolean) => Promise<{error: string | null}>
  updateSettings: (settings: Settings) => Promise<{error: string | null}>
  saveDailyHours: (person: Person, date: string, hours: number) => Promise<{error: string | null}>
  toggleRestDay: (person: Person, date: string) => Promise<{error: string | null}>
  addWeeklyGoal: (goal: WeeklyGoal) => Promise<{error: string | null}>
  updateWeeklyGoal: (id: string, patch: Partial<WeeklyGoal>) => Promise<{error: string | null}>
  deleteWeeklyGoal: (id: string) => Promise<{error: string | null}>
  adjustWeeklyGoal: (id: string, delta: number) => Promise<{error: string | null}>
  addPersonalTransaction: (entry: PersonalTransaction) => Promise<{error: string | null}>
  updatePersonalTransaction: (id: string, patch: Partial<PersonalTransaction>) => Promise<{error: string | null}>
  deletePersonalTransaction: (id: string) => Promise<{error: string | null}>
  addLead: (lead: Lead) => Promise<{error: string | null}>
  updateLead: (id: string, patch: Partial<Lead>) => Promise<{error: string | null}>
  deleteLead: (id: string) => Promise<{error: string | null}>
  addBlock: (block: CalendarBlock) => Promise<{error: string | null}>
  updateBlock: (id: string, patch: Partial<CalendarBlock>) => Promise<{error: string | null}>
  deleteBlock: (id: string) => Promise<{error: string | null}>
  setReview: (value: string) => void
}

const CampContext = createContext<CampState | null>(null)
const remoteConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
// v2 intentionally leaves the previous demo cache behind and starts the local preview clean.
const storagePrefix = 'camp-clean-v2'

function readStored<T>(key: string, seed: T): T {
  try {
    const raw = localStorage.getItem(`${storagePrefix}-${key}`)
    return raw ? JSON.parse(raw) as T : seed
  } catch {
    return seed
  }
}

function mondayISO(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T12:00:00`)
  const day = date.getDay()
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1))
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function isTaskEditable(day: string, currentDate: string): boolean {
  return day === currentDate || day === addDays(currentDate, -1)
}

function isTaskTargetAllowed(day: string, currentDate: string): boolean {
  return day.slice(0, 10) >= addDays(currentDate, -1)
}

function isStatusOnlyPatch(patch: Partial<Task>): boolean {
  return Object.keys(patch).every((key) => key === 'status')
}

export function CampProvider({children}: {children: React.ReactNode}) {
  const [tasks, setTasks] = useState<Task[]>(seedTasks)
  const [metrics, setMetrics] = useState<Metric[]>(seedMetrics)
  const [slipReasons, setSlipReasons] = useState<TaskSlipReason[]>(seedSlipReasons)
  const [transactions, setTransactions] = useState<Transaction[]>(seedTransactions)
  const [invoices, setInvoices] = useState<Invoice[]>(seedInvoices)
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>(seedReimbursements)
  const [blocks, setBlocks] = useState<CalendarBlock[]>(seedBlocks)
  const [dailyHours, setDailyHours] = useState<DailyHours[]>(seedDailyHours)
  const [restDays, setRestDays] = useState<RestDay[]>(seedRestDays)
  const [weeklyGoals, setWeeklyGoals] = useState<WeeklyGoal[]>(seedWeeklyGoals)
  const [personalTransactions, setPersonalTransactions] = useState<PersonalTransaction[]>(seedPersonalTransactions)
  const [leads, setLeads] = useState<Lead[]>(seedLeads)
  const [sprints, setSprints] = useState<Sprint[]>(seedSprints)
  const [settings, setSettings] = useState<Settings>(seedSettings)
  const [activeSprintId, setActiveSprintId] = useState('s1')
  const [currentPerson, setCurrentPerson] = useState<Person>('nihal')
  const [previewPerson, setPreviewPersonState] = useState<Person>('nihal')
  const [currentDate, setCurrentDate] = useState(() => todayISO())
  const [view, setView] = useState('Today')
  const [review, setReviewText] = useState('')
  const [hydrated, setHydrated] = useState(false)
  const [isLoading, setIsLoading] = useState(remoteConfigured)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [authStatus, setAuthStatus] = useState<CampState['authStatus']>(remoteConfigured ? 'loading' : 'local')

  useEffect(() => {
    let alive = true
    async function hydrate() {
      if (!remoteConfigured) {
        setTasks(readStored('tasks', seedTasks))
        setMetrics(readStored('metrics', seedMetrics))
        setSlipReasons(readStored('slip-reasons', seedSlipReasons))
        setTransactions(readStored('transactions', seedTransactions))
        setInvoices(readStored('invoices', seedInvoices))
        setReimbursements(readStored('reimbursements', seedReimbursements))
        setBlocks(readStored('blocks', seedBlocks))
        setDailyHours(readStored('daily-hours', seedDailyHours))
        setRestDays(readStored('rest-days', seedRestDays))
        setWeeklyGoals(readStored('weekly-goals', seedWeeklyGoals))
        setPersonalTransactions(readStored('personal-transactions', seedPersonalTransactions))
        setLeads(readStored('leads', seedLeads))
        setSprints(readStored('sprints', seedSprints))
        const storedActiveSprint = readStored('active-sprint', 's1')
        if (typeof storedActiveSprint === 'string' && storedActiveSprint) setActiveSprintId(storedActiveSprint)
        const storedPreviewPerson = readStored<string>('preview-person', 'nihal')
        if (storedPreviewPerson === 'shirin' || storedPreviewPerson === 'nihal') {
          setPreviewPersonState(storedPreviewPerson)
          setCurrentPerson(storedPreviewPerson)
        }
        setSettings(readStored('settings', seedSettings))
        setReviewText(readStored('review', ''))
        setHydrated(true)
        setIsLoading(false)
        return
      }
      const results = await Promise.all([fetchTasks(), fetchMetrics(), fetchSlipReasons(), fetchTransactions(), fetchInvoices(), fetchReimbursements(), fetchSettings(), fetchCalendarBlocks(), fetchSprints(), fetchDailyHours(), fetchRestDays(), fetchWeeklyGoals(), fetchPersonalTransactions(), fetchLeads()])
      const [remoteTasks, remoteMetrics, remoteSlipReasons, remoteTransactions, remoteInvoices, remoteReimbursements, remoteSettings, remoteBlocks, remoteSprints, remoteDailyHours, remoteRestDays, remoteWeeklyGoals, remotePersonalTransactions, remoteLeads] = results
      if (!alive) return
      if (results.some((result) => result.error)) setLoadError('Some shared data could not load. Check the Supabase setup and try again.')
      if (remoteTasks.data) setTasks(remoteTasks.data)
      if (remoteMetrics.data) setMetrics(remoteMetrics.data)
      if (remoteSlipReasons.data) setSlipReasons(remoteSlipReasons.data)
      if (remoteTransactions.data) setTransactions(remoteTransactions.data)
      if (remoteInvoices.data) setInvoices(remoteInvoices.data)
      if (remoteReimbursements.data) setReimbursements(remoteReimbursements.data)
      if (remoteSettings.data) setSettings(remoteSettings.data)
      if (remoteBlocks.data) setBlocks(remoteBlocks.data)
      if (remoteDailyHours.data) setDailyHours(remoteDailyHours.data)
      if (remoteRestDays.data) setRestDays(remoteRestDays.data)
      if (remoteWeeklyGoals.data) setWeeklyGoals(remoteWeeklyGoals.data)
      if (remotePersonalTransactions.data) setPersonalTransactions(remotePersonalTransactions.data)
      if (remoteLeads.data) setLeads(remoteLeads.data)
      if (remoteSprints.data) {
        setSprints(remoteSprints.data)
        const active = remoteSprints.data.find((sprint) => sprint.isActive)
        if (active) setActiveSprintId(active.id)
      }
      setHydrated(true)
      setIsLoading(false)
    }
    void hydrate().catch(() => { if (alive) { setLoadError('Could not load the shared workspace. Try again.'); setHydrated(true); setIsLoading(false) } })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!hydrated || !weeklyGoals.length) return
    const weekStart = mondayISO(currentDate)
    // Weekly goals belong to a sprint. Only reset goals for the sprint that
    // is currently being worked on; historical sprint reviews must retain the
    // values that were recorded when that sprint ran.
    const stale = weeklyGoals.filter((goal) => goal.sprintId === activeSprintId && goal.weekStart !== weekStart)
    if (!stale.length) return
    const staleIds = new Set(stale.map((goal) => goal.id))
    const normalized = weeklyGoals.map((goal) => staleIds.has(goal.id) ? {...goal, weekStart, value: 0} : goal)
    setWeeklyGoals(normalized)
    if (remoteConfigured) void Promise.all(stale.map((goal) => saveWeeklyGoal({...goal, weekStart, value: 0}))).catch(() => { /* reset is best effort until the database is connected */ })
  }, [activeSprintId, currentDate, hydrated, weeklyGoals])

  useEffect(() => {
    const refreshDate = () => setCurrentDate(todayISO())
    refreshDate()
    const interval = window.setInterval(refreshDate, 60_000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    const supabase = createAnonClient()
    if (!supabase) { setAuthStatus('local'); return }
    let alive = true
    const setPersonFromEmail = (email?: string | null): Person | null => {
      const person = personForEmail(email)
      if (alive && person) setCurrentPerson(person)
      return person
    }
    void supabase.auth.getUser().then(({data, error}) => {
      if (!alive) return
      if (error) { setAuthStatus('error'); return }
      if (!data.user) {
        setAuthStatus('signed-out')
        const next = `${window.location.pathname}${window.location.search}`
        window.location.replace(`/login?next=${encodeURIComponent(next || '/')}`)
        return
      }
      if (!setPersonFromEmail(data.user.email)) { setAuthStatus('error'); setLoadError('This account is not enabled for Camp.'); return }
      setAuthStatus('signed-in')
    }).catch(() => { if (alive) setAuthStatus('error') })
    const {data: authData} = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return
      if (!session?.user) {
        setAuthStatus('signed-out')
        if (window.location.pathname !== '/login') window.location.replace('/login')
        return
      }
      if (!setPersonFromEmail(session.user.email)) { setAuthStatus('error'); setLoadError('This account is not enabled for Camp.'); return }
      setAuthStatus('signed-in')
    })
    return () => { alive = false; authData.subscription.unsubscribe() }
  }, [])

  // A signed-in person is the actor recorded on writes; the preview person is
  // only the lane/profile currently expanded in the shared workspace.
  useEffect(() => {
    if (remoteConfigured) setPreviewPersonState(currentPerson)
  }, [currentPerson])

  useEffect(() => {
    if (!hydrated || remoteConfigured) return
    const save = <T,>(key: string, value: T) => {
      try { localStorage.setItem(`${storagePrefix}-${key}`, JSON.stringify(value)) } catch { /* temporary cache is best effort */ }
    }
    save('tasks', tasks)
    save('metrics', metrics)
    save('slip-reasons', slipReasons)
    save('transactions', transactions)
    save('invoices', invoices)
    save('reimbursements', reimbursements)
    save('blocks', blocks)
    save('daily-hours', dailyHours)
    save('rest-days', restDays)
    save('weekly-goals', weeklyGoals)
    save('personal-transactions', personalTransactions)
    save('leads', leads)
    save('sprints', sprints)
    save('active-sprint', activeSprintId)
    save('preview-person', previewPerson)
    save('settings', settings)
    save('review', review)
  }, [tasks, metrics, slipReasons, transactions, invoices, reimbursements, blocks, dailyHours, restDays, weeklyGoals, personalTransactions, leads, sprints, settings, activeSprintId, currentPerson, previewPerson, review, hydrated])

  useEffect(() => {
    const supabase = createAnonClient()
    if (!supabase) return
    let alive = true
    const reload = () => {
      void Promise.all([fetchTasks(), fetchMetrics(), fetchSlipReasons(), fetchTransactions(), fetchInvoices(), fetchReimbursements(), fetchCalendarBlocks(), fetchDailyHours(), fetchRestDays(), fetchWeeklyGoals(), fetchPersonalTransactions(), fetchLeads()]).then(([taskResult, metricResult, slipReasonResult, transactionResult, invoiceResult, reimbursementResult, blockResult, dailyHoursResult, restDaysResult, weeklyGoalsResult, personalTransactionsResult, leadsResult]) => {
        if (!alive) return
        if (taskResult.data) setTasks(taskResult.data)
        if (metricResult.data) setMetrics(metricResult.data)
        if (slipReasonResult.data) setSlipReasons(slipReasonResult.data)
        if (transactionResult.data) setTransactions(transactionResult.data)
        if (invoiceResult.data) setInvoices(invoiceResult.data)
        if (reimbursementResult.data) setReimbursements(reimbursementResult.data)
        if (blockResult.data) setBlocks(blockResult.data)
        if (dailyHoursResult.data) setDailyHours(dailyHoursResult.data)
        if (restDaysResult.data) setRestDays(restDaysResult.data)
        if (weeklyGoalsResult.data) setWeeklyGoals(weeklyGoalsResult.data)
        if (personalTransactionsResult.data) setPersonalTransactions(personalTransactionsResult.data)
        if (leadsResult.data) setLeads(leadsResult.data)
      }).catch(() => { /* a realtime refresh can fail without taking down the app */ })
    }
    const channel = supabase
      .channel('camp-live')
      .on('postgres_changes', {event: '*', schema: 'public', table: 'tasks'}, reload)
      .on('postgres_changes', {event: '*', schema: 'public', table: 'metrics'}, reload)
      .on('postgres_changes', {event: '*', schema: 'public', table: 'task_slip_reasons'}, reload)
      .on('postgres_changes', {event: '*', schema: 'public', table: 'transactions'}, reload)
      .on('postgres_changes', {event: '*', schema: 'public', table: 'invoices'}, reload)
      .on('postgres_changes', {event: '*', schema: 'public', table: 'reimbursements'}, reload)
      .on('postgres_changes', {event: '*', schema: 'public', table: 'calendar_blocks'}, reload)
      .on('postgres_changes', {event: '*', schema: 'public', table: 'daily_hours'}, reload)
      .on('postgres_changes', {event: '*', schema: 'public', table: 'rest_days'}, reload)
      .on('postgres_changes', {event: '*', schema: 'public', table: 'weekly_goals'}, reload)
      .on('postgres_changes', {event: '*', schema: 'public', table: 'personal_transactions'}, reload)
      .on('postgres_changes', {event: '*', schema: 'public', table: 'leads'}, reload)
      .subscribe()
    return () => { alive = false; void supabase.removeChannel(channel) }
  }, [])

  const value = useMemo<CampState>(() => ({
    tasks,
    metrics,
    slipReasons,
    transactions,
    invoices,
    reimbursements,
    blocks,
    dailyHours,
    restDays,
    weeklyGoals,
    personalTransactions,
    leads,
    sprints,
    settings,
    activeSprintId,
    setActiveSprint: async (id) => {
      if (!sprints.some((sprint) => sprint.id === id)) return {error: 'Sprint not found'}
      const result = await activateSprint(id)
      if (result.error) return {error: 'Could not switch sprint'}
      setActiveSprintId(id)
      setSprints((items) => items.map((sprint) => ({...sprint, isActive: sprint.id === id})))
      return {error: null}
    },
    addSprint: async (sprint) => {
      const result = await saveSprint(sprint)
      if (result.error) return {error: 'Could not save sprint'}
      const activateResult = sprint.isActive ? await activateSprint(sprint.id) : {error: null}
      if (activateResult.error) return {error: 'Could not switch sprint'}
      setSprints((items) => sprint.isActive ? [...items.map((item) => ({...item, isActive: false})), sprint] : [sprint, ...items])
      if (sprint.isActive) setActiveSprintId(sprint.id)
      return {error: null}
    },
    currentPerson,
    previewPerson,
    currentDate,
    isRemoteConfigured: remoteConfigured,
    authStatus,
    isLoading,
    loadError,
    view,
    setView,
    setPreviewPerson: (person) => {
      setPreviewPersonState(person)
      // Local preview has no authenticated actor, so keep the profile switch
      // behaviour users expect there. Remote mode keeps actor and preview
      // separate so completed_by/logged_by remain truthful.
      if (!remoteConfigured) setCurrentPerson(person)
    },
    logout: async () => {
      const supabase = createAnonClient()
      if (!supabase) return {error: null}
      const {error} = await supabase.auth.signOut()
      return {error: error ? 'Could not sign out' : null}
    },
    toggleTask: async (id) => {
      const current = tasks.find((task) => task.id === id)
      if (!current) return {error: 'Task not found'}
      if (!isTaskEditable(current.day, currentDate)) return {error: 'Only today and yesterday’s tasks can be updated'}
      const next = {...current, status: current.status === 'done' ? 'open' as TaskStatus : 'done' as TaskStatus, completedAt: current.status === 'done' ? undefined : new Date().toISOString(), completedBy: current.status === 'done' ? undefined : currentPerson}
      const result = await saveTask(next)
      if (result.error) return {error: 'Could not save task'}
      setTasks((items) => items.map((task) => task.id === id ? next : task))
      return {error: null}
    },
    addTask: async (task) => {
      if (!isTaskTargetAllowed(task.day, currentDate)) return {error: 'Tasks older than yesterday are read-only'}
      if (task.tier === 'must' && (task.owner === 'nihal' || task.owner === 'shirin') && tasks.filter((item) => item.id !== task.id && item.sprintId === task.sprintId && item.owner === task.owner && item.day === task.day && item.tier === 'must').length >= 5) return {error: 'Musts are capped at five for that day'}
      const sameGroup = tasks.filter((item) => item.sprintId === task.sprintId && item.owner === task.owner && item.day === task.day && item.tier === task.tier)
      const next = {...task, sortOrder: task.sortOrder ?? (sameGroup.length ? Math.max(...sameGroup.map((item) => item.sortOrder ?? 0)) + 1 : 0)}
      const result = await saveTask(next)
      if (result.error) return {error: 'Could not save task'}
      setTasks((items) => [next, ...items])
      return {error: null}
    },
    updateTask: async (id, patch) => {
      const current = tasks.find((task) => task.id === id)
      if (!current) return {error: 'Task not found'}
      if (!isTaskEditable(current.day, currentDate)) return {error: 'Only today and yesterday’s tasks can be updated'}
      if (current.day === addDays(currentDate, -1) && !isStatusOnlyPatch(patch)) return {error: 'Only completion can be changed for yesterday’s tasks'}
      const merged = {...current, ...patch}
      if (!isTaskTargetAllowed(merged.day, currentDate)) return {error: 'Tasks older than yesterday are read-only'}
      const moved = merged.day !== current.day
      if (moved && current.tier === 'must' && !patch.slipReason) return {error: 'Choose a slip reason before moving a Must'}
      const next = merged.status === 'done' && current.status !== 'done'
        ? {...merged, completedAt: new Date().toISOString(), completedBy: currentPerson}
        : merged.status !== 'done' && patch.status
          ? {...merged, completedAt: undefined, completedBy: undefined}
          : merged
      const movedNext = moved && current.tier === 'must' ? {...next, carriedCount: current.carriedCount + 1} : next
      if (movedNext.tier === 'must' && (movedNext.owner === 'nihal' || movedNext.owner === 'shirin') && tasks.filter((item) => item.id !== id && item.sprintId === movedNext.sprintId && item.owner === movedNext.owner && item.day === movedNext.day && item.tier === 'must').length >= 5) return {error: 'Musts are capped at five for that day'}
      const result = await saveTask(movedNext)
      if (result.error) return {error: 'Could not save task'}
      let reason: TaskSlipReason | undefined
      if (moved && current.tier === 'must' && patch.slipReason) {
        reason = {id: crypto.randomUUID(), taskId: id, reason: patch.slipReason, movedAt: new Date().toISOString(), movedFromDay: current.day, movedToDay: movedNext.day}
        const reasonResult = await saveSlipReason(reason)
        if (reasonResult.error) {
          await saveTask(current)
          return {error: 'Could not save slip reason'}
        }
      }
      setTasks((items) => items.map((task) => task.id === id ? movedNext : task))
      if (reason) setSlipReasons((items) => [reason as TaskSlipReason, ...items])
      return {error: null}
    },
    deleteTask: async (id) => {
      const current = tasks.find((task) => task.id === id)
      if (!current) return {error: 'Task not found'}
      if (!isTaskEditable(current.day, currentDate)) return {error: 'Only today and yesterday’s tasks can be updated'}
      if (current.day === addDays(currentDate, -1)) return {error: 'Only completion can be changed for yesterday’s tasks'}
      const result = await removeTask(id)
      if (result.error) return {error: 'Could not delete task'}
      setTasks((items) => items.filter((task) => task.id !== id))
      setSlipReasons((items) => items.filter((reason) => reason.taskId !== id))
      return {error: null}
    },
    moveTask: async (id, day, slip) => {
      const current = tasks.find((task) => task.id === id)
      if (!current) return {error: 'Task not found'}
      if (!isTaskEditable(current.day, currentDate)) return {error: 'Only today and yesterday’s tasks can be updated'}
      if (current.day === addDays(currentDate, -1)) return {error: 'Only completion can be changed for yesterday’s tasks'}
      if (!isTaskTargetAllowed(day, currentDate)) return {error: 'Tasks older than yesterday are read-only'}
      if (current.day !== day && current.tier === 'must' && !slip) return {error: 'Choose a slip reason before moving a Must'}
      if (current.day === day) return {error: null}
      if (current.tier === 'must' && (current.owner === 'nihal' || current.owner === 'shirin') && tasks.filter((task) => task.id !== id && task.sprintId === current.sprintId && task.owner === current.owner && task.day === day && task.tier === 'must').length >= 5) return {error: 'Musts are capped at five for that day'}
      const next = {...current, day, carriedCount: current.tier === 'must' ? current.carriedCount + 1 : current.carriedCount, slipReason: current.tier === 'must' ? slip : undefined}
      const result = await saveTask(next)
      if (result.error) return {error: 'Could not move task'}
      let reason: TaskSlipReason | undefined
      if (current.tier === 'must' && slip) {
        reason = {id: crypto.randomUUID(), taskId: id, reason: slip, movedAt: new Date().toISOString(), movedFromDay: current.day, movedToDay: day}
        const reasonResult = await saveSlipReason(reason)
        if (reasonResult.error) {
          await saveTask(current)
          return {error: 'Could not save slip reason'}
        }
      }
      setTasks((items) => items.map((task) => task.id === id ? next : task))
      if (reason) setSlipReasons((items) => [reason as TaskSlipReason, ...items])
      return {error: null}
    },
    reorderTasks: async (updates) => {
      if (!updates.length) return {error: null}
      const currentById = new Map(tasks.map((task) => [task.id, task]))
      const changed = updates.map(({id, sortOrder}) => {
        const current = currentById.get(id)
        return current ? {current, next: {...current, sortOrder} as Task} : null
      })
      if (changed.some((item) => !item)) return {error: 'Task not found'}
      const valid = changed.filter((item): item is {current: Task; next: Task} => Boolean(item))
      if (valid.some(({current}) => !isTaskEditable(current.day, currentDate) || current.day === addDays(currentDate, -1))) return {error: 'Only today’s task order can be changed'}
      for (const {next} of valid) {
        const result = await saveTask(next)
        if (result.error) return {error: 'Could not reorder tasks'}
      }
      const byId = new Map(valid.map(({next}) => [next.id, next]))
      setTasks((items) => items.map((item) => byId.get(item.id) ?? item))
      return {error: null}
    },
    addMetric: async (metric) => {
      const result = await saveMetric(metric)
      if (result.error) return {error: 'Could not save metric'}
      setMetrics((items) => [metric, ...items])
      return {error: null}
    },
    removeMetric: async (id) => {
      const result = await removeMetricEntry(id)
      if (result.error) return {error: 'Could not remove metric'}
      setMetrics((items) => items.filter((metric) => metric.id !== id))
      return {error: null}
    },
    saveSprintChanges: async (id, changesNextSprint) => {
      const result = await saveSprintChanges(id, changesNextSprint)
      if (result.error) return {error: 'Could not save sprint reflection'}
      setSprints((items) => items.map((sprint) => sprint.id === id ? {...sprint, changesNextSprint: changesNextSprint || undefined} : sprint))
      return {error: null}
    },
    addTransaction: async (transaction) => {
      const result = await saveTransaction(transaction)
      if (result.error) return {error: 'Could not save transaction'}
      setTransactions((items) => [transaction, ...items])
      return {error: null}
    },
    updateTransaction: async (id, patch) => {
      const current = transactions.find((transaction) => transaction.id === id)
      if (!current) return {error: 'Transaction not found'}
      const next = {...current, ...patch}
      const result = await saveTransaction(next)
      if (result.error) return {error: 'Could not update transaction'}
      setTransactions((items) => items.map((transaction) => transaction.id === id ? next : transaction))
      return {error: null}
    },
    addInvoice: async (invoice) => {
      const result = await saveInvoice(invoice)
      if (result.error) return {error: 'Could not save invoice'}
      setInvoices((items) => [invoice, ...items])
      return {error: null}
    },
    setInvoiceSent: async (id) => {
      const invoice = invoices.find((item) => item.id === id)
      if (!invoice) return {error: 'Invoice not found'}
      if (invoice.status !== 'draft') return {error: null}
      const nextInvoice: Invoice = {...invoice, status: 'sent'}
      const result = await saveInvoice(nextInvoice)
      if (result.error) return {error: 'Could not mark invoice sent'}
      setInvoices((items) => items.map((item) => item.id === id ? nextInvoice : item))
      return {error: null}
    },
    setInvoiceReceived: async (id, received) => {
      const invoice = invoices.find((item) => item.id === id)
      if (!invoice) return {error: 'Invoice not found'}
      if (invoice.status === 'draft') return {error: 'Send the invoice before marking it received'}
      if (received === (invoice.status === 'received' || invoice.status === 'paid')) return {error: null}
      const nextInvoice: Invoice = received ? {...invoice, status: 'received', receivedDate: todayISO(), paidDate: undefined} : {...invoice, status: 'sent', receivedDate: undefined, paidDate: undefined}
      if (received) {
        const transaction: Transaction = {id: crypto.randomUUID(),date: nextInvoice.receivedDate ?? new Date().toISOString().slice(0, 10),direction: 'in',amount: invoice.amount,currency: invoice.currency,category: 'Invoice received',description: invoice.description,party: invoice.party,invoiceId: invoice.id,createdBy: currentPerson}
        const invoiceResult = await saveInvoice(nextInvoice)
        if (invoiceResult.error) return {error: 'Could not update invoice'}
        const transactionResult = await saveTransaction(transaction)
        if (transactionResult.error) {
          await saveInvoice(invoice)
          return {error: 'Could not record invoice payment'}
        }
        setInvoices((items) => items.map((item) => item.id === id ? nextInvoice : item))
        setTransactions((items) => [transaction, ...items.filter((item) => item.invoiceId !== id)])
        return {error: null}
      }
      const linkedTransaction = transactions.find((item) => item.invoiceId === id)
      const removeResult = await removeLinkedTransaction('invoice_id', id)
      if (removeResult.error) return {error: 'Could not reverse invoice payment'}
      const invoiceResult = await saveInvoice(nextInvoice)
      if (invoiceResult.error) {
        if (linkedTransaction) await saveTransaction(linkedTransaction)
        return {error: 'Could not update invoice'}
      }
      setInvoices((items) => items.map((item) => item.id === id ? nextInvoice : item))
      setTransactions((items) => items.filter((item) => item.invoiceId !== id))
      return {error: null}
    },
    addReimbursement: async (reimbursement) => {
      const result = await saveReimbursement(reimbursement)
      if (result.error) return {error: 'Could not save reimbursement'}
      setReimbursements((items) => [reimbursement, ...items])
      return {error: null}
    },
    settleReimbursement: async (id, settled) => {
      const reimbursement = reimbursements.find((item) => item.id === id)
      if (!reimbursement) return {error: 'Reimbursement not found'}
      if (settled === reimbursement.settled) return {error: null}
      const nextReimbursement: Reimbursement = settled ? {...reimbursement, settled: true, settledDate: todayISO()} : {...reimbursement, settled: false, settledDate: undefined}
      if (settled) {
        const transaction: Transaction = {id: crypto.randomUUID(),date: nextReimbursement.settledDate ?? new Date().toISOString().slice(0, 10),direction: 'out',amount: reimbursement.amount,currency: reimbursement.currency,category: 'Reimbursement',description: reimbursement.description,reimbursementId: reimbursement.id,createdBy: currentPerson}
        const reimbursementResult = await saveReimbursement(nextReimbursement)
        if (reimbursementResult.error) return {error: 'Could not settle reimbursement'}
        const transactionResult = await saveTransaction(transaction)
        if (transactionResult.error) {
          await saveReimbursement(reimbursement)
          return {error: 'Could not record reimbursement'}
        }
        setReimbursements((items) => items.map((item) => item.id === id ? nextReimbursement : item))
        setTransactions((items) => [transaction, ...items.filter((item) => item.reimbursementId !== id)])
        return {error: null}
      }
      const linkedTransaction = transactions.find((item) => item.reimbursementId === id)
      const removeResult = await removeLinkedTransaction('reimbursement_id', id)
      if (removeResult.error) return {error: 'Could not reverse reimbursement'}
      const reimbursementResult = await saveReimbursement(nextReimbursement)
      if (reimbursementResult.error) {
        if (linkedTransaction) await saveTransaction(linkedTransaction)
        return {error: 'Could not update reimbursement'}
      }
      setReimbursements((items) => items.map((item) => item.id === id ? nextReimbursement : item))
      setTransactions((items) => items.filter((item) => item.reimbursementId !== id))
      return {error: null}
    },
    updateSettings: async (nextSettings) => {
      const result = await saveSettings(nextSettings)
      if (result.error) return {error: 'Could not save settings'}
      setSettings(nextSettings)
      return {error: null}
    },
    saveDailyHours: async (person, date, hours) => {
      const existing = dailyHours.find((entry) => entry.person === person && entry.date === date)
      const entry: DailyHours = {id: existing?.id ?? crypto.randomUUID(), person, date, hours, updatedAt: new Date().toISOString()}
      const result = await saveDailyHoursEntry(entry)
      if (result.error) return {error: 'Could not save daily hours'}
      setDailyHours((items) => existing ? items.map((item) => item.id === existing.id ? entry : item) : [entry, ...items])
      return {error: null}
    },
    toggleRestDay: async (person, date) => {
      const existing = restDays.find((entry) => entry.person === person && entry.date === date)
      if (existing) {
        const result = await removeRestDayEntry(person, date)
        if (result.error) return {error: 'Could not remove rest day'}
        setRestDays((items) => items.filter((item) => item.id !== existing.id))
        return {error: null}
      }
      const entry: RestDay = {id: crypto.randomUUID(), person, date}
      const result = await saveRestDayEntry(entry)
      if (result.error) return {error: 'Could not save rest day'}
      setRestDays((items) => [entry, ...items])
      return {error: null}
    },
    addWeeklyGoal: async (goal) => {
      const result = await saveWeeklyGoal(goal)
      if (result.error) return {error: 'Could not save weekly goal'}
      setWeeklyGoals((items) => [goal, ...items])
      return {error: null}
    },
    updateWeeklyGoal: async (id, patch) => {
      const current = weeklyGoals.find((goal) => goal.id === id)
      if (!current) return {error: 'Weekly goal not found'}
      const next = {...current, ...patch}
      const result = await saveWeeklyGoal(next)
      if (result.error) return {error: 'Could not save weekly goal'}
      setWeeklyGoals((items) => items.map((goal) => goal.id === id ? next : goal))
      return {error: null}
    },
    deleteWeeklyGoal: async (id) => {
      const result = await removeWeeklyGoal(id)
      if (result.error) return {error: 'Could not delete weekly goal'}
      setWeeklyGoals((items) => items.filter((goal) => goal.id !== id))
      return {error: null}
    },
    adjustWeeklyGoal: async (id, delta) => {
      const current = weeklyGoals.find((goal) => goal.id === id)
      if (!current) return {error: 'Weekly goal not found'}
      return await (async () => {
        const result = await saveWeeklyGoal({...current, value: Math.max(0, current.value + delta)})
        if (result.error) return {error: 'Could not save weekly goal'}
        setWeeklyGoals((items) => items.map((goal) => goal.id === id ? {...goal, value: Math.max(0, goal.value + delta)} : goal))
        return {error: null}
      })()
    },
    addPersonalTransaction: async (entry) => {
      const result = await savePersonalTransaction(entry)
      if (result.error) return {error: 'Could not save personal money'}
      setPersonalTransactions((items) => [entry, ...items])
      return {error: null}
    },
    updatePersonalTransaction: async (id, patch) => {
      const current = personalTransactions.find((entry) => entry.id === id)
      if (!current) return {error: 'Personal entry not found'}
      const next = {...current, ...patch}
      const result = await savePersonalTransaction(next)
      if (result.error) return {error: 'Could not update personal money'}
      setPersonalTransactions((items) => items.map((entry) => entry.id === id ? next : entry))
      return {error: null}
    },
    deletePersonalTransaction: async (id) => {
      const result = await removePersonalTransaction(id)
      if (result.error) return {error: 'Could not delete personal money'}
      setPersonalTransactions((items) => items.filter((entry) => entry.id !== id))
      return {error: null}
    },
    addLead: async (lead) => {
      const result = await saveLead(lead)
      if (result.error) return {error: 'Could not save lead'}
      setLeads((items) => [lead, ...items])
      return {error: null}
    },
    updateLead: async (id, patch) => {
      const current = leads.find((lead) => lead.id === id)
      if (!current) return {error: 'Lead not found'}
      const next = {...current, ...patch, updatedAt: new Date().toISOString()}
      const result = await saveLead(next)
      if (result.error) return {error: 'Could not update lead'}
      setLeads((items) => items.map((lead) => lead.id === id ? next : lead))
      return {error: null}
    },
    deleteLead: async (id) => {
      const result = await removeLead(id)
      if (result.error) return {error: 'Could not delete lead'}
      setLeads((items) => items.filter((lead) => lead.id !== id))
      return {error: null}
    },
    addBlock: async (block) => {
      const result = await saveCalendarBlock(block)
      if (result.error) return {error: 'Could not save calendar block'}
      setBlocks((items) => [block, ...items])
      return {error: null}
    },
    updateBlock: async (id, patch) => {
      const current = blocks.find((block) => block.id === id)
      if (!current) return {error: 'Calendar block not found'}
      const next = {...current, ...patch}
      const result = await saveCalendarBlock(next)
      if (result.error) return {error: 'Could not save calendar block'}
      setBlocks((items) => items.map((block) => block.id === id ? next : block))
      return {error: null}
    },
    deleteBlock: async (id) => {
      const result = await removeCalendarBlock(id)
      if (result.error) return {error: 'Could not delete calendar block'}
      setBlocks((items) => items.filter((block) => block.id !== id))
      return {error: null}
    },
    setReview: (valueToSave) => setReviewText(valueToSave),
  }), [tasks, metrics, slipReasons, transactions, invoices, reimbursements, blocks, dailyHours, restDays, weeklyGoals, personalTransactions, leads, sprints, settings, activeSprintId, currentPerson, previewPerson, currentDate, view, authStatus, isLoading, loadError])

  return <CampContext.Provider value={value}>{children}</CampContext.Provider>
}

export function useCamp(): CampState {
  const context = useContext(CampContext)
  if (!context) throw new Error('CampProvider missing')
  return context
}

export {users}
export type {Person, Owner, Tier, Category, TaskStatus}
