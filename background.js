import { DEFAULT_SETTINGS, addElapsed, balance, categoryForUrl, dayKey, nextReset } from "./core.js";

const DATA_KEY = "sablierData";
const SETTINGS_KEY = "sablierSettings";
const ALARM_NAME = "sablier-checkpoint";
const RESET_ALARM_NAME = "sablier-reset";
const MAX_GAP_MS = 65_000;
let queue = Promise.resolve();

function serialized(job) {
  queue = queue.then(job, job);
  return queue;
}

async function read() {
  const stored = await chrome.storage.local.get([DATA_KEY, SETTINGS_KEY]);
  return {
    settings: { ...DEFAULT_SETTINGS, ...stored[SETTINGS_KEY] },
    data: stored[DATA_KEY] || { days: {}, lastTick: Date.now(), category: null, tabId: null }
  };
}

async function activeTab() {
  const windows = await chrome.windows.getAll({ populate: true, windowTypes: ["normal"] });
  const focused = windows.find(window => window.focused);
  if (!focused) return null;
  return focused.tabs?.find(tab => tab.active) || null;
}

function prune(days, now) {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 120);
  for (const key of Object.keys(days)) {
    if (key < cutoff.toISOString().slice(0, 10)) delete days[key];
  }
}

async function syncBlocking(settings, data, now) {
  const today = data.days[dayKey(now, settings)] || { within: 0, without: 0 };
  const blocked = balance(today, settings.ratio) < 0;
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const rules = blocked ? settings.sites.map((site, index) => ({
    id: index + 1,
    priority: 1,
    action: { type: "redirect", redirect: { extensionPath: "/dashboard.html?blocked=1" } },
    condition: { urlFilter: `||${site}^`, resourceTypes: ["main_frame"] }
  })) : [];
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map(rule => rule.id),
    addRules: rules
  });
  return blocked;
}

async function checkpoint() {
  const now = Date.now();
  const { settings, data } = await read();
  // A long gap may mean Chrome was closed or the computer slept. Do not credit unknown time.
  if (now - data.lastTick <= MAX_GAP_MS) {
    addElapsed(data.days, data.lastTick, now, data.category, settings);
  }
  data.lastTick = now;
  const tab = await activeTab();
  data.category = tab ? categoryForUrl(tab.url, settings.sites) : null;
  data.tabId = tab?.id ?? null;
  prune(data.days, now);
  chrome.alarms.create(RESET_ALARM_NAME, { when: nextReset(now, settings) });
  const blocked = await syncBlocking(settings, data, now);
  if (blocked && data.category === "within" && tab?.id != null) {
    data.category = null;
    await chrome.tabs.update(tab.id, { url: chrome.runtime.getURL("dashboard.html?blocked=1") });
  }
  await chrome.storage.local.set({ [DATA_KEY]: data });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 0.5 });
  serialized(checkpoint);
});
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 0.5 });
  serialized(async () => {
    const { data } = await read();
    data.category = null;
    data.lastTick = Date.now();
    await chrome.storage.local.set({ [DATA_KEY]: data });
    await checkpoint();
  });
});
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === ALARM_NAME || alarm.name === RESET_ALARM_NAME) serialized(checkpoint);
});
chrome.tabs.onActivated.addListener(() => serialized(checkpoint));
chrome.tabs.onUpdated.addListener((_id, changes) => {
  if (changes.url) serialized(checkpoint);
});
chrome.windows.onFocusChanged.addListener(() => serialized(checkpoint));
chrome.tabs.onRemoved.addListener(() => serialized(checkpoint));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[SETTINGS_KEY]) serialized(checkpoint);
});
chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message === "checkpoint") {
    serialized(checkpoint).then(() => respond({ ok: true }), error => respond({ error: error.message }));
    return true;
  }
});
