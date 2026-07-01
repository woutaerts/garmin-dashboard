// Activiteiten-heatmap: GitHub-stijl jaarkalender op basis van training load.
// Elke cel is klikbaar en opent het dag-detailpaneel.

import { supabaseClient, THEME } from './config.js';
import { openDayPanel } from './day-panel.js';

export async function buildActivityHeatmap() {
    const container = document.getElementById('heatmap-container');
    if (!container) return;

    // Startpunt: dichtstbijzijnde maandag, ~52 weken terug
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 364);
    const dow = startDate.getDay();
    startDate.setDate(startDate.getDate() + (dow === 0 ? -6 : 1 - dow));
    startDate.setHours(0, 0, 0, 0);

    const { data, error } = await supabaseClient
        .from('garmin_activities')
        .select('start_time, training_load, activity_type, activity_name')
        .gte('start_time', startDate.toISOString())
        .order('start_time', { ascending: true });

    if (error) return;

    // Groepeer per dag
    const byDate = {};
    (data || []).forEach(act => {
        const d = new Date(act.start_time);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (!byDate[key]) byDate[key] = { load: 0, count: 0, names: [] };
        byDate[key].load += (act.training_load || 30);
        byDate[key].count += 1;
        byDate[key].names.push(act.activity_name || act.activity_type || 'Activiteit');
    });

    // Bouw weekkolommen op (ma→zo)
    const weeks = [];
    let week = [];
    const cur = new Date(startDate);
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    while (cur <= today) {
        const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
        week.push({ key, data: byDate[key] || null, month: cur.getMonth() });
        if (cur.getDay() === 0) { weeks.push(week); week = []; }
        cur.setDate(cur.getDate() + 1);
    }
    if (week.length > 0) weeks.push(week);

    // Maandlabel boven de eerste week van elke maand
    const monthNames = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
    const monthLabels = new Array(weeks.length).fill('');
    let lastMonth = -1;
    weeks.forEach((w, i) => {
        const m = w[0].month;
        if (m !== lastMonth) { monthLabels[i] = monthNames[m]; lastMonth = m; }
    });

    const getColor = (load) => {
        if (!load) return THEME.heatmap0;
        if (load <= 40) return THEME.heatmap1;
        if (load <= 80) return THEME.heatmap2;
        if (load <= 120) return THEME.heatmap3;
        return THEME.heatmap4;
    };

    const totalActs = Object.values(byDate).reduce((s, d) => s + d.count, 0);
    const activeDays = Object.keys(byDate).length;
    const dayLabels = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

    // Bouw HTML — cellen krijgen data-date voor de klikhandler
    const weeksHTML = weeks.map(w => {
        const cells = Array.from({ length: 7 }, (_, di) => {
            const entry = w[di] || null;
            if (!entry) return `<div class="hm-cell hm-cell--empty"></div>`;

            const color = getColor(entry.data?.load || 0);
            const isToday = entry.key === todayKey;
            const hasData = !!entry.data;
            const tooltip = hasData
                ? `${entry.key} · ${entry.data.names.join(', ')} · load ${entry.data.load}`
                : entry.key;

            return `<div
                class="hm-cell${isToday ? ' hm-cell--today' : ''}${hasData ? ' hm-cell--active' : ''}"
                style="background:${color}"
                data-date="${entry.key}"
                title="${tooltip}"
                role="button"
                tabindex="0"
                aria-label="${tooltip}"
            ></div>`;
        }).join('');
        return `<div class="hm-week">${cells}</div>`;
    }).join('');

    const monthRowHTML = weeks.map((_, i) => `<div class="hm-month-cell">${monthLabels[i]}</div>`).join('');
    const dayColHTML = dayLabels.map((d, i) =>
        `<div class="hm-day-label" style="visibility:${[0, 2, 4].includes(i) ? 'visible' : 'hidden'}">${d}</div>`
    ).join('');

    container.innerHTML = `
        <div class="hm-meta">
            <span class="hm-meta-count">${totalActs} activiteiten</span>
            <span class="hm-meta-sep">·</span>
            <span class="hm-meta-days">${activeDays} actieve dagen</span>
        </div>
        <div class="hm-scroll">
            <div class="hm-inner">
                <div class="hm-day-col">${dayColHTML}</div>
                <div class="hm-right">
                    <div class="hm-month-row">${monthRowHTML}</div>
                    <div class="hm-weeks">${weeksHTML}</div>
                </div>
            </div>
        </div>
        <div class="hm-legend">
            <span class="hm-legend-label">Minder</span>
            ${[THEME.heatmap0, THEME.heatmap1, THEME.heatmap2, THEME.heatmap3, THEME.heatmap4].map(c =>
                `<div class="hm-legend-cell" style="background:${c}"></div>`
            ).join('')}
            <span class="hm-legend-label">Meer</span>
        </div>`;

    // Klikhandler op alle cellen — zowel muis als toetsenbord
    container.querySelectorAll('.hm-cell[data-date]').forEach(cell => {
        const open = () => openDayPanel(cell.dataset.date);
        cell.addEventListener('click', open);
        cell.addEventListener('keydown', e => (e.key === 'Enter' || e.key === ' ') && open());
    });
}
