const SUPABASE_URL = 'https://jshftlhzljrwdjaaszib.supabase.co';
const SUPABASE_KEY = 'sb_publishable_GcNLfeb-B_vxbCR-soS_Fw_RO8ocMIL';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function signInWithGoogle() {
    await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + window.location.pathname }
    });
}

// Check sessie bij laden
supabaseClient.auth.getSession().then(({ data }) => {
    if (data.session) {
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('dashboard').style.display = 'grid';
        buildDashboard();
    }
});

async function buildDashboard() {
    const { data, error } = await supabaseClient
        .from('daily_metrics')
        .select('*')
        .order('date', { ascending: true });

    if (error) return;

    const dates = data.map(r => r.date.split('-').slice(1).reverse().join('-'));

    createLineChart('sleepChart', 'Sleep Score', dates, data.map(r => r.sleep_score), '#7B61FF');
    createLineChart('hrvChart', 'HRV (ms)', dates, data.map(r => r.hrv), '#00C4B5');
    createLineChart('rhrChart', 'Rusthartslag (bpm)', dates, data.map(r => r.resting_hr), '#FF4B4B');
}

function createLineChart(canvasId, title, labels, dataPoints, lineColor) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{ label: title, data: dataPoints, borderColor: lineColor, backgroundColor: lineColor + '22', borderWidth: 3, tension: 0.4, fill: true, pointRadius: 0 }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false }, title: { display: true, text: title, font: { size: 16 } } },
            scales: { y: { grid: { color: '#f0f0f0' } }, x: { grid: { display: false } } }
        }
    });
}