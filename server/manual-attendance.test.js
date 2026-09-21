import test from "node:test";
import assert from "node:assert/strict";
import { assertManualAttendanceAvailable, buildManualAttendance } from "./manual-attendance.js";

const now = "2026-09-22T12:00:00Z";

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
