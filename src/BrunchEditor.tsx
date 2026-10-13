import { useEffect, useState } from 'react';
import { apiUrl } from './apiUrl';
import './brunch-editor.css';

type Item=[string,string,number,string,string];
type Brunch={notice:[string,string];items:Item[]};
type Snapshot={brunch:Brunch;revision:number;updatedAt:string|null};
async function request(payload:object):Promise<Snapshot> {
  const token=localStorage.getItem('presence-token')||sessionStorage.getItem('presence-token');
  const response=await fetch(apiUrl(),{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token||''}`},body:JSON.stringify(payload)});
  const result=await response.json();
  if(!response.ok||!result.success)throw new Error(result.message||'Brunch indisponible');
  return result;
}
export default function BrunchEditor(){
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  useEffect(()=>{let cancelled=false;request({action:'getBrunch'}).then(value=>{if(!cancelled)setSnapshot(value)}).catch(err=>{if(!cancelled)setError(err.message)});return()=>{cancelled=true}},[]);
  const update=(index:number,field:number,value:string)=>setSnapshot(current=>current&&({...current,brunch:{...current.brunch,items:current.brunch.items.map((item,i)=>i===index?item.map((v,k)=>k===field?(field===2?Number(value):value):v) as Item:item)}}));
  const save=async(event:React.FormEvent)=>{event.preventDefault();if(!snapshot||busy)return;setBusy(true);setError('');setNotice('');try{setSnapshot(await request({action:'saveBrunch',...snapshot}));setNotice('Brunch enregistré. La carte en ligne le récupère à son ouverture.')}catch(err){setError(err instanceof Error?err.message:'Enregistrement impossible')}finally{setBusy(false)}};
  return <section className="super-panel brunch-editor"><h3>Carte du brunch</h3><p>Modifier les formules sur <a href="https://menu.beefhouse-marseille.fr/#brunch" target="_blank" rel="noreferrer">le menu public ↗</a>. Les autres catégories ne sont pas modifiées.</p>
    {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
    {!snapshot?<p>Chargement du brunch…</p>:<form onSubmit={save}><fieldset disabled={busy}>
      <div className="brunch-fields">{(['Français','Anglais'] as const).map((language,i)=><label key={language}>Disponibilité — {language}<input maxLength={300} value={snapshot.brunch.notice[i]} onChange={e=>{const value=e.target.value;setSnapshot(current=>{if(!current)return current;const next=[...current.brunch.notice] as [string,string];next[i]=value;return {...current,brunch:{...current.brunch,notice:next}}})}}/></label>)}</div>
      {snapshot.brunch.items.map((item,index)=><fieldset className="brunch-formula" key={index}><legend>Formule {index+1}</legend><div className="brunch-fields">
        <label>Nom français<input required maxLength={120} value={item[0]} onChange={e=>update(index,0,e.target.value)}/></label>
        <label>Nom anglais<input required maxLength={120} value={item[1]} onChange={e=>update(index,1,e.target.value)}/></label>
        <label>Description française<textarea maxLength={2000} value={item[3]} onChange={e=>update(index,3,e.target.value)}/></label>
        <label>Description anglaise<textarea maxLength={2000} value={item[4]} onChange={e=>update(index,4,e.target.value)}/></label>
        <label>Prix (€)<input required type="number" min="0" max="1000" step="0.01" value={item[2]} onChange={e=>update(index,2,e.target.value)}/></label>
      </div><button type="button" disabled={snapshot.brunch.items.length===1} onClick={()=>{if(confirm('Retirer cette formule du brunch ?'))setSnapshot(current=>current&&({...current,brunch:{...current.brunch,items:current.brunch.items.filter((_,i)=>i!==index)}}))}}>Retirer la formule</button></fieldset>)}
      <div className="brunch-actions"><button type="button" disabled={snapshot.brunch.items.length>=30} onClick={()=>setSnapshot(current=>current&&({...current,brunch:{...current.brunch,items:[...current.brunch.items,['','',0,'','']]}}))}>+ Ajouter une formule</button><button type="submit">{busy?'Enregistrement…':'Enregistrer le brunch'}</button></div>
    </fieldset></form>}
  </section>;
}
