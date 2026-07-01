// Hartslagzone-verdeling: donut + rijen met cumulatieve tijd per zone
// over de laatste 28 dagen.

import { supabaseClient, chartInstances, THEME } from './config.js';

const ZONE_COLORS = [THEME.zone1, THEME.zone2, THEME.zone3, THEME.zone4, THEME.zone5];
const ZONE_LABELS = ['Z1 · Herstel', 'Z2 · Aeroob', 'Z3 · Drempel', 'Z4 · Intensief', 'Z5 · Max'];
const ZONE_DESC = ['< 60% max HR', '60–70%', '70–80%', '80–90%', '> 90%'];

function fmtTime(s) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}u ${m}min` : `${m} min`;
}

export async function buildHRZoneDistribution() {
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

    const totalMin = Math.round(totalSec / 60);

    const rowsHTML = zones.map((z, i) => {
        const pct = ((z / totalSec) * 100).toFixed(1);
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
                    <p class="zd-center-sub">afgelopen maand</p>
                </div>
            </div>
            <div class="zd-rows">${rowsHTML}</div>
        </div>`;

    if (chartInstances.hrZoneDonut) chartInstances.hrZoneDonut.destroy();
    const ctx = document.getElementById('hrZoneDonut').getContext('2d');
    chartInstances.hrZoneDonut = new Chart(ctx, {
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
                            const min = ctx.raw;
                            const pct = ((min / totalMin) * 100).toFixed(1);
                            const h = Math.floor(min / 60);
                            const m = min % 60;
                            const time = h > 0 ? `${h}u ${m}min` : `${m} min`;
                            return ` ${time}  (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}
