// Prestatiebeheer grafiek (PMC) — toont drie kernlijnen:
//   CTL  = Chronic Training Load  = "fitness"  (42-daags gewogen gemiddelde)
//   ATL  = Acute Training Load    = "vermoeidheid" (7-daags gewogen gemiddelde)
//   TSB  = Training Stress Balance = CTL - ATL  = "vorm"
//
// Formule: exponentieel gewogen gemiddelde (EMA).
//   CTL(t) = CTL(t-1) + (load(t) - CTL(t-1)) / 42
//   ATL(t) = ATL(t-1) + (load(t) - ATL(t-1)) / 7

import { supabaseClient, chartInstances, THEME } from './config.js';

const TITLE_FONT = { family: 'Space Grotesk', size: 16, weight: 600 };
const LEGEND_FONT = { family: 'Space Grotesk', size: 13 };

// ── EMA berekening ────────────────────────────────────────────────────────

function buildPMC(dailyLoad) {
    let ctl = 0, atl = 0;
    return dailyLoad.map(({ date, load }) => {
        ctl = ctl + (load - ctl) / 42;
        atl = atl + (load - atl) / 7;
        const tsb = ctl - atl;
        return {
            date,
            ctl: Math.round(ctl * 10) / 10,
            atl: Math.round(atl * 10) / 10,
            tsb: Math.round(tsb * 10) / 10,
        };
    });
}

// ── TSB achtergrond-segmenten (groen/rood vlakken) ────────────────────────

function tsbColor(tsb) {
    if (tsb > 5)  return THEME.pmcTsbPos  || '#10b981';
    if (tsb < -5) return THEME.pmcTsbNeg  || '#f87171';
    return THEME.pmcTsbZero || '#9ca3af';
}

// Geeft per punt een puntkleur terug voor de TSB-lijn
function tsbColors(tsbArr) {
    return tsbArr.map(v => tsbColor(v));
}

// ── Chart ─────────────────────────────────────────────────────────────────

function drawPMC(id, labels, ctlData, atlData, tsbData) {
    if (chartInstances[id]) chartInstances[id].destroy();
    const ctx = document.getElementById(id).getContext('2d');

    // TSB als afzonderlijk dataset met per-punt-kleuren
    const tsbPointColors = tsbColors(tsbData);

    chartInstances[id] = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'CTL (Fitness)',
                    data: ctlData,
                    borderColor: THEME.pmcCtl  || '#3b82f6',
                    backgroundColor: 'transparent',
                    borderWidth: 2.5,
                    tension: 0.4,
                    pointRadius: 0,
                    yAxisID: 'yLoad',
                    order: 1,
                },
                {
                    label: 'ATL (Vermoeidheid)',
                    data: atlData,
                    borderColor: THEME.pmcAtl || '#ef4444',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.4,
                    pointRadius: 0,
                    yAxisID: 'yLoad',
                    order: 2,
                },
                {
                    label: 'TSB (Vorm)',
                    data: tsbData,
                    borderColor: 'transparent',
                    backgroundColor: 'transparent',
                    borderWidth: 0,
                    pointRadius: labels.length > 90 ? 0 : 3,
                    pointBackgroundColor: tsbPointColors,
                    tension: 0.4,
                    yAxisID: 'yTSB',
                    order: 0,
                    // Teken ook een gekleurde lijn via segment-plugin
                    segment: {
                        borderColor: ctx => tsbColor(ctx.p1.parsed.y),
                        borderWidth: 2,
                    },
                },
            ],
        },
        options: {
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                title: {
                    display: true,
                    text: 'Prestatiebeheer (CTL · ATL · TSB)',
                    font: TITLE_FONT,
                    padding: { top: 8, bottom: 16 },
                },
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        font: LEGEND_FONT,
                        boxWidth: 12,
                        boxHeight: 12,
                        padding: 12,
                        usePointStyle: true,
                        pointStyle: 'circle',
                    },
                },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const label = ctx.dataset.label || '';
                            const val = ctx.raw;
                            if (label.startsWith('TSB')) {
                                const emoji = val > 5 ? '✅' : val < -5 ? '⚠️' : '➖';
                                return ` TSB ${val > 0 ? '+' : ''}${val}  ${emoji}`;
                            }
                            return ` ${label}: ${val}`;
                        },
                    },
                },
                annotation: undefined,
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { maxTicksLimit: 10, font: { family: 'Space Grotesk', size: 11 } },
                },
                yLoad: {
                    type: 'linear',
                    position: 'left',
                    title: { display: true, text: 'Load', font: { family: 'Space Grotesk', size: 11 } },
                    grid: { color: '#f3f4f6' },
                },
                yTSB: {
                    type: 'linear',
                    position: 'right',
                    title: { display: true, text: 'TSB (Vorm)', font: { family: 'Space Grotesk', size: 11 } },
                    grid: { display: false },
                    // nulpunt-lijn markeren
                    afterDataLimits: scale => {
                        if (Math.abs(scale.min) < 5 && Math.abs(scale.max) < 5) {
                            scale.min = -10; scale.max = 10;
                        }
                    },
                },
            },
        },
    });
}

// ── PMC-periodeblokken ────────────────────────────────────────────────────

function buildSummaryBlock(pmcPoints) {
    const last = pmcPoints[pmcPoints.length - 1];
    if (!last) return '';

    const tsbCol = tsbColor(last.tsb);
    const advies = last.tsb > 15 ? 'Uitgerust — intensieve training mogelijk'
        : last.tsb > 5  ? 'Goede vorm — train op niveau'
        : last.tsb > -5 ? 'Neutraal — herstel aanbevolen'
        : last.tsb > -20 ? 'Vermoeid — lichte training of rust'
        : 'Overbelast — verplichte rustdag';

    return `
        <div class="pmc-summary">
            <div class="pmc-stat">
                <p class="pmc-stat-label">Fitness (CTL)</p>
                <p class="pmc-stat-value" style="color:${THEME.pmcCtl || '#3b82f6'}">${last.ctl}</p>
            </div>
            <div class="pmc-stat">
                <p class="pmc-stat-label">Vermoeidheid (ATL)</p>
                <p class="pmc-stat-value" style="color:${THEME.pmcAtl || '#ef4444'}">${last.atl}</p>
            </div>
            <div class="pmc-stat">
                <p class="pmc-stat-label">Vorm (TSB)</p>
                <p class="pmc-stat-value" style="color:${tsbCol}">${last.tsb > 0 ? '+' : ''}${last.tsb}</p>
            </div>
            <div class="pmc-stat pmc-stat--wide">
                <p class="pmc-stat-label">Advies</p>
                <p class="pmc-stat-advice" style="color:${tsbCol}">${advies}</p>
            </div>
        </div>`;
}

// ── Periodewissel ─────────────────────────────────────────────────────────

let _pmcPoints = [];

export function updatePMCPeriod(days, btn) {
    document.querySelectorAll('.pmc-toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const slice = _pmcPoints.slice(-days);
    const labels = slice.map(p => p.date.slice(5).replace('-', '/'));
    drawPMC('pmcChart', labels, slice.map(p => p.ctl), slice.map(p => p.atl), slice.map(p => p.tsb));
}

// ── Hoofdfunctie ──────────────────────────────────────────────────────────

export async function buildPMC() {
    const container = document.getElementById('pmc-container');
    if (!container) return;
    container.innerHTML = `<p class="hm-skeleton">PMC wordt geladen…</p>`;

    // Haal dagelijkse training load op — zo ver terug als mogelijk (max 730 dagen)
    const since = new Date();
    since.setDate(since.getDate() - 730);

    const { data, error } = await supabaseClient
        .from('daily_metrics')
        .select('date, training_load')
        .gte('date', since.toISOString().slice(0, 10))
        .order('date', { ascending: true });

    if (error || !data || data.length < 7) {
        container.innerHTML = `<p class="hm-skeleton">Niet genoeg data voor PMC.</p>`;
        return;
    }

    // Vul ontbrekende dagen met load 0 zodat EMA correct doorloopt
    const dayMap = new Map(data.map(r => [r.date, r.training_load || 0]));
    const startDate = new Date(data[0].date + 'T12:00:00');
    const endDate = new Date();
    const dailyLoad = [];

    for (const d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().slice(0, 10);
        dailyLoad.push({ date: key, load: dayMap.get(key) || 0 });
    }

    _pmcPoints = buildPMC(dailyLoad);

    // Standaard: toon de afgelopen 90 dagen
    const DEFAULT_DAYS = 90;
    const slice = _pmcPoints.slice(-DEFAULT_DAYS);
    const labels = slice.map(p => p.date.slice(5).replace('-', '/'));

    container.innerHTML = `
        <div class="pmc-header">
            ${buildSummaryBlock(_pmcPoints)}
            <div class="pmc-toggles">
                <button class="pmc-toggle-btn toggle-btn" onclick="updatePMCPeriod(30, this)">30d</button>
                <button class="pmc-toggle-btn toggle-btn active" onclick="updatePMCPeriod(90, this)">90d</button>
                <button class="pmc-toggle-btn toggle-btn" onclick="updatePMCPeriod(180, this)">180d</button>
                <button class="pmc-toggle-btn toggle-btn" onclick="updatePMCPeriod(365, this)">1 jaar</button>
            </div>
        </div>
        <div class="card pmc-chart-card">
            <canvas id="pmcChart"></canvas>
        </div>`;

    drawPMC('pmcChart', labels, slice.map(p => p.ctl), slice.map(p => p.atl), slice.map(p => p.tsb));
}
