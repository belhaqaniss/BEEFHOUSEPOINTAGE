import test from "node:test";
import assert from "node:assert/strict";
import { assertPunchAllowed, businessWorkDate, punchAvailability, punchService } from "./attendance-rules.js";

test("une arrivée après minuit appartient encore au service du soir précédent", () => {
  assert.equal(businessWorkDate("2026-09-21T00:30:00Z"), "2026-09-20");
  assert.equal(punchService("2026-09-21T00:30:00Z"), "soir");
  assert.equal(businessWorkDate("2026-09-21T05:00:00Z"), "2026-09-21");
});

test("une troisième signature est autorisée après cinq minutes", () => {
  const departure = { type: "Départ", timestamp: "2026-09-20T13:00:00Z", workDate: "2026-09-20" };
  assert.match(punchAvailability(departure, "2026-09-20T13:04:59Z").blockedReason, /Attendez/);
  assert.doesNotThrow(() => assertPunchAllowed(departure, "2026-09-20T13:05:00Z"));
});

test("un départ de nuit clôt le service de la veille, pas une ancienne arrivée oubliée", () => {
  const evening = { type: "Arrivée", timestamp: "2026-09-20T18:00:00Z", workDate: "2026-09-20" };
  assert.doesNotThrow(() => assertPunchAllowed(evening, "2026-09-20T23:20:00Z"));
  assert.match(punchAvailability(evening, "2026-09-21T06:00:00Z").blockedReason, /encore ouverte/);
});
