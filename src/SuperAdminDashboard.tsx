import { useCallback, useEffect, useState } from "react";
import "./finance.css";
import Planning from "./Planning";
import "./super-employees.css";
import { downloadDailyExcel } from "./dailyExcel";
import "./super-export.css";
import "./monthly-hours.css";
import "./super-tabs.css";
import { apiUrl } from "./apiUrl";

type DashboardData = {
  stats: { activeEmployees:number; inactiveEmployees:number; todayEvents:number; activeSessions:number; administrators:number };
  recent: Array<{ name:string; type:string; timestamp:string; workDate:string }>;
  admins: Array<{ id:number; username:string; role:string; createdAt:string }>;
  employees: Array<{ id:number; first:string; last:string; role:string; color:string; active:number; createdAt:string }>;
  financial: {
    month:string; expenseTotal:number; offeredTotal:number;
    days:Array<{ date:string; depense:number; offert:number }>;
    recent:Array<{ id:number; date:string; kind:"depense"|"offert"; label:string; amount:number; note:string; createdBy:string }>;
  };
};

const request = async (payload:object):Promise<any> => {
  const token=localStorage.getItem("presence-token")||sessionStorage.getItem("presence-token");
  const response=await fetch(apiUrl(),{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token||""}`},body:JSON.stringify(payload)});
  const raw=await response.text();let result:any;try{result=JSON.parse(raw)}catch{throw new Error(`Réponse invalide du serveur (${response.status}). Vérifiez VITE_API_URL.`)}
  if(!response.ok||result.success===false) throw new Error(result.message||"Erreur serveur");
  return result;
};

export default function SuperAdminDashboard(){
  const[data,setData]=useState<DashboardData|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[form,setForm]=useState({username:"",password:"",role:"admin"});
  const[financialForm,setFinancialForm]=useState({date:new Date().toLocaleDateString("en-CA"),kind:"depense",label:"",amount:"",note:""});
  const[employeeForm,setEmployeeForm]=useState({first:"",last:"",role:""});
  const[editingEmployee,setEditingEmployee]=useState<{id:number;first:string;last:string}|null>(null);
  const[exportDate,setExportDate]=useState(new Date().toLocaleDateString("en-CA"));
  const[view,setView]=useState<"overview"|"planning"|"finance"|"team">("overview");
  const[hoursMonth,setHoursMonth]=useState(new Date().toLocaleDateString("en-CA").slice(0,7)),[monthlyHours,setMonthlyHours]=useState<{totalMinutes:number;employees:Array<{id:number;first:string;last:string;role:string;color:string;totalMinutes:number;shifts:number;days:number}>}|null>(null),[hoursLoading,setHoursLoading]=useState(false);
  const refresh=useCallback(async()=>{setLoading(true);setError("");try{setData(await request({action:"superDashboard"}))}catch(e){setError(e instanceof Error?e.message:"Chargement impossible")}finally{setLoading(false)}},[]);
  useEffect(()=>{void refresh()},[refresh]);
  useEffect(()=>{const load=async()=>{setHoursLoading(true);try{setMonthlyHours(await request({action:"monthlyHours",month:hoursMonth}))}catch(err){setError(err instanceof Error?err.message:"Calcul des heures impossible")}finally{setHoursLoading(false)}};void load()},[hoursMonth]);
  const createAdmin=async(e:React.FormEvent)=>{e.preventDefault();try{await request({action:"createAdmin",...form});setForm({username:"",password:"",role:"admin"});await refresh()}catch(err){setError(err instanceof Error?err.message:"Création impossible")}};
  const deleteAdmin=async(id:number)=>{if(!confirm("Supprimer définitivement cet administrateur ?"))return;try{await request({action:"deleteAdmin",id});await refresh()}catch(err){setError(err instanceof Error?err.message:"Suppression impossible")}};
  const addFinancialEntry=async(e:React.FormEvent)=>{e.preventDefault();try{await request({action:"addFinancialEntry",...financialForm,amount:Number(financialForm.amount)});setFinancialForm(current=>({...current,label:"",amount:"",note:""}));await refresh()}catch(err){setError(err instanceof Error?err.message:"Enregistrement impossible")}};
  const deleteFinancialEntry=async(id:number)=>{if(!confirm("Supprimer cette écriture ?"))return;try{await request({action:"deleteFinancialEntry",id});await refresh()}catch(err){setError(err instanceof Error?err.message:"Suppression impossible")}};
  const addEmployee=async(e:React.FormEvent)=>{e.preventDefault();try{const colors=["coral","purple","blue","green","amber","pink"],color=colors[(data?.employees.length??0)%colors.length];await request({action:"addEmployee",...employeeForm,color});setEmployeeForm({first:"",last:"",role:""});await refresh()}catch(err){setError(err instanceof Error?err.message:"Ajout impossible")}};
  const saveEmployeeIdentity=async(e:React.FormEvent)=>{e.preventDefault();if(!editingEmployee)return;try{await request({action:"updateEmployeeIdentity",...editingEmployee});setEditingEmployee(null);await refresh()}catch(err){setError(err instanceof Error?err.message:"Modification impossible")}};
  const exportAttendance=async()=>{try{const result=await request({action:"exportAttendance",workDate:exportDate});downloadDailyExcel(exportDate,(data?.employees||[]).filter(employee=>employee.active),result.records||[])}catch(err){setError(err instanceof Error?err.message:"Export impossible")}};
  if(loading&&!data)return <div className="super-loading">Préparation du centre de contrôle…</div>;
  if(!data)return <div className="super-error">{error||"Dashboard indisponible"}<button onClick={refresh}>Réessayer</button></div>;
  const cards=[
    ["Équipe active",data.stats.activeEmployees,"●","red"],
    ["Pointages aujourd’hui",data.stats.todayEvents,"↗","gold"],
    ["Administrateurs",data.stats.administrators,"◆","dark"],
    ["Sessions actives",data.stats.activeSessions,"◉","green"],
  ];
  const chartMax=Math.max(1,...data.financial.days.flatMap(day=>[day.depense,day.offert]));
  const money=(value:number)=>new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR"}).format(value);
  const duration=(minutes:number)=>`${Math.floor(minutes/60)} h ${String(minutes%60).padStart(2,"0")}`;
  const sectionTitle={overview:"Vue d’ensemble BEEF HOUSE",planning:"Planning de l’équipe",finance:"Finances de l’établissement",team:"Équipe et accès"}[view];
  const sectionDescription={overview:"Indicateurs, heures et activité récente.",planning:"Préparez les horaires des prochaines semaines.",finance:"Suivez les dépenses et les offerts.",team:"Gérez les employés et les comptes administrateurs."}[view];
  return <section className={`super-dashboard view-${view}`}>
    <div className="super-hero"><div><span className="super-kicker">CENTRE DE CONTRÔLE</span><h2>{sectionTitle}</h2><p>{sectionDescription}</p></div><button onClick={refresh}>↻ Actualiser</button></div>
    <nav className="super-section-nav" aria-label="Sections du super administrateur"><button className={view==="overview"?"active":""} onClick={()=>setView("overview")}>⌂ Vue d’ensemble</button><button className={view==="planning"?"active":""} onClick={()=>setView("planning")}>▦ Planning</button><button className={view==="finance"?"active":""} onClick={()=>setView("finance")}>€ Finances</button><button className={view==="team"?"active":""} onClick={()=>setView("team")}>● Équipe &amp; accès</button></nav>
    {error&&<div className="super-alert">{error}<button onClick={()=>setError("")}>×</button></div>}
    <div hidden={view!=="overview"} className="super-stats">{cards.map(([label,value,icon,tone])=><article className={`stat-card ${tone}`} key={String(label)}><div><span>{label}</span><strong>{value}</strong></div><b>{icon}</b></article>)}</div>
    <div hidden={view!=="overview"} className="super-export"><div><strong>Pointage de la journée</strong><small>Télécharger les arrivées, départs et heures calculées au format Excel.</small></div><label>Date<input type="date" value={exportDate} onChange={e=>setExportDate(e.target.value)}/></label><button onClick={exportAttendance}>↓ Télécharger Excel</button></div>
    <article className="super-panel monthly-hours-panel"><div className="panel-title"><div><h3>Cumul mensuel des heures</h3><p>Heures réellement travaillées, corrigées selon le planning en cas d’arrivée anticipée.</p></div><label>Mois<input type="month" value={hoursMonth} onChange={e=>setHoursMonth(e.target.value)}/></label></div>{hoursLoading?<div className="super-loading">Calcul des heures…</div>:monthlyHours?<><div className="monthly-hours-summary"><span>Total de l’équipe</span><strong>{duration(monthlyHours.totalMinutes)}</strong><small>{new Date(`${hoursMonth}-01T12:00:00`).toLocaleDateString("fr-FR",{month:"long",year:"numeric"})}</small></div><div className="monthly-hours-table"><table><thead><tr><th>Employé</th><th>Jours pointés</th><th>Services terminés</th><th>Total du mois</th></tr></thead><tbody>{monthlyHours.employees.map(employee=><tr key={employee.id}><td><span className={`mini-avatar ${employee.color}`}>{employee.first[0]}{employee.last[0]}</span><div><b>{employee.first} {employee.last}</b><small>{employee.role}</small></div></td><td>{employee.days}</td><td>{employee.shifts}</td><td><strong>{duration(employee.totalMinutes)}</strong></td></tr>)}</tbody></table></div></>:<div className="super-empty">Aucune donnée pour ce mois.</div>}</article>
    <Planning employees={data.employees} request={request}/>
    <article className="super-panel finance-panel">
      <div className="panel-title"><div><h3>Dépenses &amp; offerts</h3><p>Suivi financier du mois de {new Date(`${data.financial.month}-01T12:00:00`).toLocaleDateString("fr-FR",{month:"long",year:"numeric"})}</p></div><div className="finance-legend"><span><i className="expense"/> Dépenses</span><span><i className="offered"/> Offerts</span></div></div>
      <div className="finance-content">
        <div className="finance-visual"><div className="finance-totals"><div><span>Dépenses du mois</span><strong>{money(data.financial.expenseTotal)}</strong></div><div><span>Offerts du mois</span><strong>{money(data.financial.offeredTotal)}</strong></div></div><div className="finance-chart" aria-label="Dépenses et offerts des sept derniers jours">{data.financial.days.map(day=><div className="chart-day" key={day.date}><div className="bar-area"><span className="chart-bar expense" title={`Dépenses : ${money(day.depense)}`} style={{height:`${day.depense?Math.max(5,day.depense/chartMax*100):0}%`}}/><span className="chart-bar offered" title={`Offerts : ${money(day.offert)}`} style={{height:`${day.offert?Math.max(5,day.offert/chartMax*100):0}%`}}/></div><small>{new Date(`${day.date}T12:00:00`).toLocaleDateString("fr-FR",{weekday:"short"})}</small></div>)}</div></div>
        <form className="finance-form" onSubmit={addFinancialEntry}><h4>Nouvelle écriture</h4><div className="finance-fields"><label>Date<input required type="date" value={financialForm.date} onChange={e=>setFinancialForm({...financialForm,date:e.target.value})}/></label><label>Type<select value={financialForm.kind} onChange={e=>setFinancialForm({...financialForm,kind:e.target.value})}><option value="depense">Dépense</option><option value="offert">Offert</option></select></label></div><label>Libellé<input required value={financialForm.label} onChange={e=>setFinancialForm({...financialForm,label:e.target.value})} placeholder="Ex. achat marchandises"/></label><label>Montant (€)<input required min="0.01" step="0.01" type="number" value={financialForm.amount} onChange={e=>setFinancialForm({...financialForm,amount:e.target.value})} placeholder="0,00"/></label><label>Note (facultatif)<input value={financialForm.note} onChange={e=>setFinancialForm({...financialForm,note:e.target.value})} placeholder="Information complémentaire"/></label><button>Enregistrer →</button></form>
      </div>
      <div className="finance-history"><h4>Dernières écritures</h4>{data.financial.recent.length?<div>{data.financial.recent.map(entry=><div className="finance-row" key={entry.id}><span className={`finance-kind ${entry.kind}`}>{entry.kind==="depense"?"D":"O"}</span><div><strong>{entry.label}</strong><small>{new Date(`${entry.date}T12:00:00`).toLocaleDateString("fr-FR")} · {entry.createdBy}{entry.note?` · ${entry.note}`:""}</small></div><b>{money(entry.amount)}</b><button onClick={()=>deleteFinancialEntry(entry.id)} title="Supprimer">×</button></div>)}</div>:<div className="super-empty">Aucune écriture financière.</div>}</div>
    </article>
    <div className="super-grid">
      <article className="super-panel activity-panel"><div className="panel-title"><div><h3>Activité récente</h3><p>Les douze derniers mouvements</p></div><span className="live-pill"><i/> LIVE</span></div><div className="activity-list">{data.recent.length?data.recent.map((item,index)=><div className="activity-row" key={`${item.timestamp}-${index}`}><span className={`activity-icon ${item.type==="Arrivée"?"in":"out"}`}>{item.type==="Arrivée"?"↘":"↗"}</span><div><strong>{item.name}</strong><small>{item.type} · {new Date(item.timestamp).toLocaleString("fr-FR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</small></div><time>{item.workDate}</time></div>):<div className="super-empty">Aucun pointage enregistré.</div>}</div></article>
      <article className="super-panel admin-panel"><div className="panel-title"><div><h3>Créer un accès</h3><p>Ajouter un administrateur sécurisé</p></div></div><form onSubmit={createAdmin}><label>Identifiant<input required minLength={3} value={form.username} onChange={e=>setForm({...form,username:e.target.value})} placeholder="ex. manager-soir"/></label><label>Mot de passe<input required minLength={8} type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="8 caractères minimum"/></label><label>Niveau<select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}><option value="admin">Administrateur</option><option value="superadmin">Super administrateur</option></select></label><button>Créer le compte →</button></form></article>
    </div>
    <div className="super-grid lower">
      <article className="super-panel employees-panel"><div className="panel-title"><div><h3>Répertoire de l’équipe</h3><p>{data.stats.activeEmployees} actifs · {data.stats.inactiveEmployees} archivés</p></div></div><form className="super-employee-form" onSubmit={addEmployee}><input required value={employeeForm.first} onChange={e=>setEmployeeForm({...employeeForm,first:e.target.value})} placeholder="Prénom"/><input required value={employeeForm.last} onChange={e=>setEmployeeForm({...employeeForm,last:e.target.value})} placeholder="Nom"/><input required value={employeeForm.role} onChange={e=>setEmployeeForm({...employeeForm,role:e.target.value})} placeholder="Poste"/><button>＋ Ajouter l’employé</button></form>{editingEmployee&&<form className="employee-edit-form" onSubmit={saveEmployeeIdentity}><div><strong>Modifier l’employé</strong><small>Les pointages et plannings existants seront conservés.</small></div><label>Prénom<input autoFocus required value={editingEmployee.first} onChange={e=>setEditingEmployee({...editingEmployee,first:e.target.value})}/></label><label>Nom<input required value={editingEmployee.last} onChange={e=>setEditingEmployee({...editingEmployee,last:e.target.value})}/></label><button type="submit">Enregistrer</button><button type="button" className="cancel-edit" onClick={()=>setEditingEmployee(null)}>Annuler</button></form>}<div className="super-table-wrap"><table><thead><tr><th>Employé</th><th>Poste</th><th>Statut</th><th>Créé le</th><th>Action</th></tr></thead><tbody>{data.employees.map(employee=><tr key={employee.id}><td><span className={`mini-avatar ${employee.color}`}>{employee.first[0]}{employee.last[0]}</span><b>{employee.first} {employee.last}</b></td><td>{employee.role}</td><td><span className={`status-pill ${employee.active?"active":"inactive"}`}>{employee.active?"Actif":"Archivé"}</span></td><td>{new Date(employee.createdAt+"Z").toLocaleDateString("fr-FR")}</td><td><button className="edit-employee-button" onClick={()=>setEditingEmployee({id:employee.id,first:employee.first,last:employee.last})}>Modifier</button></td></tr>)}</tbody></table></div></article>
      <article className="super-panel accounts-panel"><div className="panel-title"><div><h3>Comptes administrateurs</h3><p>Accès actuellement autorisés</p></div></div><div className="account-list">{data.admins.map(admin=><div key={admin.id}><span className="account-avatar">{admin.username.slice(0,2).toUpperCase()}</span><div><strong>{admin.username}</strong><small>{admin.role==="superadmin"?"Super administrateur":"Administrateur"}</small></div><button onClick={()=>deleteAdmin(admin.id)} title="Supprimer">×</button></div>)}</div></article>
    </div>
  </section>;
}
