export type ExcelPerson={first:string;last:string;role?:string};
export type ExcelAttendance={name:string;type:"Arrivée"|"Départ";timestamp:string;workDate:string;scheduledStartMinutes?:number|null;scheduledMorningStartMinutes?:number|null;scheduledEveningStartMinutes?:number|null};

const xml=(value:string)=>value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const parisTime=(value:Date)=>{const parts=new Intl.DateTimeFormat("fr-FR",{timeZone:"Europe/Paris",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(value),part=(type:string)=>Number(parts.find(item=>item.type===type)?.value||0);return {hour:part("hour"),minutes:part("hour")*60+part("minute")}};
export const employeeSummary=(person:ExcelPerson,records:ExcelAttendance[],date:string)=>{
  const events=records.filter(record=>record.name===`${person.first} ${person.last}`&&record.workDate===date).sort((a,b)=>a.timestamp.localeCompare(b.timestamp)),shifts:{start?:Date;end?:Date;period:"matin"|"soir"}[]=[];
  for(const event of events){if(event.type==="Arrivée"){const arrival=new Date(event.timestamp),arrivalTime=parisTime(arrival),period=arrivalTime.hour>=15?"soir":"matin",scheduled=period==="soir"?event.scheduledEveningStartMinutes:event.scheduledMorningStartMinutes,earlyMinutes=scheduled==null?0:scheduled-arrivalTime.minutes;let start=arrival;if(earlyMinutes>0&&earlyMinutes<=15)start=new Date(arrival.getTime()+earlyMinutes*60000);shifts.push({start,period})}else{const open=[...shifts].reverse().find(shift=>shift.start&&!shift.end);if(open)open.end=new Date(event.timestamp)}}
  const ordered=[shifts.find(shift=>shift.period==="matin"),shifts.find(shift=>shift.period==="soir")],duration=(shift?:{start?:Date;end?:Date})=>{if(!shift?.start||!shift.end)return 0;const day=24*60*60*1000,difference=shift.end.getTime()-shift.start.getTime();return ((difference%day)+day)%day/3600000},time=(value?:Date)=>value?value.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}):"",hours1=duration(ordered[0]),hours2=duration(ordered[1]);
  return{name:`${person.first} ${person.last}`,start1:time(ordered[0]?.start),end1:time(ordered[0]?.end),hours1,start2:time(ordered[1]?.start),end2:time(ordered[1]?.end),hours2,total:hours1+hours2};
};

export function downloadDailyExcel(date:string,people:ExcelPerson[],records:ExcelAttendance[]){
  const cell=(value:string,type="String",style="",extra="")=>`<Cell${style?` ss:StyleID="${style}"`:""}${extra}><Data ss:Type="${type}">${xml(value)}</Data></Cell>`;
  const empty=(style:string)=>cell("","String",style);
  const summaryRow=(person:ExcelPerson)=>{const row=employeeSummary(person,records,date);return `<Row ss:Height="19">${cell(row.name,"String","name")}${cell(row.start1,"String","time")}${cell(row.end1,"String","time")}${cell(String(row.hours1),"Number","midiTotal")}${cell(row.start2,"String","time")}${cell(row.end2,"String","time")}${cell(String(row.hours2),"Number","shiftTotal")}${cell(String(row.total),"Number","grandTotal")}${empty("sideBlank")}</Row>`};
  const isCuisine=(person:ExcelPerson)=>String(person.role||"").toLocaleLowerCase("fr").includes("cuisine");
  const salle=people.filter(person=>!isCuisine(person)),cuisine=people.filter(isCuisine);
  const section=(label:string,group:ExcelPerson[],barStyle:string,sideStyle:string)=>`<Row ss:Height="20">${cell(label==="Cuisine"?"CUISINE":"","String",barStyle)}${Array.from({length:7},()=>empty(barStyle)).join("")}${cell(label,"String",sideStyle,` ss:MergeDown="${Math.max(group.length,0)}"`)}</Row>${group.map(summaryRow).join("")}`;
  const [year,month,day]=date.split("-");
  const workbookXml=`<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:x="urn:schemas-microsoft-com:office:excel"><Styles>
  <Style ss:ID="Default"><Alignment ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="10"/></Style>
  <Style ss:ID="border"><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>
  <Style ss:ID="midi" ss:Parent="border"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#B45F06" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Center"/></Style>
  <Style ss:ID="soir" ss:Parent="border"><Font ss:Bold="1"/><Interior ss:Color="#F6B26B" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Center"/></Style>
  <Style ss:ID="date"><Font ss:Bold="1"/><Alignment ss:Horizontal="Center" ss:Vertical="Center"/></Style>
  <Style ss:ID="headMidi" ss:Parent="border"><Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="9"/><Interior ss:Color="#B45F06" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/></Style>
  <Style ss:ID="headSoir" ss:Parent="border"><Font ss:Bold="1" ss:Size="9"/><Interior ss:Color="#F6B26B" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/></Style>
  <Style ss:ID="headTotal" ss:Parent="border"><Font ss:Bold="1" ss:Size="9"/><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><NumberFormat ss:Format="0.00"/></Style>
  <Style ss:ID="salleBar" ss:Parent="border"><Font ss:Bold="1"/><Interior ss:Color="#D9EAD3" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/></Style>
  <Style ss:ID="cuisineBar" ss:Parent="border"><Font ss:Bold="1"/><Interior ss:Color="#C9DAF8" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/></Style>
  <Style ss:ID="salleSide" ss:Parent="border"><Font ss:Bold="1"/><Interior ss:Color="#E69138" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:Rotate="90"/></Style>
  <Style ss:ID="cuisineSide" ss:Parent="border"><Font ss:Bold="1"/><Interior ss:Color="#F9CB9C" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:Rotate="90"/></Style>
  <Style ss:ID="name" ss:Parent="border"><Alignment ss:Vertical="Center"/></Style><Style ss:ID="time" ss:Parent="border"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/></Style>
  <Style ss:ID="midiTotal" ss:Parent="border"><Interior ss:Color="#FCE5CD" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/><NumberFormat ss:Format="0.00"/></Style>
  <Style ss:ID="shiftTotal" ss:Parent="border"><Interior ss:Color="#FFF2CC" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/><NumberFormat ss:Format="0.00"/></Style>
  <Style ss:ID="grandTotal" ss:Parent="border"><Font ss:Bold="1"/><Interior ss:Color="#FFF2CC" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/><NumberFormat ss:Format="0.00"/></Style>
  <Style ss:ID="sideBlank" ss:Parent="border"/>
  </Styles><Worksheet ss:Name="Heures Employés"><Table><Column ss:Width="225"/><Column ss:Width="58"/><Column ss:Width="67"/><Column ss:Width="95"/><Column ss:Width="72"/><Column ss:Width="52"/><Column ss:Width="80"/><Column ss:Width="70"/><Column ss:Width="42"/>
  <Row ss:Height="8"><Cell/></Row><Row ss:Height="24">${empty("border")}${cell("MIDI","String","midi",` ss:MergeAcross="2"`)}${cell("SOIR","String","soir",` ss:MergeAcross="2"`)}${empty("border")}${empty("border")}</Row>
  <Row ss:Height="41">${cell(`${day}/${month}/${year}`,"String","date")}${cell("Heure début 1","String","headMidi")}${cell("Heure fin 1","String","headMidi")}${cell("Différence en H (first shift)","String","headMidi")}${cell("Heure début 2","String","headSoir")}${cell("Heure fin 2","String","headSoir")}${cell("Différence en heure (shift 2)","String","headSoir")}${cell("Heures totales (h)","String","headTotal")}${empty("sideBlank")}</Row>
  ${section("Salle",salle,"salleBar","salleSide")}${section("Cuisine",cuisine,"cuisineBar","cuisineSide")}
  </Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>3</SplitHorizontal><TopRowBottomPane>3</TopRowBottomPane><Selected/><DoNotDisplayGridlines/><PageSetup><Layout x:Orientation="Landscape"/><FitToPage/></PageSetup></WorksheetOptions></Worksheet></Workbook>`;
  const blob=new Blob(["\ufeff",workbookXml],{type:"application/vnd.ms-excel;charset=utf-8"}),url=URL.createObjectURL(blob),link=window.document.createElement("a");link.href=url;link.download=`pointage-${date}.xls`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
