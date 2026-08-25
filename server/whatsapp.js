import { createHmac, timingSafeEqual } from "node:crypto";
import sharp from "sharp";

const digits=value=>String(value||"").replace(/\D/g,"");
const normalize=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const iso=date=>date.toISOString().slice(0,10);
const addDays=(date,amount)=>{const next=new Date(date);next.setUTCDate(next.getUTCDate()+amount);return next};
const mondayOf=date=>{const next=new Date(date);const day=(next.getUTCDay()+6)%7;next.setUTCDate(next.getUTCDate()-day);return next};
const parisToday=()=>{const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const get=type=>parts.find(part=>part.type===type)?.value;return new Date(`${get("year")}-${get("month")}-${get("day")}T12:00:00Z`)};
const dayIndexes={lundi:0,mardi:1,mercredi:2,jeudi:3,vendredi:4,samedi:5,dimanche:6};
const dayNames=["LUNDI","MARDI","MERCREDI","JEUDI","VENDREDI","SAMEDI","DIMANCHE"];
const escapeXml=value=>String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"})[char]);
const timeLabel=minutes=>{const adjusted=minutes>=1440?minutes-1440:minutes;return `${String(Math.floor(adjusted/60)).padStart(2,"0")}h${String(adjusted%60).padStart(2,"0")}`};
const parseTime=value=>{const match=String(value).match(/^(\d{1,2})(?:h|:)?(\d{2})?$/i);if(!match)return null;let hour=Number(match[1]),minute=Number(match[2]||0);if(hour>23||minute>59||minute%30)return null;if(hour<7)hour+=24;return hour*60+minute};

const readRaw=async req=>{const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>2_000_000)throw new Error("Webhook trop volumineux");chunks.push(chunk)}return Buffer.concat(chunks)};
const configuredAdmins=()=>new Set(String(process.env.WHATSAPP_ADMIN_NUMBERS||"").split(",").map(digits).filter(Boolean));
const graphBase=()=>`https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION||"v23.0"}`;
const graphHeaders=()=>({Authorization:`Bearer ${process.env.WHATSAPP_ACCESS_TOKEN||""}`});

const sendText=async(to,text)=>{
  if(!process.env.WHATSAPP_ACCESS_TOKEN||!process.env.WHATSAPP_PHONE_NUMBER_ID){console.log(`[WhatsApp test] ${to}: ${text}`);return}
  const response=await fetch(`${graphBase()}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,{method:"POST",headers:{...graphHeaders(),"Content-Type":"application/json"},body:JSON.stringify({messaging_product:"whatsapp",to,type:"text",text:{body:text}})});
  if(!response.ok)throw new Error(`Envoi WhatsApp refusé (${response.status}): ${await response.text()}`);
};

const sendButtons=async(to,body,buttons)=>{
  if(!process.env.WHATSAPP_ACCESS_TOKEN||!process.env.WHATSAPP_PHONE_NUMBER_ID){console.log(`[WhatsApp test] ${to}: ${body} [${buttons.map(button=>button.title).join(", ")}]`);return}
  const response=await fetch(`${graphBase()}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,{method:"POST",headers:{...graphHeaders(),"Content-Type":"application/json"},body:JSON.stringify({messaging_product:"whatsapp",to,type:"interactive",interactive:{type:"button",body:{text:body},action:{buttons:buttons.map(button=>({type:"reply",reply:{id:button.id,title:button.title}}))}}})});
  if(!response.ok)throw new Error(`Envoi des boutons WhatsApp refusé (${response.status}): ${await response.text()}`);
};

const sendImage=async(to,png,caption,filename="planning.png")=>{
  if(!process.env.WHATSAPP_ACCESS_TOKEN||!process.env.WHATSAPP_PHONE_NUMBER_ID){console.log(`[WhatsApp test] image ${png.length} octets pour ${to}`);return}
  const form=new FormData();form.set("messaging_product","whatsapp");form.set("type","image/png");form.set("file",new Blob([png],{type:"image/png"}),filename);
  const uploaded=await fetch(`${graphBase()}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/media`,{method:"POST",headers:graphHeaders(),body:form});
  if(!uploaded.ok)throw new Error(`Upload image refusé (${uploaded.status}): ${await uploaded.text()}`);
  const {id}=await uploaded.json();
  const sent=await fetch(`${graphBase()}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,{method:"POST",headers:{...graphHeaders(),"Content-Type":"application/json"},body:JSON.stringify({messaging_product:"whatsapp",to,type:"image",image:{id,caption}})});
  if(!sent.ok)throw new Error(`Envoi image refusé (${sent.status}): ${await sent.text()}`);
};

const aliases=()=>{const map=new Map([["ali","mohamed emran"]]);for(const item of String(process.env.WHATSAPP_EMPLOYEE_ALIASES||"").split(",")){const [alias,name]=item.split("=");if(alias&&name)map.set(normalize(alias),normalize(name))}return map};

const findEmployee=(db,text)=>{
  const employees=db.prepare("SELECT id,first_name AS first,last_name AS last,role FROM employees WHERE active=1 ORDER BY length(first_name||last_name) DESC").all();
  const normalized=normalize(text),aliasMap=aliases();
  for(const [alias,target] of aliasMap)if(new RegExp(`(^| )${alias}( |$)`).test(normalized)){const found=employees.find(employee=>normalize(`${employee.first} ${employee.last}`)===target);if(found)return found}
  const exact=employees.find(employee=>normalized.includes(normalize(`${employee.first} ${employee.last}`)));if(exact)return exact;
  const partial=employees.filter(employee=>normalized.split(" ").includes(normalize(employee.first))||normalized.split(" ").includes(normalize(employee.last)));
  return partial.length===1?partial[0]:null;
};

const resolveDate=(text,weekOffset=0)=>{
  const explicit=String(text).match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);if(explicit)return explicit[0];
  const french=String(text).match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);if(french)return `${french[3]}-${french[2].padStart(2,"0")}-${french[1].padStart(2,"0")}`;
  const normalized=normalize(text),entry=Object.entries(dayIndexes).find(([name])=>normalized.includes(name));if(!entry)return null;
  const today=parisToday(),week=mondayOf(today);let date=addDays(week,entry[1]+weekOffset*7);if(weekOffset===0&&date<today)date=addDays(date,7);return iso(date);
};

export const commandHelp=()=>[
  "Commandes des plannings BEEF HOUSE :",
  "• planning salle",
  "• planning salle semaine prochaine",
  "• planning cuisine",
  "• planning cuisine semaine prochaine",
  "• ajouter Mohamed Emran lundi matin 09h30 15h",
  "• ajouter Mohamed Emran lundi soir 18h fermeture",
  "• modifier Walid Belhaniche mardi soir 20h 00h30",
  "• supprimer Mohamed Emran mercredi matin",
  "Répondez CONFIRMER ou ANNULER après une modification."
].join("\n");

export const parseWhatsAppCommand=(db,input)=>{
  const text=normalize(input);
  if(["aide","help","commandes","menu"].includes(text))return {type:"help"};
  if(text==="confirmer"||text==="confirmation"||text==="oui")return {type:"confirm"};
  if(text==="annuler"||text==="annulation"||text==="non")return {type:"cancel"};
  if(text.includes("planning")&&(text.includes("cuisine")||text.includes("salle")))return {type:"planning",group:text.includes("cuisine")?"cuisine":"salle",weekStart:iso(addDays(mondayOf(parisToday()),text.includes("semaine prochaine")?7:0))};
  const operation=text.startsWith("supprimer ")?"delete":text.startsWith("ajouter ")||text.startsWith("modifier ")?"set":null;
  if(!operation)return {type:"help"};
  const employee=findEmployee(db,input);if(!employee)return {type:"error",message:"Employé introuvable. Écrivez son prénom et son nom complets."};
  const service=text.includes(" soir")?"soir":text.includes(" matin")?"matin":null;if(!service)return {type:"error",message:"Précisez le service : matin ou soir."};
  const weekOffset=text.includes("semaine prochaine")?1:0,workDate=resolveDate(input,weekOffset);if(!workDate)return {type:"error",message:"Précisez un jour (lundi…dimanche) ou une date AAAA-MM-JJ."};
  const group=String(employee.role).toLowerCase().includes("cuisine")?"cuisine":"salle";
  if(operation==="delete")return {type:"pending",action:"delete",group,employeeId:employee.id,employeeName:`${employee.first} ${employee.last}`,workDate,service};
  const rawTimes=[...String(input).matchAll(/\b(\d{1,2}(?:h|:)(?:\d{2})?|\d{1,2}h)\b/gi)].map(match=>parseTime(match[1])).filter(value=>value!==null);
  const closing=text.includes("fermeture");if(!rawTimes.length||(!closing&&rawTimes.length<2))return {type:"error",message:"Indiquez une heure de début et une heure de fin, ou « fermeture »."};
  const startMinutes=rawTimes[0],endMinutes=closing?1560:rawTimes[1];if(startMinutes<420||startMinutes>=1560||endMinutes<=startMinutes||endMinutes>1560)return {type:"error",message:"Horaires invalides. Utilisez des demi-heures entre 07h et 02h."};
  return {type:"pending",action:"set",group,employeeId:employee.id,employeeName:`${employee.first} ${employee.last}`,workDate,service,startMinutes,endMinutes,closing};
};

export const description=action=>action.action==="delete"?`SUPPRIMER ${action.employeeName}\n${action.workDate} · ${action.service}`:`ENREGISTRER ${action.employeeName}\n${action.workDate} · ${action.service}\n${timeLabel(action.startMinutes)} — ${action.closing?"FERMETURE":timeLabel(action.endMinutes)}`;

export const applyAction=(db,phone,action)=>{
  const createdBy=db.prepare("SELECT id FROM admins WHERE role='superadmin' ORDER BY id LIMIT 1").get()?.id||null;
  db.exec("BEGIN");try{
    db.prepare("DELETE FROM schedule_blocks WHERE employee_id=? AND work_date=? AND service=?").run(action.employeeId,action.workDate,action.service);
    db.prepare("DELETE FROM schedule_closings WHERE employee_id=? AND work_date=? AND service=?").run(action.employeeId,action.workDate,action.service);
    if(action.action==="set"){
      const insert=db.prepare("INSERT INTO schedule_blocks(employee_id,work_date,start_minutes,service,created_by) VALUES(?,?,?,?,?) ON CONFLICT(employee_id,work_date,start_minutes) DO UPDATE SET service=excluded.service,created_by=excluded.created_by");
      for(let minutes=action.startMinutes;minutes<action.endMinutes;minutes+=30)insert.run(action.employeeId,action.workDate,minutes,action.service,createdBy);
      if(action.closing)db.prepare("INSERT INTO schedule_closings(employee_id,work_date,service,created_by) VALUES(?,?,?,?)").run(action.employeeId,action.workDate,action.service,createdBy);
    }
    db.prepare("INSERT INTO whatsapp_audit_log(phone_number,action,employee_id,work_date,service,details) VALUES(?,?,?,?,?,?)").run(phone,action.action,action.employeeId,action.workDate,action.service,JSON.stringify(action));
    db.prepare("DELETE FROM whatsapp_pending_actions WHERE phone_number=?").run(phone);db.exec("COMMIT");
  }catch(error){db.exec("ROLLBACK");throw error}
};

const scheduleRows=(db,weekStart,group)=>{
  const weekEnd=iso(addDays(new Date(`${weekStart}T12:00:00Z`),6));
  const employees=db.prepare(`SELECT id,first_name AS first,last_name AS last FROM employees WHERE active=1 AND ${group==="cuisine"?"lower(role) LIKE '%cuisine%'":"lower(role) NOT LIKE '%cuisine%'"} ORDER BY first_name,last_name`).all();
  const blocks=db.prepare("SELECT employee_id AS employeeId,work_date AS workDate,start_minutes AS startMinutes,service FROM schedule_blocks WHERE work_date BETWEEN ? AND ? ORDER BY start_minutes").all(weekStart,weekEnd);
  const closings=new Set(db.prepare("SELECT employee_id||':'||work_date||':'||service AS value FROM schedule_closings WHERE work_date BETWEEN ? AND ?").all(weekStart,weekEnd).map(row=>row.value));
  return {employees,blocks,closings};
};

export const renderPlanningPng=async(db,weekStart,group="cuisine")=>{
  const {employees,blocks,closings}=scheduleRows(db,weekStart,group),days=Array.from({length:7},(_,index)=>iso(addDays(new Date(`${weekStart}T12:00:00Z`),index))),groupLabel=group==="cuisine"?"CUISINE":"SALLE";
  const isSalle=group==="salle",width=isSalle?2800:1800,nameWidth=isSalle?330:250,columnWidth=(width-nameWidth)/14,rowHeight=isSalle?78:64,headerHeight=isSalle?125:105,height=headerHeight+rowHeight*(employees.length+1)+90;
  const cell=(employeeId,date,service)=>{const items=blocks.filter(block=>block.employeeId===employeeId&&block.workDate===date&&block.service===service);if(!items.length)return "";const start=Math.min(...items.map(item=>item.startMinutes)),end=Math.max(...items.map(item=>item.startMinutes))+30;return `${timeLabel(start)} - ${closings.has(`${employeeId}:${date}:${service}`)?"FERMETURE":timeLabel(end)}`};
  const titleSize=isSalle?34:27,daySize=isSalle?21:16,shiftSize=isSalle?16:12,nameSize=isSalle?20:15,timeSize=isSalle?18:13;
  const lines=[];lines.push(`<rect width="${width}" height="${height}" fill="#fff"/>`,`<text x="${width/2}" y="42" text-anchor="middle" font-size="${titleSize}" font-weight="800" fill="#a71922">PLANNING ${groupLabel} · SEMAINE DU ${weekStart.split("-").reverse().join("/")} AU ${days[6].split("-").reverse().join("/")}</text>`);
  lines.push(`<rect x="0" y="55" width="${width}" height="${headerHeight-55}" fill="#333"/>`,`<text x="14" y="${isSalle?98:86}" font-size="${isSalle?22:17}" font-weight="700" fill="#fff">EMPLOYÉ</text>`);
  days.forEach((date,index)=>{const x=nameWidth+index*columnWidth*2;lines.push(`<text x="${x+columnWidth}" y="${isSalle?88:78}" text-anchor="middle" font-size="${daySize}" font-weight="700" fill="#fff">${dayNames[index]}</text>`,`<text x="${x+columnWidth/2}" y="${isSalle?116:99}" text-anchor="middle" font-size="${shiftSize}" fill="#eee">Matin</text>`,`<text x="${x+columnWidth*1.5}" y="${isSalle?116:99}" text-anchor="middle" font-size="${shiftSize}" fill="#eee">Soir</text>`)});
  employees.forEach((employee,row)=>{const y=headerHeight+row*rowHeight,fill=row%2?"#f7f7f7":"#fff",textY=y+Math.round(rowHeight/2)+7;lines.push(`<rect x="0" y="${y}" width="${width}" height="${rowHeight}" fill="${fill}"/>`,`<text x="14" y="${textY}" font-size="${nameSize}" font-weight="700" fill="#222">${escapeXml(`${employee.first} ${employee.last}`)}</text>`);days.forEach((date,day)=>["matin","soir"].forEach((service,shift)=>{const x=nameWidth+(day*2+shift)*columnWidth,value=cell(employee.id,date,service);if(value)lines.push(`<rect x="${x+3}" y="${y+6}" width="${columnWidth-6}" height="${rowHeight-12}" rx="6" fill="${service==="matin"?"#f1d56e":"#d7e6f7"}"/>`,`<text x="${x+columnWidth/2}" y="${textY}" text-anchor="middle" font-size="${timeSize}" font-weight="700" fill="#222">${escapeXml(value)}</text>`)}))});
  for(let column=0;column<=14;column++){const x=column===0?0:nameWidth+(column-1)*columnWidth;lines.push(`<line x1="${x}" y1="55" x2="${x}" y2="${headerHeight+employees.length*rowHeight}" stroke="#555" stroke-width="1"/>`)}for(let row=0;row<=employees.length;row++){const y=headerHeight+row*rowHeight;lines.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="#999"/>`)}
  lines.push(`<text x="12" y="${height-32}" font-size="13" fill="#777">BEEF HOUSE · Généré automatiquement depuis le planning officiel</text>`);
  const svg=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><style>text{font-family:Arial,sans-serif}</style>${lines.join("")}</svg>`);return sharp(svg).png().toBuffer();
};

export const renderKitchenPlanningPng=(db,weekStart)=>renderPlanningPng(db,weekStart,"cuisine");

const mainMenu=phone=>sendButtons(phone,"Que souhaitez-vous consulter ?",[
  {id:"planning_salle",title:"Planning Salle"},
  {id:"planning_cuisine",title:"Planning Cuisine"},
  {id:"show_help",title:"Commandes"}
]);

const handleMessage=async(db,phone,text)=>{
  if(!configuredAdmins().has(phone)){await sendText(phone,"Ce numéro n’est pas autorisé à gérer le planning BEEF HOUSE.");return}
  db.prepare("DELETE FROM whatsapp_pending_actions WHERE expires_at<=?").run(new Date().toISOString());
  const command=parseWhatsAppCommand(db,text);
  if(command.type==="help"){await sendText(phone,commandHelp());await mainMenu(phone);return}
  if(command.type==="error"){await sendText(phone,command.message);return}
  if(command.type==="cancel"){db.prepare("DELETE FROM whatsapp_pending_actions WHERE phone_number=?").run(phone);await sendText(phone,"Modification annulée.");return}
  if(command.type==="confirm"){
    const pending=db.prepare("SELECT payload FROM whatsapp_pending_actions WHERE phone_number=? AND expires_at>?").get(phone,new Date().toISOString());if(!pending){await sendText(phone,"Aucune modification en attente. Envoyez « aide » pour voir les commandes.");return}
    const action=JSON.parse(pending.payload);applyAction(db,phone,action);await sendText(phone,`✅ Planning ${action.group==="cuisine"?"Cuisine":"Salle"} mis à jour.\n\n${description(action)}`);await mainMenu(phone);return;
  }
  if(command.type==="planning"){const label=command.group==="cuisine"?"Cuisine":"Salle",png=await renderPlanningPng(db,command.weekStart,command.group);await sendImage(phone,png,`Planning ${label} · semaine du ${command.weekStart.split("-").reverse().join("/")}`,`planning-${command.group}.png`);await mainMenu(phone);return}
  const expires=new Date(Date.now()+10*60*1000).toISOString();db.prepare("INSERT INTO whatsapp_pending_actions(phone_number,action,payload,expires_at) VALUES(?,?,?,?) ON CONFLICT(phone_number) DO UPDATE SET action=excluded.action,payload=excluded.payload,expires_at=excluded.expires_at,created_at=CURRENT_TIMESTAMP").run(phone,command.action,JSON.stringify(command),expires);
  await sendButtons(phone,`⚠️ Confirmez cette modification :\n\n${description(command)}\n\nValable pendant 10 minutes.`,[{id:"confirm_action",title:"Confirmer"},{id:"cancel_action",title:"Annuler"}]);
};

export const createWhatsAppHandler=({db,json})=>async(req,res,url)=>{
  if(req.method==="GET"){
    const valid=url.searchParams.get("hub.mode")==="subscribe"&&url.searchParams.get("hub.verify_token")===process.env.WHATSAPP_VERIFY_TOKEN;
    if(!valid)return json(res,403,{success:false,message:"Vérification WhatsApp refusée"});res.writeHead(200,{"Content-Type":"text/plain"});res.end(url.searchParams.get("hub.challenge")||"");return;
  }
  if(req.method!=="POST")return json(res,405,{success:false,message:"Méthode refusée"});
  const raw=await readRaw(req),secret=process.env.WHATSAPP_APP_SECRET,signature=String(req.headers["x-hub-signature-256"]||"");
  if(secret){const expected=`sha256=${createHmac("sha256",secret).update(raw).digest("hex")}`,given=Buffer.from(signature),wanted=Buffer.from(expected);if(given.length!==wanted.length||!timingSafeEqual(given,wanted))return json(res,401,{success:false,message:"Signature webhook invalide"})}
  let payload;try{payload=JSON.parse(raw.toString("utf8"))}catch{return json(res,400,{success:false,message:"JSON invalide"})}
  const messages=(payload.entry||[]).flatMap(entry=>(entry.changes||[]).flatMap(change=>change.value?.messages||[]));json(res,200,{success:true});
  const buttonCommands={planning_salle:"planning salle",planning_cuisine:"planning cuisine",show_help:"aide",confirm_action:"confirmer",cancel_action:"annuler"};
  for(const message of messages){const phone=digits(message.from),buttonId=message.interactive?.button_reply?.id||message.interactive?.list_reply?.id,text=message.type==="text"?message.text?.body:buttonCommands[buttonId];if(!text)continue;handleMessage(db,phone,text).catch(error=>{console.error("Erreur bot WhatsApp:",error);sendText(phone,"Une erreur est survenue. Réessayez ou contactez l’administrateur.").catch(console.error)})}
};
