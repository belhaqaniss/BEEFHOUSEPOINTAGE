type Entry={date:string;kind:'depense'|'offert'|'erreur';amount:number};
export function financeSummary(entries:Entry[],month:string){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('Mois invalide');
  const year=month.slice(0,4),count=new Date(Date.UTC(Number(year),Number(month.slice(5)),0)).getUTCDate();
  const monthly={depense:0,offert:0,erreur:0},annual={depense:0,offert:0,erreur:0};
  const days=Array.from({length:count},(_,i)=>({date:`${month}-${String(i+1).padStart(2,'0')}`,depense:0,offert:0}));
  for(const entry of entries){
    if(!Number.isFinite(entry.amount))throw Error('Montant financier invalide');
    const cents=Math.round(entry.amount*100);
    if(entry.date.slice(0,4)===year)annual[entry.kind]+=cents;
    if(entry.date.slice(0,7)!==month)continue;
    monthly[entry.kind]+=cents;
    const day=days.find(d=>d.date===entry.date);
    if(day&&entry.kind!=='erreur')day[entry.kind]+=cents;
  }
  return {month,year,expenseTotal:monthly.depense/100,offeredTotal:monthly.offert/100,errorTotal:monthly.erreur/100,
    annual:{expenseTotal:annual.depense/100,offeredTotal:annual.offert/100,errorTotal:annual.erreur/100},
    days:days.map(d=>({...d,depense:d.depense/100,offert:d.offert/100})),recent:entries.filter(e=>e.date.slice(0,7)===month)};
}
