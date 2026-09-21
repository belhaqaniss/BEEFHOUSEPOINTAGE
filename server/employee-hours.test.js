import test from "node:test";
import assert from "node:assert/strict";
import { buildEmployeeMonthReport, buildEmployeeRangeReport } from "./employee-hours.js";

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

test("deux services du soir le même jour sont tous deux comptés", () => {
  const report = buildEmployeeMonthReport([
    event(1, "2026-09-20", "Arrivée", "2026-09-20T16:00:00Z"),
    event(2, "2026-09-20", "Départ", "2026-09-20T18:00:00Z"),
    event(3, "2026-09-20", "Arrivée", "2026-09-20T19:00:00Z"),
    event(4, "2026-09-20", "Départ", "2026-09-20T23:00:00Z")
  ], "2026-09", "2026-09-21");
  assert.equal(report.totalMinutes, 360);
  assert.equal(report.eveningMinutes, 360);
  assert.equal(report.completedShifts, 2);
});

test("la troisième signature ouvre un nouveau service sans mélanger la veille", () => {
  const report = buildEmployeeMonthReport([
    event(1, "2026-09-19", "Arrivée", "2026-09-19T18:00:00Z"),
    event(2, "2026-09-19", "Départ", "2026-09-19T22:00:00Z"),
    event(3, "2026-09-20", "Arrivée", "2026-09-20T08:00:00Z"),
    event(4, "2026-09-20", "Départ", "2026-09-20T10:00:00Z"),
    event(5, "2026-09-20", "Arrivée", "2026-09-20T16:00:00Z")
  ], "2026-09", "2026-09-20");
  assert.equal(report.days[18].minutes, 240);
  assert.equal(report.days[19].minutes, 120);
  assert.equal(report.days[19].shifts[1].end, null);
  assert.equal(report.totalMinutes, 360);
});

test("calcule une semaine complète même lorsqu’elle traverse deux mois", () => {
  const report = buildEmployeeRangeReport([
    event(1, "2026-08-31", "Arrivée", "2026-08-31T08:00:00Z"),
    event(2, "2026-08-31", "Départ", "2026-08-31T12:00:00Z"),
    event(3, "2026-09-01", "Arrivée", "2026-09-01T18:00:00Z"),
    event(4, "2026-09-01", "Départ", "2026-09-02T01:00:00Z"),
    event(5, "2026-09-07", "Arrivée", "2026-09-07T08:00:00Z"),
    event(6, "2026-09-07", "Départ", "2026-09-07T09:00:00Z")
  ], "2026-08-31", "2026-09-06");
  assert.equal(report.morningMinutes, 240);
  assert.equal(report.eveningMinutes, 420);
  assert.equal(report.totalMinutes, 660);
  assert.equal(report.completedDays, 2);
  assert.equal(report.completedShifts, 2);
});

test("ignore les services incomplets dans le cumul hebdomadaire", () => {
  const report = buildEmployeeRangeReport([
    event(1, "2026-09-21", "Arrivée", "2026-09-21T08:00:00Z"),
    event(2, "2026-09-22", "Arrivée", "2026-09-22T18:00:00Z"),
    event(3, "2026-09-22", "Départ", "2026-09-23T00:00:00Z")
  ], "2026-09-21", "2026-09-27");
  assert.equal(report.morningMinutes, 0);
  assert.equal(report.eveningMinutes, 360);
  assert.equal(report.completedDays, 1);
  assert.equal(report.completedShifts, 1);
});
