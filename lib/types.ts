export type Person = 'nihal' | 'shirin'
export type Owner = Person | 'either' | 'both'
export type Tier = 'must' | 'stretch'
export type TaskStatus = 'open' | 'done' | 'waiting' | 'blocked'
// Legacy values stay readable for existing seeded/remote rows. New task entry
// uses the smaller set of categories exposed in the UI.
export type Category = 'outbound' | 'website' | 'content' | 'training' | 'delivery' | 'admin' | 'services' | 'upskilling' | 'other'
export type SlipReason = 'unclear_next_step' | 'waiting_on_someone' | 'underestimated' | 'interrupted' | 'energy' | 'reprioritised' | 'forgot' | 'scope_grew' | 'no_longer_valid'
export interface User { id: Person; name: string; avatarBase: string }
export interface Sprint { id:string; name:string; startDate:string; endDate:string; goal:string; targetCalls:number; isActive:boolean; changesNextSprint?:string }
export interface Task { id:string; sprintId:string; owner:Owner; title:string; notes?:string; day:string; tier:Tier; category:Category; status:TaskStatus; waitingOn?:string; blockedBy?:string; completedAt?:string; completedBy?:Person; slipReason?:SlipReason; carriedCount:number }
export interface Metric { id:string; sprintId:string; date:string; key:'calls_booked'|'connections_sent'|'posts_published'|'reels_published'|'articles_published'|'audits_delivered'|'proposals_sent'; value:number; loggedBy?:Person }
export interface TaskSlipReason { id:string; taskId:string; reason:SlipReason; movedAt:string; movedFromDay:string; movedToDay:string }
export interface Transaction { id:string; date:string; direction:'in'|'out'; amount:number; currency:'INR'|'AED'|'USD'; category:string; description:string; party?:string; invoiceId?:string; reimbursementId?:string; createdBy?:Person }
export interface Invoice { id:string; party:string; description:string; amount:number; currency:'INR'|'AED'|'USD'; issuedDate:string; dueDate:string; status:'draft'|'sent'|'received'|'paid'|'overdue'; receivedDate?:string; paidDate?:string; notes?:string }
export interface Reimbursement { id:string; description:string; amount:number; currency:'INR'|'AED'|'USD'; requestedBy:Person; requestedDate:string; settled:boolean; settledDate?:string; notes?:string }
export interface CalendarBlock { id:string; owner:Owner; title:string; startAt:string; endAt:string; category:Category; notes?:string }
export interface Settings { openingBalance:number; currentBalance?:number; currentBalanceAsOf?:string; monthlyBurnOverride?:number; fxRates:{AED:number;USD:number}; mustCap:number }
export interface DailyHours { id:string; person:Person; date:string; hours:number; updatedAt?:string }
export interface RestDay { id:string; person:Person; date:string }
export interface WeeklyGoal { id:string; sprintId:string; person:Person; title:string; description?:string; color:string; target?:number; value:number; weekStart?:string }
