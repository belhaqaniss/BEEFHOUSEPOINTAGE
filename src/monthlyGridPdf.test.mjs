import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {monthlyGrid,buildMonthlyGridPdf} from './monthlyGridPdf.ts';
const employee=(id,total,role='Salle')=>({id,first:'Employé',last:String(id),role,color:'blue',days:1,shifts:1,morningMinutes:0,eveningMinutes:total,totalMinutes:total});
const report=(employees,month='2026-10')=>({month,employees,totalMinutes:employees.reduce((s,e)=>s+e.totalMinutes,0),morningMinutes:0,eveningMinutes:employees.reduce((s,e)=>s+e.totalMinutes,0)});
const event=(id,type,timestamp,date='2026-10-01')=>({name:`Employé ${id}`,type,timestamp,workDate:date});
test('morning and overnight evening are summed on the business day',()=>{
  const events=[event(1,'Arrivée','2026-10-01T09:00:00+02:00'),event(1,'Départ','2026-10-01T12:00:00+02:00'),event(1,'Arrivée','2026-10-01T20:00:00+02:00'),event(1,'Départ','2026-10-02T01:30:00+02:00')];
  assert.equal(monthlyGrid(report([employee(1,510)]),events,'2026-10-31').rows[0].days[0].minutes,510);
});
test('missing departure flagged, future and impossible dates left blank',()=>{
  const grid=monthlyGrid(report([employee(1,0)],'2026-02'),[event(1,'Arrivée','2026-02-01T10:00:00Z','2026-02-01')],'2026-02-10');
  assert.equal(grid.dayCount,28);assert.equal(grid.rows[0].days[0].open,true);assert.equal(grid.rows[0].days[10].minutes,null);assert.equal(grid.rows[0].days[28].minutes,null);
});
test('cumulative rounding and DST match monthly report',()=>{
  const events=[event(1,'Arrivée','2026-10-01T10:00:00Z'),event(1,'Départ','2026-10-01T10:00:40Z'),event(1,'Arrivée','2026-10-02T10:00:00Z','2026-10-02'),event(1,'Départ','2026-10-02T10:00:40Z','2026-10-02')];
  const days=monthlyGrid(report([employee(1,1)]),events,'2026-10-31').rows[0].days;
  assert.deepEqual(days.slice(0,2).map(d=>d.minutes),[1,0]);
  const dst=[event(1,'Arrivée','2026-10-24T23:00:00+02:00','2026-10-24'),event(1,'Départ','2026-10-25T04:00:00+01:00','2026-10-24')];
  assert.equal(monthlyGrid(report([employee(1,360)]),dst,'2026-10-31').rows[0].days[23].minutes,360);
});
test('reject mismatching totals instead of exporting misleading cells',()=>{
  assert.throws(()=>monthlyGrid(report([employee(1,10)]),[],'2026-10-31'),/diffèrent/);
});
test('paginate large teams and repeat all 31 day headers',()=>{
  const employees=Array.from({length:65},(_,i)=>employee(i,0,i<35?'Salle':'Cuisine'));
  const bytes=buildMonthlyGridPdf(report(employees),[],'2026-10-31');
  assert.match(new TextDecoder().decode(bytes),/\/Count 4/);
  if(process.env.GRID_PDF_PREVIEW)fs.writeFileSync(process.env.GRID_PDF_PREVIEW,bytes);
});
