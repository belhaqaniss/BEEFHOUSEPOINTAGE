const ascii=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^\x20-\x7E]/g,"-");
const esc=value=>ascii(value).replace(/([\\()])/g,"\\$1");
const text=(x,y,size,value,bold=false,color="0.12 0.12 0.14")=>`${color} rg BT /${bold?"F2":"F1"} ${size} Tf ${x} ${y} Td (${esc(value)}) Tj ET\n`;
const line=(x1,y1,x2,y2)=>`0.55 0.55 0.58 RG 0.7 w ${x1} ${y1} m ${x2} ${y2} l S\n`;
const fill=(x,y,w,h,color)=>`${color} rg ${x} ${y} ${w} ${h} re f\n`;
const border=(x,y,w,h)=>`0.45 0.45 0.48 RG 0.45 w ${x} ${y} ${w} ${h} re S\n`;
const pdfDocument=(stream,landscape=false)=>{
  const box=landscape?"0 0 842 595":"0 0 595 842",objects=["<< /Type /Catalog /Pages 2 0 R >>","<< /Type /Pages /Kids [3 0 R] /Count 1 >>",`<< /Type /Page /Parent 2 0 R /MediaBox [${box}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>`,`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`,"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>","<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"];
  let pdf="%PDF-1.4\n",offsets=[0];objects.forEach((object,index)=>{offsets[index+1]=Buffer.byteLength(pdf);pdf+=`${index+1} 0 obj\n${object}\nendobj\n`});const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;for(let i=1;i<=objects.length;i++)pdf+=`${String(offsets[i]).padStart(10,"0")} 00000 n \n`;pdf+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;return Buffer.from(pdf);
};

export const previousParisDate=()=>{
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()),part=type=>parts.find(item=>item.type===type)?.value,date=new Date(`${part("year")}-${part("month")}-${part("day")}T12:00:00Z`);date.setUTCDate(date.getUTCDate()-1);return date.toISOString().slice(0,10);
};

export const buildDailyDetailsPdf=(detail,entries)=>{
  const expenses=entries.filter(entry=>entry.kind==="depense"),offers=entries.filter(entry=>entry.kind==="offert"),money=amount=>`${Number(amount).toFixed(2)} EUR`;
  let stream=text(162,790,20,"Detail journalier Beef House",true,"0.70 0.08 0.12")+line(155,784,442,784);
  stream+=text(72,744,11,`Date : ${detail.workDate.split("-").reverse().join("/")}`,true)+text(72,710,11,`Caissier matin : ${detail.cashierMorning}`)+text(72,681,11,`Caissier soir : ${detail.cashierEvening}`);
  stream+=text(72,640,11,`FDC initial / matin : ${detail.fdcMorning}`,true)+text(310,640,11,`FDC soir : ${detail.fdcEvening}`,true);
  let y=596;stream+=text(72,y,12,"DEPENSES",true,"0.70 0.08 0.12");y-=25;
  if(!expenses.length){stream+=text(88,y,10,"Aucune depense");y-=22}else for(const entry of expenses){stream+=text(88,y,10,`- ${entry.label}${entry.note?` (${entry.note})`:""}`)+text(450,y,10,money(entry.amount),true);y-=22}
  y-=8;stream+=text(72,y,12,"OFFERTS",true,"0.70 0.08 0.12");y-=25;
  if(!offers.length){stream+=text(88,y,10,"Aucun offert");y-=22}else for(const entry of offers){stream+=text(88,y,10,`- ${entry.label}${entry.note?` (${entry.note})`:""}`)+text(450,y,10,money(entry.amount),true);y-=22}
  const top=Math.max(165,y-12);stream+=line(72,top,523,top)+text(72,top-32,11,`FDC final : ${detail.fdcFinal}`,true)+text(72,top-62,11,`CB : ${detail.cbAmount}`)+text(72,top-87,11,`ESP : ${detail.cashAmount}`)+text(72,top-122,13,`TOTAL : ${detail.totalAmount}`,true,"0.70 0.08 0.12");
  return pdfDocument(stream);
};

const parisClock=value=>new Intl.DateTimeFormat("fr-FR",{timeZone:"Europe/Paris",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(value));
const parisMinutes=value=>{const [hour,minute]=parisClock(value).split(":").map(Number);return hour*60+minute};
const summary=(person,records,date)=>{
  const events=records.filter(record=>record.name===`${person.first} ${person.last}`&&record.workDate===date).sort((a,b)=>a.timestamp.localeCompare(b.timestamp)),shifts=[];
  for(const event of events)if(event.type==="Arrivée"){const arrival=new Date(event.timestamp),minutes=parisMinutes(event.timestamp),period=minutes>=780?"soir":"matin",scheduled=period==="soir"?event.scheduledEveningStartMinutes:event.scheduledMorningStartMinutes,early=scheduled==null?0:scheduled-minutes,start=early>0&&early<=15?new Date(arrival.getTime()+early*60000):arrival;shifts.push({start,period})}else{const open=[...shifts].reverse().find(shift=>!shift.end);if(open)open.end=new Date(event.timestamp)}
  const ordered=[shifts.find(shift=>shift.period==="matin"),shifts.find(shift=>shift.period==="soir")],duration=shift=>{if(!shift?.start||!shift.end)return 0;const day=86400000,diff=shift.end-shift.start;return ((diff%day)+day)%day/3600000},clock=value=>value?parisClock(value):"";return {name:`${person.first} ${person.last}`,start1:clock(ordered[0]?.start),end1:clock(ordered[0]?.end),hours1:duration(ordered[0]),start2:clock(ordered[1]?.start),end2:clock(ordered[1]?.end),hours2:duration(ordered[1])};
};

export const buildDailyHoursPdf=(date,people,records)=>{
  const kitchen=person=>String(person.role||"").toLowerCase().includes("cuisine"),groups=[{label:"SALLE",people:people.filter(person=>!kitchen(person)),color:"0.85 0.92 0.82"},{label:"CUISINE",people:people.filter(kitchen),color:"0.79 0.86 0.97"}].filter(group=>group.people.length),rowCount=people.length+groups.length,rowHeight=Math.max(9.5,Math.min(19,460/Math.max(rowCount,1))),rowFont=Math.min(8,Math.max(5.8,rowHeight-3.5)),x=34,widths=[210,68,68,78,68,68,78,82],tableWidth=widths.reduce((sum,value)=>sum+value,0),[year,month,day]=date.split("-");
  let stream=text(34,558,19,"BEEF HOUSE",true,"0.70 0.08 0.12")+text(260,558,16,`HEURES EMPLOYES - ${day}/${month}/${year}`,true),y=520,cursor=x;
  ["Employe","Debut 1","Fin 1","MIDI (h)","Debut 2","Fin 2","SOIR (h)","TOTAL (h)"].forEach((header,index)=>{const color=index>=4&&index<=6?"0.96 0.70 0.42":index===7?"0.98 0.89 0.65":"0.70 0.37 0.03";stream+=fill(cursor,y,widths[index],34,color)+border(cursor,y,widths[index],34)+text(cursor+5,y+13,index===0?9:8,header,true,index>0&&index<4?"1 1 1":"0.12 0.12 0.14");cursor+=widths[index]});y-=rowHeight;
  for(const group of groups){stream+=fill(x,y,tableWidth,rowHeight,group.color)+border(x,y,tableWidth,rowHeight)+text(x+7,y+rowHeight/2-2.5,rowFont,group.label,true);y-=rowHeight;for(const person of group.people){const item=summary(person,records,date),values=[item.name,item.start1||"--:--",item.end1||"--:--",item.hours1.toFixed(2),item.start2||"--:--",item.end2||"--:--",item.hours2.toFixed(2),(item.hours1+item.hours2).toFixed(2)];cursor=x;values.forEach((value,index)=>{const bg=index===3?"0.99 0.90 0.80":index===6||index===7?"1 0.95 0.80":"1 1 1";stream+=fill(cursor,y,widths[index],rowHeight,bg)+border(cursor,y,widths[index],rowHeight)+text(cursor+5,y+rowHeight/2-2.5,rowFont,value,index===7);cursor+=widths[index]});y-=rowHeight}}
  return pdfDocument(stream,true);
};
