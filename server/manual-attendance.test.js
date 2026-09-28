import test from "node:test";
import assert from "node:assert/strict";
import { assertManualAttendanceAvailable, buildManualAttendance, attendanceClock, correctedAttendanceTimestamp } from "./manual-attendance.js";

const now = "2026-09-22T12:00:00Z";

test("corrige un extra du 27 septembre sans reprendre la date décalée de l’ancien horodatage", () => {
  const now = "2026-09-28T16:00:00Z";
  const arrivalTimestamp = correctedAttendanceTimestamp({workDate:"2026-09-27",type:"Arrivée",time:attendanceClock("2026-09-28T18:00:00Z")}, now);
  assert.equal(arrivalTimestamp,"2026-09-27T18:00:00.000Z");
  const departureTimestamp = correctedAttendanceTimestamp({workDate:"2026-09-27",type:"Départ",time:"00:20",arrivalTimestamp},now);
  assert.equal(departureTimestamp,"2026-09-27T22:20:00.000Z");
  assert.equal((Date.parse(departureTimestamp)-Date.parse(arrivalTimestamp))/60000,260);
});

test("correction: conserve le jour d’un départ avant minuit et refuse une durée impossible", () => {
  const values={workDate:"2026-09-20",type:"Départ",arrivalTimestamp:"2026-09-20T18:00:00Z"};
  assert.equal(correctedAttendanceTimestamp({...values,time:"23:15"},now),"2026-09-20T21:15:00.000Z");
  assert.throws(()=>correctedAttendanceTimestamp({...values,time:"19:00"},now),/durée/);
  assert.throws(()=>correctedAttendanceTimestamp({...values,arrivalTimestamp:"2026-09-21T18:00:00Z",time:"00:20"},now),/date de l’arrivée/);
});

test("correction: refuse le futur et respecte le fuseau Paris en hiver", () => {
  assert.throws(()=>correctedAttendanceTimestamp({workDate:"2026-09-30",type:"Arrivée",time:"20:00"},now),/futur/);
  assert.equal(correctedAttendanceTimestamp({workDate:"2026-01-10",type:"Arrivée",time:"20:00"},now),"2026-01-10T19:00:00.000Z");
});

test("un service du soir garde la date choisie lorsque le départ est après minuit", () => {
  const manual = buildManualAttendance({ workDate: "2026-09-20", arrival: "20:00", departure: "01:30" }, now);
  assert.deepEqual(manual, {
    workDate: "2026-09-20", arrivalTimestamp: "2026-09-20T18:00:00.000Z",
    departureTimestamp: "2026-09-20T23:30:00.000Z", service: "soir"
  });
});

test("un service du matin reçoit le bon service et l'heure de Paris", () => {
  const manual = buildManualAttendance({ workDate: "2026-09-20", arrival: "09:30", departure: "15:00" }, now);
  assert.equal(manual.arrivalTimestamp, "2026-09-20T07:30:00.000Z");
  assert.equal(manual.service, "matin");
});

test("un service déjà présent ne peut pas être créé en double ou chevauché", () => {
  const manual = buildManualAttendance({ workDate: "2026-09-20", arrival: "20:00", departure: "01:30" }, now);
  const events = [
    { id: 1, workDate: "2026-09-20", type: "Arrivée", timestamp: "2026-09-20T18:15:00.000Z" },
    { id: 2, workDate: "2026-09-20", type: "Départ", timestamp: "2026-09-20T23:15:00.000Z" }
  ];
  assert.throws(() => assertManualAttendanceAvailable(events, manual), /chevauche/);
});

test("un service incomplet doit être corrigé avant un ajout", () => {
  const manual = buildManualAttendance({ workDate: "2026-09-20", arrival: "20:00", departure: "01:30" }, now);
  assert.throws(() => assertManualAttendanceAvailable([
    { id: 1, workDate: "2026-09-20", type: "Arrivée", timestamp: "2026-09-20T07:00:00.000Z" }
  ], manual), /départ manque/);
});

test("une arrivée oubliée la veille ne bloque pas indéfiniment les nouveaux services", () => {
  const manual = buildManualAttendance({ workDate: "2026-09-20", arrival: "20:00", departure: "01:30" }, now);
  assert.doesNotThrow(() => assertManualAttendanceAvailable([
    { id: 1, workDate: "2026-09-19", type: "Arrivée", timestamp: "2026-09-19T07:00:00.000Z" }
  ], manual));
});

test("une durée impossible ou une date future est refusée", () => {
  assert.throws(() => buildManualAttendance({ workDate: "2026-09-20", arrival: "20:00", departure: "20:00" }, now), /identiques/);
  assert.throws(() => buildManualAttendance({ workDate: "2026-09-20", arrival: "20:00", departure: "20:04" }, now), /durée/);
  assert.throws(() => buildManualAttendance({ workDate: "2026-09-30", arrival: "20:00", departure: "21:00" }, now), /futur/);
});
