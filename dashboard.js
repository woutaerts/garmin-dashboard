const SUPABASE_URL = 'https://jshftlhzljrwdjaaszib.supabase.co';
const SUPABASE_KEY = 'sb_publishable_GcNLfeb-B_vxbCR-soS_Fw_RO8ocMIL';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Globaal object om de grafieken in op te slaan zodat we ze netjes kunnen updaten
let chartInstances = {};

async function signInWithGoogle() {
    await supabaseClient.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + window.location.pathname } });
}

supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session) {
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');

        setGreeting();
        buildDashboard();
        buildActivities();
        buildActivityHeatmap();
        buildWeeklyComparison();
        buildHRZoneDistribution();
    } else {
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('dashboard').classList.add('hidden');
    }
});

// --- DYNAMISCHE BEGROETING ---
function setGreeting() {
    const hour = new Date().getHours();
    let greeting = "";

    if (hour >= 5 && hour < 11) {
        greeting = "Goedemorgen, Wout";
    } else if (hour >= 11 && hour < 17) {
        greeting = "Goedemiddag, Wout";
    } else if (hour >= 17 && hour < 24) {
        greeting = "Goedenavond, Wout";
    } else {
        greeting = "Goedenacht, Wout";
    }

    document.getElementById('greeting-text').innerText = greeting;
}

// --- DASHBOARD INIT ---
async function buildDashboard() {
    // Haal enkel de laatste dag op voor de "Gezondheid Vandaag" kaarten
    const { data, error } = await supabaseClient
        .from('daily_metrics')
        .select('*')
        .order('date', { ascending: false })
        .limit(1);

    if (!error && data && data.length > 0) {
        const latest = data[0];

        // Bepaal de kleur van je Training Status (bijv. Groen voor Productive, Oranje voor Overreaching)
        let statusColor = '#9ca3af'; // grijs als default
        if (latest.training_status === 'PRODUCTIVE') statusColor = '#10b981'; // groen
        else if (latest.training_status === 'MAINTAINING') statusColor = '#3b82f6'; // blauw
        else if (latest.training_status === 'RECOVERY') statusColor = '#8b5cf6'; // paars
        else if (latest.training_status === 'UNPRODUCTIVE' || latest.training_status === 'OVERREACHING') statusColor = '#ef4444'; // rood

        document.getElementById('summary-cards').innerHTML = `
        <div class="card summary-card">
            <h3 class="summary-title">Slaapscore</h3>
            <p class="summary-value" style="color: #7B61FF;">${latest.sleep_score || '-'}</p>
        </div>
        
        <div class="card summary-card">
            <h3 class="summary-title">VO2 Max</h3>
            <p class="summary-value" style="color: #3b82f6;">${latest.vo2_max || '-'}</p>
        </div>
        
        <div class="card summary-card">
            <h3 class="summary-title">Stappen</h3>
            <p class="summary-value" style="color: #10b981;">${latest.steps_total ? latest.steps_total.toLocaleString('nl-BE') : '-'}</p>
        </div>
        
         <div class="card summary-card">
            <h3 class="summary-title">Body Battery (Hoog / Laag)</h3>
            <p class="summary-value" style="color: #f59e0b;">${latest.body_battery_high || '-'}<span class="summary-unit">/ ${latest.body_battery_low || '-'}</span></p>
        </div>

        <div class="card summary-card">
            <h3 class="summary-title">Training Status</h3>
            <p class="summary-value" style="font-size: 24px; color: ${statusColor}; margin-top: 10px;">${latest.training_status ? latest.training_status.replace('_', ' ') : '-'}</p>
        </div>
                <div class="card summary-card">
            <h3 class="summary-title">HRV (Nacht)</h3>
            <p class="summary-value" style="color: #00C4B5;">${latest.hrv_nightly_avg || '-'}<span class="summary-unit">ms</span></p>
        </div>      
        `;
    }

    // Laad standaard de trends in voor de afgelopen 7 dagen
    updateTrends(7);
}

// --- TRENDS UPDATER ---
async function updateTrends(days, btnElement = null) {
    if (btnElement) {
        document.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.remove('active'));
        btnElement.classList.add('active');
    }

    const { data, error } = await supabaseClient
        .from('daily_metrics')
        .select('*')
        .order('date', { ascending: false })
        .limit(days);

    if (error || !data || data.length === 0) return;

    const chartData = data.reverse();

    let labels = [];
    // We maken een dynamisch object aan voor alle metrieken die we willen plotten
    let metrics = {
        sleep_score: [], hrv_nightly_avg: [], resting_hr: [],
        body_battery_high: [], body_battery_low: [],
        max_stress: [], avg_stress: [],
        training_load: [], acute_load_high: [], acute_load_low: [],
        load_focus_anaerobic: [], load_focus_aerobic_high: [], load_focus_aerobic_low: [],
        deep_sleep: [], light_sleep: [], rem_sleep: [], awake_time: [],
        hrv_baseline_low: [], hrv_baseline_high: []
    };

    if (days === 365) {
        const monthlyData = {};
        const monthNames = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];

        // Verzamel alle data per maand
        chartData.forEach(row => {
            const [year, month] = row.date.split('-');
            const key = `${year}-${month}`;
            if (!monthlyData[key]) monthlyData[key] = { counts: {}, sums: {} };

            Object.keys(metrics).forEach(m => {
                if (row[m] > 0) { // Enkel waardes > 0 meetellen voor een correct gemiddelde
                    monthlyData[key].sums[m] = (monthlyData[key].sums[m] || 0) + row[m];
                    monthlyData[key].counts[m] = (monthlyData[key].counts[m] || 0) + 1;
                }
            });
        });

        // Bereken de gemiddeldes per maand
        Object.keys(monthlyData).sort().forEach(key => {
            const [y, m] = key.split('-');
            labels.push(`${monthNames[parseInt(m) - 1]} '${y.slice(-2)}`);
            const md = monthlyData[key];

            Object.keys(metrics).forEach(m => {
                metrics[m].push(md.counts[m] > 0 ? Math.round(md.sums[m] / md.counts[m]) : null);
            });
        });
    } else {
        // Dagelijkse weergave (Week / Maand)
        labels = chartData.map(r => r.date.split('-').slice(1).reverse().join('-'));
        Object.keys(metrics).forEach(m => {
            metrics[m] = chartData.map(r => r[m]);
        });
    }

    // --- GRAFIEKEN TEKENEN ---

// 1. Herstel (Slaap & RHR als lijn, HRV als Tunnel!)
    createLineChart('sleepChart', 'Slaapscore', labels, metrics.sleep_score, '#7B61FF');
    createBandChart('hrvChart', 'HRV', labels, metrics.hrv_nightly_avg, metrics.hrv_baseline_low, metrics.hrv_baseline_high, '#00C4B5', '#00C4B5');
    createLineChart('rhrChart', 'Rusthartslag', labels, metrics.resting_hr, '#ef4444');

    // 2. Energie & Stress
    createDualLineChart('bodyBatteryChart', 'Body Battery', labels, metrics.body_battery_high, metrics.body_battery_low, '#10b981', '#ef4444', 'Hoog', 'Laag');
    createDualLineChart('stressChart', 'Stress', labels, metrics.max_stress, metrics.avg_stress, '#f59e0b', '#3b82f6', 'Max', 'Gemiddeld');
    // 3. Training
    createBandChart('trainingLoadChart', 'Acute Training Load', labels, metrics.training_load, metrics.acute_load_low, metrics.acute_load_high, '#8b5cf6', '#10b981');
    createFocusChart('loadFocusChart', 'Training Load Focus', labels, metrics.load_focus_anaerobic, metrics.load_focus_aerobic_high, metrics.load_focus_aerobic_low);

    // 4. Slaap Opbouw (Minuten omgezet naar uren met 2 decimalen)
    createSleepPhasesChart('sleepPhasesChart', 'Slaap Opbouw (Uren)', labels,
        metrics.deep_sleep.map(m => m ? (m / 60).toFixed(2) : 0),
        metrics.rem_sleep.map(m => m ? (m / 60).toFixed(2) : 0),
        metrics.light_sleep.map(m => m ? (m / 60).toFixed(2) : 0),
        metrics.awake_time.map(m => m ? (m / 60).toFixed(2) : 0)
    );
}

// =============================================================
// ACTIVITEITEN — icon mapping, helpers en rendering
// =============================================================

// Mapping van Garmin activity_type → icoon + kleuren voor de badge
const ACTIVITY_CONFIG = {
    // ── Lopen ──────────────────────────────────────────────
    running:                  { icon: 'run.svg',                  bg: '#fb9f5c', color: '#ffffff' },
    trail_running:            { icon: 'marathon.svg',             bg: '#fb8f44', color: '#ffffff' },
    treadmill_running:        { icon: 'treadmill-running.svg',    bg: '#fb9f5c', color: '#ffffff' },
    virtual_run:              { icon: 'run.svg',                  bg: '#fb9f5c', color: '#ffffff' },
    marathon:                 { icon: 'marathon.svg',             bg: '#f87b2f', color: '#ffffff' },

    // ── Fietsen ────────────────────────────────────────────
    cycling:                  { icon: 'biking.svg',               bg: '#60a5fa', color: '#ffffff' },
    road_biking:              { icon: 'biking.svg',               bg: '#3b82f6', color: '#ffffff' },
    mountain_biking:          { icon: 'biking-mountain.svg',      bg: '#2563eb', color: '#ffffff' },
    indoor_cycling:           { icon: 'biking.svg',               bg: '#60a5fa', color: '#ffffff' },
    virtual_cycling:          { icon: 'biking.svg',               bg: '#60a5fa', color: '#ffffff' },
    gravel_cycling:           { icon: 'biking.svg',               bg: '#3b82f6', color: '#ffffff' },

    // ── Zwemmen ────────────────────────────────────────────
    swimming:                 { icon: 'swimming.svg',             bg: '#38bdf8', color: '#ffffff' },
    pool_swimming:            { icon: 'swimming.svg',             bg: '#0ea5e9', color: '#ffffff' },
    open_water_swimming:      { icon: 'swimming.svg',             bg: '#0284c7', color: '#ffffff' },
    lap_swimming:             { icon: 'swimming.svg',             bg: '#38bdf8', color: '#ffffff' },

    // ── Skiën ──────────────────────────────────────────────
    alpine_skiing:            { icon: 'alpine-skiing.svg',        bg: '#818cf8', color: '#ffffff' },
    skiing:                   { icon: 'alpine-skiing.svg',        bg: '#6366f1', color: '#ffffff' },
    resort_skiing_snowboarding_ws: { icon: 'alpine-skiing.svg',   bg: '#818cf8', color: '#ffffff' },
    backcountry_skiing:       { icon: 'alpine-skiing.svg',        bg: '#6366f1', color: '#ffffff' },
    cross_country_skiing:     { icon: 'cross-country-skiing.svg', bg: '#94a3b8', color: '#ffffff' },
    freestyle_skiing:         { icon: 'freestyle-skiing.svg',     bg: '#a78bfa', color: '#ffffff' },

    // ── Kracht & Fitness ───────────────────────────────────
    strength_training:        { icon: 'barbells.svg',             bg: '#ec4899', color: '#ffffff' },
    weight_training:          { icon: 'barbells.svg',             bg: '#db2777', color: '#ffffff' },
    indoor_cardio:            { icon: 'fitness.svg',              bg: '#f472b6', color: '#ffffff' },
    fitness_equipment:        { icon: 'fitness.svg',              bg: '#ec4899', color: '#ffffff' },
    cardio:                   { icon: 'fitness.svg',              bg: '#f472b6', color: '#ffffff' },
    elliptical:               { icon: 'elliptical.svg',           bg: '#ec4899', color: '#ffffff' },

    // ── Balsporten ─────────────────────────────────────────
    soccer:                   { icon: 'playing-soccer.svg',       bg: '#34d399', color: '#ffffff' },
    football:                 { icon: 'playing-soccer.svg',       bg: '#34d399', color: '#ffffff' },
    indoor_soccer:            { icon: 'playing-soccer.svg',       bg: '#10b981', color: '#ffffff' },
    padel:                    { icon: 'playing-tennis.svg',       bg: '#2dd4bf', color: '#ffffff' },
    tennis:                   { icon: 'playing-tennis.svg',       bg: '#2dd4bf', color: '#ffffff' },
    squash:                   { icon: 'playing-tennis.svg',       bg: '#14b8a6', color: '#ffffff' },
    basketball:               { icon: 'playing-basketball.svg',   bg: '#fbbf24', color: '#ffffff' },
    volleyball:               { icon: 'playing-volleyball.svg',   bg: '#fb923c', color: '#ffffff' },
    badminton:                { icon: 'playing-badminton.svg',    bg: '#2dd4bf', color: '#ffffff' },

    // ── Outdoor ────────────────────────────────────────────
    hiking:                   { icon: 'hiking.svg',               bg: '#ea580c', color: '#ffffff' },
    walking:                  { icon: 'walk.svg',                 bg: '#f97316', color: '#ffffff' },
    rock_climbing:            { icon: 'rock-climbing.svg',        bg: '#d97706', color: '#ffffff' },
    climbing:                 { icon: 'rock-climbing.svg',        bg: '#d97706', color: '#ffffff' },
    kayaking:                 { icon: 'kayaking.svg',             bg: '#0ea5e9', color: '#ffffff' },
    canoe_kayak:              { icon: 'kayaking.svg',             bg: '#0284c7', color: '#ffffff' },

    // ── Overig ─────────────────────────────────────────────
    yoga:                     { icon: 'meditation.svg',           bg: '#a78bfa', color: '#ffffff' },
    pilates:                  { icon: 'meditation.svg',           bg: '#8b5cf6', color: '#ffffff' },
    rowing:                   { icon: 'rowing-machine.svg',       bg: '#14b8a6', color: '#ffffff' },
    rowing_machine:           { icon: 'rowing-machine.svg',       bg: '#0f766e', color: '#ffffff' },
    indoor_rowing:            { icon: 'rowing-machine.svg',       bg: '#14b8a6', color: '#ffffff' },
    golf:                     { icon: 'playing-golf.svg',         bg: '#86efac', color: '#166534' },   // light green + dark text
    boxing:                   { icon: 'boxing.svg',               bg: '#f87171', color: '#ffffff' },
    kickboxing:               { icon: 'boxing.svg',               bg: '#ef4444', color: '#ffffff' },
};

const DEFAULT_CONFIG = { icon: 'fitness.svg', bg: '#f3f4f6', color: '#6b7280' };

// Twee-staps lookup: exacte match → keyword match → default
function getActivityConfig(activityType) {
    const key = (activityType || '').toLowerCase();
    if (ACTIVITY_CONFIG[key]) return ACTIVITY_CONFIG[key];

    // Keyword fallback
    if (key.includes('run'))    return ACTIVITY_CONFIG.running;
    if (key.includes('cycl') || key.includes('bik')) return ACTIVITY_CONFIG.cycling;
    if (key.includes('swim'))   return ACTIVITY_CONFIG.swimming;
    if (key.includes('ski') && !key.includes('cross')) return ACTIVITY_CONFIG.alpine_skiing;
    if (key.includes('cross') && key.includes('ski'))  return ACTIVITY_CONFIG.cross_country_skiing;
    if (key.includes('strength') || key.includes('weight')) return ACTIVITY_CONFIG.strength_training;
    if (key.includes('soccer') || key.includes('football')) return ACTIVITY_CONFIG.soccer;
    if (key.includes('padel') || key.includes('tennis')) return ACTIVITY_CONFIG.padel;
    if (key.includes('hik'))    return ACTIVITY_CONFIG.hiking;
    if (key.includes('walk'))   return ACTIVITY_CONFIG.walking;
    if (key.includes('yoga'))   return ACTIVITY_CONFIG.yoga;
    if (key.includes('row'))    return ACTIVITY_CONFIG.rowing;
    if (key.includes('box'))    return ACTIVITY_CONFIG.boxing;
    if (key.includes('climb'))  return ACTIVITY_CONFIG.climbing;
    if (key.includes('golf'))   return ACTIVITY_CONFIG.golf;

    return DEFAULT_CONFIG;
}

// --- Helperfuncties ---

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

// Bouwt de hartslagzones visualisatie
function buildHRZoneBar(act) {
    const zones = [
        { val: act.hr_zone_1 || 0, color: '#93c5fd', label: 'Z1' },
        { val: act.hr_zone_2 || 0, color: '#4ade80', label: 'Z2' },
        { val: act.hr_zone_3 || 0, color: '#facc15', label: 'Z3' },
        { val: act.hr_zone_4 || 0, color: '#fb923c', label: 'Z4' },
        { val: act.hr_zone_5 || 0, color: '#f87171', label: 'Z5' },
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

// Geeft sport-specifieke stats terug op basis van het activiteitstype
// Geeft sport-specifieke stats terug op basis van het activiteitstype
function getSportDetails(act) {
    const key = (act.activity_type || '').toLowerCase();
    const distanceKm = act.distance ? (act.distance / 1000).toFixed(2) : null;
    const distanceM  = act.distance ? Math.round(act.distance) : null;
    const dur        = act.duration || 0;
    const durFmt     = formatDuration(dur);

    let headerStat, headerSubstat, detailStats;

    // ── Lopen ──────────────────────────────────────────────────────────
    const isRunning = key.includes('run') || key.includes('marathon') || key.includes('treadmill');
    if (isRunning) {
        const pace = formatPace(act.distance, dur);
        headerStat    = distanceKm ? `${distanceKm} km` : durFmt;
        headerSubstat = pace ? `${pace} min/km` : durFmt;

        detailStats = [
            { title: 'Gem. tempo',    value: pace,              unit: 'min/km' },
            { title: 'Gem. hartslag', value: act.average_hr,    unit: 'bpm'    },
            { title: 'Max. hartslag', value: act.max_hr,        unit: 'bpm'    },
            { title: 'Totale duur',   value: durFmt,            unit: ''       },   // ← Nieuw
            { title: 'Hoogtemeters',  value: act.elevation_gain, unit: 'm'     },
            { title: 'Calorieën',     value: act.calories,       unit: 'kcal'  },
        ];

        // ── Zwemmen ────────────────────────────────────────────────────────
    } else if (key.includes('swim')) {
        headerStat    = distanceM ? `${distanceM} m` : durFmt;
        headerSubstat = durFmt;
        detailStats = [
            { title: 'Afstand',       value: distanceM,       unit: 'm'    },
            { title: 'Duur',          value: durFmt,           unit: ''     },
            { title: 'Calorieën',     value: act.calories,     unit: 'kcal' },
            { title: 'Gem. hartslag', value: act.average_hr,   unit: 'bpm'  },
            { title: 'Max. hartslag', value: act.max_hr,       unit: 'bpm'  },
        ];

        // ── Alpien skiën ───────────────────────────────────────────────────
    } else if ((key.includes('ski') || key.includes('snow')) && !key.includes('cross') && !key.includes('nordic')) {
        const laps = act.lap_count;
        headerStat    = distanceKm ? `${distanceKm} km` : durFmt;
        headerSubstat = laps ? `${laps} afdaling${laps !== 1 ? 'en' : ''}` : durFmt;
        detailStats = [
            { title: 'Max. snelheid', value: act.max_speed_kmh ? Number(act.max_speed_kmh).toFixed(1) : null, unit: 'km/h' },
            { title: 'Tot. afdaling', value: act.elevation_loss, unit: 'm'  },
            { title: 'Aantal dalen',  value: laps,               unit: ''   },
            { title: 'Afstand',       value: distanceKm,         unit: 'km' },
            { title: 'Calorieën',     value: act.calories,        unit: 'kcal' },
        ];

        // ── Fietsen ────────────────────────────────────────────────────────
    } else if (key.includes('cycl') || key.includes('bik')) {
        const avgSpd = act.average_speed_kmh ? Number(act.average_speed_kmh).toFixed(1) : null;
        const maxSpd = act.max_speed_kmh     ? Number(act.max_speed_kmh).toFixed(1)     : null;
        headerStat    = distanceKm ? `${distanceKm} km` : durFmt;
        headerSubstat = avgSpd ? `${avgSpd} km/h` : durFmt;
        detailStats = [
            { title: 'Gem. snelheid', value: avgSpd,             unit: 'km/h' },
            { title: 'Max. snelheid', value: maxSpd,             unit: 'km/h' },
            { title: 'Afstand',       value: distanceKm,         unit: 'km'   },
            { title: 'Gem. hartslag', value: act.average_hr,     unit: 'bpm'  },
            { title: 'Hoogtemeters',  value: act.elevation_gain, unit: 'm'    },
            { title: 'Calorieën',     value: act.calories,       unit: 'kcal' },
        ];

        // ── Balsporten ─────────────────────────────────────────────────────
    } else if (['soccer','football','indoor_soccer','padel','tennis','squash','basketball','volleyball','badminton'].includes(key)
        || key.includes('soccer') || key.includes('padel') || key.includes('tennis') || key.includes('football') || key.includes('basketball')) {
        const maxSpd = act.max_speed_kmh ? Number(act.max_speed_kmh).toFixed(1) : null;
        headerStat    = distanceKm ? `${distanceKm} km` : durFmt;
        headerSubstat = maxSpd ? `Max ${maxSpd} km/h` : durFmt;
        detailStats = [
            { title: 'Max. snelheid', value: maxSpd,           unit: 'km/h' },
            { title: 'Afstand',       value: distanceKm,       unit: 'km'   },
            { title: 'Duur',          value: durFmt,           unit: ''     },
            { title: 'Gem. hartslag', value: act.average_hr,   unit: 'bpm'  },
            { title: 'Max. hartslag', value: act.max_hr,       unit: 'bpm'  },
            { title: 'Calorieën',     value: act.calories,     unit: 'kcal' },
        ];

        // ── Wandelen / Hiken ───────────────────────────────────────────────
    } else if (key.includes('hik') || key.includes('walk')) {
        const pace = formatPace(act.distance, dur);
        headerStat    = distanceKm ? `${distanceKm} km` : durFmt;
        headerSubstat = pace ? `${pace} min/km` : durFmt;
        detailStats = [
            { title: 'Afstand',       value: distanceKm,         unit: 'km'   },
            { title: 'Duur',          value: durFmt,             unit: ''     },
            { title: 'Hoogtemeters',  value: act.elevation_gain, unit: 'm'    },
            { title: 'Gem. hartslag', value: act.average_hr,     unit: 'bpm'  },
            { title: 'Max. hartslag', value: act.max_hr,         unit: 'bpm'  },
            { title: 'Calorieën',     value: act.calories,       unit: 'kcal' },
        ];

        // ── Default: kracht, cardio, overig ───────────────────────────────
    } else {
        headerStat    = act.calories ? `${act.calories} kcal` : durFmt;
        headerSubstat = durFmt;
        detailStats = [
            { title: 'Duur',          value: durFmt,           unit: ''   },
            { title: 'Gem. hartslag', value: act.average_hr,   unit: 'bpm' },
            { title: 'Max. hartslag', value: act.max_hr,       unit: 'bpm' },
            { title: 'Aeroob TE',     value: act.aerobic_te,   unit: ''   },
            { title: 'Anaeroob TE',   value: act.anaerobic_te, unit: ''   },
            { title: 'Calorieën',     value: act.calories,     unit: 'kcal'},
        ];
    }

    // Secundaire basismetriek: altijd onderaan voor elke sport
    const baseMetrics = [];
    const isDefaultCategory = !isRunning && !key.includes('swim') && !key.includes('ski') && !key.includes('cycl') && !key.includes('bik');
    if (act.aerobic_te   && !isDefaultCategory) baseMetrics.push({ label: 'Aeroob TE',   value: act.aerobic_te   });
    if (act.anaerobic_te && !isDefaultCategory) baseMetrics.push({ label: 'Anaeroob TE', value: act.anaerobic_te });
    if (act.training_load)                      baseMetrics.push({ label: 'Training load',value: act.training_load});
    if (act.vo2_max && isRunning)               baseMetrics.push({ label: 'VO₂ Max',      value: act.vo2_max      });

    return { headerStat, headerSubstat, detailStats, baseMetrics };
}

// --- Bouw activiteitenlijst ---
async function buildActivities() {
    const { data, error } = await supabaseClient
        .from('garmin_activities')
        .select('*')
        .order('start_time', { ascending: false })
        .limit(10);

    if (error) return;

    const container = document.getElementById('activities-container');
    container.innerHTML = '';

    data.forEach(act => {
        const config  = getActivityConfig(act.activity_type);
        const dateStr = new Date(act.start_time).toLocaleDateString('nl-BE', {
            weekday: 'short', day: 'numeric', month: 'short'
        });
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

        const html = `
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
        container.innerHTML += html;
    });
}

// Open/sluit detailpaneel met pijl-animatie
window.toggleDetails = function(id) {
    const detailDiv = document.getElementById(id);
    const actId     = id.replace('details-', '');
    const arrow     = document.getElementById(`arrow-${actId}`);
    const isHidden  = detailDiv.classList.contains('hidden');

    detailDiv.classList.toggle('hidden', !isHidden);
    if (arrow) arrow.style.transform = isHidden ? 'rotate(180deg)' : '';
};

function createLineChart(id, title, labels, data, color) {
    if (chartInstances[id]) {
        chartInstances[id].destroy();
    }

    const validData = data.filter(val => val !== null && val > 0);
    const average = validData.length > 0
        ? Math.round(validData.reduce((a, b) => a + b, 0) / validData.length)
        : 0;

    const avgData = Array(labels.length).fill(average);
    const pointRad = labels.length > 31 ? 0 : 3;   // iets groter voor betere zichtbaarheid

    const ctx = document.getElementById(id).getContext('2d');

    chartInstances[id] = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: title,
                    data: data,
                    borderColor: color,
                    backgroundColor: color,
                    tension: 0.4,
                    fill: false,                    // was true, nu beter voor bolletjes
                    pointRadius: pointRad,
                    pointBackgroundColor: color,    // volle bolletjes
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 1.5,
                    order: 2
                },
                {
                    label: 'Gemiddelde',
                    data: avgData,
                    borderColor: '#9ca3af',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false,
                    tension: 0,
                    order: 1
                }
            ]
        },
        options: {
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        filter: function(legendItem, chartData) {
                            return legendItem.text !== 'Gemiddelde';
                        },
                        font: {
                            family: 'Space Grotesk',
                            size: 13
                        },
                        boxWidth: 12,
                        boxHeight: 12,
                        padding: 12,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                title: {
                    display: true,
                    text: title,                    // of `${title} (Gem: ${average})`
                    font: {
                        family: 'Space Grotesk',
                        size: 16,                   // ← grotere titel
                        weight: 600
                    },
                    padding: {
                        top: 8,
                        bottom: 16
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { maxTicksLimit: 12 } }
            }
        }
    });
}

// --- DUBBELE LIJN GRAFIEK (Voor Body Battery & Stress) ---
function createDualLineChart(id, title, labels, data1, data2, color1, color2, label1 = 'Lijn 1', label2 = 'Lijn 2') {
    if (chartInstances[id]) chartInstances[id].destroy();

    const pointRad = labels.length > 31 ? 0 : 3;

    const ctx = document.getElementById(id).getContext('2d');

    chartInstances[id] = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: label1, // <--- DYNAMISCH LABEL 1
                    data: data1,
                    borderColor: color1,
                    backgroundColor: color1,
                    tension: 0.4,
                    pointRadius: pointRad,
                    pointBackgroundColor: color1,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 1.5
                },
                {
                    label: label2, // <--- DYNAMISCH LABEL 2
                    data: data2,
                    borderColor: color2,
                    backgroundColor: color2,
                    tension: 0.4,
                    pointRadius: pointRad,
                    pointBackgroundColor: color2,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 1.5
                }
            ]
        },
        options: {
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        font: {
                            family: 'Space Grotesk',
                            size: 13
                        },
                        boxWidth: 12,
                        boxHeight: 12,
                        padding: 12,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                title: {
                    display: true,
                    text: title,
                    font: {
                        family: 'Space Grotesk',
                        size: 16,
                        weight: 600
                    },
                    padding: {
                        top: 8,
                        bottom: 16
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { maxTicksLimit: 12 } }
            }
        }
    });
}

function createBandChart(id, title, labels, mainData, lowData, highData, mainColor, bandColor) {
    if (chartInstances[id]) chartInstances[id].destroy();

    const pointRad = labels.length > 31 ? 0 : 3;

    const ctx = document.getElementById(id).getContext('2d');

    chartInstances[id] = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: title,
                    data: mainData,
                    borderColor: mainColor,
                    backgroundColor: mainColor,
                    borderWidth: 2,
                    tension: 0.4,
                    pointRadius: pointRad,
                    pointBackgroundColor: mainColor,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 1.5,
                    order: 1
                },
                {
                    label: 'Bovengrens',
                    data: highData,
                    borderColor: bandColor + '60',
                    backgroundColor: bandColor + '20',
                    fill: '+1',
                    tension: 0.4,
                    pointRadius: 0,
                    order: 2,
                    legend: false
                },
                {
                    label: 'Ondergrens',
                    data: lowData,
                    borderColor: bandColor + '40',
                    backgroundColor: 'transparent',
                    fill: false,
                    tension: 0.4,
                    pointRadius: 0,
                    order: 3
                }
            ]
        },
        options: {
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,           // false houden bij createLineChart als je dat wilt
                    position: 'bottom',
                    labels: {
                        filter: function(item) {
                            return item.text !== 'Bovengrens' && item.text !== 'Ondergrens';
                        },
                        font: {
                            family: 'Space Grotesk',
                            size: 13                    // ← groter
                        },
                        boxWidth: 12,                   // ← groter
                        boxHeight: 12,                  // ← groter
                        padding: 12,                    // iets meer ruimte
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                title: {
                    display: true,
                    text: title,                    // of `${title} (Gem: ${average})`
                    font: {
                        family: 'Space Grotesk',
                        size: 16,                   // ← grotere titel
                        weight: 600
                    },
                    padding: {
                        top: 8,
                        bottom: 16
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { maxTicksLimit: 12 } }
            }
        }
    });
}

// --- GESTAPELDE STAAFGRAFIEK (Voor Training Load Focus) ---
function createFocusChart(id, title, labels, dataAnaerobic, dataHighAerobic, dataLowAerobic) {
    if (chartInstances[id]) chartInstances[id].destroy();

    const ctx = document.getElementById(id).getContext('2d');

    chartInstances[id] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Anaeroob',
                    data: dataAnaerobic,
                    backgroundColor: '#8b5cf6',
                    borderRadius: 4
                },
                {
                    label: 'Hoog Aeroob',
                    data: dataHighAerobic,
                    backgroundColor: '#f97316',
                    borderRadius: 4
                },
                {
                    label: 'Laag Aeroob',
                    data: dataLowAerobic,
                    backgroundColor: '#0ea5e9',
                    borderRadius: 4
                }
            ]
        },
        options: {
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,           // false houden bij createLineChart als je dat wilt
                    position: 'bottom',
                    labels: {
                        font: {
                            family: 'Space Grotesk',
                            size: 13                    // ← groter
                        },
                        boxWidth: 12,                   // ← groter
                        boxHeight: 12,                  // ← groter
                        padding: 12,                    // iets meer ruimte
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                title: {
                    display: true,
                    text: title,                    // of `${title} (Gem: ${average})`
                    font: {
                        family: 'Space Grotesk',
                        size: 16,                   // ← grotere titel
                        weight: 600
                    },
                    padding: {
                        top: 8,
                        bottom: 16
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: {
                    stacked: true,
                    grid: { display: false },
                    ticks: { maxTicksLimit: 12 }
                },
                y: {
                    stacked: true
                }
            },
            interaction: {
                mode: 'index',
                intersect: false
            }
        }
    });
}


// --- GESTAPELDE STAAFGRAFIEK (Voor Slaapfases in Uren) ---
function createSleepPhasesChart(id, title, labels, dataDeep, dataRem, dataLight, dataAwake) {
    if (chartInstances[id]) chartInstances[id].destroy();

    const ctx = document.getElementById(id).getContext('2d');

    chartInstances[id] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Diep',
                    data: dataDeep,
                    backgroundColor: '#1e3a8a', // Donkerblauw
                    borderRadius: 4
                },
                {
                    label: 'REM',
                    data: dataRem,
                    backgroundColor: '#3b82f6', // Helder blauw
                    borderRadius: 4
                },
                {
                    label: 'Licht',
                    data: dataLight,
                    backgroundColor: '#93c5fd', // Lichtblauw
                    borderRadius: 4
                },
                {
                    label: 'Wakker',
                    data: dataAwake,
                    backgroundColor: '#fca5a5', // Zacht rood/roze
                    borderRadius: 4
                }
            ]
        },
        options: {
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        font: { family: 'Space Grotesk', size: 13 },
                        boxWidth: 12,
                        boxHeight: 12,
                        padding: 12,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                title: {
                    display: true,
                    text: title,
                    font: { family: 'Space Grotesk', size: 16, weight: 600 },
                    padding: { top: 8, bottom: 16 }
                },
                tooltip: { mode: 'index', intersect: false }
            },
            scales: {
                x: { stacked: true, grid: { display: false }, ticks: { maxTicksLimit: 12 } },
                y: { stacked: true }
            },
            interaction: { mode: 'index', intersect: false }
        }
    });
}
// =============================================================
// ACTIVITEITEN HEATMAP — GitHub-stijl jaarcalender
// =============================================================

async function buildActivityHeatmap() {
    const container = document.getElementById('heatmap-container');
    if (!container) return;

    // Bereken startdatum: ga terug naar de dichtstbijzijnde maandag, ~52 weken geleden
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 364);
    const dow = startDate.getDay(); // 0=zo, 1=ma, ...
    const toMonday = dow === 0 ? -6 : 1 - dow;
    startDate.setDate(startDate.getDate() + toMonday);
    startDate.setHours(0, 0, 0, 0);

    const { data, error } = await supabaseClient
        .from('garmin_activities')
        .select('start_time, training_load, activity_type, activity_name')
        .gte('start_time', startDate.toISOString())
        .order('start_time', { ascending: true });

    if (error) return;

    // Groepeer op datum
    const byDate = {};
    (data || []).forEach(act => {
        const d = new Date(act.start_time);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        if (!byDate[key]) byDate[key] = { load: 0, count: 0, names: [] };
        byDate[key].load  += (act.training_load || 30);
        byDate[key].count += 1;
        byDate[key].names.push(act.activity_name || act.activity_type || 'Activiteit');
    });

    // Bouw array van alle dagen Ma→Zo per week
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const weeks = [];
    let week = [];
    const cur = new Date(startDate);

    while (cur <= today) {
        const key = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`;
        week.push({ key, data: byDate[key] || null, month: cur.getMonth(), day: cur.getDate() });
        if (cur.getDay() === 0) { // zondag = einde van de week
            weeks.push(week);
            week = [];
        }
        cur.setDate(cur.getDate() + 1);
    }
    if (week.length > 0) weeks.push(week);

    // Maandlabels boven de juiste kolommen
    const monthNames = ['Jan','Feb','Mrt','Apr','Mei','Jun','Jul','Aug','Sep','Okt','Nov','Dec'];
    const monthLabels = new Array(weeks.length).fill('');
    let lastMonth = -1;
    weeks.forEach((w, i) => {
        const m = w[0].month;
        if (m !== lastMonth) { monthLabels[i] = monthNames[m]; lastMonth = m; }
    });

    // Kleurschaal op basis van training load (donkerder = zwaarder)
    const getColor = (load) => {
        if (!load || load === 0) return '#e5e7eb';
        if (load <= 40)  return '#d1e0d9';   // Very light green-gray
        if (load <= 80)  return '#a3c9b9';   // Light muted green
        if (load <= 120) return '#5fb99a';   // Medium green
        return '#10b981';                    // Full emerald green (heavy load)
    };

    const totalActs = Object.values(byDate).reduce((s, d) => s + d.count, 0);
    const activeDays = Object.keys(byDate).length;
    const dayLabels  = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

    const weeksHTML = weeks.map(w => {
        const cells = Array.from({ length: 7 }, (_, di) => {
            const dayEntry = w.find((_, idx) => idx === di) || null;
            if (!dayEntry) return `<div class="hm-cell hm-cell--empty"></div>`;
            const color   = getColor(dayEntry.data?.load || 0);
            const tooltip = dayEntry.data
                ? `${dayEntry.key} · ${dayEntry.data.names.join(', ')} · load ${dayEntry.data.load}`
                : dayEntry.key;
            return `<div class="hm-cell" style="background:${color}" title="${tooltip}"></div>`;
        }).join('');
        return `<div class="hm-week">${cells}</div>`;
    }).join('');

    const monthRowHTML = weeks.map((_, i) =>
        `<div class="hm-month-cell">${monthLabels[i]}</div>`
    ).join('');

    container.innerHTML = `
        <div class="hm-meta">
            <span class="hm-meta-count">${totalActs} activiteiten</span>
            <span class="hm-meta-sep">·</span>
            <span class="hm-meta-days">${activeDays} actieve dagen</span>
        </div>
        <div class="hm-scroll">
            <div class="hm-inner">
                <div class="hm-day-col">
                    ${dayLabels.map((d, i) =>
        `<div class="hm-day-label" style="visibility:${[0,2,4].includes(i)?'visible':'hidden'}">${d}</div>`
    ).join('')}
                </div>
                <div class="hm-right">
                    <div class="hm-month-row">${monthRowHTML}</div>
                    <div class="hm-weeks">${weeksHTML}</div>
                </div>
            </div>
        </div>
        <div class="hm-legend">
            <span class="hm-legend-label">Minder</span>
            ${['#e5e7eb','#d1e0d9','#a3c9b9','#5fb99a','#10b981'].map(c =>
        `<div class="hm-legend-cell" style="background:${c}"></div>`
    ).join('')}
            <span class="hm-legend-label">Meer</span>
        </div>`;
}

// =============================================================
// 4-WEKEN VERGELIJKING
// =============================================================

async function buildWeeklyComparison() {
    const container = document.getElementById('comparison-container');
    if (!container) return;

    // 56 dagen dagelijkse metrics ophalen
    const { data: metricsData } = await supabaseClient
        .from('daily_metrics')
        .select('date, sleep_score, hrv_nightly_avg, resting_hr, body_battery_high, training_load, vo2_max, avg_stress')
        .order('date', { ascending: false })
        .limit(56);

    // 56 dagen activiteiten ophalen
    const eightWeeksAgo = new Date();
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
    const { data: actsData } = await supabaseClient
        .from('garmin_activities')
        .select('start_time, distance, duration, training_load')
        .gte('start_time', eightWeeksAgo.toISOString());

    if (!metricsData || metricsData.length < 2) {
        container.innerHTML = '<p class="comparison-empty">Niet genoeg data beschikbaar.</p>';
        return;
    }

    const current  = metricsData.slice(0, 28);
    const previous = metricsData.slice(28, 56);

    const avg = (arr, key) => {
        const vals = arr.map(d => d[key]).filter(v => v != null && v > 0);
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };

    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const currentActs  = (actsData || []).filter(a => new Date(a.start_time) >= fourWeeksAgo);
    const previousActs = (actsData || []).filter(a => new Date(a.start_time) <  fourWeeksAgo);
    const actSum = (arr, key) => arr.reduce((s, a) => s + (a[key] || 0), 0);

    const metrics = [
        { label: 'Slaapscore',       color: '#7B61FF', unit: '',     hib: true,
            curr: avg(current,  'sleep_score'),     prev: avg(previous, 'sleep_score'),     fmt: v => v?.toFixed(0) },
        { label: 'HRV',              color: '#00C4B5', unit: ' ms',  hib: true,
            curr: avg(current,  'hrv_nightly_avg'), prev: avg(previous,'hrv_nightly_avg'),  fmt: v => v?.toFixed(0) },
        { label: 'Rusthartslag',     color: '#ef4444', unit: ' bpm', hib: false,
            curr: avg(current,  'resting_hr'),      prev: avg(previous, 'resting_hr'),      fmt: v => v?.toFixed(0) },
        { label: 'Gem. Stress',      color: '#f59e0b', unit: '',     hib: false,
            curr: avg(current,  'avg_stress'),      prev: avg(previous, 'avg_stress'),      fmt: v => v?.toFixed(0) },
        { label: 'VO₂ Max',          color: '#3b82f6', unit: '',     hib: true,
            curr: avg(current,  'vo2_max'),         prev: avg(previous, 'vo2_max'),         fmt: v => v?.toFixed(1) },
        { label: 'Body Battery',     color: '#10b981', unit: '',     hib: true,
            curr: avg(current,  'body_battery_high'),prev:avg(previous,'body_battery_high'), fmt: v => v?.toFixed(0) },
        { label: 'Trainingsafstand', color: '#ea580c', unit: ' km',  hib: true,
            curr: actSum(currentActs,'distance')/1000, prev: actSum(previousActs,'distance')/1000, fmt: v => v?.toFixed(1) },
        { label: 'Trainingstijd',    color: '#8b5cf6', unit: ' u',   hib: true,
            curr: actSum(currentActs,'duration')/3600,  prev: actSum(previousActs,'duration')/3600,  fmt: v => v?.toFixed(1) },
    ];

    const cardsHTML = metrics.map(m => {
        const cStr = m.fmt(m.curr) ?? '-';
        const pStr = m.fmt(m.prev) ?? '-';
        let deltaHTML = '';
        if (m.curr != null && m.prev != null && m.prev > 0) {
            const delta  = m.curr - m.prev;
            const pct    = Math.abs((delta / m.prev) * 100).toFixed(1);
            const good   = m.hib ? delta >= 0 : delta <= 0;
            const arrow  = delta >= 0 ? '↑' : '↓';
            deltaHTML = `<span class="cmp-delta ${good ? 'cmp-delta--good' : 'cmp-delta--bad'}">${arrow} ${pct}%</span>`;
        }
        return `
            <div class="card cmp-card">
                <p class="cmp-label">${m.label}</p>
                <p class="cmp-value" style="color:${m.color}">${cStr}<span class="cmp-unit">${m.unit}</span></p>
                <div class="cmp-footer">
                    <span class="cmp-prev">vs ${pStr}${m.unit}</span>
                    ${deltaHTML}
                </div>
            </div>`;
    }).join('');

    container.innerHTML = `
        <p class="comparison-period">Huidige 4 weken vs vorige 4 weken</p>
        <div class="cmp-grid">${cardsHTML}</div>`;
}

// =============================================================
// HR ZONE VERDELING — donut + breakdown (laatste 28 dagen)
// =============================================================

async function buildHRZoneDistribution() {
    const container = document.getElementById('hr-zone-dist-container');
    if (!container) return;

    const since = new Date();
    since.setDate(since.getDate() - 28);

    const { data, error } = await supabaseClient
        .from('garmin_activities')
        .select('hr_zone_1, hr_zone_2, hr_zone_3, hr_zone_4, hr_zone_5')
        .gte('start_time', since.toISOString());

    if (error || !data || data.length === 0) {
        container.innerHTML = '<p class="zd-empty">Geen hartslagzone data beschikbaar.</p>';
        return;
    }

    const zones = [0, 0, 0, 0, 0];
    data.forEach(act => {
        zones[0] += act.hr_zone_1 || 0;
        zones[1] += act.hr_zone_2 || 0;
        zones[2] += act.hr_zone_3 || 0;
        zones[3] += act.hr_zone_4 || 0;
        zones[4] += act.hr_zone_5 || 0;
    });

    const totalSec = zones.reduce((a, b) => a + b, 0);
    if (totalSec === 0) {
        container.innerHTML = '<p class="zd-empty">Geen hartslagzone data beschikbaar.</p>';
        return;
    }

    const ZONE_COLORS = ['#93c5fd', '#4ade80', '#facc15', '#fb923c', '#f87171'];
    const ZONE_LABELS = ['Z1 · Herstel', 'Z2 · Aeroob', 'Z3 · Drempel', 'Z4 · Intensief', 'Z5 · Max'];
    const ZONE_DESC   = ['< 60% max HR', '60–70%', '70–80%', '80–90%', '> 90%'];

    const fmtTime = s => {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        return h > 0 ? `${h}u ${m}min` : `${m} min`;
    };
    const totalMin = Math.round(totalSec / 60);

    const rowsHTML = zones.map((z, i) => {
        const pct = totalSec > 0 ? ((z / totalSec) * 100).toFixed(1) : '0.0';
        return `
            <div class="zd-row">
                <div class="zd-row-left">
                    <span class="zd-dot" style="background:${ZONE_COLORS[i]}"></span>
                    <div>
                        <p class="zd-zone-name">${ZONE_LABELS[i]}</p>
                        <p class="zd-zone-desc">${ZONE_DESC[i]}</p>
                    </div>
                </div>
                <div class="zd-bar-wrap">
                    <div class="zd-bar-bg">
                        <div class="zd-bar-fill" style="width:${pct}%;background:${ZONE_COLORS[i]}"></div>
                    </div>
                </div>
                <div class="zd-row-right">
                    <span class="zd-pct">${pct}%</span>
                    <span class="zd-time">${fmtTime(z)}</span>
                </div>
            </div>`;
    }).join('');

    container.innerHTML = `
        <div class="zd-layout">
            <div class="zd-chart-wrap">
                <canvas id="hrZoneDonut"></canvas>
                <div class="zd-center-label">
                    <p class="zd-center-val">${fmtTime(totalSec)}</p>
                    <p class="zd-center-sub">afgelopen 28 dagen</p>
                </div>
            </div>
            <div class="zd-rows">${rowsHTML}</div>
        </div>`;

    // Donut via Chart.js
    const ctx = document.getElementById('hrZoneDonut').getContext('2d');
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ZONE_LABELS,
            datasets: [{
                data: zones.map(z => Math.max(Math.round(z / 60), 0)),
                backgroundColor: ZONE_COLORS,
                borderWidth: 3,
                borderColor: '#ffffff',
                hoverOffset: 6
            }]
        },
        options: {
            maintainAspectRatio: true,
            cutout: '74%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const min  = ctx.raw;
                            const pct  = ((min / totalMin) * 100).toFixed(1);
                            const h    = Math.floor(min / 60);
                            const m    = min % 60;
                            const time = h > 0 ? `${h}u ${m}min` : `${m} min`;
                            return ` ${time}  (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}