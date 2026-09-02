export type MonthlyHoursEmployee={
  id:number;
  first:string;
  last:string;
  role:string;
  color:string;
  days:number;
  shifts:number;
  morningMinutes:number;
  eveningMinutes:number;
  totalMinutes:number;
};

export type MonthlyHoursReport={
  month:string;
  morningMinutes:number;
  eveningMinutes:number;
  totalMinutes:number;
  employees:MonthlyHoursEmployee[];
};

const xml=(value:string)=>value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const ascii=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^\x20-\x7E]/g,"-");
const esc=(value:string)=>ascii(value).replace(/([\\()])/g,"\\$1");
const duration=(minutes:number)=>`${Math.floor(minutes/60)} h ${String(minutes%60).padStart(2,"0")}`;
const monthLabel=(month:string)=>new Date(`${month}-01T12:00:00`).toLocaleDateString("fr-FR",{month:"long",year:"numeric"});
const download=(content:BlobPart,type:string,filename:string)=>{const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};

export function buildMonthlyHoursExcel(report:MonthlyHoursReport){
  const cell=(value:string,type="String",style="",formula="",extra="")=>`<Cell${style?` ss:StyleID="${style}"`:""}${formula?` ss:Formula="${formula}"`:""}${extra}><Data ss:Type="${type}">${xml(value)}</Data></Cell>`;
  const firstDataRow=5,lastDataRow=firstDataRow+report.employees.length-1;
  const rows=report.employees.map(employee=>`<Row>${cell(`${employee.first} ${employee.last}`,"String","name")}${cell(employee.role,"String","name")}${cell(String(employee.days),"Number","integer")}${cell(String(employee.morningMinutes/60),"Number","morning")}${cell(String(employee.eveningMinutes/60),"Number","evening")}${cell(String(employee.totalMinutes/60),"Number","total")}</Row>`).join("");
  return `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:x="urn:schemas-microsoft-com:office:excel"><Styles>
  <Style ss:ID="Default"><Font ss:FontName="Arial" ss:Size="10"/><Alignment ss:Vertical="Center"/></Style>
  <Style ss:ID="title"><Font ss:Bold="1" ss:Size="16" ss:Color="#A5141E"/><Alignment ss:Horizontal="Center"/></Style>
  <Style ss:ID="summary"><Font ss:Bold="1"/><Interior ss:Color="#FFF2CC" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/></Style>
  <Style ss:ID="header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#333333" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>
  <Style ss:ID="name"><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>
  <Style ss:ID="integer" ss:Parent="name"><Alignment ss:Horizontal="Center"/><NumberFormat ss:Format="0"/></Style>
  <Style ss:ID="morning" ss:Parent="name"><Interior ss:Color="#FCE5CD" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/><NumberFormat ss:Format="0.00"/></Style>
  <Style ss:ID="evening" ss:Parent="name"><Interior ss:Color="#D9EAF7" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/><NumberFormat ss:Format="0.00"/></Style>
  <Style ss:ID="total" ss:Parent="name"><Font ss:Bold="1"/><Interior ss:Color="#FFF2CC" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/><NumberFormat ss:Format="0.00"/></Style>
  </Styles><Worksheet ss:Name="Cumul mensuel"><Table><Column ss:Width="185"/><Column ss:Width="110"/><Column ss:Width="70"/><Column ss:Width="90"/><Column ss:Width="90"/><Column ss:Width="95"/>
  <Row ss:Height="28">${cell(`BEEF HOUSE - CUMUL ${monthLabel(report.month).toUpperCase()}`,"String","title","",` ss:MergeAcross="5"`)}</Row>
  <Row ss:Height="22">${cell(`Matin : ${duration(report.morningMinutes)}`,"String","summary","",` ss:MergeAcross="1"`)}${cell(`Soir : ${duration(report.eveningMinutes)}`,"String","summary","",` ss:MergeAcross="1"`)}${cell(`Total : ${duration(report.totalMinutes)}`,"String","summary","",` ss:MergeAcross="1"`)}</Row>
  <Row ss:Height="8"><Cell/></Row>
  <Row ss:Height="24">${["Employé","Poste","Jours pointés","Matin (h)","Soir (h)","Total (h)"].map(header=>cell(header,"String","header")).join("")}</Row>
  ${rows}<Row ss:Height="23">${cell("TOTAL ÉQUIPE","String","header")}${cell("","String","header")}${cell("","String","header")}${cell(String(report.morningMinutes/60),"Number","morning",report.employees.length?`=SUM(R${firstDataRow}C:R${lastDataRow}C)`:"")}${cell(String(report.eveningMinutes/60),"Number","evening",report.employees.length?`=SUM(R${firstDataRow}C:R${lastDataRow}C)`:"")}${cell(String(report.totalMinutes/60),"Number","total",report.employees.length?`=SUM(R${firstDataRow}C:R${lastDataRow}C)`:"")}</Row>
  </Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>4</SplitHorizontal><TopRowBottomPane>4</TopRowBottomPane><Selected/><DoNotDisplayGridlines/><PageSetup><Layout x:Orientation="Landscape"/><FitToPage/></PageSetup><Print><ValidPrinterInfo/><HorizontalResolution>600</HorizontalResolution><VerticalResolution>600</VerticalResolution></Print></WorksheetOptions></Worksheet></Workbook>`;
}

const pdfText=(x:number,y:number,size:number,value:string,bold=false,color="0.12 0.12 0.14")=>`${color} rg BT /${bold?"F2":"F1"} ${size} Tf ${x} ${y} Td (${esc(value)}) Tj ET\n`;
const pdfFill=(x:number,y:number,w:number,h:number,color:string)=>`${color} rg ${x} ${y} ${w} ${h} re f\n`;
const pdfBorder=(x:number,y:number,w:number,h:number)=>`0.52 0.52 0.55 RG 0.45 w ${x} ${y} ${w} ${h} re S\n`;

export function buildMonthlyHoursPdf(report:MonthlyHoursReport){
  const x=34,widths=[255,80,100,100,100,105],tableWidth=widths.reduce((sum,value)=>sum+value,0),headerY=478,rowHeight=Math.max(8.5,Math.min(15,410/Math.max(1,report.employees.length+1))),fontSize=Math.min(8,Math.max(5.7,rowHeight-3));
  let stream=pdfText(34,558,20,"BEEF HOUSE",true,"0.70 0.08 0.12")+pdfText(245,558,16,`CUMUL MENSUEL - ${monthLabel(report.month).toUpperCase()}`,true);
  const summaries=[{label:"TOTAL MATIN",value:duration(report.morningMinutes),color:"0.99 0.90 0.80"},{label:"TOTAL SOIR",value:duration(report.eveningMinutes),color:"0.85 0.92 0.98"},{label:"TOTAL GENERAL",value:duration(report.totalMinutes),color:"1 0.95 0.72"}];
  summaries.forEach((item,index)=>{const boxX=34+index*258;stream+=pdfFill(boxX,505,244,35,item.color)+pdfBorder(boxX,505,244,35)+pdfText(boxX+10,526,7.5,item.label,true,"0.38 0.38 0.42")+pdfText(boxX+10,511,12,item.value,true,"0.60 0.07 0.11")});
  let cursor=x;["Employe","Jours","Services","Matin","Soir","Total"].forEach((header,index)=>{stream+=pdfFill(cursor,headerY,widths[index],26,"0.20 0.20 0.22")+pdfBorder(cursor,headerY,widths[index],26)+pdfText(cursor+6,headerY+9,8,header,true,"1 1 1");cursor+=widths[index]});
  let y=headerY-rowHeight;
  for(const employee of report.employees){const values=[`${employee.first} ${employee.last}`,String(employee.days),String(employee.shifts),duration(employee.morningMinutes),duration(employee.eveningMinutes),duration(employee.totalMinutes)];cursor=x;values.forEach((value,index)=>{const color=index===3?"0.99 0.94 0.89":index===4?"0.93 0.97 1":index===5?"1 0.97 0.84":"1 1 1";stream+=pdfFill(cursor,y,widths[index],rowHeight,color)+pdfBorder(cursor,y,widths[index],rowHeight)+pdfText(cursor+5,y+rowHeight/2-2,fontSize,value,index===5);cursor+=widths[index]});y-=rowHeight}
  const totals=["TOTAL EQUIPE","","",duration(report.morningMinutes),duration(report.eveningMinutes),duration(report.totalMinutes)];cursor=x;totals.forEach((value,index)=>{stream+=pdfFill(cursor,y,widths[index],rowHeight,"1 0.92 0.72")+pdfBorder(cursor,y,widths[index],rowHeight)+pdfText(cursor+5,y+rowHeight/2-2,fontSize,value,true,"0.42 0.07 0.09");cursor+=widths[index]});
  const objects=["<< /Type /Catalog /Pages 2 0 R >>","<< /Type /Pages /Kids [3 0 R] /Count 1 >>","<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",`<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}endstream`,"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>","<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"];
  let pdf="%PDF-1.4\n",offsets=[0];objects.forEach((object,index)=>{offsets[index+1]=new TextEncoder().encode(pdf).length;pdf+=`${index+1} 0 obj\n${object}\nendobj\n`});const xref=new TextEncoder().encode(pdf).length;pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;for(let index=1;index<=objects.length;index++)pdf+=`${String(offsets[index]).padStart(10,"0")} 00000 n \n`;pdf+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;return new TextEncoder().encode(pdf);
}

export const downloadMonthlyHoursExcel=(report:MonthlyHoursReport)=>download("\ufeff"+buildMonthlyHoursExcel(report),"application/vnd.ms-excel;charset=utf-8",`cumul-heures-${report.month}.xls`);
export const downloadMonthlyHoursPdf=(report:MonthlyHoursReport)=>download(buildMonthlyHoursPdf(report),"application/pdf",`cumul-heures-${report.month}.pdf`);
