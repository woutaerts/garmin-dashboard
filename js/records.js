// Records — persoonlijke records, streaks en jaarlijkse volumedoelen.
// Leest alle activiteiten op en berekent alles client-side.

import { supabaseClient, THEME } from './config.js';

// ── Helpers ──────────────────────────────────────────────────────────────

function fmtPace(distanceM, durationSec) {
    if (!distanceM || !durationSec || distanceM < 100) return null;
    const sPerKm = durationSec / (distanceM / 1000);
    return `${Math.floor(sPerKm / 60)}:${String(Math.round(sPerKm % 60)).padStart(2, '0')} /km`;
}

function fmtDuration(sec) {
    if (!sec) return '-';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return h > 0 ? `${h}u ${m < 10 ? '0' : ''}${m}min` : `${m} min`;
}

function fmtDate(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('nl-BE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysAgo(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    const diff = Math.round((Date.now() - d.getTime()) / 86_400_000);
    if (diff === 0) return 'Vandaag';
    if (diff === 1) return 'Gisteren';
    return `${diff} dagen geleden`;
}

// PR binnen 30 dagen = vuuricoon
function prBadge(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    const days = Math.round((Date.now() - d.getTime()) / 86_400_000);
    if (days <= 30) return `<span class="pr-badge pr-badge--fire" title="PR in de afgelopen maand!">🔥 Nieuw</span>`;
    if (days <= 90) return `<span class="pr-badge pr-badge--fresh" title="PR in de afgelopen 90 dagen">✨ Recent</span>`;
    return '';
}

function toDateKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Recordberekeningen ────────────────────────────────────────────────────

function computeRunningRecords(acts) {
    // Langste duurloop
    const longest = acts.reduce((best, a) => (!best || a.distance > best.distance) ? a : best, null);
    // Beste 5K-tempo (duur ÷ distance * 5000, alleen als distance >= 4500m)
    const fiveKRuns = acts.filter(a => a.distance >= 4500);
    const bestPace = fiveKRuns.reduce((best, a) => {
        const pace = a.duration / (a.distance / 1000);
        return (!best || pace < best.pace) ? { pace, act: a } : best;
    }, null);
    // Hoogste cadans
    const bestCadence = acts.reduce((best, a) => (!a.average_cadence || a.average_cadence <= 0) ? best : (!best || a.average_cadence > best.average_cadence) ? a : best, null);

    return [
        longest ? {
            label: 'Langste duurloop',
            value: `${(longest.distance / 1000).toFixed(2)} km`,
            sub: fmtDuration(longest.duration),
            date: longest.start_time.slice(0, 10),
        } : null,
        bestPace ? {
            label: 'Beste 5K-tempo',
            value: fmtPace(5000, bestPace.pace * 5),
            sub: `${(bestPace.act.distance / 1000).toFixed(1)} km loop`,
            date: bestPace.act.start_time.slice(0, 10),
        } : null,
        bestCadence ? {
            label: 'Hoogste cadans',
            value: `${bestCadence.average_cadence} spm`,
            sub: bestCadence.activity_name,
            date: bestCadence.start_time.slice(0, 10),
        } : null,
    ].filter(Boolean);
}

function computeCyclingRecords(acts) {
    const fastest = acts.reduce((best, a) => (!a.max_speed_kmh || !best) ? (a.max_speed_kmh ? a : best) : (Number(a.max_speed_kmh) > Number(best.max_speed_kmh) ? a : best), null);
    const longest = acts.reduce((best, a) => (!best || a.distance > best.distance) ? a : best, null);
    const mostClimb = acts.reduce((best, a) => (!best || (a.elevation_gain || 0) > (best.elevation_gain || 0)) ? a : best, null);

    return [
        fastest ? {
            label: 'Max. snelheid',
            value: `${Number(fastest.max_speed_kmh).toFixed(1)} km/h`,
            sub: fastest.activity_name,
            date: fastest.start_time.slice(0, 10),
        } : null,
        longest ? {
            label: 'Langste rit',
            value: `${(longest.distance / 1000).toFixed(2)} km`,
            sub: fmtDuration(longest.duration),
            date: longest.start_time.slice(0, 10),
        } : null,
        mostClimb && mostClimb.elevation_gain ? {
            label: 'Meeste hoogtemeters',
            value: `${mostClimb.elevation_gain} m`,
            sub: `${(mostClimb.distance / 1000).toFixed(1)} km`,
            date: mostClimb.start_time.slice(0, 10),
        } : null,
    ].filter(Boolean);
}

function computeSwimmingRecords(acts) {
    const longest = acts.reduce((best, a) => (!best || a.distance > best.distance) ? a : best, null);
    const longest_time = acts.reduce((best, a) => (!best || a.duration > best.duration) ? a : best, null);

    return [
        longest ? {
            label: 'Langste afstand',
            value: `${Math.round(longest.distance)} m`,
            sub: fmtDuration(longest.duration),
            date: longest.start_time.slice(0, 10),
        } : null,
        longest_time && longest_time.activity_id !== longest?.activity_id ? {
            label: 'Langste sessie',
            value: fmtDuration(longest_time.duration),
            sub: `${Math.round(longest_time.distance || 0)} m`,
            date: longest_time.start_time.slice(0, 10),
        } : null,
    ].filter(Boolean);
}

function computeSkiingRecords(acts) {
    const fastest = acts.reduce((best, a) => (!a.max_speed_kmh || !best) ? (a.max_speed_kmh ? a : best) : (Number(a.max_speed_kmh) > Number(best.max_speed_kmh) ? a : best), null);
    const mostRuns = acts.reduce((best, a) => (!best || (a.lap_count || 0) > (best.lap_count || 0)) ? a : best, null);
    const mostDescent = acts.reduce((best, a) => (!best || (a.elevation_loss || 0) > (best.elevation_loss || 0)) ? a : best, null);

    return [
        fastest ? {
            label: 'Max. snelheid',
            value: `${Number(fastest.max_speed_kmh).toFixed(1)} km/h`,
            sub: fastest.activity_name,
            date: fastest.start_time.slice(0, 10),
        } : null,
        mostRuns && mostRuns.lap_count ? {
            label: 'Meeste afdalingen',
            value: `${mostRuns.lap_count}`,
            sub: fmtDate(mostRuns.start_time.slice(0, 10)),
            date: mostRuns.start_time.slice(0, 10),
        } : null,
        mostDescent && mostDescent.elevation_loss ? {
            label: 'Meeste hoogteverschil',
            value: `${mostDescent.elevation_loss} m`,
            sub: mostDescent.activity_name,
            date: mostDescent.start_time.slice(0, 10),
        } : null,
    ].filter(Boolean);
}

// ── Streak berekening ─────────────────────────────────────────────────────

function computeStreaks(allActs) {
    // Unieke actieve datums, gesorteerd oplopend
    const days = [...new Set(allActs.map(a => a.start_time.slice(0, 10)))].sort();
    if (days.length === 0) return { current: 0, longest: 0, longestEnd: null };

    let longest = 1, longestEnd = days[0];
    let run = 1;

    for (let i = 1; i < days.length; i++) {
        const prev = new Date(days[i - 1] + 'T12:00:00');
        const curr = new Date(days[i] + 'T12:00:00');
        const diff = Math.round((curr - prev) / 86_400_000);
        if (diff === 1) {
            run++;
            if (run > longest) { longest = run; longestEnd = days[i]; }
        } else {
            run = 1;
        }
    }

    // Huidige streak: tel terug vanaf vandaag/gisteren
    const todayKey = toDateKey(new Date());
    const yesterdayKey = toDateKey(new Date(Date.now() - 86_400_000));
    let current = 0;
    const daySet = new Set(days);

    if (daySet.has(todayKey) || daySet.has(yesterdayKey)) {
        let check = new Date(daySet.has(todayKey) ? todayKey + 'T12:00:00' : yesterdayKey + 'T12:00:00');
        while (daySet.has(toDateKey(check))) {
            current++;
            check = new Date(check.getTime() - 86_400_000);
        }
    }

    return { current, longest, longestEnd };
}

// ── Jaarvolume ────────────────────────────────────────────────────────────

function computeYearVolume(allActs) {
    const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();
    const yearActs = allActs.filter(a => a.start_time >= yearStart);

    const totalKm = { running: 0, cycling: 0 };
    const totalCount = {};

    yearActs.forEach(a => {
        const k = (a.activity_type || '').toLowerCase();
        if (k.includes('run') || k.includes('marathon') || k.includes('treadmill')) totalKm.running += (a.distance || 0) / 1000;
        if (k.includes('cycl') || k.includes('bik')) totalKm.cycling += (a.distance || 0) / 1000;
        const cat = k.includes('run') || k.includes('marathon') ? 'Lopen'
            : k.includes('cycl') || k.includes('bik') ? 'Fietsen'
            : k.includes('swim') ? 'Zwemmen'
            : k.includes('strength') || k.includes('weight') || k.includes('fitness') ? 'Kracht'
            : 'Overig';
        totalCount[cat] = (totalCount[cat] || 0) + 1;
    });

    return { totalKm, totalCount, total: yearActs.length };
}

// ── HTML bouwers ──────────────────────────────────────────────────────────

function renderSportBlock(title, color, icon, records) {
    if (records.length === 0) return '';

    const cards = records.map(r => `
        <div class="pr-card">
            <div class="pr-card-top">
                <p class="pr-label">${r.label}</p>
                ${prBadge(r.date)}
            </div>
            <p class="pr-value">${r.value}</p>
            <p class="pr-sub">${r.sub}</p>
            <p class="pr-date">${fmtDate(r.date)} <span class="pr-ago">(${daysAgo(r.date)})</span></p>
        </div>`).join('');

    return `
        <div class="pr-sport-block">
            <div class="pr-sport-header">
                <div class="pr-sport-badge" style="background:${color}">
                    <img src="icons/sports/${icon}" alt="${title}" class="pr-sport-icon">
                </div>
                <h3 class="pr-sport-title">${title}</h3>
            </div>
            <div class="pr-grid">${cards}</div>
        </div>`;
}

function renderStreaks({ current, longest, longestEnd }) {
    const longestDate = longestEnd ? fmtDate(longestEnd) : '—';
    return `
        <div class="streak-grid">
            <div class="card streak-card">
                <p class="streak-icon">🔥</p>
                <p class="streak-value">${current}</p>
                <p class="streak-label">Dagen op rij</p>
            </div>
            <div class="card streak-card">
                <p class="streak-icon">🏆</p>
                <p class="streak-value">${longest}</p>
                <p class="streak-label">Langste streak</p>
                <p class="streak-sub">${longestDate}</p>
            </div>
        </div>`;
}

function renderVolume({ totalKm, totalCount, total }) {
    const RUNNING_GOAL = 800;
    const CYCLING_GOAL = 600;
    const runPct = Math.min((totalKm.running / RUNNING_GOAL) * 100, 100).toFixed(1);
    const cycPct = Math.min((totalKm.cycling / CYCLING_GOAL) * 100, 100).toFixed(1);

    const topCats = Object.entries(totalCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);
    const maxCount = topCats[0]?.[1] || 1;

    const barRows = topCats.map(([cat, cnt]) => {
        const pct = ((cnt / maxCount) * 100).toFixed(1);
        return `
            <div class="vol-cat-row">
                <span class="vol-cat-label">${cat}</span>
                <div class="vol-bar-bg"><div class="vol-bar-fill" style="width:${pct}%;background:var(--color-training)"></div></div>
                <span class="vol-cat-count">${cnt}×</span>
            </div>`;
    }).join('');

    return `
        <div class="vol-section">
            <div class="vol-goal">
                <div class="vol-goal-header">
                    <span class="vol-goal-label">🏃 Hardlopen dit jaar</span>
                    <span class="vol-goal-stat">${totalKm.running.toFixed(1)} / ${RUNNING_GOAL} km</span>
                </div>
                <div class="vol-goal-track">
                    <div class="vol-goal-fill" style="width:${runPct}%;background:${THEME.sportRunning}"></div>
                </div>
                <p class="vol-goal-pct">${runPct}% van jaardoel</p>
            </div>
            <div class="vol-goal">
                <div class="vol-goal-header">
                    <span class="vol-goal-label">🚴 Fietsen dit jaar</span>
                    <span class="vol-goal-stat">${totalKm.cycling.toFixed(1)} / ${CYCLING_GOAL} km</span>
                </div>
                <div class="vol-goal-track">
                    <div class="vol-goal-fill" style="width:${cycPct}%;background:${THEME.sportCycling}"></div>
                </div>
                <p class="vol-goal-pct">${cycPct}% van jaardoel</p>
            </div>
            <div class="vol-cats">
                <p class="vol-cats-title">Activiteiten per categorie dit jaar (${total} totaal)</p>
                ${barRows}
            </div>
        </div>`;
}

// ── Hoofdfunctie ──────────────────────────────────────────────────────────

export async function buildRecords() {
    const container = document.getElementById('records-container');
    if (!container) return;
    container.innerHTML = `<p class="hm-skeleton">Records worden geladen…</p>`;

    const { data: allActs, error } = await supabaseClient
        .from('garmin_activities')
        .select('activity_id, activity_name, activity_type, start_time, distance, duration, elevation_gain, elevation_loss, max_speed_kmh, average_speed_kmh, average_cadence, lap_count, calories')
        .order('start_time', { ascending: false });

    if (error || !allActs || allActs.length === 0) {
        container.innerHTML = `<p class="hm-skeleton">Geen activiteiten gevonden.</p>`;
        return;
    }

    // Splits per sportcategorie
    const byType = { running: [], cycling: [], swimming: [], skiing: [] };
    allActs.forEach(a => {
        const k = (a.activity_type || '').toLowerCase();
        if (k.includes('run') || k.includes('marathon') || k.includes('treadmill')) byType.running.push(a);
        else if (k.includes('cycl') || k.includes('bik')) byType.cycling.push(a);
        else if (k.includes('swim')) byType.swimming.push(a);
        else if (k.includes('ski') || k.includes('snow')) byType.skiing.push(a);
    });

    const streaks = computeStreaks(allActs);
    const volume = computeYearVolume(allActs);

    const sportsHTML = [
        byType.running.length  ? renderSportBlock('Hardlopen', THEME.sportRunning,  'run.svg',           computeRunningRecords(byType.running))  : '',
        byType.cycling.length  ? renderSportBlock('Fietsen',   THEME.sportCycling,  'biking.svg',        computeCyclingRecords(byType.cycling))  : '',
        byType.swimming.length ? renderSportBlock('Zwemmen',   THEME.sportSwimming, 'swimming.svg',      computeSwimmingRecords(byType.swimming)) : '',
        byType.skiing.length   ? renderSportBlock('Skiën',     THEME.sportSkiing,   'alpine-skiing.svg', computeSkiingRecords(byType.skiing))    : '',
    ].join('');

    container.innerHTML = `
        <div class="records-layout">
            <div class="records-main">${sportsHTML}</div>
            <div class="records-sidebar">
                <h3 class="sidebar-section-title">Activiteitsstreaks</h3>
                ${renderStreaks(streaks)}
                <h3 class="sidebar-section-title" style="margin-top:32px">Volumedoelen</h3>
                ${renderVolume(volume)}
            </div>
        </div>`;
}
