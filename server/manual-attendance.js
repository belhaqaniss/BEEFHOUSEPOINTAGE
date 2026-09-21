import { businessWorkDate, MIN_PUNCH_INTERVAL_MS, punchService } from "./attendance-rules.js";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const parisFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23"
});

const shiftDate = (date, days) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

const parisTimestamp = (date, time) => {
  const target = `${date} ${time}`;
  const utcClock = Date.parse(`${date}T${time}:00Z`);
  for (const offset of [2, 1]) {
    const candidate = new Date(utcClock - offset * 60 * 60_000);
    const parts = parisFormatter.formatToParts(candidate);
    const value = type => parts.find(part => part.type === type)?.value;
    if (`${value("year")}-${value("month")}-${value("day")} ${value("hour")}:${value("minute")}` === target) {
      return candidate.toISOString();
    }
  }
  throw new Error("Cette heure n’existe pas dans le fuseau Europe/Paris");
};

export const buildManualAttendance = ({ workDate, arrival, departure }, now = new Date()) => {
  const parsedDate = Date.parse(`${workDate}T12:00:00Z`);
  if (!datePattern.test(workDate) || !Number.isFinite(parsedDate) || new Date(parsedDate).toISOString().slice(0, 10) !== workDate) {
    throw new Error("Date de service invalide");
  }
  if (!timePattern.test(arrival) || !timePattern.test(departure)) throw new Error("Saisissez une arrivée et un départ valides");
  if (arrival === departure) throw new Error("L’arrivée et le départ ne peuvent pas être identiques");

  const calendarDate = shiftDate(workDate, Number(arrival.slice(0, 2)) < 7 ? 1 : 0);
  const departureDate = departure < arrival ? shiftDate(calendarDate, 1) : calendarDate;
  const arrivalTimestamp = parisTimestamp(calendarDate, arrival);
  const departureTimestamp = parisTimestamp(departureDate, departure);
  const duration = Date.parse(departureTimestamp) - Date.parse(arrivalTimestamp);
  if (duration < MIN_PUNCH_INTERVAL_MS || duration > 20 * 60 * 60_000) {
    throw new Error("La durée doit être comprise entre 5 minutes et 20 heures");
  }
  if (businessWorkDate(arrivalTimestamp) !== workDate) throw new Error("L’arrivée ne correspond pas à la date du service");
  if (Date.parse(departureTimestamp) > new Date(now).getTime()) throw new Error("Le départ ne peut pas être dans le futur");
  return { workDate, arrivalTimestamp, departureTimestamp, service: punchService(arrivalTimestamp) };
};

export const assertManualAttendanceAvailable = (events, manual) => {
  const start = Date.parse(manual.arrivalTimestamp);
  const end = Date.parse(manual.departureTimestamp);
  const byDate = new Map();
  for (const event of events) {
    const group = byDate.get(event.workDate) || [];
    group.push(event);
    byDate.set(event.workDate, group);
    if (Math.abs(Date.parse(event.timestamp) - start) < MIN_PUNCH_INTERVAL_MS ||
        Math.abs(Date.parse(event.timestamp) - end) < MIN_PUNCH_INTERVAL_MS) {
      throw Object.assign(new Error("Un pointage existe déjà à moins de 5 minutes de cet horaire"), { status: 409 });
    }
  }
  for (const [date, group] of byDate) {
    let open = null;
    for (const event of group.sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.id - b.id)) {
      if (event.type === "Arrivée") {
        if (open && date === manual.workDate) throw Object.assign(new Error("Un service de cette journée est incomplet. Corrigez-le avant d’ajouter des heures."), { status: 409 });
        open = event;
      } else if (open) {
        if (Date.parse(open.timestamp) < end && Date.parse(event.timestamp) > start) {
          throw Object.assign(new Error("Cet horaire chevauche un service déjà enregistré"), { status: 409 });
        }
        open = null;
      } else if (date === manual.workDate) {
        throw Object.assign(new Error("Un départ sans arrivée existe pour cette journée. Corrigez-le avant d’ajouter des heures."), { status: 409 });
      }
    }
    if (open && date === manual.workDate) throw Object.assign(new Error("Un départ manque pour cette journée. Corrigez ce service avant d’ajouter des heures."), { status: 409 });
    if (open && date !== manual.workDate && Date.parse(open.timestamp) <= end &&
        Date.parse(open.timestamp) + 20 * 60 * 60_000 > start) {
      throw Object.assign(new Error("Un service voisin est encore ouvert et peut chevaucher cet horaire"), { status: 409 });
    }
  }
};

export const adjacentWorkDates = workDate => [shiftDate(workDate, -1), shiftDate(workDate, 1)];
