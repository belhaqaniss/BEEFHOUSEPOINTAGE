const parisParts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
export const CLOSING_POLICY_START='2026-11-01';
export function closingLimit(workDate){
  if(workDate<CLOSING_POLICY_START)return Infinity;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(workDate))throw Error('Date de service invalide');
  const day=new Date(`${workDate}T12:00:00Z`);
  if(!Number.isFinite(day.getTime())||day.toISOString().slice(0,10)!==workDate)throw Error('Date de service invalide');
  const saturday=day.getUTCDay()===6;
  day.setUTCDate(day.getUTCDate()+1);
  const wall=Date.parse(`${day.toISOString().slice(0,10)}T${saturday?'01':'00'}:00:00Z`);
  let guess=wall;
  for(let i=0;i<3;i++){
    const p=Object.fromEntries(parisParts.formatToParts(new Date(guess)).map(v=>[v.type,v.value]));
    const represented=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);
    guess=wall-(represented-guess);
  }
  return guess;
}
export function countedShiftMilliseconds(start,end,workDate){
  const a=new Date(start).getTime(),b=new Date(end).getTime(),raw=b-a;
  if(!Number.isFinite(raw)||raw<=0||raw>=86400000)return 0;
  return Math.max(0,Math.min(b,closingLimit(workDate))-a);
}
// Presentation only: the stored timestamp is never modified.
export function countedDeparture(timestamp,workDate){
  const actual=Date.parse(timestamp);
  if(!Number.isFinite(actual))throw Error('Horodatage de départ invalide');
  return new Date(Math.min(actual,closingLimit(workDate))).toISOString();
}
