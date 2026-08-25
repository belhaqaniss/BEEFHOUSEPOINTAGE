import test from "node:test";
import assert from "node:assert/strict";
import { buildDailyDetailsPdf, buildDailyHoursPdf, previousParisDate } from "./reports.js";

test("génère les deux rapports PDF de la veille",()=>{
  assert.match(previousParisDate(),/^\d{4}-\d{2}-\d{2}$/);
  const detail=buildDailyDetailsPdf({workDate:"2026-08-24",cashierMorning:"A",cashierEvening:"B",fdcMorning:"1",fdcEvening:"2",fdcFinal:"3",cbAmount:"4",cashAmount:"5",totalAmount:"9"},[]);
  const hours=buildDailyHoursPdf("2026-08-24",[{first:"Ali",last:"Test",role:"Salle"}],[]);
  assert.equal(detail.subarray(0,4).toString(),"%PDF");assert.equal(hours.subarray(0,4).toString(),"%PDF");
});
