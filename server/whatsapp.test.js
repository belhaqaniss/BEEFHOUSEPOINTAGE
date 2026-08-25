import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { parseWhatsAppCommand, renderKitchenPlanningPng } from "./whatsapp.js";

const database=()=>{
  const db=new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE employees(id INTEGER PRIMARY KEY,first_name TEXT,last_name TEXT,role TEXT,active INTEGER DEFAULT 1);
    CREATE TABLE schedule_blocks(id INTEGER PRIMARY KEY,employee_id INTEGER,work_date TEXT,start_minutes INTEGER,service TEXT,created_by INTEGER);
    CREATE TABLE schedule_closings(id INTEGER PRIMARY KEY,employee_id INTEGER,work_date TEXT,service TEXT,created_by INTEGER);
  `);
  db.prepare("INSERT INTO employees VALUES(1,'Mohamed','Emran','Cuisine',1)").run();
  db.prepare("INSERT INTO employees VALUES(2,'Walid','Belhaniche','Cuisine',1)").run();
  return db;
};

test("comprend une plage Cuisine et l’alias Ali",()=>{
  const db=database(),command=parseWhatsAppCommand(db,"ajouter Ali 2026-08-26 soir 18h 00h30");
  assert.equal(command.type,"pending");assert.equal(command.employeeId,1);assert.equal(command.service,"soir");assert.equal(command.startMinutes,1080);assert.equal(command.endMinutes,1470);
});

test("comprend une suppression",()=>{
  const db=database(),command=parseWhatsAppCommand(db,"supprimer Walid Belhaniche 2026-08-27 matin");
  assert.equal(command.type,"pending");assert.equal(command.action,"delete");assert.equal(command.employeeId,2);
});

test("génère une image PNG du planning",async()=>{
  const db=database();
  for(let minute=570;minute<900;minute+=30)db.prepare("INSERT INTO schedule_blocks(employee_id,work_date,start_minutes,service) VALUES(1,'2026-08-24',?,'matin')").run(minute);
  const png=await renderKitchenPlanningPng(db,"2026-08-24");
  assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);assert.ok(png.length>1_000);
});
