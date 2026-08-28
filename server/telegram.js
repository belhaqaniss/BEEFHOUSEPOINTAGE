import { applyAction, batchDescription, commandHelp, parseBotCommand, renderPlanningPng } from "./whatsapp.js";
import { buildDailyDetailsPdf, buildDailyHoursPdf, previousParisDate } from "./reports.js";

const apiUrl=method=>`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;
const admins=()=>new Set(String(process.env.TELEGRAM_ADMIN_IDS||"").split(",").map(value=>value.trim()).filter(Boolean));

const telegramCall=async(method,payload)=>{
  const response=await fetch(apiUrl(method),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
  const result=await response.json();
  if(!response.ok||!result.ok)throw new Error(`Telegram ${method} refusé: ${result.description||response.status}`);
  return result.result;
};

const nextWeekLabel=()=>{
  const todayParts=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const part=type=>todayParts.find(item=>item.type===type)?.value;
  const today=new Date(`${part("year")}-${part("month")}-${part("day")}T12:00:00Z`);
  const monday=new Date(today);monday.setUTCDate(monday.getUTCDate()-((monday.getUTCDay()+6)%7)+7);
  const sunday=new Date(monday);sunday.setUTCDate(sunday.getUTCDate()+6);
  const label=date=>`${String(date.getUTCDate()).padStart(2,"0")}/${String(date.getUTCMonth()+1).padStart(2,"0")}`;
  return `${label(monday)}–${label(sunday)}`;
};

const menu=()=>({inline_keyboard:[
  [{text:"📋 Planning Salle",callback_data:"planning_salle"},{text:"👨‍🍳 Planning Cuisine",callback_data:"planning_cuisine"}],
  [{text:`🗓 Salle semaine prochaine · ${nextWeekLabel()}`,callback_data:"planning_salle_next"}],
  [{text:`🗓 Cuisine semaine prochaine · ${nextWeekLabel()}`,callback_data:"planning_cuisine_next"}],
  [{text:"📄 Détail journalier (hier)",callback_data:"daily_details_yesterday"},{text:"⏱ Heures employés (hier)",callback_data:"hours_yesterday"}],
  [{text:"❓ Aide",callback_data:"show_help"}]
]});

const sendText=(chatId,text,replyMarkup)=>telegramCall("sendMessage",{chat_id:chatId,text,reply_markup:replyMarkup});

const sendPhoto=async(chatId,png,caption,replyMarkup)=>{
  const form=new FormData();
  form.set("chat_id",String(chatId));
  form.set("caption",caption);
  if(replyMarkup)form.set("reply_markup",JSON.stringify(replyMarkup));
  form.set("photo",new Blob([png],{type:"image/png"}),"planning.png");
  const response=await fetch(apiUrl("sendPhoto"),{method:"POST",body:form});
  const result=await response.json();
  if(!response.ok||!result.ok)throw new Error(`Telegram sendPhoto refusé: ${result.description||response.status}`);
};

const sendDocument=async(chatId,document,filename,caption,replyMarkup)=>{
  const form=new FormData();form.set("chat_id",String(chatId));form.set("caption",caption);form.set("document",new Blob([document],{type:"application/pdf"}),filename);if(replyMarkup)form.set("reply_markup",JSON.stringify(replyMarkup));
  const response=await fetch(apiUrl("sendDocument"),{method:"POST",body:form}),result=await response.json();
  if(!response.ok||!result.ok)throw new Error(`Telegram sendDocument refusé: ${result.description||response.status}`);
};

const handleCommand=async(db,chatId,input)=>{
  const owner=`telegram:${chatId}`;
  if(!admins().has(String(chatId))){
    await sendText(chatId,`Accès non autorisé. Votre identifiant Telegram est ${chatId}. Ajoutez-le à TELEGRAM_ADMIN_IDS sur le serveur.`);
    return;
  }
  db.prepare("DELETE FROM whatsapp_pending_actions WHERE expires_at<=?").run(new Date().toISOString());
  const reportDate=previousParisDate();
  if(input==="daily_details_yesterday"){
    const detail=db.prepare("SELECT work_date AS workDate,cashier_morning AS cashierMorning,cashier_evening AS cashierEvening,fdc_morning AS fdcMorning,fdc_evening AS fdcEvening,fdc_final AS fdcFinal,cb_amount AS cbAmount,cash_amount AS cashAmount,total_amount AS totalAmount FROM daily_details WHERE work_date=? ORDER BY id DESC LIMIT 1").get(reportDate);
    if(!detail)return sendText(chatId,`Aucun détail journalier enregistré pour le ${reportDate.split("-").reverse().join("/")}.`,menu());
    const entries=db.prepare("SELECT kind,label,amount_cents/100.0 AS amount,note FROM financial_entries WHERE entry_date=? AND source_detail=1 ORDER BY kind,id").all(reportDate),pdf=buildDailyDetailsPdf(detail,entries);
    return sendDocument(chatId,pdf,`detail-journalier-${reportDate}.pdf`,`Détail journalier du ${reportDate.split("-").reverse().join("/")}`,menu());
  }
  if(input==="hours_yesterday"){
    const people=db.prepare("SELECT first_name AS first,last_name AS last,role FROM employees WHERE active=1 ORDER BY first_name,last_name").all(),records=db.prepare("SELECT e.first_name||' '||e.last_name AS name,a.type,a.timestamp,a.work_date AS workDate,(SELECT MIN(sb.start_minutes) FROM schedule_blocks sb WHERE sb.employee_id=a.employee_id AND sb.work_date=a.work_date AND sb.service='matin') AS scheduledMorningStartMinutes,(SELECT MIN(sb.start_minutes) FROM schedule_blocks sb WHERE sb.employee_id=a.employee_id AND sb.work_date=a.work_date AND sb.service='soir') AS scheduledEveningStartMinutes FROM attendance a JOIN employees e ON e.id=a.employee_id WHERE a.work_date=? ORDER BY e.first_name,a.timestamp").all(reportDate),pdf=buildDailyHoursPdf(reportDate,people,records);
    return sendDocument(chatId,pdf,`heures-employes-${reportDate}.pdf`,`Heures des employés du ${reportDate.split("-").reverse().join("/")}`,menu());
  }
  const command=parseBotCommand(db,input);
  if(command.type==="help")return sendText(chatId,`${commandHelp()}\n\nVous pouvez aussi utiliser les boutons ci-dessous.`,menu());
  if(command.type==="error")return sendText(chatId,command.message,menu());
  if(command.type==="cancel"){
    db.prepare("DELETE FROM whatsapp_pending_actions WHERE phone_number=?").run(owner);
    return sendText(chatId,"Modification annulée.",menu());
  }
  if(command.type==="confirm"){
    const pending=db.prepare("SELECT payload FROM whatsapp_pending_actions WHERE phone_number=? AND expires_at>?").get(owner,new Date().toISOString());
    if(!pending)return sendText(chatId,"Aucune modification en attente.",menu());
    const saved=JSON.parse(pending.payload),actions=Array.isArray(saved)?saved:[saved];
    for(const action of actions)applyAction(db,owner,action);
    return sendText(chatId,`✅ ${actions.length} service${actions.length>1?"s":""} enregistré${actions.length>1?"s":""}.\n\n${batchDescription(actions)}`,menu());
  }
  if(command.type==="planning"){
    const label=command.group==="cuisine"?"Cuisine":"Salle";
    const png=await renderPlanningPng(db,command.weekStart,command.group);
    return sendPhoto(chatId,png,`Planning ${label} · semaine du ${command.weekStart.split("-").reverse().join("/")}`,menu());
  }
  const actions=command.type==="pending_batch"?command.actions:[command],expires=new Date(Date.now()+10*60*1000).toISOString();
  db.prepare("INSERT INTO whatsapp_pending_actions(phone_number,action,payload,expires_at) VALUES(?,?,?,?) ON CONFLICT(phone_number) DO UPDATE SET action=excluded.action,payload=excluded.payload,expires_at=excluded.expires_at,created_at=CURRENT_TIMESTAMP").run(owner,actions.length>1?"batch":actions[0].action,JSON.stringify(actions.length>1?actions:actions[0]),expires);
  return sendText(chatId,`⚠️ Confirmez ${actions.length>1?`ces ${actions.length} modifications`:"cette modification"} :\n\n${batchDescription(actions)}`,{inline_keyboard:[[{text:"✅ Confirmer",callback_data:"confirm_action"},{text:"❌ Annuler",callback_data:"cancel_action"}]]});
};

export const createTelegramHandler=({db,json})=>async(req,res)=>{
  if(req.method!=="POST")return json(res,405,{success:false,message:"Méthode refusée"});
  const expected=String(process.env.TELEGRAM_WEBHOOK_SECRET||"");
  if(expected&&req.headers["x-telegram-bot-api-secret-token"]!==expected)return json(res,401,{success:false,message:"Secret Telegram invalide"});
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  let update;try{update=JSON.parse(Buffer.concat(chunks).toString("utf8"))}catch{return json(res,400,{success:false,message:"JSON invalide"})}
  json(res,200,{success:true});
  const callback=update.callback_query;
  const message=update.message;
  const chatId=callback?.message?.chat?.id??message?.chat?.id;
  if(!chatId)return;
  const commands={planning_salle:"planning salle",planning_cuisine:"planning cuisine",planning_salle_next:"planning salle semaine prochaine",planning_cuisine_next:"planning cuisine semaine prochaine",daily_details_yesterday:"daily_details_yesterday",hours_yesterday:"hours_yesterday",show_help:"aide",confirm_action:"confirmer",cancel_action:"annuler"};
  if(callback?.id)telegramCall("answerCallbackQuery",{callback_query_id:callback.id}).catch(console.error);
  const text=commands[callback?.data]||message?.text;
  if(!text)return;
  handleCommand(db,chatId,text.replace(/^\/start(?:@\w+)?$/i,"aide")).catch(error=>{console.error("Erreur bot Telegram:",error);sendText(chatId,"Une erreur est survenue. Réessayez ou contactez l’administrateur.").catch(console.error)});
};
