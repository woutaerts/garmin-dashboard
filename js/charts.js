// Alle Chart.js-opbouwfuncties plus de trend-orkestratie (week/maand/jaar).

import { supabaseClient, chartInstances, THEME } from './config.js';

// Gedeelde legendastijl/titelstijl, scheelt herhaling in elke chartconfig.
const FONT = { family: 'Space Grotesk', size: 13 };
const TITLE_FONT = { family: 'Space Grotesk', size: 16, weight: 600 };
const LEGEND_BASE = {
    position: 'bottom',
    labels: { font: FONT, boxWidth: 12, boxHeight: 12, padding: 12, usePointStyle: true, pointStyle: 'circle' }
};

// --- Lijngrafiek met stippellijn-gemiddelde (slaap, RHR) ---
export function createLineChart(id, title, labels, data, color) {
    if (chartInstances[id]) chartInstances[id].destroy();

    const validData = data.filter(val => val !== null && val > 0);
    const average = validData.length > 0
        ? Math.round(validData.reduce((a, b) => a + b, 0) / validData.length)
        : 0;
    const avgData = Array(labels.length).fill(average);
    const pointRad = labels.length > 31 ? 0 : 3;

    const ctx = document.getElementById(id).getContext('2d');
    chartInstances[id] = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: title, data, borderColor: color, backgroundColor: color,
                    tension: 0.4, fill: false, pointRadius: pointRad,
                    pointBackgroundColor: color, pointBorderColor: '#ffffff', pointBorderWidth: 1.5, order: 2
                },
                {
                    label: 'Gemiddelde', data: avgData, borderColor: THEME.textFaint,
                    borderWidth: 2, borderDash: [5, 5], pointRadius: 0, fill: false, tension: 0, order: 1
                }
            ]
        },
        options: {
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, ...LEGEND_BASE, labels: { ...LEGEND_BASE.labels, filter: item => item.text !== 'Gemiddelde' } },
                title: { display: true, text: title, font: TITLE_FONT, padding: { top: 8, bottom: 16 } },
                tooltip: { mode: 'index', intersect: false }
            },
            scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 12 } } }
        }
    });
}

// --- Twee lijnen naast elkaar (body battery, stress) ---
export function createDualLineChart(id, title, labels, data1, data2, color1, color2, label1 = 'Lijn 1', label2 = 'Lijn 2') {
    if (chartInstances[id]) chartInstances[id].destroy();

    const pointRad = labels.length > 31 ? 0 : 3;
    const ctx = document.getElementById(id).getContext('2d');

    chartInstances[id] = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                { label: label1, data: data1, borderColor: color1, backgroundColor: color1, tension: 0.4, pointRadius: pointRad, pointBackgroundColor: color1, pointBorderColor: '#fff', pointBorderWidth: 1.5 },
                { label: label2, data: data2, borderColor: color2, backgroundColor: color2, tension: 0.4, pointRadius: pointRad, pointBackgroundColor: color2, pointBorderColor: '#fff', pointBorderWidth: 1.5 }
            ]
        },
        options: {
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, ...LEGEND_BASE },
                title: { display: true, text: title, font: TITLE_FONT, padding: { top: 8, bottom: 16 } },
                tooltip: { mode: 'index', intersect: false }
            },
            scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 12 } } }
        }
    });
}

// --- Lijn met band/tunnel eromheen (HRV t.o.v. baseline, training load) ---
export function createBandChart(id, title, labels, mainData, lowData, highData, mainColor, bandColor) {
    if (chartInstances[id]) chartInstances[id].destroy();

    const pointRad = labels.length > 31 ? 0 : 3;
    const ctx = document.getElementById(id).getContext('2d');

    chartInstances[id] = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                { label: title, data: mainData, borderColor: mainColor, backgroundColor: mainColor, borderWidth: 2, tension: 0.4, pointRadius: pointRad, pointBackgroundColor: mainColor, pointBorderColor: '#fff', pointBorderWidth: 1.5, order: 1 },
                { label: 'Bovengrens', data: highData, borderColor: bandColor + '60', backgroundColor: bandColor + '20', fill: '+1', tension: 0.4, pointRadius: 0, order: 2 },
                { label: 'Ondergrens', data: lowData, borderColor: bandColor + '40', backgroundColor: 'transparent', fill: false, tension: 0.4, pointRadius: 0, order: 3 }
            ]
        },
        options: {
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, ...LEGEND_BASE, labels: { ...LEGEND_BASE.labels, filter: item => item.text !== 'Bovengrens' && item.text !== 'Ondergrens' } },
                title: { display: true, text: title, font: TITLE_FONT, padding: { top: 8, bottom: 16 } },
                tooltip: { mode: 'index', intersect: false }
            },
            scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 12 } } }
        }
    });
}

// --- Gestapelde staafgrafiek voor training load focus ---
export function createFocusChart(id, title, labels, dataAnaerobic, dataHighAerobic, dataLowAerobic) {
    if (chartInstances[id]) chartInstances[id].destroy();

    const ctx = document.getElementById(id).getContext('2d');
    chartInstances[id] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Anaeroob', data: dataAnaerobic, backgroundColor: THEME.training, borderRadius: 4 },
                { label: 'Hoog Aeroob', data: dataHighAerobic, backgroundColor: THEME.aerobicHigh, borderRadius: 4 },
                { label: 'Laag Aeroob', data: dataLowAerobic, backgroundColor: THEME.aerobicLow, borderRadius: 4 }
            ]
        },
        options: {
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, ...LEGEND_BASE },
                title: { display: true, text: title, font: TITLE_FONT, padding: { top: 8, bottom: 16 } },
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

// --- Gestapelde staafgrafiek voor slaapfases (in uren) ---
export function createSleepPhasesChart(id, title, labels, dataDeep, dataRem, dataLight, dataAwake) {
    if (chartInstances[id]) chartInstances[id].destroy();

    const ctx = document.getElementById(id).getContext('2d');
    chartInstances[id] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Diep', data: dataDeep, backgroundColor: THEME.sleepDeep, borderRadius: 4 },
                { label: 'REM', data: dataRem, backgroundColor: THEME.sleepRem, borderRadius: 4 },
                { label: 'Licht', data: dataLight, backgroundColor: THEME.sleepLight, borderRadius: 4 },
                { label: 'Wakker', data: dataAwake, backgroundColor: THEME.sleepAwake, borderRadius: 4 }
            ]
        },
        options: {
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, ...LEGEND_BASE },
                title: { display: true, text: title, font: TITLE_FONT, padding: { top: 8, bottom: 16 } },
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

// --- Haalt daily_metrics op voor de gekozen periode en tekent alle trendgrafieken ---
export async function updateTrends(days, btnElement = null) {
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
        // Jaarweergave: groepeer per maand en neem het gemiddelde
        const monthlyData = {};
        const monthNames = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];

        chartData.forEach(row => {
            const [year, month] = row.date.split('-');
            const key = `${year}-${month}`;
            if (!monthlyData[key]) monthlyData[key] = { counts: {}, sums: {} };

            Object.keys(metrics).forEach(m => {
                if (row[m] > 0) {
                    monthlyData[key].sums[m] = (monthlyData[key].sums[m] || 0) + row[m];
                    monthlyData[key].counts[m] = (monthlyData[key].counts[m] || 0) + 1;
                }
            });
        });

        Object.keys(monthlyData).sort().forEach(key => {
            const [y, m] = key.split('-');
            labels.push(`${monthNames[parseInt(m) - 1]} '${y.slice(-2)}`);
            const md = monthlyData[key];
            Object.keys(metrics).forEach(m => {
                metrics[m].push(md.counts[m] > 0 ? Math.round(md.sums[m] / md.counts[m]) : null);
            });
        });
    } else {
        // Week/maand: gewoon dag per dag
        labels = chartData.map(r => r.date.split('-').slice(1).reverse().join('-'));
        Object.keys(metrics).forEach(m => { metrics[m] = chartData.map(r => r[m]); });
    }

    // Herstel
    createLineChart('sleepChart', 'Slaapscore', labels, metrics.sleep_score, THEME.sleep);
    createBandChart('hrvChart', 'HRV', labels, metrics.hrv_nightly_avg, metrics.hrv_baseline_low, metrics.hrv_baseline_high, THEME.hrv, THEME.hrv);
    createLineChart('rhrChart', 'Rusthartslag', labels, metrics.resting_hr, THEME.rhr);

    // Energie & stress
    createDualLineChart('bodyBatteryChart', 'Body Battery', labels, metrics.body_battery_high, metrics.body_battery_low, THEME.bodyBattery, THEME.danger, 'Hoog', 'Laag');
    createDualLineChart('stressChart', 'Stress', labels, metrics.avg_stress, metrics.max_stress, THEME.stress, THEME.stressSecondary, 'Gemiddeld', 'Max');

    // Training
    createBandChart('trainingLoadChart', 'Acute Training Load', labels, metrics.training_load, metrics.acute_load_low, metrics.acute_load_high, THEME.training, THEME.success);
    createFocusChart('loadFocusChart', 'Training Load Focus', labels, metrics.load_focus_anaerobic, metrics.load_focus_aerobic_high, metrics.load_focus_aerobic_low);

    // Slaapopbouw: minuten omzetten naar uren met 2 decimalen
    createSleepPhasesChart('sleepPhasesChart', 'Slaap Opbouw (Uren)', labels,
        metrics.deep_sleep.map(m => m ? (m / 60).toFixed(2) : 0),
        metrics.rem_sleep.map(m => m ? (m / 60).toFixed(2) : 0),
        metrics.light_sleep.map(m => m ? (m / 60).toFixed(2) : 0),
        metrics.awake_time.map(m => m ? (m / 60).toFixed(2) : 0)
    );
}
