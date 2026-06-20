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
    // 1. Haal enkel de laatste dag op voor de "Gezondheid Vandaag" kaarten
    const { data, error } = await supabaseClient
        .from('daily_metrics')
        .select('*')
        .order('date', { ascending: false })
        .limit(1);

    if (!error && data && data.length > 0) {
        const latest = data[0];
        document.getElementById('summary-cards').innerHTML = `
        <div class="card summary-card">
            <h3 class="summary-title">Sleep Score</h3>
            <p class="summary-value" style="color: #7B61FF;">${latest.sleep_score || '-'}</p>
        </div>
        <div class="card summary-card">
            <h3 class="summary-title">HRV</h3>
            <p class="summary-value" style="color: #00C4B5;">${latest.hrv || '-'}<span class="summary-unit">ms</span></p>
        </div>
        <div class="card summary-card">
            <h3 class="summary-title">Rusthartslag</h3>
            <p class="summary-value" style="color: #FF4B4B;">${latest.resting_hr || '-'}<span class="summary-unit">bpm</span></p>
        </div>
        `;
    }

    // 2. Laad standaard de trends in voor de afgelopen 7 dagen
    updateTrends(7);
}

// --- TRENDS UPDATER ---
async function updateTrends(days, btnElement = null) {
    // Styling van de actieve knop updaten (als er op een knop is geklikt)
    if (btnElement) {
        document.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.remove('active'));
        btnElement.classList.add('active');
    }

    // Haal het geselecteerde aantal dagen op
    const { data, error } = await supabaseClient
        .from('daily_metrics')
        .select('*')
        .order('date', { ascending: false })
        .limit(days);

    if (error || !data || data.length === 0) return;

    const chartData = data.reverse(); // Zet in chronologische volgorde (van oud naar nieuw)

    // Als we het hele jaar opvragen, groeperen we de data per maand
    if (days === 365) {
        const monthlyData = {};

        // Loop over alle dagen en tel ze op bij de juiste maand
        chartData.forEach(row => {
            const [year, month] = row.date.split('-');
            const monthKey = `${year}-${month}`; // Bijv. "2026-06"

            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = {
                    sleep_sum: 0, sleep_count: 0,
                    hrv_sum: 0, hrv_count: 0,
                    rhr_sum: 0, rhr_count: 0
                };
            }

            // We tellen alleen waardes groter dan 0 mee voor een accuraat gemiddelde
            if (row.sleep_score > 0) {
                monthlyData[monthKey].sleep_sum += row.sleep_score;
                monthlyData[monthKey].sleep_count++;
            }
            if (row.hrv > 0) {
                monthlyData[monthKey].hrv_sum += row.hrv;
                monthlyData[monthKey].hrv_count++;
            }
            if (row.resting_hr > 0) {
                monthlyData[monthKey].rhr_sum += row.resting_hr;
                monthlyData[monthKey].rhr_count++;
            }
        });

        const monthLabels = [];
        const sleepMonthly = [];
        const hrvMonthly = [];
        const rhrMonthly = [];
        const monthNames = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];

        // Bereken het definitieve gemiddelde per maand en maak de labels
        Object.keys(monthlyData).sort().forEach(key => {
            const [y, m] = key.split('-');
            // Label wordt bijvoorbeeld: "Jun '26"
            monthLabels.push(`${monthNames[parseInt(m) - 1]} '${y.slice(-2)}`);

            const md = monthlyData[key];
            sleepMonthly.push(md.sleep_count > 0 ? Math.round(md.sleep_sum / md.sleep_count) : null);
            hrvMonthly.push(md.hrv_count > 0 ? Math.round(md.hrv_sum / md.hrv_count) : null);
            rhrMonthly.push(md.rhr_count > 0 ? Math.round(md.rhr_sum / md.rhr_count) : null);
        });

        // Teken de grafieken met de maand-data
        createLineChart('sleepChart', 'Sleep Score', monthLabels, sleepMonthly, '#7B61FF');
        createLineChart('hrvChart', 'HRV', monthLabels, hrvMonthly, '#00C4B5');
        createLineChart('rhrChart', 'RHR', monthLabels, rhrMonthly, '#FF4B4B');

    } else {
        // Dagelijkse weergave (Voor de Week en Maand toggle)
        const dates = chartData.map(r => r.date.split('-').slice(1).reverse().join('-')); // DD-MM
        createLineChart('sleepChart', 'Sleep Score', dates, chartData.map(r => r.sleep_score), '#7B61FF');
        createLineChart('hrvChart', 'HRV', dates, chartData.map(r => r.hrv), '#00C4B5');
        createLineChart('rhrChart', 'RHR', dates, chartData.map(r => r.resting_hr), '#FF4B4B');
    }
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
    // 0. Zeer belangrijk: verwijder de oude grafiek als we switchen van Week/Maand/Jaar
    if (chartInstances[id]) {
        chartInstances[id].destroy();
    }

    // 1. Bereken het gemiddelde (we negeren lege/0 waardes voor een accuraat gemiddelde)
    const validData = data.filter(val => val !== null && val > 0);
    const average = validData.length > 0
        ? Math.round(validData.reduce((a, b) => a + b, 0) / validData.length)
        : 0;

    // 2. Maak een array met exact hetzelfde gemiddelde voor de stippellijn
    const avgData = Array(labels.length).fill(average);

    // 3. Verberg de individuele bolletjes op de lijn als we het hele jaar (365 dagen) tonen
    const pointRad = labels.length > 31 ? 0 : 2;

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
                    backgroundColor: color + '20',
                    tension: 0.4,
                    fill: true,
                    pointRadius: pointRad,
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
                legend: { display: false },
                title: {
                    display: true,
                    text: `${title} (Gem: ${average})`,
                    font: { family: 'Space Grotesk', size: 14 }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { maxTicksLimit: 12 } } // Maximaal 12 datums op de as
            }
        }
    });
}