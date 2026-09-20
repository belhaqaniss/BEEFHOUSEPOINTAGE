export type EmployeeMonthReport = {
  month: string;
  days: Array<{
    date: string;
    minutes: number;
    shifts: Array<{ service: "matin" | "soir"; start: string; end: string | null }>;
  }>;
  morningMinutes: number;
  eveningMinutes: number;
  totalMinutes: number;
  completedDays: number;
  completedShifts: number;
};

type EmployeeName = { first: string; last: string };

const ascii = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "-");
const escapePdf = (value: string) => ascii(value).replace(/([\\()])/g, "\\$1");
const text = (x: number, y: number, size: number, value: string, bold = false, color = "0.13 0.15 0.18") =>
  `${color} rg BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${escapePdf(value)}) Tj ET\n`;
const fill = (x: number, y: number, width: number, height: number, color: string) => `${color} rg ${x} ${y} ${width} ${height} re f\n`;
const line = (x1: number, y1: number, x2: number, y2: number) => `0.85 0.87 0.89 RG 0.5 w ${x1} ${y1} m ${x2} ${y2} l S\n`;
const hours = (minutes: number) => `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
const monthLabel = (month: string) => new Date(`${month}-01T12:00:00Z`).toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
const dateLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });
const localTime = (timestamp: string) => new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
}).format(new Date(timestamp));
const localDateTime = (timestamp: Date) => new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
}).format(timestamp);

function documentBytes(pageStreams: string[]) {
  const pageCount = pageStreams.length;
  const fontRegular = 3 + pageCount * 2;
  const fontBold = fontRegular + 1;
  const kids = pageStreams.map((_, index) => `${3 + index * 2} 0 R`).join(" ");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`
  ];
  for (let index = 0; index < pageCount; index++) {
    const stream = pageStreams[index];
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${4 + index * 2} 0 R >>`);
    objects.push(`<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}endstream`);
  }
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(new TextEncoder().encode(pdf).length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

export function buildEmployeeHoursPdf(employee: EmployeeName, report: EmployeeMonthReport, generatedAt = new Date()) {
  const pages: string[] = [];
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(generatedAt);
  let stream = "";
  let page = 0;
  let y = 0;
  const left = 42;
  const right = 553;
  const columns = [42, 138, 315, 493];
  const addPage = () => {
    if (page) pages.push(stream);
    page++;
    stream = text(left, 798, 16, "BEEF HOUSE", true, "0.67 0.14 0.18");
    if (page === 1) {
      stream += text(left, 766, 18, `Releve des heures - ${monthLabel(report.month)}`, true);
      stream += text(left, 744, 11, `${employee.first} ${employee.last}`, true);
      stream += text(left, 728, 8.3, `Du 01 au ${String(report.days.length).padStart(2, "0")}/${report.month.slice(5)}/${report.month.slice(0, 4)}  |  Extrait le ${localDateTime(generatedAt)} (Paris)`, false, "0.39 0.42 0.46");
      const cards = [
        ["MATIN", hours(report.morningMinutes)],
        ["SOIR", hours(report.eveningMinutes)],
        ["TOTAL", hours(report.totalMinutes)]
      ];
      cards.forEach(([label, value], index) => {
        const x = left + index * 173;
        stream += fill(x, 648, 165, 58, index === 2 ? "0.99 0.93 0.93" : "0.96 0.97 0.98");
        stream += text(x + 11, 683, 8, label, true, index === 2 ? "0.67 0.14 0.18" : "0.39 0.42 0.46");
        stream += text(x + 11, 660, 17, value, true, index === 2 ? "0.67 0.14 0.18" : "0.13 0.15 0.18");
      });
      stream += text(left, 630, 8, `${report.completedDays} journees terminees  |  ${report.completedShifts} services termines  |  Pointages reels uniquement`, false, "0.39 0.42 0.46");
      y = 604;
    } else {
      stream += text(190, 802, 10, `${employee.first} ${employee.last} - ${monthLabel(report.month)} (suite)`, true);
      y = 772;
    }
    stream += fill(left, y - 28, right - left, 28, "0.13 0.15 0.18");
    ["JOUR", "MATIN", "SOIR", "TOTAL"].forEach((label, index) => {
      stream += text(columns[index] + 8, y - 18, 8.2, label, true, "1 1 1");
    });
    y -= 28;
  };
  addPage();
  for (const [index, day] of report.days.entries()) {
    const morning = day.shifts.filter(shift => shift.service === "matin").map(shift => `${localTime(shift.start)} - ${shift.end ? localTime(shift.end) : day.date === today ? "en cours" : "depart absent"}`);
    const evening = day.shifts.filter(shift => shift.service === "soir").map(shift => `${localTime(shift.start)} - ${shift.end ? localTime(shift.end) : day.date === today ? "en cours" : "depart absent"}`);
    const lines = Math.max(1, morning.length, evening.length);
    const rowHeight = Math.max(17, lines * 13 + 4);
    if (y - rowHeight < 106) addPage();
    stream += fill(left, y - rowHeight, right - left, rowHeight, index % 2 ? "0.96 0.97 0.98" : "1 1 1");
    stream += line(left, y - rowHeight, right, y - rowHeight);
    stream += text(columns[0] + 8, y - 12, 8.3, dateLabel(day.date), true);
    for (let lineNumber = 0; lineNumber < lines; lineNumber++) {
      stream += text(columns[1] + 8, y - 12 - lineNumber * 13, 7.8, morning[lineNumber] || (lineNumber === 0 ? "--" : ""), false, "0.18 0.20 0.23");
      stream += text(columns[2] + 8, y - 12 - lineNumber * 13, 7.8, evening[lineNumber] || (lineNumber === 0 ? "--" : ""), false, "0.18 0.20 0.23");
    }
    const hasOpen = day.shifts.some(shift => !shift.end);
    stream += text(columns[3] + 8, y - 12, 8.3, day.minutes ? hours(day.minutes) : hasOpen ? day.date === today ? "En cours" : "A verifier" : "--", true, hasOpen ? "0.67 0.14 0.18" : "0.13 0.15 0.18");
    y -= rowHeight;
  }
  if (y < 116) addPage();
  stream += text(left, y - 20, 8.7, "A noter", true);
  stream += text(left, y - 35, 7.5, "Services sans depart non comptes. Un jour sans pointage n'est pas une preuve d'absence.", false, "0.39 0.42 0.46");
  stream += text(left, y - 49, 7.5, "Temps brut entre arrivee et depart, sans deduction de pause ; le planning n'entre pas dans le total.", false, "0.39 0.42 0.46");
  pages.push(stream);
  const finished = pages.map((content, index) => content + line(left, 51, right, 51) +
    text(left, 38, 7, "Source : pointage BEEF HOUSE. Document de controle, non bulletin de paie.", false, "0.39 0.42 0.46") +
    text(523, 38, 7, `${index + 1} / ${pages.length}`, false, "0.39 0.42 0.46"));
  return documentBytes(finished);
}

export function downloadEmployeeHoursPdf(employee: EmployeeName, report: EmployeeMonthReport) {
  const blob = new Blob([buildEmployeeHoursPdf(employee, report)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `heures-${employee.first.toLowerCase()}-${employee.last.toLowerCase()}-${report.month}.pdf`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
