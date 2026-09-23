import { CalendarPlus, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./Button";

function dates(when?: string) {
  const base = when ? new Date(when) : new Date(Date.now() + 24 * 60 * 60 * 1000);
  const start = Number.isNaN(base.getTime()) ? new Date(Date.now() + 24 * 60 * 60 * 1000) : base;
  start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const compact = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return { start, end, compact };
}

export function CalendarActions({ title, compact = false, when }: { title: string; compact?: boolean; when?: string }) {
  const download = () => {
    const { start, end, compact: format } = dates(when);
    const body = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Sensus//EN\r\nBEGIN:VEVENT\r\nUID:${crypto.randomUUID()}@sensus\r\nDTSTAMP:${format(new Date())}\r\nDTSTART:${format(start)}\r\nDTEND:${format(end)}\r\nSUMMARY:${title.replace(/[,;]/g, " ")}\r\nDESCRIPTION:Scheduled from Sensus\r\nEND:VEVENT\r\nEND:VCALENDAR`;
    const url = URL.createObjectURL(new Blob([body], { type: "text/calendar" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "sensus-action.ics"; anchor.click(); URL.revokeObjectURL(url);
  };
  const google = () => {
    const { start, end, compact: format } = dates(when);
    window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${format(start)}/${format(end)}&details=${encodeURIComponent("Scheduled from Sensus")}`, "_blank", "noopener,noreferrer");
  };
  return <div className="flex flex-wrap gap-2"><Button variant="glass" size="sm" onClick={download}><CalendarPlus className="size-3.5" />{compact ? ".ics" : "Add to calendar"}</Button><Button variant="ghost" size="sm" onClick={google}><ExternalLink className="size-3.5" />Google</Button></div>;
}

export type CalendarItem = { title: string; when?: string; details?: string };

/** One .ics file containing every step, plus a sequential Google Calendar fallback. */
export function CalendarBulkActions({ items, label = "Add all to calendar", subject = "steps" }: { items: CalendarItem[]; label?: string; subject?: string }) {
  if (items.length === 0) return null;
  const downloadAll = () => {
    const events = items.map((item, index) => {
      const base = dates(item.when);
      const start = item.when ? base.start : new Date(base.start.getTime() + index * 24 * 60 * 60 * 1000);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      const format = base.compact;
      return `BEGIN:VEVENT\r\nUID:${crypto.randomUUID()}@sensus\r\nDTSTAMP:${format(new Date())}\r\nDTSTART:${format(start)}\r\nDTEND:${format(end)}\r\nSUMMARY:${item.title.replace(/[,;]/g, " ")}\r\nDESCRIPTION:${(item.details ?? "Scheduled from Sensus").replace(/[,;]/g, " ")}\r\nEND:VEVENT`;
    }).join("\r\n");
    const body = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Sensus//EN\r\n${events}\r\nEND:VCALENDAR`;
    const url = URL.createObjectURL(new Blob([body], { type: "text/calendar" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "sensus-plan.ics"; anchor.click(); URL.revokeObjectURL(url);
    toast.success(`${items.length} ${subject} exported to your calendar file.`);
  };
  const googleAll = () => {
    items.forEach((item, index) => {
      const base = dates(item.when);
      const start = item.when ? base.start : new Date(base.start.getTime() + index * 24 * 60 * 60 * 1000);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      const format = base.compact;
      window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(item.title)}&dates=${format(start)}/${format(end)}&details=${encodeURIComponent(item.details ?? "Scheduled from Sensus")}`, "_blank", "noopener,noreferrer");
    });
    toast.success(`Opened ${items.length} Google Calendar tabs — allow pop-ups if they are blocked.`);
  };
  return <div className="flex flex-wrap gap-2"><Button variant="glass" size="sm" onClick={downloadAll}><CalendarPlus className="size-3.5" />{label}</Button><Button variant="ghost" size="sm" onClick={googleAll}><ExternalLink className="size-3.5" />All to Google</Button></div>;
}
