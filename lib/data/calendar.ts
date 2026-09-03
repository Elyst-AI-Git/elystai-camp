import type {CalendarBlock} from '../types'
import {createAnonClient} from '../supabase/browser'

type DbCalendarBlock = {
  id: string
  owner: CalendarBlock['owner']
  title: string
  start_at: string
  end_at: string
  category: CalendarBlock['category']
  notes?: string | null
}

const genericError = (error: unknown, fallback: string): Error | null => error ? new Error(fallback) : null

function mapBlock(row: DbCalendarBlock): CalendarBlock {
  return {id:row.id,owner:row.owner,title:row.title,startAt:row.start_at,endAt:row.end_at,category:row.category,notes:row.notes ?? undefined}
}

export async function fetchCalendarBlocks(): Promise<{data:CalendarBlock[] | null; error:Error | null}> {
  const supabase = createAnonClient()
  if (!supabase) return {data:null,error:null}
  const {data,error} = await supabase.from('calendar_blocks').select('*').order('start_at')
  if (error) return {data:null,error:new Error('Could not load calendar blocks')}
  return {data:(data as unknown as DbCalendarBlock[]).map(mapBlock),error:null}
}

export async function saveCalendarBlock(block: CalendarBlock): Promise<{error:Error | null}> {
  const supabase = createAnonClient()
  if (!supabase) return {error:null}
  const {error} = await supabase.from('calendar_blocks').upsert({id:block.id,owner:block.owner,title:block.title,start_at:block.startAt,end_at:block.endAt,category:block.category,notes:block.notes ?? null})
  return {error:genericError(error,'Could not save calendar block')}
}

export async function removeCalendarBlock(id: string): Promise<{error:Error | null}> {
  const supabase = createAnonClient()
  if (!supabase) return {error:null}
  const {error} = await supabase.from('calendar_blocks').delete().eq('id',id)
  return {error:genericError(error,'Could not delete calendar block')}
}
