import {useEffect,useRef,useState} from 'react';
import {readExpenseNote,writeExpenseNote} from './expenseCategory';
import type {ExpenseCategory} from './expenseCategory';
import {readOfferedNote,writeOfferedNote} from './offeredCategory';
import type {OfferedCategory} from './offeredCategory';
export type EditableFinancialEntry={id:number;date:string;kind:'depense'|'offert'|'erreur';label:string;amount:number;note:string};
export default function FinancialEntryDialog({entry,save,close}:{entry:EditableFinancialEntry;save:(entry:EditableFinancialEntry)=>Promise<void>;close:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null);
  const [form,setForm]=useState({...entry,amount:String(entry.amount)}),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const parsed= form.kind==='depense'?readExpenseNote(form.note):readOfferedNote(form.note);
  useEffect(()=>{dialog.current?.showModal()},[]);
  const note=(category:string,text:string)=>form.kind==='depense'?writeExpenseNote(category as ExpenseCategory,text):form.kind==='offert'?writeOfferedNote(category as OfferedCategory,text):text;
  return <dialog className="financial-edit-dialog" ref={dialog} onCancel={e=>{e.preventDefault();if(!busy)close()}} aria-labelledby="financial-edit-title"><form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await save({...form,amount:Number(form.amount)});close()}catch(err){setError(err instanceof Error?err.message:'Modification impossible')}finally{setBusy(false)}}}>
    <h3 id="financial-edit-title">Modifier l’écriture</h3><fieldset disabled={busy}>
      <label>Date d’origine<input type="date" value={entry.date} readOnly/></label>
      <label>Type<select value={form.kind} onChange={e=>setForm({...form,kind:e.target.value as EditableFinancialEntry['kind'],note:readExpenseNote(readOfferedNote(form.note).text).text})}><option value="depense">Dépense</option><option value="offert">Offert</option><option value="erreur">Erreur</option></select></label>
      {form.kind!=='erreur'&&<label>Catégorie<select required value={parsed.category} onChange={e=>setForm({...form,note:note(e.target.value,parsed.text)})}><option value="">Sélectionner…</option>{form.kind==='depense'?<><option value="purchase">Achat</option><option value="payroll">Paie</option></>:<><option value="professional">Repas professionnel</option><option value="influencer">Table influenceur</option></>}</select></label>}
      <label>Libellé<input autoFocus required maxLength={300} value={form.label} onChange={e=>setForm({...form,label:e.target.value})}/></label>
      <label>Montant (€)<input required type="number" min="0" step="0.01" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></label>
      <label>Note<textarea maxLength={2000} value={parsed.text} onChange={e=>setForm({...form,note:note(parsed.category,e.target.value)})}/></label>
      {error&&<p role="alert">{error}</p>}<div className="financial-edit-actions"><button type="button" onClick={close}>Annuler</button><button type="submit">{busy?'Enregistrement…':'Enregistrer'}</button></div>
    </fieldset></form></dialog>;
}
