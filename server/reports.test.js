import test from "node:test";
import assert from "node:assert/strict";
import { buildDailyDetailsPdf, buildDailyHoursPdf, previousParisDate } from "./reports.js";

test("génère les deux rapports PDF de la veille",()=>{
  assert.match(previousParisDate(),/^\d{4}-\d{2}-\d{2}$/);
  const detail=buildDailyDetailsPdf({workDate:"2026-08-24",cashierMorning:"A",cashierEvening:"B",fdcMorning:"1",fdcEvening:"2",fdcFinal:"3",cbAmount:"4",cashAmount:"5",totalAmount:"9"},[]);
  const hours=buildDailyHoursPdf("2026-08-24",[{first:"Ali",last:"Test",role:"Salle"}],[]);
  assert.equal(detail.subarray(0,4).toString(),"%PDF");assert.equal(hours.subarray(0,4).toString(),"%PDF");
});

test("sépare les erreurs des dépenses dans le détail journalier",()=>{
  const detail={workDate:"2026-09-20",cashierMorning:"A",cashierEvening:"B",fdcMorning:"1",fdcEvening:"2",fdcFinal:"3",cbAmount:"4",cashAmount:"5",totalAmount:"9"};
  const pdf=buildDailyDetailsPdf(detail,[
    {kind:"depense",label:"Menthe",amount:1},
    {kind:"erreur",label:"Erreur de caisse",amount:12}
  ]).toString();
  assert.match(pdf,/\(DEPENSES\)/);
  assert.match(pdf,/\(ERREURS\)/);
  assert.match(pdf,/\(- Erreur de caisse\)/);
});

test("le PDF additionne plusieurs passages du soir sans compter la pause",()=>{
  const records=[
    {name:"Ali Test",workDate:"2026-09-20",type:"Arrivée",timestamp:"2026-09-20T16:00:00Z"},
    {name:"Ali Test",workDate:"2026-09-20",type:"Départ",timestamp:"2026-09-20T18:00:00Z"},
    {name:"Ali Test",workDate:"2026-09-20",type:"Arrivée",timestamp:"2026-09-20T19:00:00Z"},
    {name:"Ali Test",workDate:"2026-09-20",type:"Départ",timestamp:"2026-09-20T23:00:00Z"}
  ];
  const pdf=buildDailyHoursPdf("2026-09-20",[{first:"Ali",last:"Test",role:"Salle"}],records).toString();
  assert.match(pdf,/\(6\.00\)/);
});
