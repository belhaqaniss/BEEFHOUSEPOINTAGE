import test from "node:test";
import assert from "node:assert/strict";
import { buildEmployeeMonthReport } from "./employee-hours.js";

const event = (id, workDate, type, timestamp) => ({ id, workDate, type, timestamp });

test("détaille seulement les services terminés du salarié et du mois demandé", () => {
  const report = buildEmployeeMonthReport([
    event(1, "2026-09-02", "Arrivée", "2026-09-02T08:00:00.000Z"),
    event(2, "2026-09-02", "Départ", "2026-09-02T10:00:00.000Z"),
    event(3, "2026-09-02", "Arrivée", "2026-09-02T18:00:00.000Z"),
    event(4, "2026-09-02", "Départ", "2026-09-02T21:00:00.000Z"),
    event(5, "2026-09-03", "Arrivée", "2026-09-03T08:00:00.000Z"),
    event(6, "2026-08-31", "Arrivée", "2026-08-31T08:00:00.000Z")
  ], "2026-09", "2026-09-03");
  assert.equal(report.totalMinutes, 300);
  assert.equal(report.morningMinutes, 120);
  assert.equal(report.eveningMinutes, 180);
  assert.equal(report.completedDays, 1);
  assert.equal(report.completedShifts, 2);
  assert.equal(report.days.length, 3);
  assert.equal(report.days[1].minutes, 300);
  assert.equal(report.days[2].minutes, 0);
  assert.equal(report.days[2].shifts[0].end, null);
});

test("garde un départ après minuit dans la journée de travail", () => {
  const report = buildEmployeeMonthReport([
    event(1, "2026-09-02", "Arrivée", "2026-09-02T18:00:00.000Z"),
    event(2, "2026-09-02", "Départ", "2026-09-03T01:00:00.000Z")
  ], "2026-09", "2026-09-03");
  assert.equal(report.days[1].minutes, 420);
  assert.equal(report.days[2].minutes, 0);
  assert.equal(report.eveningMinutes, 420);
});

test("les heures journalières arrondies recomposent exactement le cumul mensuel", () => {
  const report = buildEmployeeMonthReport([
    event(1, "2026-09-01", "Arrivée", "2026-09-01T08:00:00.000Z"),
    event(2, "2026-09-01", "Départ", "2026-09-01T08:00:30.000Z"),
    event(3, "2026-09-02", "Arrivée", "2026-09-02T08:00:00.000Z"),
    event(4, "2026-09-02", "Départ", "2026-09-02T08:00:30.000Z")
  ], "2026-09", "2026-09-02");
  assert.equal(report.totalMinutes, report.days.reduce((sum, day) => sum + day.minutes, 0));
  assert.equal(report.totalMinutes, 1);
});

test("une arrivée non clôturée ne gonfle pas le cumul", () => {
  const report = buildEmployeeMonthReport([
    event(1, "2026-09-02", "Arrivée", "2026-09-02T08:00:00.000Z"),
    event(2, "2026-09-02", "Arrivée", "2026-09-02T09:00:00.000Z"),
    event(3, "2026-09-02", "Départ", "2026-09-02T11:00:00.000Z"),
    event(4, "2026-09-02", "Départ", "2026-09-02T12:00:00.000Z")
  ], "2026-09", "2026-09-02");
  assert.equal(report.totalMinutes, 120);
  assert.equal(report.completedShifts, 1);
  assert.equal(report.days[1].shifts.filter(shift => !shift.end).length, 1);
});
