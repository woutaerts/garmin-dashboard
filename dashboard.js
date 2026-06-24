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
    createBandChart('hrvChart', 'HRV & Baseline', labels, metrics.hrv_nightly_avg, metrics.hrv_baseline_low, metrics.hrv_baseline_high, '#00C4B5', '#00C4B5');
    createLineChart('rhrChart', 'Rusthartslag', labels, metrics.resting_hr, '#FF4B4B');

    // 2. Energie & Stress
    createDualLineChart('bodyBatteryChart', 'Body Battery (Hoog/Laag)', labels, metrics.body_battery_high, metrics.body_battery_low, '#10b981', '#ef4444');
    createDualLineChart('stressChart', 'Stress (Max/Gem)', labels, metrics.max_stress, metrics.avg_stress, '#f59e0b', '#3b82f6');

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

// --- RECENTE WORKOUTS ---
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
        const distanceKm = (act.distance / 1000).toFixed(2);
        const durationMin = Math.round(act.duration / 60);
        const dateStr = new Date(act.start_time).toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short' });

        let iconClass = act.activity_type === 'running' ? 'icon-running' : 'icon-strength';

        const html = `
            <div class="card activity-card" onclick="toggleDetails('details-${act.activity_id}')">
                <div class="activity-header">
                    <div class="activity-info">
                        <div class="activity-icon ${iconClass}">
                            ${act.activity_type === 'running' ? '🏃' : '🏋️'}
                        </div>
                        <div>
                            <h3 class="activity-name">${act.activity_name}</h3>
                            <p class="activity-date">${dateStr}</p>
                        </div>
                    </div>
                    <div class="activity-stats">
                        <div>
                            <p class="activity-primary-stat">${distanceKm > 0 ? distanceKm + ' km' : act.calories + ' kcal'}</p>
                            <p class="activity-duration">${durationMin} min</p>
                        </div>
                        <div class="activity-arrow">▼</div>
                    </div>
                </div>
                
                <div id="details-${act.activity_id}" class="activity-details hidden">
                    <div class="activity-details-grid">
                        <div>
                            <p class="detail-title">Gem. Hartslag</p>
                            <p class="detail-value">${act.average_hr || '-'} <span class="detail-unit">bpm</span></p>
                        </div>
                        <div>
                            <p class="detail-title">Hoogtemeters</p>
                            <p class="detail-value">${act.elevation_gain || 0} <span class="detail-unit">m</span></p>
                        </div>
                        <div>
                            <p class="detail-title">Calorieën</p>
                            <p class="detail-value">${act.calories || 0} <span class="detail-unit">kcal</span></p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
}

// Functie om de extra info van een activiteit open/dicht te klappen
window.toggleDetails = function(id) {
    const detailDiv = document.getElementById(id);
    if (detailDiv.classList.contains('hidden')) {
        detailDiv.classList.remove('hidden');
    } else {
        detailDiv.classList.add('hidden');
    }
}

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
function createDualLineChart(id, title, labels, data1, data2, color1, color2) {
    if (chartInstances[id]) chartInstances[id].destroy();

    const pointRad = labels.length > 31 ? 0 : 3;   // iets groter maken voor duidelijke bolletjes

    const ctx = document.getElementById(id).getContext('2d');

    chartInstances[id] = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Hoog',
                    data: data1,
                    borderColor: color1,
                    backgroundColor: color1,           // <-- belangrijk voor volle bolletjes
                    tension: 0.4,
                    pointRadius: pointRad,
                    pointBackgroundColor: color1,      // volle vulling
                    pointBorderColor: '#fff',          // wit randje voor mooie look
                    pointBorderWidth: 1.5
                },
                {
                    label: 'Laag',
                    data: data2,
                    borderColor: color2,
                    backgroundColor: color2,           // <-- belangrijk
                    tension: 0.4,
                    pointRadius: pointRad,
                    pointBackgroundColor: color2,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 1.5
                }
            ]
        },
        options: {
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
                    label: 'Acute Load',
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