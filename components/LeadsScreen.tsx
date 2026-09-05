'use client'

import {useMemo, useState, type FormEvent} from 'react'
import {useCamp} from '../lib/context'
import type {Lead, LeadStage, Person} from '../lib/types'
import SelectMenu from './SelectMenu'

const stages: Array<{value: LeadStage; label: string}> = [
  {value: 'new', label: 'New'},
  {value: 'contacted', label: 'Contacted'},
  {value: 'qualified', label: 'Qualified'},
  {value: 'proposal', label: 'Proposal'},
  {value: 'won', label: 'Won'},
  {value: 'lost', label: 'Lost'},
]
const stageLabel = (stage: LeadStage) => stages.find((item) => item.value === stage)?.label ?? stage
const personLabel = (person: Person) => person === 'nihal' ? 'Nihal' : 'Shirin'
const formatDate = (value?: string) => value ? new Intl.DateTimeFormat('en-IN', {day: 'numeric', month: 'short', year: 'numeric'}).format(new Date(`${value}T12:00:00`)) : 'No date set'
const formatValue = (value?: number) => value === undefined ? '' : `₹${Math.round(value).toLocaleString('en-IN')}`

export default function LeadsScreen() {
  const {leads, currentPerson, currentDate, addLead, updateLead, deleteLead} = useCamp()
  const [query, setQuery] = useState('')
  const [ownerFilter, setOwnerFilter] = useState<'all' | Person>('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Lead | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const filtered = useMemo(() => leads.filter((lead) => {
    const matchesQuery = !query.trim() || `${lead.company} ${lead.contactName ?? ''} ${lead.nextAction}`.toLowerCase().includes(query.trim().toLowerCase())
    return matchesQuery && (ownerFilter === 'all' || lead.owner === ownerFilter)
  }), [leads, ownerFilter, query])
  const openLeads = filtered.filter((lead) => !['won', 'lost'].includes(lead.stage)).length
  const pipelineValue = filtered.filter((lead) => lead.stage !== 'lost').reduce((sum, lead) => sum + (lead.estimatedValue ?? 0), 0)

  async function move(lead: Lead, stage: LeadStage) {
    if (lead.stage === stage) return
    setBusyId(lead.id); setMessage('')
    try {
      const result = await updateLead(lead.id, {stage})
      setMessage(result.error ?? 'Lead moved')
    } catch { setMessage('Could not move lead') } finally { setBusyId(null) }
  }

  async function remove(lead: Lead) {
    if (!window.confirm(`Delete ${lead.company} from the pipeline?`)) return
    setBusyId(lead.id); setMessage('')
    try {
      const result = await deleteLead(lead.id)
      setMessage(result.error ?? 'Lead deleted')
    } catch { setMessage('Could not delete lead') } finally { setBusyId(null) }
  }

  return <section className="leads-page">
    <section className="leads-hero"><div><p className="eyebrow light">Lead management</p><h2>Keep the next conversation clear.</h2><p>One shared pipeline for the two of us, with an owner and a next action on every lead.</p></div><button type="button" className="button light" onClick={() => {setEditing(null);setShowModal(true)}}>+ New lead</button></section>
    <section className="leads-toolbar"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search companies or contacts" aria-label="Search leads"/><SelectMenu value={ownerFilter} options={[{value:'all',label:'Both owners'},{value:'nihal',label:'Nihal'},{value:'shirin',label:'Shirin'}]} ariaLabel="Lead owner filter" onChange={setOwnerFilter}/><span>{openLeads} open · {formatValue(pipelineValue)} in pipeline</span></section>
    <section className="lead-pipeline">{stages.map((stage) => {const items = filtered.filter((lead) => lead.stage === stage.value); return <article className={`lead-column stage-${stage.value}`} key={stage.value}><header><div><p className="eyebrow">{stage.label}</p><h3>{items.length}</h3></div></header>{items.length === 0 && <p className="lead-empty">Nothing here yet.</p>}{items.map((lead) => <div className="lead-card" key={lead.id}><div className="lead-card-head"><div><h4>{lead.company}</h4>{lead.contactName && <p>{lead.contactName}</p>}</div><span className={`lead-owner ${lead.owner}`}><img src={`/avatars/${lead.owner}-dp.png`} alt=""/>{personLabel(lead.owner)}</span></div><p className="lead-next"><span>Next</span>{lead.nextAction}</p><div className="lead-card-meta"><span>{lead.followUpDate ? `Follow up ${formatDate(lead.followUpDate)}` : 'No follow-up date'}</span>{lead.estimatedValue !== undefined && <strong>{formatValue(lead.estimatedValue)}</strong>}</div>{lead.source && <small className="lead-source">{lead.source}</small>}<div className="lead-card-actions"><SelectMenu value={lead.stage} options={stages} ariaLabel={`Move ${lead.company}`} disabled={busyId === lead.id} onChange={(value) => void move(lead, value)}/><button type="button" className="ledger-edit-button" disabled={busyId === lead.id} onClick={() => {setEditing(lead);setShowModal(true)}}>Edit</button><button type="button" className="ledger-delete-button" disabled={busyId === lead.id} onClick={() => void remove(lead)}>Delete</button></div></div>)}</article>})}</section>
    {message && <p className="finance-toast" role="status">{message}</p>}
    {showModal && <LeadModal currentPerson={currentPerson} currentDate={currentDate} initial={editing ?? undefined} close={() => setShowModal(false)} save={async (lead) => {const result = editing ? await updateLead(editing.id, lead) : await addLead(lead); if (!result.error) setShowModal(false); return result}}/>}
  </section>
}

function LeadModal({currentPerson, currentDate, initial, close, save}: {currentPerson: Person; currentDate: string; initial?: Lead; close: () => void; save: (lead: Lead) => Promise<{error: string | null}>}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [owner, setOwner] = useState<Person>(initial?.owner ?? currentPerson)
  const [stage, setStage] = useState<LeadStage>(initial?.stage ?? 'new')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('')
    const form = new FormData(event.currentTarget)
    const company = String(form.get('company') ?? '').trim()
    const nextAction = String(form.get('nextAction') ?? '').trim()
    const estimatedValueRaw = String(form.get('estimatedValue') ?? '').trim()
    const estimatedValue = estimatedValueRaw ? Number(estimatedValueRaw) : undefined
    if (!company || !nextAction || (estimatedValue !== undefined && (!Number.isFinite(estimatedValue) || estimatedValue < 0))) {setError('Add a company and a clear next action.'); return}
    setBusy(true)
    try {
      const result = await save({id: initial?.id ?? crypto.randomUUID(), company, contactName: String(form.get('contactName') ?? '').trim() || undefined, stage: String(form.get('stage')) as LeadStage, owner: String(form.get('owner')) as Person, source: String(form.get('source') ?? '').trim() || undefined, nextAction, followUpDate: String(form.get('followUpDate') ?? '') || undefined, estimatedValue, notes: String(form.get('notes') ?? '').trim() || undefined, createdAt: initial?.createdAt ?? new Date().toISOString(), updatedAt: new Date().toISOString()})
      if (result.error) setError(result.error)
    } catch { setError('Could not save lead') } finally { setBusy(false) }
  }
  return <div className="modal-bg"><section className="modal lead-modal"><button type="button" className="modal-close" onClick={close} disabled={busy}>×</button><p className="eyebrow">Lead pipeline</p><h2>{initial ? 'Edit lead' : 'New lead'}</h2>{error && <p className="login-error" role="alert">{error}</p>}<form className="modal-form" noValidate onSubmit={(event) => void submit(event)}><label>Company<input name="company" autoFocus defaultValue={initial?.company ?? ''} placeholder="Company name"/></label><label>Contact <span className="optional">optional</span><input name="contactName" defaultValue={initial?.contactName ?? ''} placeholder="Person to speak with"/></label><label>Owner<SelectMenu value={owner} options={[{value:'nihal',label:'Nihal'},{value:'shirin',label:'Shirin'}]} ariaLabel="Lead owner" name="owner" onChange={setOwner}/></label><label>Stage<SelectMenu value={stage} options={stages} ariaLabel="Lead stage" name="stage" onChange={setStage}/></label><label>Next action<input name="nextAction" defaultValue={initial?.nextAction ?? ''} placeholder="What happens next?"/></label><label>Follow-up date<input name="followUpDate" type="date" defaultValue={initial?.followUpDate ?? currentDate}/></label><label>Estimated value <span className="optional">optional</span><input name="estimatedValue" type="number" min="0" step="1" defaultValue={initial?.estimatedValue ?? ''} placeholder="INR"/></label><label>Source <span className="optional">optional</span><input name="source" defaultValue={initial?.source ?? ''} placeholder="Referral, outbound, event…"/></label><label>Notes <span className="optional">optional</span><textarea name="notes" rows={3} defaultValue={initial?.notes ?? ''} placeholder="Useful context"/></label><button type="submit" className="button dark" disabled={busy}>{busy ? 'Saving…' : initial ? 'Update lead' : 'Save lead'}</button></form></section></div>
}
