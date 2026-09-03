'use client'

import {useEffect, useMemo, useState, type CSSProperties, type FormEvent, type PointerEvent, type ReactNode} from 'react'
import {useCamp} from '../lib/context'
import {categoryLabel, categoryPalette, taskCategories} from '../lib/category'
import type {CalendarBlock, Category, Owner} from '../lib/types'
import SelectMenu from './SelectMenu'

type CalendarView = 'day' | 'week' | 'month'
type EditorValues = {id?: string; title: string; owner: Owner; category: Category; startDate: string; endDate: string; startTime: string; endTime: string; notes: string}
type Selection = {day: string; start: number}

const START_HOUR = 7
const END_HOUR = 24
const HOUR_HEIGHT = 76
const GRID_MINUTES = (END_HOUR - START_HOUR) * 60
const OWNER_LABEL: Record<Owner, string> = {nihal: 'Nihal', shirin: 'Shirin', either: 'Either', both: 'Both'}

function asDate(value: string): Date { return new Date(`${value.slice(0,10)}T12:00:00`) }
function dateISO(value: Date): string { return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}` }
function hasTimezone(value: string): boolean { return /(?:z|[+-]\d{2}:?\d{2})$/i.test(value) }
function localDatePart(value: string): string {
  if (!hasTimezone(value)) return value.slice(0,10)
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value.slice(0,10) : dateISO(date)
}
function localTimePart(value: string): string {
  if (!hasTimezone(value)) return value.slice(11,16)
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value.slice(11,16) : `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`
}
function addDays(value: string, amount: number): string { const date = asDate(value); date.setDate(date.getDate()+amount); return dateISO(date) }
function monday(value: string): string { const date = asDate(value); const day = date.getDay(); date.setDate(date.getDate() - (day === 0 ? 6 : day - 1)); return dateISO(date) }
function minutesFromTime(value: string): number { const time = localTimePart(value).split(':').map(Number); return (time[0] ?? START_HOUR) * 60 + (time[1] ?? 0) }
function timeFromMinutes(value: number): string { const safe = Math.max(0,Math.min(1439,value)); return `${String(Math.floor(safe/60)).padStart(2,'0')}:${String(safe%60).padStart(2,'0')}` }
function snapMinutes(value: number): number { return Math.max(START_HOUR*60,Math.min((END_HOUR*60)-15,Math.round(value/15)*15)) }
function storedDateTime(day: string, time: string): string {
  const date = new Date(`${day}T${time}:00`)
  return Number.isNaN(date.getTime()) ? `${day}T${time}` : date.toISOString()
}
function blockStyle(category: Category): CSSProperties { return {'--block-color': categoryPalette[category]} as CSSProperties }
function ownerInitial(owner: Owner): string { return owner === 'nihal' ? 'N' : owner === 'shirin' ? 'S' : owner === 'both' ? 'N+S' : '•'}
function displayDate(value: string, options: Intl.DateTimeFormatOptions): string { return new Intl.DateTimeFormat('en-IN', options).format(asDate(value)) }
function blockDate(block: CalendarBlock): string { return localDatePart(block.startAt) }
function blockEndDate(block: CalendarBlock): string { return localDatePart(block.endAt) }

function editorFromBlock(block: CalendarBlock): EditorValues {
  return {id:block.id,title:block.title,owner:block.owner,category:block.category,startDate:blockDate(block),endDate:blockEndDate(block),startTime:localTimePart(block.startAt),endTime:localTimePart(block.endAt),notes:block.notes ?? ''}
}

function newEditor(day: string, start = START_HOUR * 60, end = start + 60): EditorValues {
  return {title:'',owner:'nihal',category:'other',startDate:day,endDate:day,startTime:timeFromMinutes(start),endTime:timeFromMinutes(Math.min(END_HOUR*60,end)) ,notes:''}
}

function ownerChip(owner: Owner): ReactNode { return <span className="calendar-owner" title={`Owner: ${OWNER_LABEL[owner]}`}>{ownerInitial(owner)}</span> }

export default function CalendarScreen() {
  const {blocks,addBlock,updateBlock,deleteBlock,currentDate} = useCamp()
  const [view,setView] = useState<CalendarView>('day')
  const [cursor,setCursor] = useState(currentDate)
  const [editor,setEditor] = useState<EditorValues | null>(null)
  const [busy,setBusy] = useState(false)
  const [message,setMessage] = useState('')
  async function moveBlock(block: CalendarBlock, day: string, start: number) {
    const duration = Math.max(30, minutesFromTime(block.endAt) - minutesFromTime(block.startAt))
    const safeStart = snapMinutes(start)
    const safeEnd = Math.min(END_HOUR * 60, safeStart + duration)
    setBusy(true); setMessage('Moving…')
    try {
      const result = await updateBlock(block.id, {startAt:storedDateTime(day,timeFromMinutes(safeStart)), endAt:storedDateTime(day,timeFromMinutes(Math.max(safeStart + 30, safeEnd)))})
      if (result.error) { setMessage(result.error); return }
      setMessage('Block moved')
    } catch { setMessage('Could not move calendar block') } finally { setBusy(false) }
  }

  useEffect(() => { setCursor(currentDate) }, [currentDate])

  const days = useMemo(() => view === 'week' ? Array.from({length:7},(_,index) => addDays(monday(cursor),index)) : [cursor], [cursor,view])
  const monthCells = useMemo(() => {
    const first = asDate(`${cursor.slice(0,7)}-01`)
    const offset = first.getDay() === 0 ? 6 : first.getDay() - 1
    const start = new Date(first); start.setDate(first.getDate() - offset)
    return Array.from({length:42},(_,index) => { const date = new Date(start); date.setDate(start.getDate()+index); return dateISO(date) })
  }, [cursor])
  const visibleBlocks = useMemo(() => blocks.filter((block) => view === 'month' ? monthCells.includes(blockDate(block)) : days.includes(blockDate(block))), [blocks,days,monthCells,view])

  function openCreate(day: string, start = START_HOUR * 60, end = start + 60) { setMessage(''); setEditor(newEditor(day,start,end)) }
  function openEdit(block: CalendarBlock) { setMessage(''); setEditor(editorFromBlock(block)) }
  function moveCursor(amount: number) { setCursor((current) => view === 'day' ? addDays(current,amount) : view === 'week' ? addDays(current,amount*7) : dateISO(new Date(asDate(current).getFullYear(),asDate(current).getMonth()+amount,1))) }
  function goToday() { setCursor(currentDate) }

  async function saveEditor(values: EditorValues) {
    const startAt = `${values.startDate}T${values.startTime}`
    const endAt = `${values.endDate}T${values.endTime}`
    if (!values.title.trim() || !values.startDate || !values.endDate || !values.startTime || !values.endTime) { setMessage('Complete the block details.'); return }
    if (new Date(`${endAt}:00`).getTime() <= new Date(`${startAt}:00`).getTime()) { setMessage('End time must be after start time.'); return }
    setBusy(true); setMessage('Saving…')
    try {
      const payload: CalendarBlock = {id:values.id ?? crypto.randomUUID(),title:values.title.trim(),owner:values.owner,category:values.category,startAt:storedDateTime(values.startDate,values.startTime),endAt:storedDateTime(values.endDate,values.endTime),notes:values.notes.trim() || undefined}
      const result = values.id ? await updateBlock(values.id,payload) : await addBlock(payload)
      if (result.error) { setMessage(result.error); return }
      setEditor(null); setMessage(values.id ? 'Block updated' : 'Block added')
    } catch {
      setMessage('Could not save calendar block')
    } finally {
      setBusy(false)
    }
  }

  async function removeEditor() {
    if (!editor?.id) return
    if (!window.confirm('Delete this calendar block?')) return
    setBusy(true); setMessage('Deleting…')
    try {
      const result = await deleteBlock(editor.id)
      if (result.error) { setMessage(result.error); return }
      setEditor(null); setMessage('Block deleted')
    } catch {
      setMessage('Could not delete calendar block')
    } finally {
      setBusy(false)
    }
  }

  const title = view === 'day' ? displayDate(cursor,{weekday:'long',day:'numeric',month:'long'}) : view === 'week' ? `${displayDate(days[0],{day:'numeric',month:'short'})} – ${displayDate(days[6],{day:'numeric',month:'short'})}` : displayDate(cursor,{month:'long',year:'numeric'})
  return <div className="calendar-screen">
    <section className="calendar-hero"><div><p className="eyebrow light">Camp calendar</p><h2>Make space for the work.</h2><p>Both founders in one calendar, with colour reserved for the kind of work.</p></div><button type="button" className="button dark" onClick={() => openCreate(view === 'week' ? days[0] : cursor)}>+ New Event</button></section>
    <section className="calendar-toolbar"><div className="calendar-view-switch" role="group" aria-label="Calendar view"><button type="button" className={view==='day'?'active':''} onClick={() => setView('day')}>Day</button><button type="button" className={view==='week'?'active':''} onClick={() => setView('week')}>Week</button><button type="button" className={view==='month'?'active':''} onClick={() => setView('month')}>Month</button></div><div className="calendar-nav"><button type="button" aria-label="Previous" onClick={() => moveCursor(-1)}>‹</button><strong>{title}</strong><button type="button" aria-label="Next" onClick={() => moveCursor(1)}>›</button><button type="button" className="today-button" onClick={goToday}>Today</button></div></section>
    {view === 'month' ? <MonthGrid cells={monthCells} blocks={visibleBlocks} today={currentDate} onCreate={openCreate} onEdit={openEdit}/> : <TimeGrid days={days} blocks={visibleBlocks} today={currentDate} onCreate={openCreate} onEdit={openEdit} onMove={(block,day,start) => void moveBlock(block,day,start)}/>} 
    <p className="calendar-helper">Drag across empty time to create a block. Click any block to edit or delete it.</p>
    {message&&<p className="calendar-toast" role="status">{message}</p>}
    {editor&&<CalendarEditor values={editor} busy={busy} onClose={() => setEditor(null)} onSave={(values) => void saveEditor(values)} onDelete={() => void removeEditor()}/>} 
  </div>
}

function TimeGrid({days,blocks,today,onCreate,onEdit,onMove}:{days:string[];blocks:CalendarBlock[];today:string;onCreate:(day:string,start?:number,end?:number)=>void;onEdit:(block:CalendarBlock)=>void;onMove:(block:CalendarBlock,day:string,start:number)=>void}) {
  const [selection,setSelection] = useState<Selection | null>(null)
  const [moving,setMoving] = useState<CalendarBlock | null>(null)
  function position(event: PointerEvent<HTMLDivElement>): number { const rect = event.currentTarget.getBoundingClientRect(); return snapMinutes(START_HOUR*60 + ((event.clientY - rect.top) / HOUR_HEIGHT) * 60) }
  function down(event: PointerEvent<HTMLDivElement>,day:string) { if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); setSelection({day,start:position(event)}) }
  function up(event: PointerEvent<HTMLDivElement>,day:string) { if (!selection || selection.day !== day) return; const end = Math.max(selection.start + 30, position(event)); setSelection(null); onCreate(day,selection.start,Math.min(END_HOUR*60,end)) }
  function drop(event: React.DragEvent<HTMLDivElement>, day: string) { event.preventDefault(); if (!moving) return; onMove(moving, day, position(event as unknown as PointerEvent<HTMLDivElement>)); setMoving(null) }
  return <section className={`calendar-time-grid ${days.length>1?'is-week':''}`}><div className="calendar-grid-head"><span>Time</span>{days.map((day) => <div className={day===today?'is-today':''} key={day}><b>{displayDate(day,{weekday:'short'})}</b><small>{displayDate(day,{day:'numeric',month:'short'})}</small></div>)}</div><div className="calendar-grid-body"><aside className="calendar-time-gutter">{Array.from({length:END_HOUR-START_HOUR},(_,index)=><time key={index}>{String(START_HOUR+index).padStart(2,'0')}:00</time>)}</aside><div className="calendar-day-columns">{days.map((day) => <div className={`calendar-day-column ${day===today?'is-today':''}`} key={day}><div className="calendar-canvas" style={{height:GRID_MINUTES/60*HOUR_HEIGHT}} onPointerDown={(event) => down(event,day)} onPointerUp={(event) => up(event,day)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => drop(event,day)}>{Array.from({length:END_HOUR-START_HOUR+1},(_,index)=><i className="calendar-grid-line" style={{top:index*HOUR_HEIGHT}} key={index}/>)}<NowLine day={day} today={today}/>{blocks.filter((block) => blockDate(block)===day).map((block) => <CalendarBlockCard block={block} key={block.id} onClick={() => onEdit(block)} onDragStart={() => setMoving(block)}/>)}</div></div>)}</div></div></section>
}

function CalendarBlockCard({block,onClick,compact=false,onDragStart}:{block:CalendarBlock;onClick:()=>void;compact?:boolean;onDragStart?:()=>void}) {
  const start = minutesFromTime(block.startAt)
  const end = Math.max(start+30,minutesFromTime(block.endAt))
  const style = {...blockStyle(block.category),top:((start - START_HOUR*60)/60)*HOUR_HEIGHT,height:Math.max(34,((end-start)/60)*HOUR_HEIGHT)} as CSSProperties
  return <button type="button" draggable={!compact} className={`calendar-block-card ${compact?'compact':''}`} style={style} onDragStart={(event) => {event.stopPropagation();onDragStart?.();event.dataTransfer.effectAllowed='move'}} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => {event.stopPropagation();onClick()}}><div><b>{block.title}</b>{!compact&&<small>{localTimePart(block.startAt)} – {localTimePart(block.endAt)}</small>}</div>{ownerChip(block.owner)}</button>
}

function NowLine({day,today}:{day:string;today:string}) {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    const refresh = () => setNow(new Date())
    refresh()
    const timer = window.setInterval(refresh, 60_000)
    return () => window.clearInterval(timer)
  }, [])
  if (!now || day !== today || dateISO(now) !== today) return null
  const minutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60
  if (minutes < START_HOUR * 60 || minutes > END_HOUR * 60) return null
  return <i className="calendar-now-line" style={{top:((minutes - START_HOUR * 60) / 60) * HOUR_HEIGHT}} aria-hidden="true"><b>Now</b></i>
}

function MonthGrid({cells,blocks,today,onCreate,onEdit}:{cells:string[];blocks:CalendarBlock[];today:string;onCreate:(day:string,start?:number,end?:number)=>void;onEdit:(block:CalendarBlock)=>void}) {
  const month = cells[14]?.slice(0,7)
  return <section className="calendar-month-grid"><div className="month-weekdays">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day) => <b key={day}>{day}</b>)}</div><div className="month-cells">{cells.map((day) => {const dayBlocks=blocks.filter((block) => blockDate(block)===day);return <button type="button" className={`month-cell ${day.slice(0,7)!==month?'outside':''} ${day===today?'is-today':''}`} key={day} onClick={() => onCreate(day)}><strong>{asDate(day).getDate()}</strong>{dayBlocks.slice(0,4).map((block) => <span className="month-block" style={blockStyle(block.category)} onClick={(event) => {event.stopPropagation();onEdit(block)}} key={block.id}><i/>{block.title}<small>{localTimePart(block.startAt)}</small></span>)}{dayBlocks.length>4&&<small className="more-blocks">+{dayBlocks.length-4} more</small>}</button>})}</div></section>
}

export function TodayCalendarStrip() {
  const {blocks,addBlock,updateBlock,deleteBlock,currentDate} = useCamp()
  const [editor,setEditor] = useState<EditorValues | null>(null)
  const [busy,setBusy] = useState(false)
  const [message,setMessage] = useState('')
  const [selection,setSelection] = useState<Selection | null>(null)
  const [moving,setMoving] = useState<CalendarBlock | null>(null)
  const dayBlocks = blocks.filter((block) => blockDate(block)===currentDate).sort((a,b) => a.startAt.localeCompare(b.startAt))
  const hours = Array.from({length:END_HOUR-START_HOUR},(_,index) => START_HOUR+index)
  function cellFromEvent(event: PointerEvent<HTMLDivElement>): number {
    const cells = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('.calendar-strip-cell'))
    const hit = cells.find((cell) => {
      const rect = cell.getBoundingClientRect()
      return event.clientX >= rect.left && event.clientX <= rect.right
    })
    const cell = hit ?? (event.clientX < (cells[0]?.getBoundingClientRect().left ?? 0) ? cells[0] : cells[cells.length - 1])
    if (!cell) return selection?.start ?? START_HOUR * 60
    const hour = Number(cell.dataset.hour ?? START_HOUR)
    const rect = cell.getBoundingClientRect()
    const withinHour = Math.max(0, Math.min(59.99, ((event.clientX - rect.left) / Math.max(1, rect.width)) * 60))
    return snapMinutes(hour * 60 + withinHour)
  }
  function down(event: PointerEvent<HTMLDivElement>,hour:number) { if(event.button!==0)return; event.currentTarget.setPointerCapture(event.pointerId); setSelection({day:currentDate,start:hour*60}) }
  function up(event: PointerEvent<HTMLDivElement>) { if(!selection)return; const end=Math.max(selection.start+30,cellFromEvent(event)); setSelection(null);setEditor(newEditor(currentDate,selection.start,Math.min(END_HOUR*60,end))) }
  async function moveBlock(block: CalendarBlock, start: number) {
    const duration = Math.max(30, minutesFromTime(block.endAt) - minutesFromTime(block.startAt))
    const safeStart = snapMinutes(start)
    const safeEnd = Math.min(END_HOUR * 60, safeStart + duration)
    setBusy(true); setMessage('Moving…')
    try {
      const result = await updateBlock(block.id, {startAt:storedDateTime(currentDate,timeFromMinutes(safeStart)), endAt:storedDateTime(currentDate,timeFromMinutes(Math.max(safeStart + 30, safeEnd)))})
      if (result.error) { setMessage(result.error); return }
      setMessage('Block moved')
    } catch { setMessage('Could not move calendar block') } finally { setBusy(false) }
  }
  function drop(event: React.DragEvent<HTMLDivElement>) { event.preventDefault(); if(!moving)return; void moveBlock(moving,cellFromEvent(event as unknown as PointerEvent<HTMLDivElement>)); setMoving(null) }
  async function save(values:EditorValues) { const startAt=`${values.startDate}T${values.startTime}`,endAt=`${values.endDate}T${values.endTime}`; if(!values.title.trim()||!values.startDate||!values.endDate||!values.startTime||!values.endTime){setMessage('Complete the block details.');return} if(new Date(`${endAt}:00`).getTime()<=new Date(`${startAt}:00`).getTime()){setMessage('End time must be after start time.');return} setBusy(true); try { const payload:CalendarBlock={id:values.id??crypto.randomUUID(),title:values.title.trim(),owner:values.owner,category:values.category,startAt:storedDateTime(values.startDate,values.startTime),endAt:storedDateTime(values.endDate,values.endTime),notes:values.notes.trim()||undefined};const result=values.id?await updateBlock(values.id,payload):await addBlock(payload);if(result.error){setMessage(result.error);return}setEditor(null);setMessage(values.id?'Block updated':'Block added') } catch { setMessage('Could not save calendar block') } finally { setBusy(false) } }
  async function remove() { if(!editor?.id||!window.confirm('Delete this calendar block?'))return;setBusy(true);try { const result=await deleteBlock(editor.id);if(result.error){setMessage(result.error);return}setEditor(null);setMessage('Block deleted') } catch { setMessage('Could not delete calendar block') } finally { setBusy(false) } }
  return <section className="today-cal calendar-today-strip"><div className="section-head"><div><p className="eyebrow">Today’s hours · {displayDate(currentDate,{weekday:'long',day:'numeric',month:'short'})}</p><h2>Make space for the work</h2></div><span className="hint">Drag to add · drag a block to move · click to edit</span></div><div className="calendar-strip" onPointerUp={up} onDragOver={(event) => event.preventDefault()} onDrop={drop}>{hours.map((hour) => <div className="calendar-strip-cell" data-hour={hour} key={hour} onPointerDown={(event) => down(event,hour)}><small>{String(hour).padStart(2,'0')}:00</small>{dayBlocks.filter((block) => localTimePart(block.startAt).slice(0,2)===String(hour).padStart(2,'0')).map((block) => <button type="button" draggable className="calendar-strip-block" style={blockStyle(block.category)} onDragStart={(event) => {event.stopPropagation();setMoving(block);event.dataTransfer.effectAllowed='move'}} onPointerDown={(event) => event.stopPropagation()} onClick={() => setEditor(editorFromBlock(block))} key={block.id}><b>{block.title}</b>{ownerChip(block.owner)}</button>)}</div>)}</div>{message&&<p className="calendar-inline-message" role="status">{message}</p>}{editor&&<CalendarEditor values={editor} busy={busy} onClose={() => setEditor(null)} onSave={(values) => void save(values)} onDelete={() => void remove()}/>}</section>
}

function CalendarEditor({values,busy,onClose,onSave,onDelete}:{values:EditorValues;busy:boolean;onClose:()=>void;onSave:(values:EditorValues)=>void;onDelete:()=>void}) {
  const [form,setForm] = useState(values)
  const update = <K extends keyof EditorValues>(key:K,value:EditorValues[K]) => setForm((current) => ({...current,[key]:value}))
  function submit(event:FormEvent<HTMLFormElement>) { event.preventDefault(); onSave(form) }
  return <div className="modal-bg"><section className="modal calendar-modal"><button className="modal-close" onClick={onClose} type="button" disabled={busy}>×</button><p className="eyebrow">Camp calendar</p><h2>{values.id?'Edit event':'Add an event'}</h2><form className="calendar-form" noValidate onSubmit={submit}><label>Title<input value={form.title} onChange={(event) => update('title',event.target.value)} placeholder="What needs space?" autoFocus/></label><div className="calendar-form-two"><label>Owner<SelectMenu value={form.owner} options={[{value:'nihal',label:'Nihal'},{value:'shirin',label:'Shirin'},{value:'either',label:'Either'},{value:'both',label:'Both'}]} ariaLabel="Event owner" onChange={(value) => update('owner',value)}/></label><label>Category<SelectMenu value={form.category} options={taskCategories.map((category) => ({value:category,label:categoryLabel(category)}))} ariaLabel="Event category" onChange={(value) => update('category',value)}/></label></div><div className="calendar-form-two"><label>Starts<input type="date" value={form.startDate} onChange={(event) => update('startDate',event.target.value)}/><input type="time" value={form.startTime} onChange={(event) => update('startTime',event.target.value)}/></label><label>Ends<input type="date" value={form.endDate} onChange={(event) => update('endDate',event.target.value)}/><input type="time" value={form.endTime} onChange={(event) => update('endTime',event.target.value)}/></label></div><label>Notes <span className="optional">optional</span><textarea value={form.notes} onChange={(event) => update('notes',event.target.value)} placeholder="A little context for the handoff." rows={3}/></label><div className="calendar-form-actions">{values.id&&<button className="text-button danger" type="button" onClick={onDelete} disabled={busy}>Delete</button>}<button className="button quiet" type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="button dark" type="submit" disabled={busy}>{busy?'Saving…':values.id?'Save changes':'Add event'}</button></div></form></section></div>
}
