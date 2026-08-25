import { applyAction, commandHelp, description, parseWhatsAppCommand, renderPlanningPng } from "./whatsapp.js";

const apiUrl=method=>`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;
const admins=()=>new Set(String(process.env.TELEGRAM_ADMIN_IDS||"").split(",").map(value=>value.trim()).filter(Boolean));

const telegramCall=async(method,payload)=>{
  const response=await fetch(apiUrl(method),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
  const result=await response.json();
  if(!response.ok||!result.ok)throw new Error(`Telegram ${method} refusé: ${result.description||response.status}`);
  return result.result;
};

const menu={inline_keyboard:[
  [{text:"📋 Planning Salle",callback_data:"planning_salle"},{text:"👨‍🍳 Planning Cuisine",callback_data:"planning_cuisine"}],
  [{text:"🗓 Salle semaine prochaine",callback_data:"planning_salle_next"}],
  [{text:"🗓 Cuisine semaine prochaine",callback_data:"planning_cuisine_next"}],
  [{text:"❓ Aide",callback_data:"show_help"}]
]};

const sendText=(chatId,text,replyMarkup)=>telegramCall("sendMessage",{chat_id:chatId,text,reply_markup:replyMarkup});

const sendPhoto=async(chatId,png,caption)=>{
  const form=new FormData();
  form.set("chat_id",String(chatId));
  form.set("caption",caption);
  form.set("photo",new Blob([png],{type:"image/png"}),"planning.png");
  const response=await fetch(apiUrl("sendPhoto"),{method:"POST",body:form});
  const result=await response.json();
  if(!response.ok||!result.ok)throw new Error(`Telegram sendPhoto refusé: ${result.description||response.status}`);
};

const handleCommand=async(db,chatId,input)=>{
  const owner=`telegram:${chatId}`;
  if(!admins().has(String(chatId))){
    await sendText(chatId,`Accès non autorisé. Votre identifiant Telegram est ${chatId}. Ajoutez-le à TELEGRAM_ADMIN_IDS sur le serveur.`);
    return;
  }
  db.prepare("DELETE FROM whatsapp_pending_actions WHERE expires_at<=?").run(new Date().toISOString());
  const command=parseWhatsAppCommand(db,input);
  if(command.type==="help")return sendText(chatId,`${commandHelp()}\n\nVous pouvez aussi utiliser les boutons ci-dessous.`,menu);
  if(command.type==="error")return sendText(chatId,command.message,menu);
  if(command.type==="cancel"){
    db.prepare("DELETE FROM whatsapp_pending_actions WHERE phone_number=?").run(owner);
    return sendText(chatId,"Modification annulée.",menu);
  }
  if(command.type==="confirm"){
    const pending=db.prepare("SELECT payload FROM whatsapp_pending_actions WHERE phone_number=? AND expires_at>?").get(owner,new Date().toISOString());
    if(!pending)return sendText(chatId,"Aucune modification en attente.",menu);
    const action=JSON.parse(pending.payload);
    applyAction(db,owner,action);
    return sendText(chatId,`✅ Planning ${action.group==="cuisine"?"Cuisine":"Salle"} mis à jour.\n\n${description(action)}`,menu);
  }
  if(command.type==="planning"){
    const label=command.group==="cuisine"?"Cuisine":"Salle";
    const png=await renderPlanningPng(db,command.weekStart,command.group);
    await sendPhoto(chatId,png,`Planning ${label} · semaine du ${command.weekStart.split("-").reverse().join("/")}`);
    return sendText(chatId,"Que souhaitez-vous faire ?",menu);
  }
  const expires=new Date(Date.now()+10*60*1000).toISOString();
  db.prepare("INSERT INTO whatsapp_pending_actions(phone_number,action,payload,expires_at) VALUES(?,?,?,?) ON CONFLICT(phone_number) DO UPDATE SET action=excluded.action,payload=excluded.payload,expires_at=excluded.expires_at,created_at=CURRENT_TIMESTAMP").run(owner,command.action,JSON.stringify(command),expires);
  return sendText(chatId,`⚠️ Confirmez cette modification :\n\n${description(command)}`,{inline_keyboard:[[{text:"✅ Confirmer",callback_data:"confirm_action"},{text:"❌ Annuler",callback_data:"cancel_action"}]]});
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
  const commands={planning_salle:"planning salle",planning_cuisine:"planning cuisine",planning_salle_next:"planning salle semaine prochaine",planning_cuisine_next:"planning cuisine semaine prochaine",show_help:"aide",confirm_action:"confirmer",cancel_action:"annuler"};
  if(callback?.id)telegramCall("answerCallbackQuery",{callback_query_id:callback.id}).catch(console.error);
  const text=commands[callback?.data]||message?.text;
  if(!text)return;
  handleCommand(db,chatId,text.replace(/^\/start(?:@\w+)?$/i,"aide")).catch(error=>{console.error("Erreur bot Telegram:",error);sendText(chatId,"Une erreur est survenue. Réessayez ou contactez l’administrateur.").catch(console.error)});
};
