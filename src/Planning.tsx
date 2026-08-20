import { useCallback, useEffect, useMemo, useState } from "react";
import "./planning.css";
import "./manual-planning.css";
import { downloadPlanningPdf, viewPlanningPdf } from "./planningPdf";

type Employee={id:number;first:string;last:string;role:string;active:number};
type Block={employeeId:number;workDate:string;startMinutes:number};

const mondayOf=(date:Date)=>{const result=new Date(date);const day=(result.getDay()+6)%7;result.setDate(result.getDate()-day);result.setHours(12,0,0,0);return result};
const iso=(date:Date)=>date.toISOString().slice(0,10);
const addDays=(date:Date,count:number)=>{const result=new Date(date);result.setDate(result.getDate()+count);return result};
const timeLabel=(minutes:number)=>`${String(Math.floor(minutes/60)%24).padStart(2,"0")}:${String(minutes%60).padStart(2,"0")}`;
const timeToMinutes=(value:string)=>{const[hours,minutes]=value.split(":").map(Number);return (hours<7?hours+24:hours)*60+minutes};

export default function Planning({employees,request}:{employees:Employee[];request:(payload:object)=>Promise<any>}){
  const activeEmployees=employees.filter(employee=>employee.active);
  const[week,setWeek]=useState(()=>mondayOf(new Date())),[blocks,setBlocks]=useState<Block[]>([]),[busyKey,setBusyKey]=useState(""),[manualBusy,setManualBusy]=useState(false),[manualError,setManualError]=useState("");
  const[manual,setManual]=useState(()=>({employeeId:"",workDate:iso(new Date()),start:"09:00",end:"17:00"}));
  const days=useMemo(()=>Array.from({length:7},(_,index)=>addDays(week,index)),[week]);
  const visibleDays=useMemo(()=>{const today=iso(new Date());return days.filter(day=>iso(day)>=today)},[days]);
  const slots=useMemo(()=>Array.from({length:38},(_,index)=>420+index*30),[]);
  const load=useCallback(async()=>{const result=await request({action:"getSchedule",weekStart:iso(week)});setBlocks(result.blocks||[])},[request,week]);
  useEffect(()=>{void load()},[load]);
  useEffect(()=>{if(!manual.employeeId&&activeEmployees[0])setManual(current=>({...current,employeeId:String(activeEmployees[0].id)}))},[activeEmployees,manual.employeeId]);
  const selected=new Set(blocks.map(block=>`${block.employeeId}-${block.workDate}-${block.startMinutes}`));
  const toggle=async(employeeId:number,workDate:string,startMinutes:number)=>{const key=`${employeeId}-${workDate}-${startMinutes}`,wasSelected=selected.has(key);setBusyKey(key);setBlocks(current=>wasSelected?current.filter(block=>`${block.employeeId}-${block.workDate}-${block.startMinutes}`!==key):[...current,{employeeId,workDate,startMinutes}]);try{await request({action:"toggleScheduleBlock",employeeId,workDate,startMinutes})}catch{await load()}finally{setBusyKey("")}};
  const saveManual=async(e:React.FormEvent)=>{e.preventDefault();const startMinutes=timeToMinutes(manual.start),endMinutes=timeToMinutes(manual.end);setManualBusy(true);setManualError("");try{await request({action:"setScheduleRange",employeeId:Number(manual.employeeId),workDate:manual.workDate,startMinutes,endMinutes});const targetWeek=mondayOf(new Date(`${manual.workDate}T12:00:00`));if(iso(targetWeek)===iso(week))await load();else setWeek(targetWeek)}catch(error){setManualError(error instanceof Error?error.message:"Enregistrement impossible")}finally{setManualBusy(false)}};
  return <article className="super-panel planning-panel">
    <div className="panel-title planning-title"><div><h3>Planning hebdomadaire</h3><p>Méthode 1 · cliquez sur les cubes de 30 minutes</p></div><div className="planning-actions"><button className="preview-button" onClick={()=>viewPlanningPdf(days,activeEmployees,blocks)}>◉ Visualiser</button><button className="pdf-button" onClick={()=>downloadPlanningPdf(days,activeEmployees,blocks,iso(week))}>↓ Télécharger PDF</button><div className="week-controls"><button onClick={()=>setWeek(addDays(week,-7))}>←</button><strong>{days[0].toLocaleDateString("fr-FR",{day:"2-digit",month:"short"})} — {days[6].toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric"})}</strong><button onClick={()=>setWeek(addDays(week,7))}>→</button></div></div></div>
    <form className="manual-planning" onSubmit={saveManual}><div><strong>Méthode 2 · saisie manuelle</strong><small>Choisissez une personne et sa plage horaire. Les cubes seront mis à jour automatiquement.</small></div><label>Employé<select required value={manual.employeeId} onChange={e=>setManual({...manual,employeeId:e.target.value})}>{activeEmployees.map(employee=><option value={employee.id} key={employee.id}>{employee.first} {employee.last}</option>)}</select></label><label>Date<input required type="date" min={iso(new Date())} value={manual.workDate} onChange={e=>setManual({...manual,workDate:e.target.value})}/></label><label>Début<input required type="time" step="1800" min="07:00" value={manual.start} onChange={e=>setManual({...manual,start:e.target.value})}/></label><label>Fin<input required type="time" step="1800" value={manual.end} onChange={e=>setManual({...manual,end:e.target.value})}/></label><button disabled={manualBusy||!manual.employeeId}>{manualBusy?"Enregistrement…":"Appliquer"}</button>{manualError&&<p className="super-alert">{manualError}</p>}</form>
    <div className="planning-help"><i/> Ouverture 07:00, fermeture 02:00. Une saisie manuelle remplace les cubes existants de cette personne pour la journée.</div>
    <div className="planning-scroll">{visibleDays.length?visibleDays.map(day=>{const workDate=iso(day);return <section className="planning-day" key={workDate}><div className="planning-day-heading"><h4>{day.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})}</h4></div><div className="planning-grid"><div className="planning-hours"><span>Employé</span>{slots.map((slot,index)=><small key={slot}>{index%2===0?timeLabel(slot):"·"}</small>)}</div>{activeEmployees.map(employee=><div className="planning-employee" key={employee.id}><span title={`${employee.first} ${employee.last}`}><b>{employee.first} {employee.last}</b><small>{employee.role}</small></span>{slots.map(slot=>{const key=`${employee.id}-${workDate}-${slot}`,active=selected.has(key);return <button key={slot} className={active?"selected":""} disabled={busyKey===key} onClick={()=>toggle(employee.id,workDate,slot)} title={`${employee.first} · ${timeLabel(slot)}–${timeLabel(slot+30)}`} aria-label={`${active?"Retirer":"Ajouter"} ${employee.first} à ${timeLabel(slot)}`}/>})}</div>)}</div></section>}):<div className="no-future-days">Cette semaine est terminée. Passez à la semaine suivante.</div>}</div>
  </article>;
}
