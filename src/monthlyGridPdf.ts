import type {MonthlyHoursReport} from './monthlyHoursExport';
import {countedShiftMilliseconds} from '../server/closing-hours.js';

export type GridEvent={name:string;type:string;timestamp:string;workDate:string};
export function monthlyGrid(report:MonthlyHoursReport,events:GridEvent[],through:string){
  const month=report.month;
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('Mois invalide');
  const dayCount=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).getUTCDate();
  const rows=report.employees.map(employee=>{
    const name=`${employee.first} ${employee.last}`;
    let cumulative=0;
    const days=Array.from({length:31},(_,index)=>{
      const date=`${month}-${String(index+1).padStart(2,'0')}`;
      if(index>=dayCount||date>through)return {minutes:null,open:false};
      const own=events.filter(e=>e.name===name&&e.workDate===date).sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
      let start:number|null=null,ms=0;
      for(const event of own){
        const time=Date.parse(event.timestamp);
        if(!Number.isFinite(time))throw Error('Horodatage invalide');
        if(event.type==='Arrivée')start=time;
        else if(event.type==='Départ'){
          if(start!==null&&time>start&&time-start<86400000)ms+=countedShiftMilliseconds(start,time,date);
          start=null;
        }
      }
      const previous=Math.round(cumulative/60000);cumulative+=ms;
      return {minutes:Math.round(cumulative/60000)-previous,open:start!==null};
    });
    const total=Math.round(cumulative/60000);
    if(total!==employee.totalMinutes)throw Error(`Les pointages de ${name} ont changé ou diffèrent du cumul. Rechargez puis réessayez.`);
    return {name,kitchen:employee.role.toLocaleLowerCase('fr').includes('cuisine'),days,total};
  });
  if(rows.reduce((s,r)=>s+r.total,0)!==report.totalMinutes)throw Error('Total mensuel incohérent');
  return {rows,dayCount,month,total:report.totalMinutes};
}

const ascii=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7E]/g,'-');
const escape=(s:string)=>ascii(s).replace(/([\\()])/g,'\\$1');
const duration=(m:number)=>`${Math.floor(m/60)}:${String(m%60).padStart(2,'0')}`;
const text=(x:number,y:number,s:string,size=8,bold=false)=>`0.12 0.12 0.14 rg BT /${bold?'F2':'F1'} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${escape(s)}) Tj ET\n`;
const rect=(x:number,y:number,w:number,h:number,color:string)=>`${color} rg ${x} ${y} ${w} ${h} re f 0.78 0.78 0.78 RG 0.3 w ${x} ${y} ${w} ${h} re S\n`;

export function buildMonthlyGridPdf(report:MonthlyHoursReport,events:GridEvent[],through:string){
  const grid=monthlyGrid(report,events,through),streams:string[]=[];
  const x=24,nameWidth=170,dayWidth=29.5,totalWidth=58,width=nameWidth+31*dayWidth+totalWidth;
  const groups=[{label:'SALLE',rows:grid.rows.filter(r=>!r.kitchen)},{label:'CUISINE',rows:grid.rows.filter(r=>r.kitchen)}];
  for(const group of groups){
    if(!group.rows.length)continue;
    for(let offset=0;offset<group.rows.length;offset+=28){
      const page=group.rows.slice(offset,offset+28);
      let stream=text(x,805,'BEEF HOUSE - HEURES POINTEES',18,true)+text(x,782,`${new Date(`${grid.month}-01T12:00:00Z`).toLocaleDateString('fr-FR',{month:'long',year:'numeric'}).toUpperCase()} - ${group.label}`,13,true);
      stream+=text(x,764,'Durees en heures:minutes. Depuis 01/11/2026 : fin plafonnee a 00:00, samedi a 01:00.',9);
      let y=724;
      const drawRow=(name:string,values:string[],total:string,bold=false,header=false)=>{
        const fill=header?'0.91 0.85 0.85':bold?'0.98 0.93 0.81':'1 1 1';
        stream+=rect(x,y,nameWidth,22,fill);
        // Fit long names without crossing into the first day.
        const size=Math.min(9,Math.max(6,156/(Math.max(1,ascii(name).length)*0.56)));
        stream+=text(x+5,y+7,name,size,bold||header);
        values.forEach((value,i)=>{
          const cellX=x+nameWidth+i*dayWidth;
          const weekend=i<grid.dayCount&&[0,6].includes(new Date(`${grid.month}-${String(i+1).padStart(2,'0')}T12:00:00Z`).getUTCDay());
          stream+=rect(cellX,y,dayWidth,22,i>=grid.dayCount?'0.88 0.88 0.88':header||bold?fill:weekend?'0.95 0.95 0.97':'1 1 1');
          stream+=text(cellX+(dayWidth-value.length*4)/2,y+7,value,8,bold||header);
        });
        const totalX=x+nameWidth+31*dayWidth;
        stream+=rect(totalX,y,totalWidth,22,'0.98 0.93 0.81')+text(totalX+4,y+7,total,8,true);
        y-=22;
      };
      drawRow('EMPLOYE',Array.from({length:31},(_,i)=>String(i+1)),'TOTAL',true,true);
      for(const row of page)drawRow(row.name,row.days.map(d=>d.minutes===null?'-':`${duration(d.minutes)}${d.open?'*':''}`),duration(row.total));
      drawRow('TOTAL PAGE',Array.from({length:31},(_,i)=>page.every(r=>r.days[i].minutes===null)?'-':duration(page.reduce((s,r)=>s+(r.days[i].minutes??0),0))),duration(page.reduce((s,r)=>s+r.total,0)),true);
      stream+=text(x,61,`TOTAL ${group.label} : ${duration(group.rows.reduce((s,r)=>s+r.total,0))}    TOTAL RESTAURANT : ${duration(grid.total)}`,10,true);
      stream+=text(x,44,'0:00 = aucune heure complete comptabilisee. * = depart manquant, duree ouverte exclue. - = jour futur ou inexistant.',8);
      stream+=text(x,30,'Arrondi cumule a la minute par employe, identique au cumul mensuel. Les fins apres minuit restent sur leur journee de service.',8);
      stream+=text(x+width-50,30,`Page ${streams.length+1}`,8);
      streams.push(stream);
    }
  }
  if(!streams.length)throw Error('Aucun employé à exporter');
  const objects=['<< /Type /Catalog /Pages 2 0 R >>',`<< /Type /Pages /Kids [${streams.map((_,i)=>`${5+i*2} 0 R`).join(' ')}] /Count ${streams.length} >>`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'];
  streams.forEach((stream,i)=>{objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1191 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6+i*2} 0 R >>`,`<< /Length ${stream.length} >>\nstream\n${stream}endstream`)});
  let pdf='%PDF-1.4\n';const offsets=[0];
  objects.forEach((object,i)=>{offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${object}\nendobj\n`});
  const start=pdf.length;pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(offset=>{pdf+=`${String(offset).padStart(10,'0')} 00000 n \n`});
  pdf+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

export function downloadMonthlyGridPdf(report:MonthlyHoursReport,events:GridEvent[],through:string){
  const bytes=buildMonthlyGridPdf(report,events,through),url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
  const link=document.createElement('a');link.href=url;link.download=`heures-par-jour-${report.month}.pdf`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
