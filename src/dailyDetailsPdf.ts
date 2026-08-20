export type DailyDetail={workDate:string;cashierMorning:string;cashierEvening:string;fdcMorning:string;fdcEvening:string;fdcFinal:string;cbAmount:string;cashAmount:string;totalAmount:string};
export type DailyEntry={kind:"depense"|"offert";label:string;amount:number;note?:string};

const ascii=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^\x20-\x7E]/g,"-");
const esc=(value:string)=>ascii(value).replace(/([\\()])/g,"\\$1");
const text=(x:number,y:number,size:number,value:string,bold=false,color="0.12 0.12 0.14")=>`${color} rg BT /${bold?"F2":"F1"} ${size} Tf ${x} ${y} Td (${esc(value)}) Tj ET\n`;
const line=(x1:number,y1:number,x2:number,y2:number)=>`0.55 0.55 0.58 RG 0.7 w ${x1} ${y1} m ${x2} ${y2} l S\n`;
const money=(amount:number)=>`${amount.toFixed(2)} EUR`;

export function buildDailyDetailsPdf(detail:DailyDetail,entries:DailyEntry[]){
  const expenses=entries.filter(entry=>entry.kind==="depense"),offers=entries.filter(entry=>entry.kind==="offert");
  let stream=text(162,790,20,"Detail journalier Beef House",true,"0.70 0.08 0.12")+line(155,784,442,784);
  stream+=text(72,744,11,`Date : ${new Date(`${detail.workDate}T12:00:00`).toLocaleDateString("fr-FR")}`,true);
  stream+=text(72,710,11,`Caissier matin : ${detail.cashierMorning}`)+text(72,681,11,`Caissier soir : ${detail.cashierEvening}`);
  stream+=text(72,640,11,`FDC initial / matin : ${detail.fdcMorning}`,true)+text(310,640,11,`FDC soir : ${detail.fdcEvening}`,true);
  let y=596;stream+=text(72,y,12,"DEPENSES",true,"0.70 0.08 0.12");y-=25;
  if(!expenses.length){stream+=text(88,y,10,"Aucune depense");y-=22}else for(const entry of expenses){stream+=text(88,y,10,`- ${entry.label}${entry.note?` (${entry.note})`:""}`)+text(450,y,10,money(entry.amount),true);y-=22}
  y-=8;stream+=text(72,y,12,"OFFERTS",true,"0.70 0.08 0.12");y-=25;
  if(!offers.length){stream+=text(88,y,10,"Aucun offert");y-=22}else for(const entry of offers){stream+=text(88,y,10,`- ${entry.label}${entry.note?` (${entry.note})`:""}`)+text(450,y,10,money(entry.amount),true);y-=22}
  const closureTop=Math.max(165,y-12);
  stream+=line(72,closureTop,523,closureTop)+text(72,closureTop-32,11,`FDC final : ${detail.fdcFinal}`,true)+text(72,closureTop-62,11,`CB : ${detail.cbAmount}`)+text(72,closureTop-87,11,`ESP : ${detail.cashAmount}`)+text(72,closureTop-122,13,`TOTAL : ${detail.totalAmount}`,true,"0.70 0.08 0.12");
  stream+=text(72,35,7,"Document genere depuis BEEF HOUSE")+text(430,35,7,new Date().toLocaleString("fr-FR"));
  const objects=["<< /Type /Catalog /Pages 2 0 R >>","<< /Type /Pages /Kids [3 0 R] /Count 1 >>","<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",`<< /Length ${stream.length} >>\nstream\n${stream}endstream`,"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>","<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"];
  let pdf="%PDF-1.4\n",offsets=[0];objects.forEach((object,index)=>{offsets[index+1]=pdf.length;pdf+=`${index+1} 0 obj\n${object}\nendobj\n`});const xref=pdf.length;pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;for(let i=1;i<=objects.length;i++)pdf+=`${String(offsets[i]).padStart(10,"0")} 00000 n \n`;pdf+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;return new TextEncoder().encode(pdf);
}
export function downloadDailyDetailsPdf(detail:DailyDetail,entries:DailyEntry[]){const blob=new Blob([buildDailyDetailsPdf(detail,entries)],{type:"application/pdf"}),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=`detail-journalier-${detail.workDate}.pdf`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
