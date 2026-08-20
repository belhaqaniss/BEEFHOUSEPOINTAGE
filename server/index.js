import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const dataDir = join(root, "data");
mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(join(dataDir, "presence.sqlite"));
db.exec(readFileSync(join(root, "schema.sql"), "utf8"));
const adminColumns = db.prepare("PRAGMA table_info(admins)").all();
if (!adminColumns.some(column => column.name === "role")) {
  db.exec("ALTER TABLE admins ADD COLUMN role TEXT NOT NULL DEFAULT 'admin'");
}
const detailColumns = db.prepare("PRAGMA table_info(daily_details)").all();
for (const [name, definition] of [
  ["fdc_final", "TEXT NOT NULL DEFAULT ''"], ["cb_amount", "TEXT NOT NULL DEFAULT ''"],
  ["cash_amount", "TEXT NOT NULL DEFAULT ''"], ["total_amount", "TEXT NOT NULL DEFAULT ''"],
  ["created_by", "INTEGER REFERENCES admins(id)"]
]) if (!detailColumns.some(column => column.name === name)) db.exec(`ALTER TABLE daily_details ADD COLUMN ${name} ${definition}`);
const financialColumns=db.prepare("PRAGMA table_info(financial_entries)").all();
if(!financialColumns.some(column=>column.name==="source_detail"))db.exec("ALTER TABLE financial_entries ADD COLUMN source_detail INTEGER NOT NULL DEFAULT 0");

const hashPassword = (password, salt) => scryptSync(password, salt, 64).toString("hex");
const seedAdminAccount = (username, password, role) => {
  const existing = db.prepare("SELECT id FROM admins WHERE username = ?").get(username);
  if (existing) { db.prepare("UPDATE admins SET role=? WHERE id=?").run(role, existing.id); return; }
  const salt = randomBytes(16).toString("hex");
  db.prepare("INSERT INTO admins(username,password_hash,password_salt,role) VALUES(?,?,?,?)").run(username, hashPassword(password, salt), salt, role);
};
const seedEmployees = () => {
  const insert = db.prepare("INSERT OR IGNORE INTO employees(first_name,last_name,role,color) VALUES(?,?,?,?)");
  [["Amélie","Martin","Accueil","coral"],["Amine","Bensaïd","Caisse","purple"],["Ambre","Dupont","Service","blue"],["Camille","Robert","Caisse","green"],["Lucas","Bernard","Service","amber"],["Sarah","Petit","Accueil","pink"],["Aniss","Belhaq","Salle","blue"]].forEach(row => insert.run(...row));
};
seedAdminAccount("admin", "admin", "admin");
seedAdminAccount("superadmin", "superadmin", "superadmin");
seedEmployees();

const json = (res, status, body) => { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" }); res.end(JSON.stringify(body)); };
const body = async req => { const chunks=[]; let size=0; for await (const chunk of req){size+=chunk.length;if(size>3_000_000)throw new Error("Requête trop volumineuse");chunks.push(chunk);} return chunks.length?JSON.parse(Buffer.concat(chunks).toString("utf8")):{}; };
const adminFromRequest = req => {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  return db.prepare("SELECT admins.id,admins.username,admins.role FROM sessions JOIN admins ON admins.id=sessions.admin_id WHERE token=? AND expires_at>?").get(token, new Date().toISOString());
};
const requireAdmin = req => { const admin=adminFromRequest(req); if(!admin) throw Object.assign(new Error("Session administrateur requise"),{status:401}); return admin; };
const requireSuperAdmin = req => { const admin=requireAdmin(req); if(admin.role!=="superadmin") throw Object.assign(new Error("Accès super administrateur requis"),{status:403}); return admin; };
const requireOperationalAdmin = req => { const admin=requireAdmin(req); if(admin.role!=="admin") throw Object.assign(new Error("Le Super Admin ne peut pas effectuer les opérations de pointage"),{status:403}); return admin; };
const employees = () => db.prepare("SELECT id,first_name AS first,last_name AS last,role,color FROM employees WHERE active=1 ORDER BY first_name,last_name").all();

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") return json(res, 204, {});
  const url = new URL(req.url, "http://server.internal");
  if (url.pathname === "/api/health") return json(res, 200, { success:true, database:"sqlite" });
  if (url.pathname !== "/api" && url.pathname !== "/") return json(res, 404, { success:false, message:"Route introuvable" });
  try {
    if (req.method === "GET" && (url.searchParams.get("action") || "employees") === "employees") return json(res, 200, employees());
    if (req.method !== "POST") return json(res, 405, { success:false, message:"Méthode refusée" });
    const data = await body(req);
    if (data.action === "login") {
      const admin=db.prepare("SELECT * FROM admins WHERE username=?").get(String(data.username||""));
      if(!admin) throw Object.assign(new Error("Identifiants incorrects"),{status:401});
      const given=Buffer.from(hashPassword(String(data.password||""),admin.password_salt),"hex"),expected=Buffer.from(admin.password_hash,"hex");
      if(given.length!==expected.length||!timingSafeEqual(given,expected)) throw Object.assign(new Error("Identifiants incorrects"),{status:401});
      const token=randomBytes(32).toString("hex"),expires=new Date(Date.now()+8*60*60*1000).toISOString();
      db.prepare("DELETE FROM sessions WHERE expires_at<=?").run(new Date().toISOString());
      db.prepare("INSERT INTO sessions(token,admin_id,expires_at) VALUES(?,?,?)").run(token,admin.id,expires);
      return json(res,200,{success:true,token,expiresAt:expires,username:admin.username,role:admin.role});
    }
    if (data.action === "logout") { const token=String(req.headers.authorization||"").replace(/^Bearer\s+/i,""); if(token)db.prepare("DELETE FROM sessions WHERE token=?").run(token); return json(res,200,{success:true}); }
    if (data.action === "addEmployee") { requireAdmin(req); const first=String(data.first||"").trim(),last=String(data.last||"").trim(),role=String(data.role||"").trim();if(!first||!last||!role)throw new Error("Prénom, nom et poste obligatoires");db.prepare("INSERT INTO employees(first_name,last_name,role,color) VALUES(?,?,?,?) ON CONFLICT(first_name,last_name) DO UPDATE SET role=excluded.role,color=excluded.color,active=1").run(first,last,role,String(data.color||"blue")); return json(res,200,{success:true,employees:employees()}); }
    if (data.action === "deleteEmployee") { requireOperationalAdmin(req); db.prepare("UPDATE employees SET active=0 WHERE lower(first_name)=lower(?) AND lower(last_name)=lower(?)").run(String(data.first),String(data.last)); return json(res,200,{success:true,employees:employees()}); }
    if (data.action === "pointage") {
      requireOperationalAdmin(req);
      const employee=db.prepare("SELECT id FROM employees WHERE active=1 AND lower(first_name||' '||last_name)=lower(?)").get(String(data.name));
      if(!employee) throw Object.assign(new Error("Employé introuvable"),{status:404});
      const lastEvent=db.prepare("SELECT type FROM attendance WHERE employee_id=? ORDER BY timestamp DESC,id DESC LIMIT 1").get(employee.id);
      if(String(data.mode)==="Arrivée"&&lastEvent?.type==="Arrivée") throw Object.assign(new Error("Cette personne a déjà pointé son arrivée. Enregistrez d’abord son départ."),{status:409});
      if(String(data.mode)==="Départ"&&lastEvent?.type!=="Arrivée") throw Object.assign(new Error("Aucune arrivée ouverte pour cette personne."),{status:409});
      db.prepare("INSERT INTO attendance(employee_id,type,timestamp,work_date,signature) VALUES(?,?,?,?,?)").run(employee.id,String(data.mode),String(data.date),String(data.workDate),String(data.signature||""));
      return json(res,200,{success:true});
    }
    if (data.action === "details") {
      const current=requireOperationalAdmin(req),workDate=String(data.workDate||String(data.date).slice(0,10));
      const entries=Array.isArray(data.entries)?data.entries:[];
      db.exec("BEGIN");
      try {
        db.prepare("INSERT INTO daily_details(work_date,cashier_morning,cashier_evening,fdc_morning,fdc_evening,fdc_final,cb_amount,cash_amount,total_amount,created_by) VALUES(?,?,?,?,?,?,?,?,?,?)").run(workDate,String(data.cashierMorning||""),String(data.cashierEvening||""),String(data.fdcMorning||""),String(data.fdcEvening||""),String(data.fdcFinal||""),String(data.cbAmount||""),String(data.cashAmount||""),String(data.totalAmount||""),current.id);
        db.prepare("DELETE FROM financial_entries WHERE entry_date=? AND source_detail=1").run(workDate);
        const insert=db.prepare("INSERT INTO financial_entries(entry_date,kind,label,amount_cents,note,source_detail,created_by) VALUES(?,?,?,?,?,1,?)");
        for(const entry of entries){const label=String(entry.label||"").trim(),amount=Number(entry.amount),kind=entry.kind==="offert"?"offert":"depense";if(label&&Number.isFinite(amount)&&amount>=0)insert.run(workDate,kind,label,Math.round(amount*100),String(entry.note||"").trim(),current.id);}
        db.exec("COMMIT");
      } catch(error){db.exec("ROLLBACK");throw error;}
      return json(res,200,{success:true});
    }
    if (data.action === "dailyDetails") {
      requireAdmin(req);const workDate=String(data.workDate||"");
      const detail=db.prepare("SELECT id,work_date AS workDate,cashier_morning AS cashierMorning,cashier_evening AS cashierEvening,fdc_morning AS fdcMorning,fdc_evening AS fdcEvening,fdc_final AS fdcFinal,cb_amount AS cbAmount,cash_amount AS cashAmount,total_amount AS totalAmount,created_at AS createdAt FROM daily_details WHERE work_date=? ORDER BY id DESC LIMIT 1").get(workDate)||null;
      const entries=db.prepare("SELECT id,kind,label,amount_cents/100.0 AS amount,note FROM financial_entries WHERE entry_date=? AND source_detail=1 ORDER BY kind,id").all(workDate);
      return json(res,200,{success:true,detail,entries});
    }
    if (data.action === "report") { requireOperationalAdmin(req); const rows=db.prepare("SELECT a.id,e.first_name||' '||e.last_name AS name,a.type,a.timestamp,a.work_date AS workDate,(SELECT MIN(sb.start_minutes) FROM schedule_blocks sb WHERE sb.employee_id=a.employee_id AND sb.work_date=a.work_date) AS scheduledStartMinutes FROM attendance a JOIN employees e ON e.id=a.employee_id WHERE a.work_date=? ORDER BY e.first_name,a.timestamp").all(String(data.workDate)); return json(res,200,{success:true,records:rows}); }
    if (data.action === "exportAttendance") { requireAdmin(req); const rows=db.prepare("SELECT e.first_name||' '||e.last_name AS name,a.type,a.timestamp,a.work_date AS workDate,(SELECT MIN(sb.start_minutes) FROM schedule_blocks sb WHERE sb.employee_id=a.employee_id AND sb.work_date=a.work_date) AS scheduledStartMinutes FROM attendance a JOIN employees e ON e.id=a.employee_id WHERE a.work_date=? ORDER BY e.first_name,a.timestamp").all(String(data.workDate)); return json(res,200,{success:true,records:rows}); }
    if (data.action === "monthlyHours") {
      requireSuperAdmin(req);
      const month=String(data.month||"");
      if(!/^\d{4}-\d{2}$/.test(month)) throw new Error("Mois invalide");
      const staff=db.prepare("SELECT id,first_name AS first,last_name AS last,role,color FROM employees WHERE active=1 ORDER BY first_name,last_name").all();
      const events=db.prepare("SELECT a.employee_id AS employeeId,a.type,a.timestamp,a.work_date AS workDate,(SELECT MIN(sb.start_minutes) FROM schedule_blocks sb WHERE sb.employee_id=a.employee_id AND sb.work_date=a.work_date) AS scheduledStartMinutes FROM attendance a WHERE substr(a.work_date,1,7)=? ORDER BY a.employee_id,a.work_date,a.timestamp,a.id").all(month);
      const employees=staff.map(employee=>{
        const own=events.filter(event=>event.employeeId===employee.id),openByDate=new Map(),firstArrivalByDate=new Set();let totalMs=0,shifts=0;
        for(const event of own){
          if(event.type==="Arrivée"){
            let start=new Date(event.timestamp);
            if(!firstArrivalByDate.has(event.workDate)&&event.scheduledStartMinutes!==null){const planned=new Date(`${event.workDate}T00:00:00`);planned.setMinutes(Number(event.scheduledStartMinutes));if(start<planned)start=planned;}
            firstArrivalByDate.add(event.workDate);openByDate.set(event.workDate,start);
          } else {
            const start=openByDate.get(event.workDate),end=new Date(event.timestamp);
            if(start&&!Number.isNaN(end.getTime())){totalMs+=Math.max(0,end.getTime()-start.getTime());shifts++;openByDate.delete(event.workDate);}
          }
        }
        const totalMinutes=Math.round(totalMs/60000);
        return {...employee,totalMinutes,shifts,days:new Set(own.map(event=>event.workDate)).size};
      });
      return json(res,200,{success:true,month,employees,totalMinutes:employees.reduce((sum,employee)=>sum+employee.totalMinutes,0)});
    }
    if (data.action === "updateAttendance") {
      requireOperationalAdmin(req);
      const id=Number(data.id),timestamp=String(data.timestamp||""),parsed=new Date(timestamp);
      if(!Number.isInteger(id)||Number.isNaN(parsed.getTime())) throw new Error("Heure de pointage invalide");
      const result=db.prepare("UPDATE attendance SET timestamp=? WHERE id=?").run(parsed.toISOString(),id);
      if(!result.changes) throw Object.assign(new Error("Pointage introuvable"),{status:404});
      return json(res,200,{success:true});
    }
    if (data.action === "deleteAttendancePair") {
      requireOperationalAdmin(req);
      const ids=Array.isArray(data.ids)?data.ids.map(Number).filter(Number.isInteger):[];
      if(!ids.length||ids.length>2) throw new Error("Horaire invalide");
      const remove=db.prepare("DELETE FROM attendance WHERE id=?");
      db.exec("BEGIN");
      try { for(const id of ids)remove.run(id);db.exec("COMMIT"); }
      catch(error){db.exec("ROLLBACK");throw error;}
      return json(res,200,{success:true});
    }
    if (data.action === "superDashboard") {
      requireSuperAdmin(req);
      const today=String(data.workDate||new Date().toISOString().slice(0,10));
      const stats={
        activeEmployees:db.prepare("SELECT COUNT(*) AS value FROM employees WHERE active=1").get().value,
        inactiveEmployees:db.prepare("SELECT COUNT(*) AS value FROM employees WHERE active=0").get().value,
        todayEvents:db.prepare("SELECT COUNT(*) AS value FROM attendance WHERE work_date=?").get(today).value,
        activeSessions:db.prepare("SELECT COUNT(*) AS value FROM sessions WHERE expires_at>?").get(new Date().toISOString()).value,
        administrators:db.prepare("SELECT COUNT(*) AS value FROM admins").get().value
      };
      const recent=db.prepare("SELECT e.first_name||' '||e.last_name AS name,a.type,a.timestamp,a.work_date AS workDate FROM attendance a JOIN employees e ON e.id=a.employee_id ORDER BY a.timestamp DESC LIMIT 12").all();
      const admins=db.prepare("SELECT id,username,role,created_at AS createdAt FROM admins ORDER BY role DESC,username").all();
      const allEmployees=db.prepare("SELECT id,first_name AS first,last_name AS last,role,color,active,created_at AS createdAt FROM employees ORDER BY active DESC,first_name,last_name").all();
      const month=today.slice(0,7);
      const financialTotals=db.prepare("SELECT kind,COALESCE(SUM(amount_cents),0) AS cents FROM financial_entries WHERE substr(entry_date,1,7)=? GROUP BY kind").all(month);
      const expenseCents=financialTotals.find(row=>row.kind==="depense")?.cents||0,offeredCents=financialTotals.find(row=>row.kind==="offert")?.cents||0;
      const financialDays=[];
      for(let offset=6;offset>=0;offset--){const date=new Date(`${today}T12:00:00`);date.setDate(date.getDate()-offset);const key=date.toISOString().slice(0,10);const totals=db.prepare("SELECT kind,COALESCE(SUM(amount_cents),0) AS cents FROM financial_entries WHERE entry_date=? GROUP BY kind").all(key);financialDays.push({date:key,depense:(totals.find(row=>row.kind==="depense")?.cents||0)/100,offert:(totals.find(row=>row.kind==="offert")?.cents||0)/100});}
      const financialRecent=db.prepare("SELECT f.id,f.entry_date AS date,f.kind,f.label,f.amount_cents/100.0 AS amount,f.note,a.username AS createdBy FROM financial_entries f LEFT JOIN admins a ON a.id=f.created_by ORDER BY f.entry_date DESC,f.id DESC LIMIT 10").all();
      return json(res,200,{success:true,stats,recent,admins,employees:allEmployees,financial:{month,expenseTotal:expenseCents/100,offeredTotal:offeredCents/100,days:financialDays,recent:financialRecent}});
    }
    if (data.action === "createAdmin") {
      requireSuperAdmin(req);
      const username=String(data.username||"").trim(),password=String(data.password||"");
      if(username.length<3||password.length<8) throw new Error("3 caractères minimum pour le nom et 8 pour le mot de passe");
      const salt=randomBytes(16).toString("hex");
      db.prepare("INSERT INTO admins(username,password_hash,password_salt,role) VALUES(?,?,?,?)").run(username,hashPassword(password,salt),salt,data.role==="superadmin"?"superadmin":"admin");
      return json(res,200,{success:true});
    }
    if (data.action === "deleteAdmin") {
      const current=requireSuperAdmin(req),target=Number(data.id);
      if(current.id===target) throw new Error("Vous ne pouvez pas supprimer votre propre compte");
      db.prepare("DELETE FROM admins WHERE id=?").run(target);
      return json(res,200,{success:true});
    }
    if (data.action === "addFinancialEntry") {
      const current=requireSuperAdmin(req),kind=data.kind==="offert"?"offert":"depense",label=String(data.label||"").trim(),amount=Number(data.amount),date=String(data.date||new Date().toISOString().slice(0,10));
      if(!label||!Number.isFinite(amount)||amount<=0) throw new Error("Libellé et montant positif obligatoires");
      db.prepare("INSERT INTO financial_entries(entry_date,kind,label,amount_cents,note,created_by) VALUES(?,?,?,?,?,?)").run(date,kind,label,Math.round(amount*100),String(data.note||"").trim(),current.id);
      return json(res,200,{success:true});
    }
    if (data.action === "deleteFinancialEntry") {
      requireSuperAdmin(req);
      db.prepare("DELETE FROM financial_entries WHERE id=?").run(Number(data.id));
      return json(res,200,{success:true});
    }
    if (data.action === "getSchedule") {
      requireSuperAdmin(req);
      const start=String(data.weekStart||""),endDate=new Date(`${start}T12:00:00`);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||Number.isNaN(endDate.getTime())) throw new Error("Semaine invalide");
      endDate.setDate(endDate.getDate()+6);const end=endDate.toISOString().slice(0,10);
      const blocks=db.prepare("SELECT employee_id AS employeeId,work_date AS workDate,start_minutes AS startMinutes FROM schedule_blocks WHERE work_date BETWEEN ? AND ? ORDER BY work_date,employee_id,start_minutes").all(start,end);
      return json(res,200,{success:true,blocks});
    }
    if (data.action === "toggleScheduleBlock") {
      const current=requireSuperAdmin(req),employeeId=Number(data.employeeId),workDate=String(data.workDate||""),startMinutes=Number(data.startMinutes);
      if(!Number.isInteger(employeeId)||!/^\d{4}-\d{2}-\d{2}$/.test(workDate)||!Number.isInteger(startMinutes)||startMinutes<420||startMinutes>=1560||startMinutes%30) throw new Error("Créneau invalide");
      const existing=db.prepare("SELECT id FROM schedule_blocks WHERE employee_id=? AND work_date=? AND start_minutes=?").get(employeeId,workDate,startMinutes);
      if(existing) db.prepare("DELETE FROM schedule_blocks WHERE id=?").run(existing.id);
      else db.prepare("INSERT INTO schedule_blocks(employee_id,work_date,start_minutes,created_by) VALUES(?,?,?,?)").run(employeeId,workDate,startMinutes,current.id);
      return json(res,200,{success:true,selected:!existing});
    }
    if (data.action === "setScheduleRange") {
      const current=requireSuperAdmin(req),employeeId=Number(data.employeeId),workDate=String(data.workDate||""),startMinutes=Number(data.startMinutes),endMinutes=Number(data.endMinutes);
      if(!Number.isInteger(employeeId)||!/^\d{4}-\d{2}-\d{2}$/.test(workDate)||!Number.isInteger(startMinutes)||!Number.isInteger(endMinutes)||startMinutes<420||startMinutes>=1560||endMinutes<=startMinutes||endMinutes>1560||startMinutes%30||endMinutes%30) throw new Error("La plage doit utiliser des créneaux de 30 minutes entre 07:00 et 02:00");
      if(!db.prepare("SELECT id FROM employees WHERE id=? AND active=1").get(employeeId)) throw Object.assign(new Error("Employé introuvable"),{status:404});
      db.exec("BEGIN");
      try {
        db.prepare("DELETE FROM schedule_blocks WHERE employee_id=? AND work_date=?").run(employeeId,workDate);
        const insert=db.prepare("INSERT INTO schedule_blocks(employee_id,work_date,start_minutes,created_by) VALUES(?,?,?,?)");
        for(let minutes=startMinutes;minutes<endMinutes;minutes+=30) insert.run(employeeId,workDate,minutes,current.id);
        db.exec("COMMIT");
      } catch(error) { db.exec("ROLLBACK"); throw error; }
      return json(res,200,{success:true});
    }
    return json(res,400,{success:false,message:"Action inconnue"});
  } catch (error) { return json(res,error.status||400,{success:false,message:error.message||"Erreur serveur"}); }
});

const port = Number(process.env.PORT || 3001);
server.listen(port, "0.0.0.0", () => console.log(`API SQLite disponible sur le port ${port}`));
