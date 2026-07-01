// Activiteitenlijst: icoonmapping, sport-specifieke statistieken en
// het uitklapbare detailpaneel.

import { supabaseClient, THEME } from './config.js';

// Eén kleur per sportcategorie (icoon zelf wordt via CSS altijd wit gemaakt).
const ACTIVITY_CONFIG = {
    // Hardlopen
    running: { icon: 'run.svg', bg: THEME.sportRunning },
    trail_running: { icon: 'marathon.svg', bg: THEME.sportRunning },
    treadmill_running: { icon: 'treadmill-running.svg', bg: THEME.sportRunning },
    virtual_run: { icon: 'run.svg', bg: THEME.sportRunning },
    marathon: { icon: 'marathon.svg', bg: THEME.sportRunning },

    // Fietsen
    cycling: { icon: 'biking.svg', bg: THEME.sportCycling },
    road_biking: { icon: 'biking.svg', bg: THEME.sportCycling },
    mountain_biking: { icon: 'biking-mountain.svg', bg: THEME.sportCycling },
    indoor_cycling: { icon: 'biking.svg', bg: THEME.sportCycling },
    virtual_cycling: { icon: 'biking.svg', bg: THEME.sportCycling },
    gravel_cycling: { icon: 'biking.svg', bg: THEME.sportCycling },

    // Zwemmen
    swimming: { icon: 'swimming.svg', bg: THEME.sportSwimming },
    pool_swimming: { icon: 'swimming.svg', bg: THEME.sportSwimming },
    open_water_swimming: { icon: 'swimming.svg', bg: THEME.sportSwimming },
    lap_swimming: { icon: 'swimming.svg', bg: THEME.sportSwimming },

    // Skiën
    alpine_skiing: { icon: 'alpine-skiing.svg', bg: THEME.sportSkiing },
    skiing: { icon: 'alpine-skiing.svg', bg: THEME.sportSkiing },
    resort_skiing_snowboarding_ws: { icon: 'alpine-skiing.svg', bg: THEME.sportSkiing },
    backcountry_skiing: { icon: 'alpine-skiing.svg', bg: THEME.sportSkiing },
    cross_country_skiing: { icon: 'cross-country-skiing.svg', bg: THEME.sportSkiing },
    freestyle_skiing: { icon: 'freestyle-skiing.svg', bg: THEME.sportSkiing },

    // Kracht & fitness
    strength_training: { icon: 'barbells.svg', bg: THEME.sportStrength },
    weight_training: { icon: 'barbells.svg', bg: THEME.sportStrength },
    indoor_cardio: { icon: 'fitness.svg', bg: THEME.sportStrength },
    fitness_equipment: { icon: 'fitness.svg', bg: THEME.sportStrength },
    cardio: { icon: 'fitness.svg', bg: THEME.sportStrength },
    elliptical: { icon: 'elliptical.svg', bg: THEME.sportStrength },

    // Balsporten
    soccer: { icon: 'playing-soccer.svg', bg: THEME.sportBall },
    football: { icon: 'playing-soccer.svg', bg: THEME.sportBall },
    indoor_soccer: { icon: 'playing-soccer.svg', bg: THEME.sportBall },
    padel: { icon: 'playing-tennis.svg', bg: THEME.sportBall },
    tennis: { icon: 'playing-tennis.svg', bg: THEME.sportBall },
    squash: { icon: 'playing-tennis.svg', bg: THEME.sportBall },
    basketball: { icon: 'playing-basketball.svg', bg: THEME.sportBall },
    volleyball: { icon: 'playing-volleyball.svg', bg: THEME.sportBall },
    badminton: { icon: 'playing-badminton.svg', bg: THEME.sportBall },

    // Outdoor
    hiking: { icon: 'hiking.svg', bg: THEME.sportOutdoor },
    walking: { icon: 'walk.svg', bg: THEME.sportOutdoor },
    rock_climbing: { icon: 'rock-climbing.svg', bg: THEME.sportOutdoor },
    climbing: { icon: 'rock-climbing.svg', bg: THEME.sportOutdoor },

    // Water
    kayaking: { icon: 'kayaking.svg', bg: THEME.sportWater },
    canoe_kayak: { icon: 'kayaking.svg', bg: THEME.sportWater },

    // Mind-body
    yoga: { icon: 'meditation.svg', bg: THEME.sportMindbody },
    pilates: { icon: 'meditation.svg', bg: THEME.sportMindbody },

    // Roeien
    rowing: { icon: 'rowing-machine.svg', bg: THEME.sportRowing },
    rowing_machine: { icon: 'rowing-machine.svg', bg: THEME.sportRowing },
    indoor_rowing: { icon: 'rowing-machine.svg', bg: THEME.sportRowing },

    // Overig
    golf: { icon: 'playing-golf.svg', bg: THEME.sportGolf },
    boxing: { icon: 'boxing.svg', bg: THEME.sportBoxing },
    kickboxing: { icon: 'boxing.svg', bg: THEME.sportBoxing },
};

const DEFAULT_CONFIG = { icon: 'fitness.svg', bg: THEME.sportDefault };

// Exacte match → keyword-fallback → default icoon
function getActivityConfig(activityType) {
    const key = (activityType || '').toLowerCase();
    if (ACTIVITY_CONFIG[key]) return ACTIVITY_CONFIG[key];

    if (key.includes('run')) return ACTIVITY_CONFIG.running;
    if (key.includes('cycl') || key.includes('bik')) return ACTIVITY_CONFIG.cycling;
    if (key.includes('swim')) return ACTIVITY_CONFIG.swimming;
    if (key.includes('ski') && !key.includes('cross')) return ACTIVITY_CONFIG.alpine_skiing;
    if (key.includes('cross') && key.includes('ski')) return ACTIVITY_CONFIG.cross_country_skiing;
    if (key.includes('strength') || key.includes('weight')) return ACTIVITY_CONFIG.strength_training;
    if (key.includes('soccer') || key.includes('football')) return ACTIVITY_CONFIG.soccer;
    if (key.includes('padel') || key.includes('tennis')) return ACTIVITY_CONFIG.padel;
    if (key.includes('hik')) return ACTIVITY_CONFIG.hiking;
    if (key.includes('walk')) return ACTIVITY_CONFIG.walking;
    if (key.includes('yoga')) return ACTIVITY_CONFIG.yoga;
    if (key.includes('row')) return ACTIVITY_CONFIG.rowing;
    if (key.includes('box')) return ACTIVITY_CONFIG.boxing;
    if (key.includes('climb')) return ACTIVITY_CONFIG.climbing;
    if (key.includes('golf')) return ACTIVITY_CONFIG.golf;

    return DEFAULT_CONFIG;
}

function formatDuration(seconds) {
    if (!seconds) return '-';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}u ${m < 10 ? '0' : ''}${m}min`;
    return `${m}:${s < 10 ? '0' : ''}${s} min`;
}

function formatPace(distanceM, durationSec) {
    if (!distanceM || !durationSec || distanceM < 10) return null;
    const paceSecPerKm = durationSec / (distanceM / 1000);
    const paceMin = Math.floor(paceSecPerKm / 60);
    const paceSec = Math.round(paceSecPerKm % 60);
    return `${paceMin}:${String(paceSec).padStart(2, '0')}`;
}

function formatZoneTime(seconds) {
    if (!seconds) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

// Hartslagzone-balk voor één activiteit (zelfde kleuren als de zone-verdeling).
function buildHRZoneBar(act) {
    const zones = [
        { val: act.hr_zone_1 || 0, color: THEME.zone1, label: 'Z1' },
        { val: act.hr_zone_2 || 0, color: THEME.zone2, label: 'Z2' },
        { val: act.hr_zone_3 || 0, color: THEME.zone3, label: 'Z3' },
        { val: act.hr_zone_4 || 0, color: THEME.zone4, label: 'Z4' },
        { val: act.hr_zone_5 || 0, color: THEME.zone5, label: 'Z5' },
    ];
    const total = zones.reduce((sum, z) => sum + z.val, 0);
    if (total === 0) return '';

    const segments = zones
        .filter(z => z.val > 0)
        .map(z => {
            const pct = ((z.val / total) * 100).toFixed(1);
            return `<div class="zone-segment" style="width:${pct}%;background:${z.color};" title="${z.label}: ${formatZoneTime(z.val)} (${pct}%)"></div>`;
        }).join('');

    const labels = zones.map(z => {
        const dim = z.val === 0 ? ' zone-label-dim' : '';
        return `<div class="zone-label${dim}">
            <span class="zone-dot" style="background:${z.color}"></span>
            <span>${z.label}</span>
            <span class="zone-time">${formatZoneTime(z.val)}</span>
        </div>`;
    }).join('');

    return `
        <div class="hr-zones-section">
            <p class="detail-section-title">Hartslagzones</p>
            <div class="zone-bar">${segments}</div>
            <div class="zone-labels">${labels}</div>
        </div>`;
}

// Bepaalt welke statistieken relevant zijn per sporttype.
function getSportDetails(act) {
    const key = (act.activity_type || '').toLowerCase();
    const distanceKm = act.distance ? (act.distance / 1000).toFixed(2) : null;
    const distanceM = act.distance ? Math.round(act.distance) : null;
    const dur = act.duration || 0;
    const durFmt = formatDuration(dur);

    let headerStat, headerSubstat, detailStats;

    const isRunning = key.includes('run') || key.includes('marathon') || key.includes('treadmill');
    if (isRunning) {
        const pace = formatPace(act.distance, dur);
        headerStat = distanceKm ? `${distanceKm} km` : durFmt;
        headerSubstat = pace ? `${pace} min/km` : durFmt;
        detailStats = [
            { title: 'Gem. tempo', value: pace, unit: 'min/km' },
            { title: 'Gem. hartslag', value: act.average_hr, unit: 'bpm' },
            { title: 'Max. hartslag', value: act.max_hr, unit: 'bpm' },
            { title: 'Totale duur', value: durFmt, unit: '' },
            { title: 'Hoogtemeters', value: act.elevation_gain, unit: 'm' },
            { title: 'Calorieën', value: act.calories, unit: 'kcal' },
        ];

    } else if (key.includes('swim')) {
        headerStat = distanceM ? `${distanceM} m` : durFmt;
        headerSubstat = durFmt;
        detailStats = [
            { title: 'Afstand', value: distanceM, unit: 'm' },
            { title: 'Duur', value: durFmt, unit: '' },
            { title: 'Calorieën', value: act.calories, unit: 'kcal' },
            { title: 'Gem. hartslag', value: act.average_hr, unit: 'bpm' },
            { title: 'Max. hartslag', value: act.max_hr, unit: 'bpm' },
        ];

    } else if ((key.includes('ski') || key.includes('snow')) && !key.includes('cross') && !key.includes('nordic')) {
        const laps = act.lap_count;
        headerStat = distanceKm ? `${distanceKm} km` : durFmt;
        headerSubstat = laps ? `${laps} afdaling${laps !== 1 ? 'en' : ''}` : durFmt;
        detailStats = [
            { title: 'Max. snelheid', value: act.max_speed_kmh ? Number(act.max_speed_kmh).toFixed(1) : null, unit: 'km/h' },
            { title: 'Tot. afdaling', value: act.elevation_loss, unit: 'm' },
            { title: 'Aantal dalen', value: laps, unit: '' },
            { title: 'Afstand', value: distanceKm, unit: 'km' },
            { title: 'Calorieën', value: act.calories, unit: 'kcal' },
        ];

    } else if (key.includes('cycl') || key.includes('bik')) {
        const avgSpd = act.average_speed_kmh ? Number(act.average_speed_kmh).toFixed(1) : null;
        const maxSpd = act.max_speed_kmh ? Number(act.max_speed_kmh).toFixed(1) : null;
        headerStat = distanceKm ? `${distanceKm} km` : durFmt;
        headerSubstat = avgSpd ? `${avgSpd} km/h` : durFmt;
        detailStats = [
            { title: 'Gem. snelheid', value: avgSpd, unit: 'km/h' },
            { title: 'Max. snelheid', value: maxSpd, unit: 'km/h' },
            { title: 'Afstand', value: distanceKm, unit: 'km' },
            { title: 'Gem. hartslag', value: act.average_hr, unit: 'bpm' },
            { title: 'Hoogtemeters', value: act.elevation_gain, unit: 'm' },
            { title: 'Calorieën', value: act.calories, unit: 'kcal' },
        ];

    } else if (['soccer', 'football', 'indoor_soccer', 'padel', 'tennis', 'squash', 'basketball', 'volleyball', 'badminton'].includes(key)
        || key.includes('soccer') || key.includes('padel') || key.includes('tennis') || key.includes('football') || key.includes('basketball')) {
        const maxSpd = act.max_speed_kmh ? Number(act.max_speed_kmh).toFixed(1) : null;
        headerStat = distanceKm ? `${distanceKm} km` : durFmt;
        headerSubstat = maxSpd ? `Max ${maxSpd} km/h` : durFmt;
        detailStats = [
            { title: 'Max. snelheid', value: maxSpd, unit: 'km/h' },
            { title: 'Afstand', value: distanceKm, unit: 'km' },
            { title: 'Duur', value: durFmt, unit: '' },
            { title: 'Gem. hartslag', value: act.average_hr, unit: 'bpm' },
            { title: 'Max. hartslag', value: act.max_hr, unit: 'bpm' },
            { title: 'Calorieën', value: act.calories, unit: 'kcal' },
        ];

    } else if (key.includes('hik') || key.includes('walk')) {
        const pace = formatPace(act.distance, dur);
        headerStat = distanceKm ? `${distanceKm} km` : durFmt;
        headerSubstat = pace ? `${pace} min/km` : durFmt;
        detailStats = [
            { title: 'Afstand', value: distanceKm, unit: 'km' },
            { title: 'Duur', value: durFmt, unit: '' },
            { title: 'Hoogtemeters', value: act.elevation_gain, unit: 'm' },
            { title: 'Gem. hartslag', value: act.average_hr, unit: 'bpm' },
            { title: 'Max. hartslag', value: act.max_hr, unit: 'bpm' },
            { title: 'Calorieën', value: act.calories, unit: 'kcal' },
        ];

    } else {
        // Kracht, cardio en alle overige types
        headerStat = act.calories ? `${act.calories} kcal` : durFmt;
        headerSubstat = durFmt;
        detailStats = [
            { title: 'Duur', value: durFmt, unit: '' },
            { title: 'Gem. hartslag', value: act.average_hr, unit: 'bpm' },
            { title: 'Max. hartslag', value: act.max_hr, unit: 'bpm' },
            { title: 'Aeroob TE', value: act.aerobic_te, unit: '' },
            { title: 'Anaeroob TE', value: act.anaerobic_te, unit: '' },
            { title: 'Calorieën', value: act.calories, unit: 'kcal' },
        ];
    }

    // Extra basismetrieken onderaan, alleen tonen waar ze nog niet in de grid staan
    const baseMetrics = [];
    const isDefaultCategory = !isRunning && !key.includes('swim') && !key.includes('ski') && !key.includes('cycl') && !key.includes('bik');
    if (act.aerobic_te && !isDefaultCategory) baseMetrics.push({ label: 'Aeroob TE', value: act.aerobic_te });
    if (act.anaerobic_te && !isDefaultCategory) baseMetrics.push({ label: 'Anaeroob TE', value: act.anaerobic_te });
    if (act.training_load) baseMetrics.push({ label: 'Training load', value: act.training_load });
    if (act.vo2_max && isRunning) baseMetrics.push({ label: 'VO₂ Max', value: act.vo2_max });

    return { headerStat, headerSubstat, detailStats, baseMetrics };
}

// Rendert een array van activiteiten in de container — ook aanroepbaar vanuit filters.js.
export function buildActivitiesFromData(data) {
    const container = document.getElementById('activities-container');
    if (!container) return;
    container.innerHTML = '';

    if (!data || data.length === 0) {
        container.innerHTML = `<p style="text-align:center;color:var(--color-text-faint);padding:32px 0;font-size:14px;">Geen activiteiten gevonden voor dit filter.</p>`;
        return;
    }

    data.forEach(act => {
        const config = getActivityConfig(act.activity_type);
        const dateStr = new Date(act.start_time).toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short' });
        const { headerStat, headerSubstat, detailStats, baseMetrics } = getSportDetails(act);
        const hrZoneBar = buildHRZoneBar(act);

        const detailStatsHTML = detailStats
            .filter(s => s.value !== null && s.value !== undefined && s.value !== '')
            .map(s => `
                <div class="detail-stat">
                    <p class="detail-title">${s.title}</p>
                    <p class="detail-value">${s.value}${s.unit ? `<span class="detail-unit"> ${s.unit}</span>` : ''}</p>
                </div>`).join('');

        const baseMetricsHTML = baseMetrics.length > 0 ? `
            <div class="base-metrics-row">
                ${baseMetrics.map(m => `
                    <div class="base-metric">
                        <span class="base-metric-label">${m.label}</span>
                        <span class="base-metric-value">${m.value}</span>
                    </div>`).join('')}
            </div>` : '';

        container.innerHTML += `
            <div class="card activity-card" onclick="toggleDetails('details-${act.activity_id}')">
                <div class="activity-header">
                    <div class="activity-info">
                        <div class="activity-icon-badge" style="background-color:${config.bg};">
                            <img src="icons/sports/${config.icon}" alt="${act.activity_type}" class="activity-sport-icon">
                        </div>
                        <div class="activity-text">
                            <h3 class="activity-name">${act.activity_name}</h3>
                            <p class="activity-date">${dateStr}</p>
                        </div>
                    </div>
                    <div class="activity-header-right">
                        <div class="activity-stats-right">
                            <p class="activity-primary-stat">${headerStat}</p>
                            <p class="activity-secondary-stat">${headerSubstat}</p>
                        </div>
                        <div class="activity-arrow" id="arrow-${act.activity_id}">▼</div>
                    </div>
                </div>

                <div id="details-${act.activity_id}" class="activity-details hidden">
                    <div class="activity-details-grid">${detailStatsHTML}</div>
                    ${hrZoneBar}
                    ${baseMetricsHTML}
                </div>
            </div>`;
    });
}

// buildActivities haalt data op en geeft die door aan de renderer hierboven.
// filters.js roept buildActivitiesFromData rechtstreeks aan met gefilterde data.
export async function buildActivities() {
    // De initiële rendering wordt overgenomen door initFilterBar() in filters.js,
    // zodat filter-state al meteen correct is. Hier doen we niets extra's.
}

// Klapt het detailpaneel van één activiteit open of dicht (window-functie i.v.m. inline onclick).
export function toggleDetails(id) {
    const detailDiv = document.getElementById(id);
    const actId = id.replace('details-', '');
    const arrow = document.getElementById(`arrow-${actId}`);
    const isHidden = detailDiv.classList.contains('hidden');

    detailDiv.classList.toggle('hidden', !isHidden);
    if (arrow) arrow.style.transform = isHidden ? 'rotate(180deg)' : '';
}