export const MIN_PUNCH_INTERVAL_MS = 5 * 60_000;
const MAX_SHIFT_MS = 20 * 60 * 60_000;

const parisParts = timestamp => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", hourCycle: "h23"
  }).formatToParts(new Date(timestamp));
  const value = type => parts.find(part => part.type === type)?.value;
  return { date: `${value("year")}-${value("month")}-${value("day")}`, hour: Number(value("hour")) };
};

export const businessWorkDate = timestamp => {
  const { date, hour } = parisParts(timestamp);
  if (hour >= 7) return date;
  const previous = new Date(`${date}T12:00:00Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  return previous.toISOString().slice(0, 10);
};

export const punchService = timestamp => {
  const hour = parisParts(timestamp).hour;
  return hour < 7 || hour >= 13 ? "soir" : "matin";
};

export const punchAvailability = (lastEvent, now) => {
  const current = new Date(now).getTime();
  const elapsed = lastEvent ? current - new Date(lastEvent.timestamp).getTime() : null;
  const workDate = businessWorkDate(now);
  if (lastEvent && (!Number.isFinite(elapsed) || elapsed < 0)) {
    return { blockedReason: "Le dernier pointage est daté dans le futur. Demandez une correction à un responsable.", remainingMs: 0 };
  }
  if (lastEvent?.type === "Arrivée" && (lastEvent.workDate !== workDate || elapsed > MAX_SHIFT_MS)) {
    return { blockedReason: `L’arrivée du ${lastEvent.workDate} est encore ouverte. Demandez à un responsable de corriger ce service avant de repointer.`, remainingMs: 0 };
  }
  if (lastEvent && elapsed < MIN_PUNCH_INTERVAL_MS) {
    const remainingMs = MIN_PUNCH_INTERVAL_MS - elapsed;
    return { blockedReason: `Attendez encore ${Math.ceil(remainingMs / 60_000)} minute(s) entre deux pointages.`, remainingMs };
  }
  return { blockedReason: null, remainingMs: 0 };
};

export const assertPunchAllowed = (lastEvent, now) => {
  const availability = punchAvailability(lastEvent, now);
  if (availability.blockedReason) throw Object.assign(new Error(availability.blockedReason), { status: 409 });
};
