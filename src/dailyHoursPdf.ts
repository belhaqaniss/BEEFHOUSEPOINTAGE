import { employeeSummary, type ExcelAttendance, type ExcelPerson } from "./dailyExcel";

const ascii=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^\x20-\x7E]/g,"-");
const esc=(value:string)=>ascii(value).replace(/([\\()])/g,"\\$1");
const text=(x:number,y:number,size:number,value:string,bold=false,color="0.12 0.12 0.14")=>`${color} rg BT /${bold?"F2":"F1"} ${size} Tf ${x} ${y} Td (${esc(value)}) Tj ET\n`;
const fill=(x:number,y:number,w:number,h:number,color:string)=>`${color} rg ${x} ${y} ${w} ${h} re f\n`;
const border=(x:number,y:number,w:number,h:number)=>`0.45 0.45 0.48 RG 0.45 w ${x} ${y} ${w} ${h} re S\n`;
const time=(value:string)=>value||"--:--";
const hours=(value:number)=>value.toFixed(2);

export function buildDailyHoursPdf(date:string,people:ExcelPerson[],records:ExcelAttendance[]){
  const isCuisine=(person:ExcelPerson)=>String(person.role||"").toLocaleLowerCase("fr").includes("cuisine");
  const groups=[{label:"SALLE",people:people.filter(person=>!isCuisine(person)),color:"0.85 0.92 0.82"},{label:"CUISINE",people:people.filter(isCuisine),color:"0.79 0.86 0.97"}].filter(group=>group.people.length);
  const rowCount=people.length+groups.length,rowHeight=Math.max(9.5,Math.min(19,460/Math.max(rowCount,1))),rowFont=Math.min(8,Math.max(5.8,rowHeight-3.5));
  const x=34,widths=[210,68,68,78,68,68,78,82],tableWidth=widths.reduce((sum,value)=>sum+value,0);
  const [year,month,day]=date.split("-");
  let stream=text(34,558,19,"BEEF HOUSE",true,"0.70 0.08 0.12")+text(260,558,16,`HEURES EMPLOYES - ${day}/${month}/${year}`,true);
  let y=520;
  const headers=["Employe","Debut 1","Fin 1","MIDI (h)","Debut 2","Fin 2","SOIR (h)","TOTAL (h)"];
  let cursor=x;
  headers.forEach((header,index)=>{const color=index>=4&&index<=6?"0.96 0.70 0.42":index===7?"0.98 0.89 0.65":"0.70 0.37 0.03";stream+=fill(cursor,y,widths[index],34,color)+border(cursor,y,widths[index],34)+text(cursor+5,y+13,index===0?9:8,header,true,index>0&&index<4?"1 1 1":"0.12 0.12 0.14");cursor+=widths[index]});
  y-=rowHeight;
  for(const group of groups){
    stream+=fill(x,y,tableWidth,rowHeight,group.color)+border(x,y,tableWidth,rowHeight)+text(x+7,y+rowHeight/2-2.5,rowFont,group.label,true);
    y-=rowHeight;
    for(const person of group.people){
      const summary=employeeSummary(person,records,date),values=[summary.name,time(summary.start1),time(summary.end1),hours(summary.hours1),time(summary.start2),time(summary.end2),hours(summary.hours2),hours(summary.total)];
      cursor=x;
      values.forEach((value,index)=>{const bg=index===3?"0.99 0.90 0.80":index===6||index===7?"1 0.95 0.80":"1 1 1";stream+=fill(cursor,y,widths[index],rowHeight,bg)+border(cursor,y,widths[index],rowHeight)+text(cursor+5,y+rowHeight/2-2.5,rowFont,value,index===7);cursor+=widths[index]});
      y-=rowHeight;
    }
  }
  const objects=["<< /Type /Catalog /Pages 2 0 R >>","<< /Type /Pages /Kids [3 0 R] /Count 1 >>","<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",`<< /Length ${stream.length} >>\nstream\n${stream}endstream`,"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>","<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"];
  let pdf="%PDF-1.4\n",offsets=[0];objects.forEach((object,index)=>{offsets[index+1]=pdf.length;pdf+=`${index+1} 0 obj\n${object}\nendobj\n`});const xref=pdf.length;pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;for(let index=1;index<=objects.length;index++)pdf+=`${String(offsets[index]).padStart(10,"0")} 00000 n \n`;pdf+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

export function downloadDailyHoursPdf(date:string,people:ExcelPerson[],records:ExcelAttendance[]){
  const blob=new Blob([buildDailyHoursPdf(date,people,records)],{type:"application/pdf"}),url=URL.createObjectURL(blob),link=document.createElement("a");
  link.href=url;link.download=`heures-employes-${date}.pdf`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
