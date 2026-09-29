import { DEFAULT_SETTINGS, balance, dayKey, weekTotals, normalizeDomain } from "./core.js";
const SETTINGS_KEY = "sablierSettings", DATA_KEY = "sablierData";
const $ = id => document.getElementById(id);
const format = ms => { if (ms > 0 && ms < 60000) return "<1m"; const minutes = Math.floor(Math.max(0, ms) / 60000); if (minutes < 60) return `${minutes}m`; return `${Math.floor(minutes / 60)}h ${minutes % 60}m`; };
async function load() {
  await chrome.runtime.sendMessage("checkpoint");
  const stored = await chrome.storage.local.get([SETTINGS_KEY, DATA_KEY]);
  const settings = { ...DEFAULT_SETTINGS, ...stored[SETTINGS_KEY] };
  const data = stored[DATA_KEY] || { days: {} };
  render(settings, data);
}
function render(settings, data) {
  const now = Date.now(), today = data.days[dayKey(now, settings)] || { within: 0, without: 0 }, week = weekTotals(data.days, now, settings), difference = balance(today, settings.ratio), blocked = new URLSearchParams(location.search).has("blocked");
  $("status").textContent = difference < 0 || blocked ? "TIME TO REINVEST" : "IN BALANCE";
  $("status").className = `status ${difference < 0 || blocked ? "blocked" : ""}`;
  $("mode").textContent = difference >= 0 ? "PLAY TIME AVAILABLE" : "TIME TO REINVEST";
  $("balance").textContent = difference >= 0 ? format(difference) : format(-difference / settings.ratio);
  $("balanceText").textContent = difference >= 0 ? "You have earned room for entertainment." : "Spend this time on other websites to restore balance.";
  $("todayWithin").textContent = format(today.within); $("todayWithout").textContent = format(today.without); $("weekWithin").textContent = format(week.within); $("weekWithout").textContent = format(week.without);
  $("weekBar").style.width = `${week.within + week.without ? week.within / (week.within + week.without) * 100 : 50}%`;
  document.body.classList.toggle("owing", difference < 0);
  $("resetLabel").textContent = `${String(settings.resetHour).padStart(2,"0")}:${String(settings.resetMinute).padStart(2,"0")}`;
  const total = today.within + today.without || 1, top = Math.min(80, Math.max(12, today.within / total * 100)), bottom = Math.min(80, Math.max(12, today.without / total * 100)); document.documentElement.style.setProperty("--top", `${top}%`); document.documentElement.style.setProperty("--bottom", `${bottom}%`);
  $("siteCount").textContent = `${settings.sites.length} site${settings.sites.length === 1 ? "" : "s"}`; $("siteList").innerHTML = settings.sites.map(site => `<li><span>${site}</span><button data-site="${site}" aria-label="Remove ${site}">Remove</button></li>`).join(""); $("ratioInput").value = settings.ratio; $("resetInput").value = `${String(settings.resetHour).padStart(2,"0")}:${String(settings.resetMinute).padStart(2,"0")}`;
}
async function save(settings) { await chrome.storage.local.set({ [SETTINGS_KEY]: settings }); await load(); $("message").textContent = "Saved"; setTimeout(() => $("message").textContent = "", 1800); }
$("siteForm").addEventListener("submit", async event => { event.preventDefault(); try { const stored = await chrome.storage.local.get(SETTINGS_KEY), settings = { ...DEFAULT_SETTINGS, ...stored[SETTINGS_KEY] }, site = normalizeDomain($("siteInput").value); if (!settings.sites.includes(site)) settings.sites.push(site); $("siteInput").value = ""; await save(settings); } catch (error) { $("message").textContent = error.message; } });
$("siteList").addEventListener("click", async event => { const site = event.target.dataset.site; if (!site) return; const stored = await chrome.storage.local.get(SETTINGS_KEY), settings = { ...DEFAULT_SETTINGS, ...stored[SETTINGS_KEY] }; settings.sites = settings.sites.filter(item => item !== site); await save(settings); });
$("saveButton").addEventListener("click", async () => { const stored = await chrome.storage.local.get(SETTINGS_KEY), settings = { ...DEFAULT_SETTINGS, ...stored[SETTINGS_KEY] }, time = $("resetInput").value.split(":"), ratio = Number($("ratioInput").value); if (!Number.isFinite(ratio) || ratio < 0.1 || ratio > 20 || time.length !== 2) { $("message").textContent = "Check the ratio and reset time."; return; } settings.ratio = ratio; settings.resetHour = Number(time[0]); settings.resetMinute = Number(time[1]); await save(settings); });
load();
