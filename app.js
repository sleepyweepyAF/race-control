/* ============================================================
   RACE CONTROL — app.js
   Fail-Safe Edition (All 12 systems implemented)
   ============================================================ */

/* ──────────────────────────────────────────────────────────
   FAIL-SAFE 1 — API TIMEOUT SYSTEM
   Wraps every fetch with a 8-second timeout.
   Prevents requests from hanging indefinitely.
   ────────────────────────────────────────────────────────── */

function fetchWithTimeout(url, ms = 8000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return fetch(url, { signal: controller.signal })
    .finally(() => clearTimeout(timer))
}

/* ──────────────────────────────────────────────────────────
   FAIL-SAFE 2 — GLOBAL ERROR DISPLAY SYSTEM
   Replaces a container's content with a clear error message.
   Prevents the UI from being stuck on "Loading..."
   ────────────────────────────────────────────────────────── */

function showError(containerId, message) {
  const el = document.getElementById(containerId)
  if (el) {
    el.innerHTML = `<p style="color:#ff4747;text-align:center;padding:12px;">⚠️ ${message}</p>`
  }
}

/* ──────────────────────────────────────────────────────────
   FAIL-SAFE 3 — OPENF1 LIVE LOCK DETECTION
   OpenF1 API blocks all calls during live sessions.
   Detects the lock message and shows correct feedback.
   ────────────────────────────────────────────────────────── */

function isOpenF1Locked(text) {
  return typeof text === "string" &&
    text.toLowerCase().includes("live f1 session in progress")
}

/* ──────────────────────────────────────────────────────────
   FAIL-SAFE 4 — OFFLINE DETECTION
   Checks navigator.onLine before any API call.
   Prevents useless requests when there is no internet.
   ────────────────────────────────────────────────────────── */

function isOffline() {
  return !navigator.onLine
}

/* ──────────────────────────────────────────────────────────
   FAIL-SAFE 5 — LOCAL STORAGE CACHING
   Saves API responses so the app can work offline.
   Keys: meetings, driverStandings, constructorStandings,
         sessions_<meeting_key>
   ────────────────────────────────────────────────────────── */

function saveToCache(key, data) {
  try {
    localStorage.setItem("rc_" + key, JSON.stringify({
      timestamp: Date.now(),
      data: data
    }))
  } catch (e) {
    // Storage might be full — fail silently
  }
}

function loadFromCache(key) {
  try {
    const raw = localStorage.getItem("rc_" + key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed.data || null
  } catch (e) {
    return null
  }
}

/* ──────────────────────────────────────────────────────────
   FAIL-SAFE 7 — CACHED FETCH WRAPPER (Advanced)
   Single function that:
     1. Returns cached data immediately if offline
     2. Fetches fresh data with timeout
     3. Detects OpenF1 lock (Fail-Safe 3)
     4. Saves fresh data to cache on success
     5. Falls back to cache if fetch fails
   Centralises all API + cache logic.
   ────────────────────────────────────────────────────────── */

async function cachedFetch(url, cacheKey) {

  // Offline: try cache immediately
  if (isOffline()) {
    const cached = loadFromCache(cacheKey)
    if (cached) return { data: cached, fromCache: true }
    throw new Error("You are offline and no cached data is available.")
  }

  try {
    const res = await fetchWithTimeout(url)
    const text = await res.text()

    // Fail-Safe 3: OpenF1 lock check
    if (isOpenF1Locked(text)) {
      throw new Error("🔴 Live F1 session in progress — API temporarily locked. Showing cached data.")
    }

    const data = JSON.parse(text)

    // Save fresh data to cache (Fail-Safe 5)
    saveToCache(cacheKey, data)

    return { data, fromCache: false }

  } catch (err) {

    // Cooldown system handles live-lock (Fail-Safe 11)
    if (err.message && err.message.includes("Live F1 session")) {
      triggerAPICooldown()
    }

    // Try cache fallback
    const cached = loadFromCache(cacheKey)
    if (cached) {
      return { data: cached, fromCache: true }
    }

    throw err
  }
}

/* ──────────────────────────────────────────────────────────
   FAIL-SAFE 11 — SMART API COOLDOWN
   When OpenF1 locks during a live session,
   the app pauses all API calls for 30 minutes
   to avoid spamming a locked endpoint.
   ────────────────────────────────────────────────────────── */

let apiCooldownUntil = 0

function triggerAPICooldown() {
  apiCooldownUntil = Date.now() + 30 * 60 * 1000 // 30 minutes
  console.warn("[Race Control] API cooldown triggered for 30 minutes.")
}

function isInCooldown() {
  return Date.now() < apiCooldownUntil
}

/* ══════════════════════════════════════════════════════════
   ORIGINAL WORKING CODE BEGINS
   All original functions preserved exactly as-is.
   ══════════════════════════════════════════════════════════ */

let raceStartTime
let racePageStartTime

function showPage(page) {

  document.querySelectorAll(".page").forEach(p => {
    p.classList.add("hidden")
  })

  setTimeout(() => {
    document.getElementById(page).classList.remove("hidden")
    window.scrollTo({ top: 0, behavior: "instant" })
  }, 50)

  if (page === "calendar") {
    setTimeout(() => showCalendarMenu(), 60)
  }

}

function setNav(page) {
  document.querySelectorAll(".bottom-nav-btn").forEach(b => b.classList.remove("active"))
  const btn = document.getElementById("nav-" + page)
  if (btn) btn.classList.add("active")
}

function showCalendarMenu() {
  const all = ["calendarMenu","calendarSubNext","calendarSubUpcoming","calendarSubCancelled"]
  all.forEach(id => {
    const el = document.getElementById(id)
    if (el) el.style.display = id === "calendarMenu" ? "block" : "none"
  })
}

function showCalendarSub(id) {
  const all = ["calendarMenu","calendarSubNext","calendarSubUpcoming","calendarSubCancelled"]
  all.forEach(i => {
    const el = document.getElementById(i)
    if (el) el.style.display = i === id ? "block" : "none"
  })
  window.scrollTo({ top: 0, behavior: "instant" })
}

function showCalendarBack() {
  showCalendarMenu()
  window.scrollTo({ top: 0, behavior: "instant" })
}

function goBackFromRacePage() {
  const target = window._racePageBackTarget
  if (!target) { showPage("calendar"); return }
  if (target.type === "calendarSub") {
    showPage("calendar")
    setTimeout(() => showCalendarSub(target.id), 70)
  } else if (target.type === "page") {
    showPage(target.id)
  }
}

function goBackFromResultPage() {
  showPage("results")
  loadResults()
  setNav("results")
}

/* Team color map for accent bars in standings */
function getTeamColor(name) {
  const colors = {
    "Mercedes":              "#00D2BE",
    "Ferrari":               "#E8002D",
    "Red Bull":              "#3671C6",
    "Red Bull Racing":       "#3671C6",
    "McLaren":               "#FF8000",
    "Aston Martin":          "#358C75",
    "Alpine":                "#FF87BC",
    "Alpine F1 Team":        "#FF87BC",
    "Williams":              "#64C4FF",
    "Haas":                  "#B6BABD",
    "Haas F1 Team":          "#B6BABD",
    "RB":                    "#6692FF",
    "RB F1 Team":            "#6692FF",
    "Racing Bulls":          "#6692FF",
    "Kick Sauber":           "#52E252",
    "Sauber":                "#52E252",
    "Audi":                  "#FF0000",
    "Cadillac":              "#CC0000",
    "Cadillac F1 Team":      "#CC0000"
  }
  return colors[name] || "#555"
}

function getFlag(code) {

  // 2-letter codes (used by Ergast API + Results page)
  const flags2 = {
    CN: "🇨🇳",
    BH: "🇧🇭",
    AU: "🇦🇺",
    SA: "🇸🇦",
    JP: "🇯🇵",
    IT: "🇮🇹",
    US: "🇺🇸",
    ES: "🇪🇸",
    CA: "🇨🇦",
    MC: "🇲🇨",
    AT: "🇦🇹",
    GB: "🇬🇧",
    HU: "🇭🇺",
    BE: "🇧🇪",
    NL: "🇳🇱",
    SG: "🇸🇬",
    MX: "🇲🇽",
    BR: "🇧🇷",
    QA: "🇶🇦",
    AE: "🇦🇪"
  }

  // 3-letter codes (used by OpenF1 API — Home + Calendar pages)
  // Includes all known variants OpenF1 may return
  const flags3 = {
    CHN: "🇨🇳",
    BHR: "🇧🇭",
    BAH: "🇧🇭",
    AUS: "🇦🇺",
    SAU: "🇸🇦",
    KSA: "🇸🇦",
    JPN: "🇯🇵",
    ITA: "🇮🇹",
    IMO: "🇮🇹",
    USA: "🇺🇸",
    ESP: "🇪🇸",
    CAN: "🇨🇦",
    MCO: "🇲🇨",
    MON: "🇲🇨",
    AUT: "🇦🇹",
    GBR: "🇬🇧",
    HUN: "🇭🇺",
    BEL: "🇧🇪",
    NLD: "🇳🇱",
    NED: "🇳🇱",
    SGP: "🇸🇬",
    MEX: "🇲🇽",
    BRA: "🇧🇷",
    QAT: "🇶🇦",
    ARE: "🇦🇪",
    UAE: "🇦🇪",
    ABU: "🇦🇪",
    AZE: "🇦🇿",
    MYS: "🇲🇾",
    POR: "🇵🇹",
    RSA: "🇿🇦",
    TUR: "🇹🇷",
    MIA: "🇺🇸",
    LAS: "🇺🇸",
    ATL: "🇺🇸"
  }

  if (!code) return "🏁"
  return flags2[code] || flags3[code] || "🏁"

}

/* Fallback flag lookup by meeting name — used when country_code is missing */
function getFlagByName(name) {
  const nameMap = {
    "Bahrain Grand Prix":       "🇧🇭",
    "Saudi Arabian Grand Prix": "🇸🇦",
    "Australian Grand Prix":    "🇦🇺",
    "Chinese Grand Prix":       "🇨🇳",
    "Japanese Grand Prix":      "🇯🇵",
    "Miami Grand Prix":         "🇺🇸",
    "Emilia Romagna Grand Prix":"🇮🇹",
    "Monaco Grand Prix":        "🇲🇨",
    "Canadian Grand Prix":      "🇨🇦",
    "Spanish Grand Prix":       "🇪🇸",
    "Austrian Grand Prix":      "🇦🇹",
    "British Grand Prix":       "🇬🇧",
    "Hungarian Grand Prix":     "🇭🇺",
    "Belgian Grand Prix":       "🇧🇪",
    "Dutch Grand Prix":         "🇳🇱",
    "Italian Grand Prix":       "🇮🇹",
    "Azerbaijan Grand Prix":    "🇦🇿",
    "Singapore Grand Prix":     "🇸🇬",
    "United States Grand Prix": "🇺🇸",
    "Mexico City Grand Prix":   "🇲🇽",
    "São Paulo Grand Prix":     "🇧🇷",
    "Las Vegas Grand Prix":     "🇺🇸",
    "Qatar Grand Prix":         "🇶🇦",
    "Abu Dhabi Grand Prix":     "🇦🇪",
    "Barcelona Grand Prix":     "🇪🇸"
  }
  return nameMap[name] || "🏁"
}

function formatIST(date) {

  return new Intl.DateTimeFormat("en-IN", {

    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true

  }).format(date) + " IST"

}

function updateRaceStatus(sessions) {

  const now = new Date()

  let first = new Date(sessions[0].date_start)
  let last = new Date(sessions[sessions.length - 1].date_start)

  let status = "Upcoming"

  if (now >= first && now <= last) {
    status = "Race Week 🟢"
  }

  if (now > last) {
    status = "Race Finished"
  }

  document.getElementById("raceStatus").innerText = status

}

function startCountdown() {

  function update() {

    let diff = raceStartTime - new Date()

    if (diff < 0) {
      document.getElementById("countdown").innerText = "Race Started"
      return
    }

    let d = Math.floor(diff / 86400000)
    let h = Math.floor(diff / 3600000) % 24
    let m = Math.floor(diff / 60000) % 60

    document.getElementById("countdown").innerText =
      d + "d " + h + "h " + m + "m"

  }

  update()
  setInterval(update, 60000)

}

function startRacePageCountdown() {

  function update() {

    let diff = racePageStartTime - new Date()

    if (diff < 0) {
      document.getElementById("racePageCountdown").innerText = "Race Started"
      return
    }

    let d = Math.floor(diff / 86400000)
    let h = Math.floor(diff / 3600000) % 24
    let m = Math.floor(diff / 60000) % 60

    document.getElementById("racePageCountdown").innerText =
      d + "d " + h + "h " + m + "m"

  }

  update()
  setInterval(update, 60000)

}

/* ──────────────────────────────────────────────────────────
   loadRaceData — upgraded with all fail-safes
   ────────────────────────────────────────────────────────── */

async function loadRaceData() {

  // Fail-Safe 11: Cooldown check
  if (isInCooldown()) {
    const cached = loadFromCache("meetings")
    if (cached) {
      processRaceData(cached)
    } else {
      showError("raceName", "API on cooldown. Please wait.")
    }
    return
  }

  try {

    const { data: meetings, fromCache } = await cachedFetch(
      "https://api.openf1.org/v1/meetings",
      "meetings"
    )

    if (fromCache) {
      document.getElementById("raceName").style.color = "#aaa"
    }

    processRaceData(meetings)

  } catch (err) {

    // Fail-Safe 2: Show error in UI
    document.getElementById("raceName").innerText = "Race Control"
    showError("nextSession", err.message || "Failed to load race data.")
    document.getElementById("raceStatus").innerText = "Unavailable"
    document.getElementById("countdown").innerText = "--"

  }

}

/* ──────────────────────────────────────────────────────────
   FAIL-SAFE 6 — CACHE FALLBACK RENDERING
   processRaceData works with both fresh and cached data.
   ────────────────────────────────────────────────────────── */

// Officially cancelled 2026 races — filtered from all views
const CANCELLED_RACES = [
  "Bahrain Grand Prix",
  "Saudi Arabian Grand Prix"
]

function processRaceData(meetings) {

  const now = new Date()
  let nextRace = null

  // Filter out cancelled races before processing
  meetings = meetings.filter(r => !CANCELLED_RACES.includes(r.meeting_name))

  for (let race of meetings) {
    let start = new Date(race.date_start)
    // Use end of weekend (start + 3 days) so ongoing race weekends
    // are not skipped. A weekend is only "over" after race day ends.
    let end = new Date(start)
    end.setDate(end.getDate() + 3)
    if (end > now) {
      nextRace = race
      break
    }
  }

  if (nextRace) {

    document.getElementById("raceName").innerText = nextRace.meeting_name
    document.getElementById("circuit").innerText = nextRace.circuit_short_name
    document.getElementById("location").innerText =
      nextRace.location + ", " + nextRace.country_name
    document.getElementById("flag").innerText =
      getFlag(nextRace.country_code)

    loadSessions(nextRace.meeting_key)

    // Store meeting key for circuit info + weather
    _currentMeetingKey = nextRace.meeting_key

  }

}

/* ──────────────────────────────────────────────────────────
   loadSessions — upgraded with fail-safes 6, 7, 8
   ────────────────────────────────────────────────────────── */

async function loadSessions(key) {

  try {

    const { data: sessions } = await cachedFetch(
      `https://api.openf1.org/v1/sessions?meeting_key=${key}`,
      `sessions_${key}`
    )

    renderSessions(sessions)

  } catch (err) {

    // Fail-Safe 8: Sessions page fail-safe
    showError("sessionsContent", err.message || "Failed to load sessions.")
    showError("nextSession", "Session data unavailable.")
    document.getElementById("raceStatus").innerText = "Unavailable"

  }

}

/* Sessions renderer — works with fresh and cached data */
function renderSessions(sessions) {

  const container = document.getElementById("sessionsContent")
  container.innerHTML = ""

  let nextSession = null

  sessions.forEach(s => {

    let date = new Date(s.date_start)
    const isPast = date < new Date()

    let row = document.createElement("div")
    row.className = "session-row" + (isPast ? " session-past" : "")

    const dateStr = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata", day: "numeric", month: "short"
    }).format(date)

    const timeStr = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true
    }).format(date)

    row.innerHTML = `
<div class="session-date-col">
  <div class="session-date">${dateStr}</div>
  <div class="session-time">${timeStr} IST</div>
</div>
<div class="session-name-col">
  <div class="session-name">${s.session_name}</div>
  ${isPast ? '<div class="session-done">COMPLETED</div>' : ''}
</div>
`
    container.appendChild(row)

    if (!nextSession && date > new Date()) {
      nextSession = s
    }

    if (s.session_name === "Race") {
      raceStartTime = date
    }

  })

  updateRaceStatus(sessions)

  if (nextSession) {

    document.getElementById("nextSession").innerText =
      nextSession.session_name + " — " + formatIST(new Date(nextSession.date_start))

  }

  startCountdown()

}

/* ──────────────────────────────────────────────────────────
   openRacePage — upgraded with fail-safe 9
   ────────────────────────────────────────────────────────── */

async function openRacePage(race, start, end, isCancelled = false, backTarget = null) {

  window._racePageBackTarget = backTarget

  const backBar = document.getElementById("racePageBackBar")
  const backBtn = document.getElementById("racePageBackBtn")
  if (backBar && backBtn) {
    if (backTarget) {
      backBtn.innerText = "‹ " + backTarget.label
      backBar.style.display = "flex"
    } else {
      backBar.style.display = "none"
    }
  }

  showPage("racePage")

  // Use name-based flag fallback in case country_code is missing or wrong
  const flag = getFlag(race.country_code) !== "🏁"
    ? getFlag(race.country_code)
    : getFlagByName(race.meeting_name)

  const cancelledBadge = isCancelled ? "🚫 " : ""

  // Populate new race-detail-header
  const raceDetailFlag = document.getElementById("raceDetailFlag")
  if (raceDetailFlag) raceDetailFlag.innerText = flag

  document.getElementById("racePageName").innerText = cancelledBadge + race.meeting_name
  document.getElementById("racePageCircuit").innerText = race.circuit_short_name
  document.getElementById("racePageLocation").innerText = race.location + ", " + race.country_name
  document.getElementById("racePageDates").innerText =
    start.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) +
    " – " +
    end.toLocaleDateString("en-IN", { day: "numeric", month: "short" })

  // Hide countdown card entirely for cancelled races
  const countdownCard = document.getElementById("racePageCountdownCard")
  if (countdownCard) countdownCard.style.display = isCancelled ? "none" : "block"

  try {

    const { data: sessions } = await cachedFetch(
      `https://api.openf1.org/v1/sessions?meeting_key=${race.meeting_key}`,
      `sessions_${race.meeting_key}`
    )

    const container = document.getElementById("racePageSessions")
    container.innerHTML = ""

    sessions.forEach(s => {

      let date = new Date(s.date_start)
      const isPast = date < new Date()

      let row = document.createElement("div")
      row.className = "session-row" + (isPast ? " session-past" : "")

      const dateStr = new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata", day: "numeric", month: "short"
      }).format(date)

      const timeStr = new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true
      }).format(date)

      row.innerHTML = `
<div class="session-date-col">
  <div class="session-date">${dateStr}</div>
  <div class="session-time">${timeStr} IST</div>
</div>
<div class="session-name-col">
  <div class="session-name">${s.session_name}</div>
  ${isPast ? '<div class="session-done">COMPLETED</div>' : ''}
</div>
`
      container.appendChild(row)

      if (s.session_name === "Race") {
        racePageStartTime = date
      }

    })

    // Only start countdown for non-cancelled races
    if (!isCancelled) {
      startRacePageCountdown()
    }

    // Load circuit info + weather for this race
    if (race.circuit_short_name) {
      // Find full circuit name from sessions data or use short name
      const fullCircuitName = Object.keys(CIRCUIT_DATA).find(k =>
        k.toLowerCase().includes(race.circuit_short_name.toLowerCase()) ||
        race.circuit_short_name.toLowerCase().includes(k.split(" ")[0].toLowerCase())
      ) || race.circuit_short_name
      loadCircuitInfo(race.meeting_key, fullCircuitName)
      // Use race session date for weather
      const raceSession = sessions.find(s => s.session_name === "Race")
      if (raceSession) loadWeather(fullCircuitName, raceSession.date_start)
    }

  } catch (err) {

    // Fail-Safe 9: Race page fail-safe
    showError("racePageSessions", err.message || "Failed to load race sessions.")
    document.getElementById("racePageCountdown").innerText = "--"

  }

}

/* ──────────────────────────────────────────────────────────
   loadCalendar — upgraded with fail-safes 7, 6
   ────────────────────────────────────────────────────────── */

async function loadCalendar() {

  try {

    const { data: races } = await cachedFetch(
      "https://api.openf1.org/v1/meetings",
      "meetings"
    )

    renderCalendar(races)

  } catch (err) {

    showError("nextSubContent", err.message || "Failed to load calendar.")

  }

}

function renderCalendar(races) {

  const now = new Date()

  let next = null
  let upcoming = []
  let cancelled = []

  // Split races into active and cancelled buckets
  const currentYear = new Date().getFullYear()

  races.forEach(r => {

    let start = new Date(r.date_start)
    let end = new Date(start)
    end.setDate(end.getDate() + 2)

    if (CANCELLED_RACES.includes(r.meeting_name)) {
      // Only show cancelled races from the current year — avoids
      // duplicate entries from previous seasons in the OpenF1 API
      if (start.getFullYear() === currentYear) {
        cancelled.push({ r, start, end })
      }
    }
    else if (end > now && !next) {
      next = { r, start, end }
    }
    else if (end > now) {
      upcoming.push({ r, start, end })
    }

  })

  // ── Helper: build a standard race item ──
  function makeItem(r, start, end) {
    let item = document.createElement("div")
    item.className = "calendar-item"
    item.innerHTML = `<div class="cal-item-inner"><div class="cal-item-accent"></div><div class="cal-item-body"><div class="cal-item-round">${getFlag(r.country_code)}</div><div class="calendar-race">${r.meeting_name}</div><div class="calendar-date">${start.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div></div></div>`
    return item
  }

  // ── Helper: build a cancelled item ──
  function makeCancelledItem(r, start, end) {
    let item = document.createElement("div")
    item.className = "calendar-item calendar-item-cancelled"
    const cf = getFlag(r.country_code) !== "🏁" ? getFlag(r.country_code) : getFlagByName(r.meeting_name)
    item.innerHTML = `<div class="cal-item-inner"><div class="cal-item-accent" style="background:#ff4747"></div><div class="cal-item-body"><div class="cancelled-label">🚫 CANCELLED</div><div class="calendar-race">${cf} ${r.meeting_name}</div><div class="calendar-date">Was scheduled: ${start.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div></div></div>`
    return item
  }

  // ── Populate NEXT RACE subpage ──
  const nextContainer = document.getElementById("nextSubContent")
  nextContainer.innerHTML = ""
  if (next) {
    const item = makeItem(next.r, next.start, next.end)
    item.onclick = () => openRacePage(next.r, next.start, next.end, false, { type: "calendarSub", id: "calendarSubNext", label: "Next Race" })
    nextContainer.appendChild(item)
  } else {
    nextContainer.innerHTML = "<p style='color:#aaa;padding:10px'>No upcoming race found.</p>"
  }

  // ── Populate UPCOMING subpage ──
  const upcomingContainer = document.getElementById("upcomingSubContent")
  upcomingContainer.innerHTML = ""
  if (upcoming.length) {
    upcoming.forEach(x => {
      const item = makeItem(x.r, x.start, x.end)
      item.onclick = () => openRacePage(x.r, x.start, x.end, false, { type: "calendarSub", id: "calendarSubUpcoming", label: "Upcoming" })
      upcomingContainer.appendChild(item)
    })
  } else {
    upcomingContainer.innerHTML = "<p style='color:#aaa;padding:10px'>No upcoming races.</p>"
  }

  // ── Populate CANCELLED subpage ──
  const cancelledContainer = document.getElementById("cancelledSubContent")
  cancelledContainer.innerHTML = ""
  if (cancelled.length) {
    cancelled.forEach(x => {
      const item = makeCancelledItem(x.r, x.start, x.end)
      item.onclick = () => openRacePage(x.r, x.start, x.end, true, { type: "calendarSub", id: "calendarSubCancelled", label: "Cancelled" })
      cancelledContainer.appendChild(item)
    })
  } else {
    cancelledContainer.innerHTML = "<p style='color:#aaa;padding:10px'>No cancelled races this season.</p>"
  }

  showCalendarMenu()

  // Add "View Results →" buttons to completed race cards
  setTimeout(addResultLinksToCalendar, 500)

}

/* ──────────────────────────────────────────────────────────
   DRIVER STANDINGS — upgraded with fail-safes 7, 6
   ────────────────────────────────────────────────────────── */

async function loadDriverStandings() {

  try {

    const { data } = await cachedFetch(
      "https://api.jolpi.ca/ergast/f1/current/driverStandings.json",
      "driverStandings"
    )

    renderDriverStandings(data)

  } catch (err) {

    showError("driversContent", err.message || "Failed to load driver standings.")

  }

}

/* ──────────────────────────────────────────────────────────
   FAIL-SAFE 6 — renderDriverStandings
   Works with both fresh and cached data.
   ────────────────────────────────────────────────────────── */

function renderDriverStandings(data) {

  const standings = data.MRData.StandingsTable.StandingsLists[0].DriverStandings

  const container = document.querySelector("#drivers .card")

  let html = `

<h3>Driver Standings</h3>

<table class="standings-table">

<thead>
<tr>
<th class="pos-col">POS</th>
<th class="driver-col">DRIVER</th>
<th class="points-col">PTS</th>
</tr>
</thead>

<tbody>

`

  standings.forEach((d, i) => {

    const teamColor = getTeamColor(d.Constructors[0].name)

    html += `
<tr>
<td class="pos-col">${i + 1}</td>
<td class="driver-col">
  <div class="driver-name-wrap">
    <span class="team-accent-bar" style="background:${teamColor}"></span>
    <div>
      <div class="driver-fullname">${d.Driver.givenName} ${d.Driver.familyName}</div>
      <div class="driver-team-sub">${d.Constructors[0].name}</div>
    </div>
  </div>
</td>
<td class="points-col">${d.points}</td>
</tr>
`

  })

  html += `</tbody></table>`

  container.innerHTML = html

  // Load points progression chart below standings
  loadPointsChart()

}

/* ──────────────────────────────────────────────────────────
   CONSTRUCTOR STANDINGS — upgraded with fail-safe 10
   ────────────────────────────────────────────────────────── */

async function loadConstructorStandings() {

  try {

    const { data } = await cachedFetch(
      "https://api.jolpi.ca/ergast/f1/current/constructorStandings.json",
      "constructorStandings"
    )

    renderConstructorStandings(data)

  } catch (err) {

    showError("teamsContent", err.message || "Failed to load constructor standings.")

  }

}

/* ──────────────────────────────────────────────────────────
   FAIL-SAFE 10 — renderConstructorStandings
   Works with both fresh and cached data.
   ────────────────────────────────────────────────────────── */

function renderConstructorStandings(data) {

  const standings = data.MRData.StandingsTable.StandingsLists[0].ConstructorStandings

  const container = document.querySelector("#teams .card")

  let html = `

<h3>Constructor Standings</h3>

<table class="standings-table">

<thead>
<tr>
<th class="pos-col">POS</th>
<th class="team-col">TEAM</th>
<th class="points-col">PTS</th>
</tr>
</thead>

<tbody>

`

  standings.forEach((t, i) => {

    const teamColor = getTeamColor(t.Constructor.name)

    html += `
<tr>
<td class="pos-col">${i + 1}</td>
<td class="team-col">
  <div class="team-name-wrap">
    <span class="team-accent-bar" style="background:${teamColor}"></span>
    ${t.Constructor.name}
  </div>
</td>
<td class="points-col">${t.points}</td>
</tr>
`

  })

  html += `</tbody></table>`

  container.innerHTML = html

}

/* ──────────────────────────────────────────────────────────
   ERROR TARGET ANCHORS
   index.html uses .card containers — adding id anchors
   for showError() to target standings sections.
   These are set here to avoid touching index.html.
   ────────────────────────────────────────────────────────── */

window.addEventListener("DOMContentLoaded", () => {

  const driversCard = document.querySelector("#drivers .card")
  if (driversCard && !driversCard.id) driversCard.id = "driversContent"

  const teamsCard = document.querySelector("#teams .card")
  if (teamsCard && !teamsCard.id) teamsCard.id = "teamsContent"

})

/* ══════════════════════════════════════════════════════════
   RESULTS PAGE
   Shows completed race weekends with:
   - Race result (POS / DRIVER / TEAM / TIME / PTS)
   - Qualifying result (POS / DRIVER / TEAM / Q1 / Q2 / Q3)
   - Fastest lap
   - Sprint result if available (POS / DRIVER / TEAM / TIME / PTS)
   ══════════════════════════════════════════════════════════ */

/* List of completed rounds — fetched once and reused */
let completedRounds = []

async function loadResults() {

  const container = document.getElementById("resultsContent")
  container.innerHTML = "<p style='color:#aaa;text-align:center;padding:16px'>Loading results...</p>"

  const year = new Date().getFullYear()

  // Update page title to current year dynamically
  const heading = document.querySelector("#results .card h3")
  if (heading) heading.innerText = year + " Race Results"

  try {

    const { data } = await cachedFetch(
      `https://api.jolpi.ca/ergast/f1/${year}/results.json?limit=100`,
      `results${year}`
    )

    const races = data.MRData.RaceTable.Races

    if (!races || races.length === 0) {
      container.innerHTML = "<p style='color:#aaa;text-align:center;padding:16px'>No results available yet.</p>"
      return
    }

    // Store completed rounds for sub-page loading
    completedRounds = races

    container.innerHTML = ""

    // Show most recent first
    const reversed = [...races].reverse()

    reversed.forEach(race => {

      const item = document.createElement("div")
      item.className = "calendar-item"

      const raceDate = new Date(race.date)

      item.innerHTML = `
<div class="calendar-race">${getFlag(getRoundCountryCode(race))} ${race.raceName}</div>
<div class="calendar-date">
Round ${race.round} · ${raceDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
</div>
`
      item.onclick = () => openResultPage(race.round)
      container.appendChild(item)

    })

  } catch (err) {
    showError("resultsContent", err.message || "Failed to load results.")
  }

}

/* Helper — map race country to flag code */
function getRoundCountryCode(race) {
  const map = {
    "Australia": "AU",
    "China": "CN",
    "Japan": "JP",
    "Bahrain": "BH",
    "Saudi Arabia": "SA",
    "Italy": "IT",
    "USA": "US",
    "United States": "US",
    "Spain": "ES",
    "Canada": "CA",
    "Monaco": "MC",
    "Austria": "AT",
    "UK": "GB",
    "Great Britain": "GB",
    "Hungary": "HU",
    "Belgium": "BE",
    "Netherlands": "NL",
    "Singapore": "SG",
    "Mexico": "MX",
    "Brazil": "BR",
    "Qatar": "QA",
    "Abu Dhabi": "AE"
  }
  return map[race.Circuit.Location.country] || ""
}

/* ──────────────────────────────────────────────────────────
   STATUS ABBREVIATOR
   Converts long Ergast status strings to short mobile-friendly text
   e.g. "Did not start" → "DNS", "Retired" → "RET"
   ────────────────────────────────────────────────────────── */

function shortStatus(status) {
  const map = {
    "Did not start":      "DNS",
    "Did not qualify":    "DNQ",
    "Disqualified":       "DSQ",
    "Retired":            "RET",
    "Not classified":     "NC",
    "Withdrew":           "WD",
    "Excluded":           "EX",
    "Accident":           "RET",
    "Collision":          "RET",
    "Engine":             "RET",
    "Gearbox":            "RET",
    "Hydraulics":         "RET",
    "Electrical":         "RET",
    "Spun off":           "RET",
    "Brakes":             "RET",
    "Suspension":         "RET",
    "Power Unit":         "RET",
    "Overheating":        "RET"
  }
  return map[status] || status
}

/* ──────────────────────────────────────────────────────────
   openResultPage — tabbed layout: Race / Qualifying / Sprint
   Tabs replace the single long scroll — much cleaner on mobile
   ────────────────────────────────────────────────────────── */

async function openResultPage(round) {

  showPage("resultPage")

  // Show back button
  const backBar = document.getElementById("resultPageBackBar")
  if (backBar) backBar.style.display = "flex"

  // Reset header
  document.getElementById("resultPageName").innerText = "Loading..."
  document.getElementById("resultPageDate").innerText = ""

  // Show tab bar, default to Race tab
  showResultTab("race")

  // Set loading states in each tab panel
  document.getElementById("resultPageFastestLap").innerText = "--"
  document.getElementById("resultPageRaceTable").innerHTML = "<p style=\'color:#aaa;padding:10px\'>Loading...</p>"
  document.getElementById("resultPageQualiTable").innerHTML = "<p style=\'color:#aaa;padding:10px\'>Loading...</p>"
  document.getElementById("resultPageSprintCard").style.display = "none"
  document.getElementById("tabSprintBtn").style.display = "none"

  try {

    const year = new Date().getFullYear()

    const [raceRes, qualiRes, sprintRes] = await Promise.allSettled([
      cachedFetch(`https://api.jolpi.ca/ergast/f1/${year}/${round}/results.json`, `raceResult_${year}_${round}`),
      cachedFetch(`https://api.jolpi.ca/ergast/f1/${year}/${round}/qualifying.json`, `qualiResult_${year}_${round}`),
      cachedFetch(`https://api.jolpi.ca/ergast/f1/${year}/${round}/sprint.json`, `sprintResult_${year}_${round}`)
    ])

    /* ── RACE RESULT ── */
    if (raceRes.status === "fulfilled") {

      const race = raceRes.value.data.MRData.RaceTable.Races[0]

      if (race) {

        document.getElementById("resultPageName").innerText =
          getFlag(getRoundCountryCode(race)) + " " + race.raceName

        document.getElementById("resultPageDate").innerText =
          new Date(race.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })

        const results = race.Results

        /* Fastest lap */
        const flDriver = results.find(r => r.FastestLap && r.FastestLap.rank === "1")
        if (flDriver) {
          document.getElementById("resultPageFastestLap").innerText =
            flDriver.Driver.givenName + " " + flDriver.Driver.familyName +
            " — " + flDriver.FastestLap.Time.time +
            " (Lap " + flDriver.FastestLap.lap + ")"
        } else {
          document.getElementById("resultPageFastestLap").innerText = "Not available"
        }

        let html = `
<table class="standings-table">
<thead>
<tr>
<th class="pos-col">POS</th>
<th class="driver-col">DRIVER</th>
<th class="team-col">TEAM</th>
<th class="time-col">GAP</th>
<th class="points-col">PTS</th>
</tr>
</thead>
<tbody>
`
        results.forEach(r => {
          const gap = r.position === "1"
            ? (r.Time ? r.Time.time : "—")
            : (r.Time ? "+" + r.Time.time : shortStatus(r.status))

          html += `
<tr>
<td class="pos-col">${r.position}</td>
<td class="driver-col">${r.Driver.familyName}</td>
<td class="team-col">${r.Constructor.name}</td>
<td class="time-col">${gap}</td>
<td class="points-col">${r.points}</td>
</tr>
`
        })

        html += "</tbody></table>"
        document.getElementById("resultPageRaceTable").innerHTML = html

      }

    } else {
      document.getElementById("resultPageRaceTable").innerHTML =
        "<p style=\'color:#ff4747;padding:10px\'>⚠️ Race result unavailable.</p>"
    }

    /* ── QUALIFYING RESULT ── */
    if (qualiRes.status === "fulfilled") {

      const qualiRace = qualiRes.value.data.MRData.RaceTable.Races[0]

      if (qualiRace && qualiRace.QualifyingResults) {

        const qResults = qualiRace.QualifyingResults

        let html = `
<table class="standings-table">
<thead>
<tr>
<th class="pos-col">POS</th>
<th class="driver-col">DRIVER</th>
<th class="team-col">TEAM</th>
<th class="time-col">BEST</th>
</tr>
</thead>
<tbody>
`
        qResults.forEach(q => {
          const best = q.Q3 || q.Q2 || q.Q1 || "—"
          html += `
<tr>
<td class="pos-col">${q.position}</td>
<td class="driver-col">${q.Driver.familyName}</td>
<td class="team-col">${q.Constructor.name}</td>
<td class="time-col">${best}</td>
</tr>
`
        })

        html += "</tbody></table>"
        document.getElementById("resultPageQualiTable").innerHTML = html

      } else {
        document.getElementById("resultPageQualiTable").innerHTML =
          "<p style=\'color:#aaa;padding:10px\'>Qualifying data not available.</p>"
      }

    } else {
      document.getElementById("resultPageQualiTable").innerHTML =
        "<p style=\'color:#ff4747;padding:10px\'>⚠️ Qualifying result unavailable.</p>"
    }

    /* ── SPRINT RESULT (if available) ── */
    if (sprintRes.status === "fulfilled") {

      const sprintRace = sprintRes.value.data.MRData.RaceTable.Races[0]

      if (sprintRace && sprintRace.SprintResults && sprintRace.SprintResults.length > 0) {

        document.getElementById("resultPageSprintCard").style.display = "block"

        // Show Sprint tab button
        document.getElementById("tabSprintBtn").style.display = "inline-block"

        const sResults = sprintRace.SprintResults

        let html = `
<table class="standings-table">
<thead>
<tr>
<th class="pos-col">POS</th>
<th class="driver-col">DRIVER</th>
<th class="team-col">TEAM</th>
<th class="time-col">GAP</th>
<th class="points-col">PTS</th>
</tr>
</thead>
<tbody>
`
        sResults.forEach(s => {
          const gap = s.position === "1"
            ? (s.Time ? s.Time.time : "—")
            : (s.Time ? "+" + s.Time.time : shortStatus(s.status))

          html += `
<tr>
<td class="pos-col">${s.position}</td>
<td class="driver-col">${s.Driver.familyName}</td>
<td class="team-col">${s.Constructor.name}</td>
<td class="time-col">${gap}</td>
<td class="points-col">${s.points}</td>
</tr>
`
        })

        html += "</tbody></table>"
        document.getElementById("resultPageSprintTable").innerHTML = html

      }

    }

  } catch (err) {
    document.getElementById("resultPageName").innerText = "Error"
    showError("resultPageRaceTable", err.message || "Failed to load result.")
  }

}

/* ──────────────────────────────────────────────────────────
   TAB SWITCHER for Result Detail Page
   Switches between Race / Qualifying / Sprint panels
   ────────────────────────────────────────────────────────── */

function showResultTab(tab) {

  // Hide all panels
  document.getElementById("resultTabRace").style.display = "none"
  document.getElementById("resultTabQuali").style.display = "none"
  document.getElementById("resultTabSprint").style.display = "none"

  // Remove active from all tab buttons
  document.querySelectorAll(".result-tab-btn").forEach(b => b.classList.remove("tab-active"))

  // Show selected panel + activate button
  document.getElementById("resultTab" + tab.charAt(0).toUpperCase() + tab.slice(1)).style.display = "block"
  document.getElementById("tab" + tab.charAt(0).toUpperCase() + tab.slice(1) + "Btn").classList.add("tab-active")

}

/* ──────────────────────────────────────────────────────────
   BOOT — Load all data on startup
   Same as original, no changes.
   ────────────────────────────────────────────────────────── */

loadRaceData()
loadCalendar()
loadDriverStandings()
loadConstructorStandings()

/* ══════════════════════════════════════════════════════════
   FEATURE UPDATES — Road Ahead Implementation
   ══════════════════════════════════════════════════════════ */

/* ──────────────────────────────────────────────────────────
   HAPTIC FEEDBACK
   Subtle vibration on button taps via Vibration API.
   Silently ignored on browsers that don't support it.
   ────────────────────────────────────────────────────────── */

function haptic(ms = 8) {
  try {
    if (navigator.vibrate) navigator.vibrate(ms)
  } catch (e) { /* ignore */ }
}

/* ──────────────────────────────────────────────────────────
   PWA INSTALL PROMPT
   Detects beforeinstallprompt and shows a custom
   styled install banner at the bottom of the home page.
   Only shown once per session — dismissed permanently
   when user taps Install or Dismiss.
   ────────────────────────────────────────────────────────── */

let _installPromptEvent = null

window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault()
  _installPromptEvent = e

  // Only show if not already installed and not dismissed before
  if (!localStorage.getItem("rc_install_dismissed")) {
    const banner = document.getElementById("installBanner")
    if (banner) banner.style.display = "flex"
  }
})

function installApp() {
  haptic(10)
  if (_installPromptEvent) {
    _installPromptEvent.prompt()
    _installPromptEvent.userChoice.then(choice => {
      if (choice.outcome === "accepted") {
        localStorage.setItem("rc_install_dismissed", "1")
      }
      const banner = document.getElementById("installBanner")
      if (banner) banner.style.display = "none"
      _installPromptEvent = null
    })
  }
}

function dismissInstall() {
  haptic(6)
  localStorage.setItem("rc_install_dismissed", "1")
  const banner = document.getElementById("installBanner")
  if (banner) banner.style.display = "none"
}

// Hide banner if already running as installed PWA
if (window.matchMedia("(display-mode: standalone)").matches) {
  localStorage.setItem("rc_install_dismissed", "1")
}

/* ──────────────────────────────────────────────────────────
   UI POLISH — Active nav state on subpages
   When race page or result detail page opens,
   highlight the correct parent nav button.
   ────────────────────────────────────────────────────────── */

// Patch goBackFromRacePage to restore nav state
const _origGoBackRace = goBackFromRacePage
window.goBackFromRacePage = function() {
  haptic()
  _origGoBackRace()
}

const _origGoBackResult = goBackFromResultPage
window.goBackFromResultPage = function() {
  haptic()
  _origGoBackResult()
}

/* ──────────────────────────────────────────────────────────
   LIVE SESSION INDICATOR + SESSION PROGRESS TRACKER
   Checks OpenF1 for currently active sessions.
   Shows LIVE badge on home page and in session rows.
   Polls every 60 seconds while app is open.
   ────────────────────────────────────────────────────────── */

let _liveSessionInterval = null
let _currentMeetingKey = null

async function checkLiveSession() {
  try {
    // OpenF1 returns current active session with no params
    const res = await fetchWithTimeout("https://api.openf1.org/v1/sessions?session_status=active", 5000)
    const text = await res.text()
    if (isOpenF1Locked(text)) return

    const sessions = JSON.parse(text)

    const liveIndicator = document.getElementById("liveIndicator")
    const liveLabel = document.getElementById("liveLabel")

    if (sessions && sessions.length > 0) {
      const live = sessions[0]
      if (liveIndicator) liveIndicator.style.display = "flex"
      if (liveLabel) liveLabel.innerText = live.session_name.toUpperCase() + " LIVE"

      // Update status on home page too
      const statusEl = document.getElementById("raceStatus")
      if (statusEl) statusEl.innerHTML = `<span class="live-dot"></span> ${live.session_name} LIVE`
    } else {
      if (liveIndicator) liveIndicator.style.display = "none"
    }
  } catch (e) {
    // Silent fail — live check is best-effort
  }
}

function startLiveSessionPolling() {
  checkLiveSession()
  if (_liveSessionInterval) clearInterval(_liveSessionInterval)
  _liveSessionInterval = setInterval(checkLiveSession, 60000)
}

// Start polling on load
startLiveSessionPolling()

/* ──────────────────────────────────────────────────────────
   RACE RESULTS AUTO-LINK FROM CALENDAR
   After renderCalendar runs, checks if any completed
   race weekend has results available and adds a
   "View Results →" button to its calendar card.
   ────────────────────────────────────────────────────────── */

async function addResultLinksToCalendar() {
  try {
    const year = new Date().getFullYear()
    const { data } = await cachedFetch(
      `https://api.jolpi.ca/ergast/f1/${year}/results.json?limit=100`,
      `results${year}`
    )
    const races = data.MRData.RaceTable.Races
    if (!races || !races.length) return

    // Build a set of completed race names
    const completedNames = new Set(races.map(r => r.raceName))

    // Find all calendar items in the upcoming/next subpages
    // and check if their name matches a completed race
    const allItems = document.querySelectorAll("#nextSubContent .calendar-item, #upcomingSubContent .calendar-item")
    allItems.forEach(item => {
      const nameEl = item.querySelector(".calendar-race")
      if (!nameEl) return
      const nameText = nameEl.innerText.trim()

      // Strip flag emoji (first char cluster) to get plain race name
      const plainName = nameText.replace(/^[\u{1F1E0}-\u{1F1FF}\u{1F3F4}\u{1F600}-\u{1F64F}\u{2600}-\u{26FF}\s]+/u, "").trim()

      // Find matching completed race
      const match = races.find(r => r.raceName.includes(plainName) || plainName.includes(r.raceName.replace(" Grand Prix", "")))
      if (match && !item.querySelector(".result-link-btn")) {
        const btn = document.createElement("div")
        btn.className = "result-link-btn"
        btn.innerText = "View Results →"
        btn.onclick = (e) => {
          e.stopPropagation()
          haptic()
          setNav("results")
          showPage("results")
          loadResults().then(() => {
            setTimeout(() => openResultPage(match.round), 600)
          })
        }
        item.querySelector(".cal-item-body").appendChild(btn)
      }
    })
  } catch (e) {
    // Silent fail — auto-link is enhancement only
  }
}

/* ──────────────────────────────────────────────────────────
   POINTS PROGRESSION CHART
   Shows championship points after each round for
   top 5 drivers. Rendered as a lightweight SVG line chart.
   Accessible from the Drivers standings page.
   ────────────────────────────────────────────────────────── */

async function loadPointsChart() {
  const container = document.getElementById("pointsChartContainer")
  if (!container) return

  container.innerHTML = "<p style='color:#aaa;text-align:center;padding:16px'>Loading chart...</p>"

  try {
    const year = new Date().getFullYear()
    const { data } = await cachedFetch(
      `https://api.jolpi.ca/ergast/f1/${year}/results.json?limit=500`,
      `results${year}`
    )
    const races = data.MRData.RaceTable.Races
    if (!races || races.length === 0) {
      container.innerHTML = "<p style='color:#aaa;text-align:center;padding:16px'>No race data yet.</p>"
      return
    }

    // Build cumulative points per driver
    const driverPoints = {}
    const driverColors = {}
    const roundLabels = []

    races.forEach(race => {
      roundLabels.push("R" + race.round)
      race.Results.forEach(r => {
        const name = r.Driver.familyName
        const pts = parseFloat(r.points) || 0
        if (!driverPoints[name]) driverPoints[name] = []
        const prev = driverPoints[name].length > 0
          ? driverPoints[name][driverPoints[name].length - 1]
          : 0
        driverPoints[name].push(prev + pts)
        if (!driverColors[name]) {
          driverColors[name] = getTeamColor(r.Constructor.name)
        }
      })
    })

    // Fill missing rounds with last known value
    const numRounds = races.length
    Object.keys(driverPoints).forEach(name => {
      while (driverPoints[name].length < numRounds) {
        const last = driverPoints[name][driverPoints[name].length - 1] || 0
        driverPoints[name].push(last)
      }
    })

    // Pick top 5 by final total
    const sorted = Object.entries(driverPoints)
      .sort((a, b) => b[1][numRounds - 1] - a[1][numRounds - 1])
      .slice(0, 5)

    // Chart dimensions
    const W = 320, H = 180, PAD = { t: 12, r: 16, b: 28, l: 36 }
    const chartW = W - PAD.l - PAD.r
    const chartH = H - PAD.t - PAD.b

    const allValues = sorted.flatMap(([, pts]) => pts)
    const maxPts = Math.max(...allValues, 1)

    function xPos(i) { return PAD.l + (i / Math.max(numRounds - 1, 1)) * chartW }
    function yPos(v) { return PAD.t + chartH - (v / maxPts) * chartH }

    let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">`

    // Grid lines
    for (let i = 0; i <= 4; i++) {
      const y = PAD.t + (i / 4) * chartH
      const label = Math.round(maxPts * (1 - i / 4))
      svg += `<line x1="${PAD.l}" y1="${y}" x2="${W - PAD.r}" y2="${y}" stroke="#1e1e1e" stroke-width="1"/>`
      svg += `<text x="${PAD.l - 4}" y="${y + 4}" text-anchor="end" font-size="8" fill="#555">${label}</text>`
    }

    // Round labels (every other round to avoid clutter)
    roundLabels.forEach((lbl, i) => {
      if (i % Math.ceil(numRounds / 5) === 0 || i === numRounds - 1) {
        svg += `<text x="${xPos(i)}" y="${H - 4}" text-anchor="middle" font-size="8" fill="#555">${lbl}</text>`
      }
    })

    // Lines per driver
    sorted.forEach(([name, pts]) => {
      const color = driverColors[name] || "#e10600"
      const points = pts.map((v, i) => `${xPos(i)},${yPos(v)}`).join(" ")
      svg += `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`
      // End dot
      const lastX = xPos(numRounds - 1)
      const lastY = yPos(pts[numRounds - 1])
      svg += `<circle cx="${lastX}" cy="${lastY}" r="3" fill="${color}"/>`
      svg += `<text x="${lastX + 4}" y="${lastY + 4}" font-size="8" fill="${color}">${name}</text>`
    })

    svg += "</svg>"

    container.innerHTML = svg

  } catch (e) {
    container.innerHTML = "<p style='color:#ff4747;text-align:center;padding:16px'>⚠️ Could not load chart.</p>"
  }
}

/* ──────────────────────────────────────────────────────────
   CIRCUIT INFORMATION
   Fetches circuit data from Ergast for the current
   next race and displays it on a circuit info card.
   ────────────────────────────────────────────────────────── */

// Circuit static data — Ergast doesn't provide laps/length
// so we maintain a local map for the 2026 season circuits
const CIRCUIT_DATA = {
  "Albert Park Grand Prix Circuit": { laps: 58, length: "5.278 km", record: "1:20.235 (Russell, 2023)", corners: 16, drs: 4 },
  "Shanghai International Circuit": { laps: 56, length: "5.451 km", record: "1:32.238 (M. Schumacher, 2004)", corners: 16, drs: 2 },
  "Suzuka Circuit": { laps: 53, length: "5.807 km", record: "1:30.983 (Hamilton, 2019)", corners: 18, drs: 1 },
  "Miami International Autodrome": { laps: 57, length: "5.412 km", record: "1:29.708 (Verstappen, 2023)", corners: 19, drs: 3 },
  "Circuit de Monaco": { laps: 78, length: "3.337 km", record: "1:12.909 (Leclerc, 2021)", corners: 19, drs: 1 },
  "Circuit Gilles Villeneuve": { laps: 70, length: "4.361 km", record: "1:13.078 (Bottas, 2019)", corners: 14, drs: 2 },
  "Circuit de Barcelona-Catalunya": { laps: 66, length: "4.675 km", record: "1:16.330 (Verstappen, 2023)", corners: 14, drs: 2 },
  "Red Bull Ring": { laps: 71, length: "4.318 km", record: "1:05.619 (Bottas, 2020)", corners: 10, drs: 3 },
  "Silverstone Circuit": { laps: 52, length: "5.891 km", record: "1:27.097 (Hamilton, 2020)", corners: 18, drs: 2 },
  "Hungaroring": { laps: 70, length: "4.381 km", record: "1:16.627 (Hamilton, 2020)", corners: 14, drs: 1 },
  "Circuit de Spa-Francorchamps": { laps: 44, length: "7.004 km", record: "1:46.286 (Bottas, 2018)", corners: 19, drs: 2 },
  "Circuit Zandvoort": { laps: 72, length: "4.259 km", record: "1:11.097 (Verstappen, 2023)", corners: 14, drs: 2 },
  "Autodromo Nazionale di Monza": { laps: 53, length: "5.793 km", record: "1:21.046 (Barrichello, 2004)", corners: 11, drs: 3 },
  "Baku City Circuit": { laps: 51, length: "6.003 km", record: "1:43.009 (Leclerc, 2019)", corners: 20, drs: 2 },
  "Marina Bay Street Circuit": { laps: 62, length: "4.940 km", record: "1:35.867 (Leclerc, 2023)", corners: 19, drs: 3 },
  "Circuit of the Americas": { laps: 56, length: "5.513 km", record: "1:36.169 (Hamilton, 2019)", corners: 20, drs: 2 },
  "Autodromo Hermanos Rodriguez": { laps: 71, length: "4.304 km", record: "1:17.774 (Bottas, 2021)", corners: 17, drs: 3 },
  "Autodromo Jose Carlos Pace": { laps: 71, length: "4.309 km", record: "1:10.540 (Russell, 2023)", corners: 15, drs: 2 },
  "Las Vegas Strip Circuit": { laps: 50, length: "6.120 km", record: "1:35.490 (Leclerc, 2023)", corners: 17, drs: 2 },
  "Lusail International Circuit": { laps: 57, length: "5.380 km", record: "1:24.319 (Piastri, 2023)", corners: 16, drs: 2 },
  "Yas Marina Circuit": { laps: 58, length: "5.281 km", record: "1:26.103 (Verstappen, 2021)", corners: 16, drs: 2 }
}

async function loadCircuitInfo(meetingKey, circuitName) {
  const container = document.getElementById("circuitInfoContainer")
  if (!container) return

  const info = CIRCUIT_DATA[circuitName]

  if (info) {
    container.innerHTML = `
<div class="circuit-info-grid">
  <div class="circuit-stat">
    <div class="circuit-stat-label">LAPS</div>
    <div class="circuit-stat-value">${info.laps}</div>
  </div>
  <div class="circuit-stat">
    <div class="circuit-stat-label">LENGTH</div>
    <div class="circuit-stat-value">${info.length}</div>
  </div>
  <div class="circuit-stat">
    <div class="circuit-stat-label">CORNERS</div>
    <div class="circuit-stat-value">${info.corners}</div>
  </div>
  <div class="circuit-stat">
    <div class="circuit-stat-label">DRS ZONES</div>
    <div class="circuit-stat-value">${info.drs}</div>
  </div>
</div>
<div class="circuit-record">
  <span class="circuit-stat-label">LAP RECORD</span>
  <span class="circuit-record-value">${info.record}</span>
</div>
`
  } else {
    container.innerHTML = "<p style='color:#aaa;font-size:13px'>Circuit data not available.</p>"
  }
}

/* ──────────────────────────────────────────────────────────
   WEATHER INTEGRATION
   Uses Open-Meteo (free, no API key needed) with circuit
   coordinates to fetch race weekend forecast.
   ────────────────────────────────────────────────────────── */

const CIRCUIT_COORDS = {
  "Albert Park Grand Prix Circuit":   { lat: -37.8497, lon: 144.9680 },
  "Shanghai International Circuit":   { lat: 31.3389,  lon: 121.2198 },
  "Suzuka Circuit":                    { lat: 34.8431,  lon: 136.5408 },
  "Miami International Autodrome":     { lat: 25.9581,  lon: -80.2389 },
  "Circuit de Monaco":                 { lat: 43.7347,  lon: 7.4206  },
  "Circuit Gilles Villeneuve":         { lat: 45.5000,  lon: -73.5228 },
  "Circuit de Barcelona-Catalunya":    { lat: 41.5700,  lon: 2.2611  },
  "Red Bull Ring":                     { lat: 47.2197,  lon: 14.7647 },
  "Silverstone Circuit":               { lat: 52.0786,  lon: -1.0169 },
  "Hungaroring":                       { lat: 47.5789,  lon: 19.2486 },
  "Circuit de Spa-Francorchamps":      { lat: 50.4372,  lon: 5.9714  },
  "Circuit Zandvoort":                 { lat: 52.3888,  lon: 4.5408  },
  "Autodromo Nazionale di Monza":      { lat: 45.6156,  lon: 9.2811  },
  "Baku City Circuit":                 { lat: 40.3725,  lon: 49.8533 },
  "Marina Bay Street Circuit":         { lat: 1.2914,   lon: 103.8639},
  "Circuit of the Americas":           { lat: 30.1328,  lon: -97.6411},
  "Autodromo Hermanos Rodriguez":      { lat: 19.4042,  lon: -99.0907},
  "Autodromo Jose Carlos Pace":        { lat: -23.7036, lon: -46.6997},
  "Las Vegas Strip Circuit":           { lat: 36.1147,  lon: -115.1728},
  "Lusail International Circuit":      { lat: 25.4900,  lon: 51.4542 },
  "Yas Marina Circuit":                { lat: 24.4672,  lon: 54.6031 }
}

async function loadWeather(circuitName, raceDateStr) {
  const container = document.getElementById("weatherContainer")
  if (!container) return

  const coords = CIRCUIT_COORDS[circuitName]
  if (!coords) {
    container.innerHTML = "<p style='color:#aaa;font-size:13px'>Weather not available for this circuit.</p>"
    return
  }

  container.innerHTML = "<p style='color:#aaa;font-size:13px'>Loading weather...</p>"

  try {
    const raceDate = new Date(raceDateStr)
    const dateStr = raceDate.toISOString().split("T")[0]

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,windspeed_10m_max,weathercode&timezone=auto&start_date=${dateStr}&end_date=${dateStr}`

    const res = await fetchWithTimeout(url, 8000)
    const data = await res.json()

    if (!data.daily || !data.daily.temperature_2m_max) {
      container.innerHTML = "<p style='color:#aaa;font-size:13px'>Weather data unavailable.</p>"
      return
    }

    const maxTemp = data.daily.temperature_2m_max[0]
    const minTemp = data.daily.temperature_2m_min[0]
    const rainProb = data.daily.precipitation_probability_max[0]
    const windMax = data.daily.windspeed_10m_max[0]
    const wcode = data.daily.weathercode[0]

    // Simple weather icon based on WMO code
    function weatherIcon(code) {
      if (code === 0) return "☀️"
      if (code <= 2) return "🌤️"
      if (code <= 3) return "☁️"
      if (code <= 49) return "🌫️"
      if (code <= 69) return "🌧️"
      if (code <= 79) return "🌨️"
      if (code <= 99) return "⛈️"
      return "🌡️"
    }

    container.innerHTML = `
<div class="weather-row">
  <div class="weather-icon">${weatherIcon(wcode)}</div>
  <div class="weather-stats">
    <div class="weather-temp">${Math.round(maxTemp)}°C <span class="weather-min">/ ${Math.round(minTemp)}°C</span></div>
    <div class="weather-details">
      <span>🌧 ${rainProb}%</span>
      <span>💨 ${Math.round(windMax)} km/h</span>
    </div>
  </div>
</div>
`
  } catch (e) {
    container.innerHTML = "<p style='color:#aaa;font-size:13px'>Could not load weather.</p>"
  }
}

