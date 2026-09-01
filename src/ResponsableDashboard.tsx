import { useCallback, useEffect, useState } from "react";
import Planning from "./Planning";
import "./responsable.css";

type Employee={
  id:number;
  first:string;
  last:string;
  role:string;
  color:string;
  active:number;
  createdAt:string;
  employeeUsername?:string;
};

export default function ResponsableDashboard({request}:{request:(payload:object)=>Promise<any>}){
  const[employees,setEmployees]=useState<Employee[]>([]);
  const[loading,setLoading]=useState(true);
  const[busy,setBusy]=useState(false);
  const[error,setError]=useState("");
  const[message,setMessage]=useState("");
  const[form,setForm]=useState({first:"",last:"",role:""});
  const[editing,setEditing]=useState<{id:number;first:string;last:string;role:string}|null>(null);

  const refresh=useCallback(async()=>{
    try{const result=await request({action:"responsableDashboard"});setEmployees(result.employees||[]);setError("")}
    catch(reason){setError(reason instanceof Error?reason.message:"Chargement de l’équipe impossible")}
    finally{setLoading(false)}
  },[request]);

  useEffect(()=>{void refresh()},[refresh]);

  const addEmployee=async(event:React.FormEvent)=>{
    event.preventDefault();setBusy(true);setMessage("");setError("");
    try{
      const colors=["coral","purple","blue","green","amber","pink"],color=colors[employees.length%colors.length];
      await request({action:"addEmployee",...form,color});
      setForm({first:"",last:"",role:""});
      setMessage("Le nouvel employé a été ajouté.");
      await refresh();
    }catch(reason){setError(reason instanceof Error?reason.message:"Ajout impossible")}
    finally{setBusy(false)}
  };

  const saveEmployee=async(event:React.FormEvent)=>{
    event.preventDefault();if(!editing)return;setBusy(true);setMessage("");setError("");
    try{
      await request({action:"updateEmployeeIdentity",...editing});
      setEditing(null);
      setMessage("Les informations de l’employé ont été modifiées.");
      await refresh();
    }catch(reason){setError(reason instanceof Error?reason.message:"Modification impossible")}
    finally{setBusy(false)}
  };

  const deleteEmployee=async(employee:Employee)=>{
    if(!confirm(`Supprimer ${employee.first} ${employee.last} de l’équipe active ? Ses anciens pointages seront conservés.`))return;
    setBusy(true);setMessage("");setError("");
    try{
      await request({action:"deleteEmployee",id:employee.id});
      setMessage(`${employee.first} ${employee.last} a été retiré de l’équipe active.`);
      await refresh();
    }catch(reason){setError(reason instanceof Error?reason.message:"Suppression impossible")}
    finally{setBusy(false)}
  };

  if(loading)return <div className="super-loading">Chargement de l’espace responsable…</div>;
  return <div className="responsable-dashboard">
    <div className="responsable-banner"><div><small>ACCÈS RESPONSABLE</small><strong>Planning et gestion de l’équipe</strong><p>Organisez les services et maintenez la liste des employés.</p></div><span>{employees.filter(employee=>employee.active).length} employés actifs</span></div>
    {message&&<div className="message">✓ &nbsp; {message}<button onClick={()=>setMessage("")}>×</button></div>}
    {error&&<div className="super-alert">{error}<button onClick={()=>setError("")}>×</button></div>}
    <Planning employees={employees} request={request}/>
    <article className="super-panel employees-panel responsable-team-panel">
      <div className="panel-title"><div><h3>Gestion des employés</h3><p>Ajouter, modifier ou retirer un membre de l’équipe.</p></div></div>
      <form className="super-employee-form" onSubmit={addEmployee}>
        <input required value={form.first} onChange={event=>setForm({...form,first:event.target.value})} placeholder="Prénom"/>
        <input required value={form.last} onChange={event=>setForm({...form,last:event.target.value})} placeholder="Nom"/>
        <input required value={form.role} onChange={event=>setForm({...form,role:event.target.value})} placeholder="Poste"/>
        <button disabled={busy}>＋ Ajouter l’employé</button>
      </form>
      {editing&&<form className="employee-edit-form" onSubmit={saveEmployee}>
        <div><strong>Modifier l’employé</strong><small>Les pointages et les horaires déjà enregistrés seront conservés.</small></div>
        <label>Prénom<input autoFocus required value={editing.first} onChange={event=>setEditing({...editing,first:event.target.value})}/></label>
        <label>Nom<input required value={editing.last} onChange={event=>setEditing({...editing,last:event.target.value})}/></label>
        <label>Poste<input required value={editing.role} onChange={event=>setEditing({...editing,role:event.target.value})}/></label>
        <button disabled={busy}>Enregistrer</button>
        <button type="button" className="cancel-edit" onClick={()=>setEditing(null)}>Annuler</button>
      </form>}
      <div className="super-table-wrap"><table><thead><tr><th>Employé</th><th>Poste</th><th>Identifiant employé</th><th>Statut</th><th>Actions</th></tr></thead><tbody>{employees.map(employee=><tr key={employee.id}><td><span className={`mini-avatar ${employee.color}`}>{employee.first[0]}{employee.last[0]}</span><b>{employee.first} {employee.last}</b></td><td>{employee.role}</td><td><code>{employee.employeeUsername||"—"}</code></td><td><span className={`status-pill ${employee.active?"active":"inactive"}`}>{employee.active?"Actif":"Retiré"}</span></td><td className="responsable-row-actions">{employee.active&&<><button className="edit-employee-button" onClick={()=>setEditing({id:employee.id,first:employee.first,last:employee.last,role:employee.role})}>Modifier</button><button className="archive-employee-button" disabled={busy} onClick={()=>deleteEmployee(employee)}>Supprimer</button></>}</td></tr>)}</tbody></table></div>
    </article>
  </div>;
}
