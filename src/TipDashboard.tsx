import {useEffect,useMemo,useState} from "react";
import {apiUrl} from "./apiUrl";
import "./tips.css";

type Allocation={id:number;service:"matin"|"soir";recipientKey:string;recipientName:string;amount:number;claimed:boolean;accumulated:number};
type TipResult={day:{workDate:string;morningAmount:number;eveningAmount:number};allocations:Allocation[]};
const request=async(payload:object)=>{const token=localStorage.getItem("presence-token")||sessionStorage.getItem("presence-token"),response=await fetch(apiUrl(),{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token||""}`},body:JSON.stringify(payload)}),raw=await response.text();let result;try{result=JSON.parse(raw)}catch{throw new Error("Réponse invalide du serveur")};if(!response.ok||!result.success)throw new Error(result.message||"Erreur serveur");return result as TipResult&{success:true}};
const today=()=>new Date().toLocaleDateString("en-CA");
const euro=(amount:number)=>amount.toLocaleString("fr-FR",{style:"currency",currency:"EUR"});

export default function TipDashboard(){
 const[date,setDate]=useState(today()),[morning,setMorning]=useState(""),[evening,setEvening]=useState(""),[allocations,setAllocations]=useState<Allocation[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const apply=(result:TipResult)=>{setMorning(String(result.day.morningAmount||""));setEvening(String(result.day.eveningAmount||""));setAllocations(result.allocations||[])};
 const load=async()=>{setBusy(true);setError("");try{apply(await request({action:"tipOverview",workDate:date}))}catch(err){setError(err instanceof Error?err.message:"Chargement impossible")}finally{setBusy(false)}};
 useEffect(()=>{void load()},[date]);
 const save=async()=>{setBusy(true);setError("");try{apply(await request({action:"saveTips",workDate:date,morningAmount:Number(morning||0),eveningAmount:Number(evening||0)}))}catch(err){setError(err instanceof Error?err.message:"Calcul impossible")}finally{setBusy(false)}};
 const toggle=async(id:number)=>{setBusy(true);setError("");try{apply(await request({action:"toggleTipClaimed",id}))}catch(err){setError(err instanceof Error?err.message:"Modification impossible")}finally{setBusy(false)}};
 const total=useMemo(()=>allocations.reduce((sum,row)=>sum+row.amount,0),[allocations]);
 return <div className="tips-page">
  <section className="card tips-head"><div className="cardhead"><span>€</span><div><h2>Répartition des pourboires</h2><p>Le total de chaque service est divisé entre les personnes inscrites au planning.</p></div></div><div className="tips-inputs"><label>Date<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Pourboire du matin (€)<input type="number" min="0" step="0.01" value={morning} onChange={e=>setMorning(e.target.value)} placeholder="0,00"/></label><label>Pourboire du soir (€)<input type="number" min="0" step="0.01" value={evening} onChange={e=>setEvening(e.target.value)} placeholder="0,00"/></label><button disabled={busy} onClick={save}>{busy?"Calcul...":"Calculer et enregistrer"}</button></div>{error&&<p className="tips-error">{error}</p>}<p className="kitchen-rule">Planning matin = part du matin · Planning soir = part du soir · Cuisine = une seule part collective par service.</p></section>
  <section className="card tips-list"><div className="tips-list-title"><div><h2>Parts de la journée</h2><p>{allocations.length} attribution{allocations.length>1?"s":""}</p></div><strong>{euro(total)}</strong></div>{allocations.length?<div className="tips-table"><table><thead><tr><th>Bénéficiaire</th><th>Service</th><th>Part du jour</th><th>Cumul non pris</th><th>Statut</th></tr></thead><tbody>{allocations.map(row=><tr key={row.id} className={row.claimed?"claimed":""}><td><b>{row.recipientName}</b>{row.recipientKey==="cuisine"&&<small>Part collective</small>}</td><td><span className={`tip-shift ${row.service}`}>{row.service}</span></td><td>{euro(row.amount)}</td><td><strong>{euro(row.accumulated)}</strong></td><td><button disabled={busy} className={row.claimed?"taken":"pending"} onClick={()=>toggle(row.id)}>{row.claimed?"✓ Pris":"Pas pris"}</button></td></tr>)}</tbody></table></div>:<div className="tips-empty">Aucune part calculée. Vérifiez le planning de cette date, saisissez les montants puis cliquez sur « Calculer ».</div>}</section>
 </div>
}
