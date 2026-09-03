import type {Person} from '../types';
const PEOPLE:Record<string,Person>={'nihalanas2311@gmail.com':'nihal','shirin6150@gmail.com':'shirin'};
export function personForEmail(email?:string|null):Person|null{return email?PEOPLE[email.toLowerCase()]||null:null}
