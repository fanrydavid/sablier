export const DEFAULT_SETTINGS = Object.freeze({
  sites: [],
  ratio: 1,
  resetHour: 6,
  resetMinute: 0
});

export function normalizeDomain(value) {
  const input = String(value).trim().toLowerCase();
  if (!input) throw new Error("Enter a website domain.");
  let hostname;
  try {
    hostname = new URL(input.includes("://") ? input : `https://${input}`).hostname;
  } catch {
    throw new Error("Enter a valid domain, such as youtube.com.");
  }
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(hostname)) {
    throw new Error("Enter a valid domain, such as youtube.com.");
  }
  return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
}

export function categoryForUrl(url, sites) {
  let parsed;
  try { parsed = new URL(url); } catch { return null; }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  const host = parsed.hostname.toLowerCase();
  return sites.some(site => host === site || host.endsWith(`.${site}`)) ? "within" : "without";
}

export function dayKey(timestamp, settings) {
  const date = new Date(timestamp);
  date.setHours(date.getHours() - settings.resetHour, date.getMinutes() - settings.resetMinute);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function nextReset(timestamp, settings) {
  const date = new Date(timestamp);
  date.setHours(settings.resetHour, settings.resetMinute, 0, 0);
  if (date.getTime() <= timestamp) date.setDate(date.getDate() + 1);
  return date.getTime();
}

export function addElapsed(days, start, end, category, settings) {
  if (!category || end <= start) return days;
  while (start < end) {
    const key = dayKey(start, settings);
    const pieceEnd = Math.min(end, nextReset(start, settings));
    const row = days[key] || { within: 0, without: 0 };
    row[category] += pieceEnd - start;
    days[key] = row;
    start = pieceEnd;
  }
  return days;
}

export function weekTotals(days, timestamp, settings) {
  const today = dayKey(timestamp, settings);
  const start = new Date(`${today}T12:00:00`);
  const weekday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - weekday);
  const totals = { within: 0, without: 0 };
  for (let i = 0; i < 7; i++) {
    const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
    const row = days[key];
    if (row) {
      totals.within += row.within;
      totals.without += row.without;
    }
    start.setDate(start.getDate() + 1);
  }
  return totals;
}

export function balance(today, ratio) {
  return today.without * ratio - today.within;
}
