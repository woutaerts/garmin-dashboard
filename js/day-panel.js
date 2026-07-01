// Dag-detailpaneel: toont activiteiten én dagmetrieken voor een gekozen datum.
// Wordt geopend via een klik op een heatmap-cel of via toetsenbord (← →).

import { supabaseClient, THEME } from './config.js';

let currentDate = null;

// ── Hulpfuncties ──────────────────────────────────────────────────────────

function toKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(dateStr, n) {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return toKey(d);
}

function fmtLongDate(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return {
        dow: d.toLocaleDateString('nl-BE', { weekday: 'long' }),
        short: d.toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' }),
    };
}

function fmtDuration(seconds) {
    if (!seconds) return null;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}u ${m < 10 ? '0' : ''}${m}min`;
    return `${m} min`;
}

function fmtPace(distanceM, durationSec) {
    if (!distanceM || !durationSec || distanceM < 100) return null;
    const pps = durationSec / (distanceM / 1000);
    return `${Math.floor(pps / 60)}:${String(Math.round(pps % 60)).padStart(2, '0')} /km`;
}

// Minimale sportconfig (subset van activities.js — vermijdt circulaire import)
const SPORT_MAP = {
    run: { color: THEME.sportRunning, icon: 'run.svg' },
    marathon: { color: THEME.sportRunning, icon: 'marathon.svg' },
    treadmill: { color: THEME.sportRunning, icon: 'treadmill-running.svg' },
    cycl: { color: THEME.sportCycling, icon: 'biking.svg' },
    bik: { color: THEME.sportCycling, icon: 'biking.svg' },
    swim: { color: THEME.sportSwimming, icon: 'swimming.svg' },
    ski: { color: THEME.sportSkiing, icon: 'alpine-skiing.svg' },
    snow: { color: THEME.sportSkiing, icon: 'alpine-skiing.svg' },
    strength: { color: THEME.sportStrength, icon: 'barbells.svg' },
    weight: { color: THEME.sportStrength, icon: 'barbells.svg' },
    cardio: { color: THEME.sportStrength, icon: 'fitness.svg' },
    fitness: { color: THEME.sportStrength, icon: 'fitness.svg' },
    soccer: { color: THEME.sportBall, icon: 'playing-soccer.svg' },
    football: { color: THEME.sportBall, icon: 'playing-soccer.svg' },
    padel: { color: THEME.sportBall, icon: 'playing-tennis.svg' },
    tennis: { color: THEME.sportBall, icon: 'playing-tennis.svg' },
    basketball: { color: THEME.sportBall, icon: 'playing-basketball.svg' },
    hik: { color: THEME.sportOutdoor, icon: 'hiking.svg' },
    walk: { color: THEME.sportOutdoor, icon: 'walk.svg' },
    yoga: { color: THEME.sportMindbody, icon: 'meditation.svg' },
    row: { color: THEME.sportRowing, icon: 'rowing-machine.svg' },
    golf: { color: THEME.sportGolf, icon: 'playing-golf.svg' },
    box: { color: THEME.sportBoxing, icon: 'boxing.svg' },
};

function getSportStyle(activityType) {
    const key = (activityType || '').toLowerCase();
    for (const kw of Object.keys(SPORT_MAP)) {
        if (key.includes(kw)) return SPORT_MAP[kw];
    }
    return { color: THEME.sportDefault, icon: 'fitness.svg' };
}

// ── HTML-bouwers ──────────────────────────────────────────────────────────

function buildZoneBar(act) {
    const zones = [
        { v: act.hr_zone_1 || 0, c: THEME.zone1 },
        { v: act.hr_zone_2 || 0, c: THEME.zone2 },
        { v: act.hr_zone_3 || 0, c: THEME.zone3 },
        { v: act.hr_zone_4 || 0, c: THEME.zone4 },
        { v: act.hr_zone_5 || 0, c: THEME.zone5 },
    ];
    const total = zones.reduce((s, z) => s + z.v, 0);
    if (total === 0) return '';
    const segs = zones.filter(z => z.v > 0).map(z => {
        const pct = ((z.v / total) * 100).toFixed(1);
        return `<div class="panel-zone-seg" style="width:${pct}%;background:${z.c}" title="${pct}%"></div>`;
    }).join('');
    return `<div class="panel-zone-bar">${segs}</div>`;
}

function buildActivitiesHTML(activities) {
    if (!activities || activities.length === 0) {
        return `<p class="panel-empty">Geen activiteiten op deze dag.</p>`;
    }
    return activities.map(act => {
        const { color, icon } = getSportStyle(act.activity_type);
        const meta = [];
        if (act.distance > 100) meta.push(`${(act.distance / 1000).toFixed(2)} km`);
        const isRun = (act.activity_type || '').toLowerCase().includes('run');
        const pace = isRun ? fmtPace(act.distance, act.duration) : null;
        if (pace) meta.push(pace);
        else if (act.average_speed_kmh) meta.push(`${Number(act.average_speed_kmh).toFixed(1)} km/h`);
        const dur = fmtDuration(act.duration);
        if (dur) meta.push(dur);
        if (act.calories) meta.push(`${act.calories} kcal`);

        return `
            <div class="panel-activity">
                <div class="panel-act-badge" style="background:${color}">
                    <img src="icons/sports/${icon}" alt="${act.activity_type}">
                </div>
                <div style="min-width:0;flex:1">
                    <p class="panel-act-name">${act.activity_name || act.activity_type}</p>
                    <p class="panel-act-meta">${meta.join(' · ')}</p>
                    ${buildZoneBar(act)}
                </div>
            </div>`;
    }).join('');
}

function buildMetricsHTML(metrics) {
    if (!metrics) return `<p class="panel-empty">Geen dagmetrieken voor deze dag.</p>`;

    const FIELDS = [
        { label: 'Slaapscore', key: 'sleep_score', color: THEME.sleep, unit: '', dec: 0 },
        { label: 'HRV', key: 'hrv_nightly_avg', color: THEME.hrv, unit: 'ms', dec: 0 },
        { label: 'Rusthartslag', key: 'resting_hr', color: THEME.rhr, unit: 'bpm', dec: 0 },
        { label: 'Stress', key: 'avg_stress', color: THEME.stress, unit: '', dec: 0 },
        { label: 'Body Battery', key: 'body_battery_high', color: THEME.bodyBattery, unit: '', dec: 0 },
        { label: 'VO₂ Max', key: 'vo2_max', color: THEME.vo2max, unit: '', dec: 1 },
    ];

    const cards = FIELDS
        .filter(f => metrics[f.key] != null && Number(metrics[f.key]) > 0)
        .map(f => `
            <div class="panel-metric">
                <p class="panel-metric-label">${f.label}</p>
                <p class="panel-metric-value" style="color:${f.color}">
                    ${Number(metrics[f.key]).toFixed(f.dec)}<span class="panel-metric-unit">${f.unit ? ' ' + f.unit : ''}</span>
                </p>
            </div>`).join('');

    return cards || `<p class="panel-empty">Geen dagmetrieken voor deze dag.</p>`;
}

// ── Datumkopregel updaten ─────────────────────────────────────────────────

function updateHeader(dateStr) {
    const { dow, short } = fmtLongDate(dateStr);
    document.getElementById('panel-date').textContent = short;
    document.getElementById('panel-date-dow').textContent = dow;

    const today = toKey(new Date());
    document.getElementById('panel-next').disabled = dateStr >= today;
}

// ── Data ophalen & renderen ───────────────────────────────────────────────

async function load(dateStr) {
    currentDate = dateStr;
    updateHeader(dateStr);

    const body = document.getElementById('panel-body');
    body.innerHTML = `<div class="panel-empty">Laden…</div>`;

    const [{ data: activities }, { data: metricsRows }] = await Promise.all([
        supabaseClient
            .from('garmin_activities')
            .select('*')
            .gte('start_time', dateStr + 'T00:00:00')
            .lte('start_time', dateStr + 'T23:59:59')
            .order('start_time'),
        supabaseClient
            .from('daily_metrics')
            .select('*')
            .eq('date', dateStr)
            .limit(1),
    ]);

    const metrics = metricsRows?.[0] || null;

    body.innerHTML = `
        <div>
            <p class="panel-section-label">Activiteiten</p>
            ${buildActivitiesHTML(activities)}
        </div>
        <div>
            <p class="panel-section-label">Dagmetrieken</p>
            <div class="panel-metrics-grid">${buildMetricsHTML(metrics)}</div>
        </div>`;
}

// ── Publieke API ──────────────────────────────────────────────────────────

export function openDayPanel(dateStr) {
    document.getElementById('day-panel').classList.add('is-open');
    document.getElementById('panel-backdrop').classList.remove('hidden');
    requestAnimationFrame(() =>
        document.getElementById('panel-backdrop').classList.add('is-open')
    );
    document.body.style.overflow = 'hidden';
    load(dateStr);
}

export function closeDayPanel() {
    const backdrop = document.getElementById('panel-backdrop');
    document.getElementById('day-panel').classList.remove('is-open');
    backdrop.classList.remove('is-open');
    document.body.style.overflow = '';
    setTimeout(() => backdrop.classList.add('hidden'), 300);
}

export function initDayPanel() {
    document.getElementById('panel-close').addEventListener('click', closeDayPanel);
    document.getElementById('panel-backdrop').addEventListener('click', closeDayPanel);

    document.getElementById('panel-prev').addEventListener('click', () => {
        if (currentDate) load(addDays(currentDate, -1));
    });

    document.getElementById('panel-next').addEventListener('click', () => {
        const today = toKey(new Date());
        if (currentDate && currentDate < today) load(addDays(currentDate, 1));
    });

    // Pijltoetsen en Escape terwijl het paneel open is
    document.addEventListener('keydown', e => {
        if (!document.getElementById('day-panel').classList.contains('is-open')) return;
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            if (currentDate) load(addDays(currentDate, -1));
        }
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            const today = toKey(new Date());
            if (currentDate && currentDate < today) load(addDays(currentDate, 1));
        }
        if (e.key === 'Escape') closeDayPanel();
    });
}