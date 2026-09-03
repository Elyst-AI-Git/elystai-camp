import type {Invoice, Metric, Person, RestDay, Sprint, Task} from './types'

export type DayTone = 'rest' | 'empty' | 'some' | 'all'
export type CharacterState = 'working' | 'done' | 'resting' | 'celebrating'

function atNoon(value: string): Date {
  return new Date(`${value.slice(0, 10)}T12:00:00`)
}

export function addDays(value: string, amount: number): string {
  const date = atNoon(value)
  date.setDate(date.getDate() + amount)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function dayStatus(tasks: Task[], restDays: RestDay[], person: Person, date: string): DayTone {
  if (restDays.some((entry) => entry.person === person && entry.date === date)) return 'rest'
  const musts = tasks.filter((task) => task.owner === person && task.tier === 'must' && task.day === date)
  if (!musts.length) return 'empty'
  const done = musts.filter((task) => task.status === 'done').length
  if (!done) return 'empty'
  return done === musts.length ? 'all' : 'some'
}

export function mustsForPerson(tasks: Task[], person: Person, date: string): Task[] {
  return tasks.filter((task) => task.owner === person && task.tier === 'must' && task.day === date)
}

export function consistencyDays(tasks: Task[], restDays: RestDay[], person: Person, today: string, count = 35): Array<{date: string; tone: DayTone}> {
  return Array.from({length: count}, (_, index) => {
    const date = addDays(today, index - (count - 1))
    return {date, tone: dayStatus(tasks, restDays, person, date)}
  })
}

export function currentStreak(tasks: Task[], restDays: RestDay[], person: Person, today: string): number {
  let cursor = today
  let streak = 0
  let evaluated = 0
  let seenScheduledDay = false
  while (evaluated < 366) {
    const tone = dayStatus(tasks, restDays, person, cursor)
    if (tone === 'rest') {
      cursor = addDays(cursor, -1)
      evaluated += 1
      continue
    }
    // An unscheduled day before the first scheduled day is simply outside the
    // streak window. Once work has been scheduled, an empty day is a genuine
    // miss and correctly breaks the count.
    if (tone === 'empty') {
      if (seenScheduledDay) break
      cursor = addDays(cursor, -1)
      evaluated += 1
      continue
    }
    seenScheduledDay = true
    if (tone !== 'all') break
    streak += 1
    cursor = addDays(cursor, -1)
    evaluated += 1
  }
  return streak
}

export function lifetimeGoodDays(tasks: Task[], restDays: RestDay[], person: Person, today: string): number {
  const dates = tasks.filter((task) => task.owner === person && task.tier === 'must' && task.day <= today).map((task) => task.day)
  const first = dates.sort()[0]
  if (!first) return 0
  const totalDays = Math.min(3660, Math.max(0, Math.floor((atNoon(today).getTime() - atNoon(first).getTime()) / 86400000) + 1))
  let good = 0
  for (let index = 0; index < totalDays; index += 1) {
    if (dayStatus(tasks, restDays, person, addDays(first, index)) === 'all') good += 1
  }
  return good
}

export function characterState({tasks, restDays, metrics, invoices, sprint, person, today}: {tasks: Task[]; restDays: RestDay[]; metrics: Metric[]; invoices: Invoice[]; sprint?: Sprint; person: Person; today: string}): CharacterState {
  // Celebrations are global Camp events, but calls must belong to the active
  // sprint. A celebration is date-bound so it naturally falls back to the
  // normal state when the next day starts.
  const sprintCalls = sprint ? metrics.filter((metric) => metric.sprintId === sprint.id && metric.key === 'calls_booked').reduce((sum, metric) => sum + metric.value, 0) : 0
  const callLoggedToday = Boolean(sprint && metrics.some((metric) => metric.sprintId === sprint.id && metric.key === 'calls_booked' && metric.date.slice(0, 10) === today))
  const targetReachedToday = Boolean(sprint && sprint.targetCalls > 0 && sprintCalls >= sprint.targetCalls && callLoggedToday)
  const invoiceReceivedToday = invoices.some((invoice) => invoice.status === 'received' && invoice.receivedDate?.slice(0, 10) === today)
  const celebrationToday = callLoggedToday || targetReachedToday || invoiceReceivedToday
  if (celebrationToday) return 'celebrating'
  if (restDays.some((entry) => entry.person === person && entry.date === today)) return 'resting'
  const musts = mustsForPerson(tasks, person, today)
  if (!musts.length) return 'resting'
  const done = musts.filter((task) => task.status === 'done').length
  if (done === musts.length) return 'done'
  return done ? 'working' : 'resting'
}
