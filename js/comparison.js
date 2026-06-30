// Vergelijkt de huidige 4 weken met de 4 weken ervoor, voor acht kernmetrieken.

import { supabaseClient, THEME } from './config.js';

export async function buildWeeklyComparison() {
    const container = document.getElementById('comparison-container');
    if (!container) return;

    const { data: metricsData } = await supabaseClient
        .from('daily_metrics')
        .select('date, sleep_score, hrv_nightly_avg, resting_hr, body_battery_high, training_load, vo2_max, avg_stress')
        .order('date', { ascending: false })
        .limit(56);

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

    const current = metricsData.slice(0, 28);
    const previous = metricsData.slice(28, 56);

    const avg = (arr, key) => {
        const vals = arr.map(d => d[key]).filter(v => v != null && v > 0);
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };

    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const currentActs = (actsData || []).filter(a => new Date(a.start_time) >= fourWeeksAgo);
    const previousActs = (actsData || []).filter(a => new Date(a.start_time) < fourWeeksAgo);
    const actSum = (arr, key) => arr.reduce((s, a) => s + (a[key] || 0), 0);

    // hib = "hoger is beter", bepaalt of de pijl groen of rood kleurt
    const metrics = [
        { label: 'Slaapscore', color: THEME.sleep, unit: '', hib: true, curr: avg(current, 'sleep_score'), prev: avg(previous, 'sleep_score'), fmt: v => v?.toFixed(0) },
        { label: 'HRV', color: THEME.hrv, unit: ' ms', hib: true, curr: avg(current, 'hrv_nightly_avg'), prev: avg(previous, 'hrv_nightly_avg'), fmt: v => v?.toFixed(0) },
        { label: 'Rusthartslag', color: THEME.rhr, unit: ' bpm', hib: false, curr: avg(current, 'resting_hr'), prev: avg(previous, 'resting_hr'), fmt: v => v?.toFixed(0) },
        { label: 'Gem. Stress', color: THEME.stress, unit: '', hib: false, curr: avg(current, 'avg_stress'), prev: avg(previous, 'avg_stress'), fmt: v => v?.toFixed(0) },
        { label: 'VO₂ Max', color: THEME.vo2max, unit: '', hib: true, curr: avg(current, 'vo2_max'), prev: avg(previous, 'vo2_max'), fmt: v => v?.toFixed(1) },
        { label: 'Body Battery', color: THEME.bodyBattery, unit: '', hib: true, curr: avg(current, 'body_battery_high'), prev: avg(previous, 'body_battery_high'), fmt: v => v?.toFixed(0) },
        { label: 'Trainingsafstand', color: THEME.trainingDistance, unit: ' km', hib: true, curr: actSum(currentActs, 'distance') / 1000, prev: actSum(previousActs, 'distance') / 1000, fmt: v => v?.toFixed(1) },
        { label: 'Trainingstijd', color: THEME.training, unit: ' u', hib: true, curr: actSum(currentActs, 'duration') / 3600, prev: actSum(previousActs, 'duration') / 3600, fmt: v => v?.toFixed(1) },
    ];

    const cardsHTML = metrics.map(m => {
        const cStr = m.fmt(m.curr) ?? '-';
        const pStr = m.fmt(m.prev) ?? '-';
        let deltaHTML = '';
        if (m.curr != null && m.prev != null && m.prev > 0) {
            const delta = m.curr - m.prev;
            const pct = Math.abs((delta / m.prev) * 100).toFixed(1);
            const good = m.hib ? delta >= 0 : delta <= 0;
            const arrow = delta >= 0 ? '↑' : '↓';
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