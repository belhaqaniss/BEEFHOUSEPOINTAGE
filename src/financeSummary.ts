import {readOfferedNote} from './offeredCategory';
import {readExpenseNote} from './expenseCategory';
type Entry={date:string;kind:'depense'|'offert'|'erreur';amount:number;note?:string};
export function financeSummary(entries:Entry[],month:string){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('Mois invalide');
  const year=month.slice(0,4),count=new Date(Date.UTC(Number(year),Number(month.slice(5)),0)).getUTCDate();
  const monthly={depense:0,offert:0,erreur:0},annual={depense:0,offert:0,erreur:0};
  const offeredMonth={professional:0,influencer:0,unspecified:0},offeredYear={professional:0,influencer:0,unspecified:0};
  const expenseMonth={purchase:0,payroll:0,unspecified:0},expenseYear={purchase:0,payroll:0,unspecified:0};
  const days=Array.from({length:count},(_,i)=>({date:`${month}-${String(i+1).padStart(2,'0')}`,depense:0,offert:0}));
  for(const entry of entries){
    if(!Number.isFinite(entry.amount))throw Error('Montant financier invalide');
    const cents=Math.round(entry.amount*100);
    if(entry.kind==='depense'){
      const key=readExpenseNote(entry.note).category||'unspecified';
      if(entry.date.slice(0,4)===year)expenseYear[key]+=cents;
      if(entry.date.slice(0,7)===month)expenseMonth[key]+=cents;
    }
    if(entry.kind==='offert'){
      const key=readOfferedNote(entry.note).category||'unspecified';
      if(entry.date.slice(0,4)===year)offeredYear[key]+=cents;
      if(entry.date.slice(0,7)===month)offeredMonth[key]+=cents;
    }
    if(entry.date.slice(0,4)===year)annual[entry.kind]+=cents;
    if(entry.date.slice(0,7)!==month)continue;
    monthly[entry.kind]+=cents;
    const day=days.find(d=>d.date===entry.date);
    if(day&&entry.kind!=='erreur')day[entry.kind]+=cents;
  }
  return {month,year,expenseTotal:monthly.depense/100,offeredTotal:monthly.offert/100,errorTotal:monthly.erreur/100,
    offeredMonth:{professional:offeredMonth.professional/100,influencer:offeredMonth.influencer/100,unspecified:offeredMonth.unspecified/100},
    offeredYear:{professional:offeredYear.professional/100,influencer:offeredYear.influencer/100,unspecified:offeredYear.unspecified/100},
    expenseMonth:{purchase:expenseMonth.purchase/100,payroll:expenseMonth.payroll/100,unspecified:expenseMonth.unspecified/100},
    expenseYear:{purchase:expenseYear.purchase/100,payroll:expenseYear.payroll/100,unspecified:expenseYear.unspecified/100},
    annual:{expenseTotal:annual.depense/100,offeredTotal:annual.offert/100,errorTotal:annual.erreur/100},
    days:days.map(d=>({...d,depense:d.depense/100,offert:d.offert/100})),recent:entries.filter(e=>e.date.slice(0,7)===month)};
}
