const parisHour = timestamp => Number(new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23"
}).formatToParts(new Date(timestamp)).find(part => part.type === "hour")?.value || 0);

const roundedMinutes = milliseconds => Math.round(milliseconds / 60_000);

export function buildEmployeeRangeReport(events, startDate, endDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || startDate > endDate) {
    throw new Error("Période invalide");
  }
  const openByDate = new Map();
  const completedDays = new Set();
  let totalMilliseconds = 0;
  let morningMilliseconds = 0;
  let completedShifts = 0;
  for (const event of [...events].sort((a, b) => a.workDate.localeCompare(b.workDate) || a.timestamp.localeCompare(b.timestamp) || a.id - b.id)) {
    if (event.workDate < startDate || event.workDate > endDate) continue;
    if (event.type === "Arrivée") {
      const hour = parisHour(event.timestamp);
      openByDate.set(event.workDate, { service: hour < 7 || hour >= 13 ? "soir" : "matin", start: event.timestamp });
      continue;
    }
    const open = openByDate.get(event.workDate);
    openByDate.delete(event.workDate);
    if (!open) continue;
    const difference = new Date(event.timestamp).getTime() - new Date(open.start).getTime();
    if (difference <= 0 || difference >= 86_400_000) continue;
    totalMilliseconds += difference;
    if (open.service === "matin") morningMilliseconds += difference;
    completedDays.add(event.workDate);
    completedShifts++;
  }
  const totalMinutes = roundedMinutes(totalMilliseconds);
  const morningMinutes = roundedMinutes(morningMilliseconds);
  return {
    startDate, endDate, morningMinutes, eveningMinutes: totalMinutes - morningMinutes,
    totalMinutes, completedDays: completedDays.size, completedShifts
  };
}

export function buildEmployeeMonthReport(events, month, throughDate) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Mois invalide");
  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const lastDay = month < throughDate.slice(0, 7) ? daysInMonth
    : month === throughDate.slice(0, 7) ? Math.min(daysInMonth, Number(throughDate.slice(8, 10))) : 0;
  const byDate = new Map();
  const openByDate = new Map();
  for (const event of [...events].sort((a, b) => a.workDate.localeCompare(b.workDate) || a.timestamp.localeCompare(b.timestamp) || a.id - b.id)) {
    if (!event.workDate.startsWith(`${month}-`)) continue;
    const day = byDate.get(event.workDate) || { date: event.workDate, shifts: [], milliseconds: 0 };
    if (event.type === "Arrivée") {
      const hour = parisHour(event.timestamp);
      const shift = { service: hour < 7 || hour >= 13 ? "soir" : "matin", start: event.timestamp, end: null };
      day.shifts.push(shift);
      openByDate.set(event.workDate, shift);
    } else {
      const open = openByDate.get(event.workDate);
      openByDate.delete(event.workDate);
      if (open) {
        const difference = new Date(event.timestamp).getTime() - new Date(open.start).getTime();
        if (difference > 0 && difference < 86_400_000) {
          open.end = event.timestamp;
          day.milliseconds += difference;
        }
      }
    }
    byDate.set(event.workDate, day);
  }

  let totalMilliseconds = 0;
  let morningMilliseconds = 0;
  let completedDays = 0;
  let completedShifts = 0;
  const days = [];
  for (let dayNumber = 1; dayNumber <= lastDay; dayNumber++) {
    const date = `${month}-${String(dayNumber).padStart(2, "0")}`;
    const day = byDate.get(date) || { date, shifts: [], milliseconds: 0 };
    const previousRoundedTotal = roundedMinutes(totalMilliseconds);
    totalMilliseconds += day.milliseconds;
    const minutes = roundedMinutes(totalMilliseconds) - previousRoundedTotal;
    const completed = day.shifts.filter(shift => shift.end);
    if (completed.length) completedDays++;
    completedShifts += completed.length;
    morningMilliseconds += completed.filter(shift => shift.service === "matin")
      .reduce((sum, shift) => sum + new Date(shift.end).getTime() - new Date(shift.start).getTime(), 0);
    days.push({ date, shifts: day.shifts, minutes });
  }
  const totalMinutes = roundedMinutes(totalMilliseconds);
  const morningMinutes = roundedMinutes(morningMilliseconds);
  return {
    month, days, morningMinutes, eveningMinutes: totalMinutes - morningMinutes,
    totalMinutes, completedDays, completedShifts
  };
}
