import { useCallback, useEffect, useState } from "react";

export type CustomerFeedback = {
  id:number;
  feedbackDate:string;
  feedbackTime:string;
  tableNumber:string;
  feedback:string;
  createdAt:string;
  createdBy:string;
};

const today=()=>new Date().toLocaleDateString("en-CA");
const currentTime=()=>new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});

export default function CustomerFeedbackDashboard({request}:{request:(data:object)=>Promise<any>}){
  const[selectedDate,setSelectedDate]=useState(today),[items,setItems]=useState<CustomerFeedback[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
  const[form,setForm]=useState({feedbackDate:today(),feedbackTime:currentTime(),tableNumber:"",feedback:""});
  const load=useCallback(async(date=selectedDate)=>{setLoading(true);try{const result=await request({action:"customerFeedback",feedbackDate:date});setItems(result.items||[]);setError("")}catch(reason){setError(reason instanceof Error?reason.message:"Chargement impossible")}finally{setLoading(false)}},[request,selectedDate]);
  useEffect(()=>{void load(selectedDate);const timer=window.setInterval(()=>void load(selectedDate),20_000);return()=>window.clearInterval(timer)},[load,selectedDate]);
  const submit=async(event:React.FormEvent)=>{event.preventDefault();setBusy(true);setError("");setMessage("");try{await request({action:"createCustomerFeedback",...form});setSelectedDate(form.feedbackDate);setForm(current=>({...current,feedbackTime:currentTime(),tableNumber:"",feedback:""}));setMessage("Le retour client a été enregistré.");await load(form.feedbackDate)}catch(reason){setError(reason instanceof Error?reason.message:"Enregistrement impossible")}finally{setBusy(false)}};
  return <div className="customer-feedback-layout">
    <section className="card customer-feedback-form-card"><div className="cardhead"><span>★</span><div><h2>Nouveau retour client</h2><p>Conservez le commentaire avec la table, la date et l’heure.</p></div></div><form onSubmit={submit}><div className="customer-feedback-fields"><label>Date<input required type="date" value={form.feedbackDate} onChange={event=>setForm({...form,feedbackDate:event.target.value})}/></label><label>Heure<input required type="time" value={form.feedbackTime} onChange={event=>setForm({...form,feedbackTime:event.target.value})}/></label><label>Numéro de table<input required maxLength={30} value={form.tableNumber} onChange={event=>setForm({...form,tableNumber:event.target.value})} placeholder="Ex. 12 ou Terrasse 4"/></label></div><label>Retour du client<textarea required maxLength={1500} value={form.feedback} onChange={event=>setForm({...form,feedback:event.target.value})} placeholder="Écrivez précisément le retour du client…"/></label>{error&&<div className="customer-feedback-error">{error}</div>}{message&&<div className="customer-feedback-success">{message}</div>}<button className="primary" disabled={busy}>{busy?"Enregistrement…":"Enregistrer le retour →"}</button></form></section>
    <section className="card customer-feedback-list-card"><div className="cardhead"><span>≡</span><div><h2>Retours de la journée</h2><p>{items.length} retour{items.length>1?"s":""} enregistré{items.length>1?"s":""}.</p></div><label>Date<input type="date" value={selectedDate} onChange={event=>setSelectedDate(event.target.value)}/></label></div>{loading?<div className="customer-feedback-empty">Chargement…</div>:items.length?<div className="customer-feedback-list">{items.map(item=><article key={item.id}><div className="customer-feedback-meta"><b>Table {item.tableNumber}</b><time>{item.feedbackTime}</time></div><p>{item.feedback}</p><small>Ajouté par {item.createdBy}</small></article>)}</div>:<div className="customer-feedback-empty">Aucun retour client pour cette date.</div>}</section>
  </div>;
}
