import type {CalendarBlock,DailyHours,Invoice,Lead,Metric,PersonalTransaction,Reimbursement,RestDay,Settings,Sprint,Task,TaskSlipReason,Transaction,User,WeeklyGoal} from '../types';
const localISO=(date=new Date())=>{const year=date.getFullYear();const month=String(date.getMonth()+1).padStart(2,'0');const day=String(date.getDate()).padStart(2,'0');return `${year}-${month}-${day}`};
export const today=localISO();
export const users:User[]=[{id:'nihal',name:'Nihal',avatarBase:'/avatars/nihal-dp.png'},{id:'shirin',name:'Shirin',avatarBase:'/avatars/shirin-dp.png'}];
// The no-env preview intentionally starts empty. Production data is created in Supabase.
export const sprints:Sprint[]=[];
export const tasks:Task[]=[];
export const metrics:Metric[]=[];
export const slipReasons:TaskSlipReason[]=[];
export const transactions:Transaction[]=[];
export const invoices:Invoice[]=[];
export const reimbursements:Reimbursement[]=[];
export const blocks:CalendarBlock[]=[];
export const settings:Settings={openingBalance:0,currentBalance:0,currentBalanceAsOf:today,fxRates:{AED:0,USD:0},mustCap:5};
export const dailyHours:DailyHours[]=[];
export const restDays:RestDay[]=[];
export const weeklyGoals:WeeklyGoal[]=[];
export const personalTransactions:PersonalTransaction[]=[];
export const leads:Lead[]=[];
