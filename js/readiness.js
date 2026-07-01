// Herstelbereidheid — berekent een score (0–100) uit HRV, slaap,
// body battery en rusthartslag en toont die als SVG-ring.

import { supabaseClient, THEME } from './config.js';
import { updateTrends } from './charts.js';

const STATUS_COLORS = {
    PRODUCTIVE:   THEME.statusProductive,
    MAINTAINING:  THEME.statusMaintaining,
    RECOVERY:     THEME.statusRecovery,
    UNPRODUCTIVE: THEME.statusAttention,
    OVERREACHING: THEME.statusAttention,
};

// ── Scoreberekening ───────────────────────────────────────────────────────
// Elke component weegt mee als de waarde beschikbaar is.
// Baseline voor HRV en RHR komen uit het gemiddelde van de laatste 28 dagen.

function computeReadiness(latest, baseline) {
    let score = 0;
    let weight = 0;

    // Slaapscore (0–100) → 30%
    if (latest.sleep_score) {
        score += (latest.sleep_score / 100) * 30;
        weight += 30;
    }

    // HRV t.o.v. persoonlijke baseline → 30%
    if (latest.hrv_nightly_avg && baseline.avgHrv) {
        const ratio = Math.min(latest.hrv_nightly_avg / baseline.avgHrv, 1.25);
        score += Math.min(ratio / 1.25, 1) * 30;
        weight += 30;
    }

    // Body battery (max van de dag, 0–100) → 25%
    if (latest.body_battery_high) {
        score += (latest.body_battery_high / 100) * 25;
        weight += 25;
    }

    // Rusthartslag t.o.v. baseline (lager = beter) → 15%
    if (latest.resting_hr && baseline.avgRhr) {
        const ratio = Math.min(baseline.avgRhr / latest.resting_hr, 1.2);
        score += Math.min(ratio / 1.2, 1) * 15;
        weight += 15;
    }

    // Normaliseer naar 0–100 op basis van de gewogen componenten die beschikbaar waren
    return weight > 0 ? Math.round((score / weight) * 100) : null;
}

function readinessColor(score) {
    if (score >= 80) return THEME.readinessGreat  || '#10b981';
    if (score >= 60) return THEME.readinessGood   || '#34d399';
    if (score >= 40) return THEME.readinessModerate || '#f59e0b';
    return THEME.readinessPoor || '#ef4444';
}

function readinessLabel(score) {
    if (score >= 80) return 'Klaar om te trainen';
    if (score >= 60) return 'Goed herstel';
    if (score >= 40) return 'Matig herstel';
    return 'Rust aanbevolen';
}

// ── SVG-ring ──────────────────────────────────────────────────────────────

function buildRing(score, color) {
    const R = 54;
    const CIRCUM = 2 * Math.PI * R;
    const dash = score != null ? (score / 100) * CIRCUM : 0;

    return `
        <svg class="readiness-ring-svg" viewBox="0 0 120 120" aria-hidden="true">
            <circle cx="60" cy="60" r="${R}" fill="none" stroke="var(--readiness-track)" stroke-width="10"/>
            <circle cx="60" cy="60" r="${R}" fill="none"
                stroke="${color}"
                stroke-width="10"
                stroke-linecap="round"
                stroke-dasharray="${dash.toFixed(1)} ${CIRCUM.toFixed(1)}"
                stroke-dashoffset="${(CIRCUM / 4).toFixed(1)}"
                style="transition: stroke-dasharray 1s cubic-bezier(.4,0,.2,1);"
            />
        </svg>`;
}

// ── KPI-chips onder de ring ────────────────────────────────────────────────

function chip(label, value, unit, color) {
    return `
        <div class="readiness-chip">
            <p class="readiness-chip-label">${label}</p>
            <p class="readiness-chip-value" style="color:${color}">${value ?? '—'}<span class="readiness-chip-unit">${unit}</span></p>
        </div>`;
}

// ── Hoofdfunctie ──────────────────────────────────────────────────────────

export async function buildReadiness() {
    const container = document.getElementById('readiness-container');
    const summaryEl  = document.getElementById('summary-cards');
    if (!container) return;

    // Haal de laatste dag + 28-daagse baseline op tegelijk
    const [{ data: recent }, { data: baseline28 }] = await Promise.all([
        supabaseClient
            .from('daily_metrics')
            .select('*')
            .order('date', { ascending: false })
            .limit(1),
        supabaseClient
            .from('daily_metrics')
            .select('hrv_nightly_avg, resting_hr')
            .order('date', { ascending: false })
            .limit(28),
    ]);

    if (!recent || recent.length === 0) {
        container.innerHTML = `<p class="hm-skeleton">Geen data beschikbaar.</p>`;
        return;
    }

    const latest = recent[0];

    // Baseline gemiddelden
    const validHrv = (baseline28 || []).map(r => r.hrv_nightly_avg).filter(v => v > 0);
    const validRhr = (baseline28 || []).map(r => r.resting_hr).filter(v => v > 0);
    const avgHrv = validHrv.length ? validHrv.reduce((a, b) => a + b, 0) / validHrv.length : null;
    const avgRhr = validRhr.length ? validRhr.reduce((a, b) => a + b, 0) / validRhr.length : null;

    const score = computeReadiness(latest, { avgHrv, avgRhr });
    const color = readinessColor(score ?? 0);
    const label = readinessLabel(score ?? 0);

    // HRV-trend pijl (vergeleken met gemiddelde)
    const hrvTrend = latest.hrv_nightly_avg && avgHrv
        ? (latest.hrv_nightly_avg >= avgHrv * 0.97 ? '↑' : '↓')
        : '';
    const hrvColor = hrvTrend === '↑' ? THEME.success : THEME.danger;

    container.innerHTML = `
        <div class="readiness-block">
            <div class="readiness-ring-wrap">
                ${buildRing(score, color)}
                <div class="readiness-ring-center">
                    <p class="readiness-score" style="color:${color}">${score ?? '—'}</p>
                    <p class="readiness-label">${label}</p>
                </div>
            </div>
            <div class="readiness-chips">
                ${chip('HRV', latest.hrv_nightly_avg ? `${hrvTrend} ${latest.hrv_nightly_avg}` : '—', ' ms', hrvColor)}
                ${chip('Slaap', latest.sleep_score, '', THEME.sleep)}
                ${chip('Body Battery', latest.body_battery_high, '%', THEME.bodyBattery)}
                ${chip('Rusthartslag', latest.resting_hr, ' bpm', THEME.rhr)}
            </div>
        </div>`;

    // Vul de klassieke KPI-kaarten er gewoon ook nog onder in
    if (summaryEl) {
        const statusColor = STATUS_COLORS[latest.training_status] || THEME.statusNeutral;
        summaryEl.innerHTML = `
            <div class="card summary-card">
                <h3 class="summary-title">VO₂ Max</h3>
                <p class="summary-value" style="color:${THEME.vo2max}">${latest.vo2_max || '—'}</p>
            </div>
            <div class="card summary-card">
                <h3 class="summary-title">Stappen</h3>
                <p class="summary-value" style="color:${THEME.steps}">${latest.steps_total ? latest.steps_total.toLocaleString('nl-BE') : '—'}</p>
            </div>
            <div class="card summary-card">
                <h3 class="summary-title">Training Status</h3>
                <p class="summary-value" style="font-size:22px;color:${statusColor};margin-top:8px">
                    ${latest.training_status ? latest.training_status.replace(/_/g, ' ') : '—'}
                </p>
            </div>`;
    }

    updateTrends(7);
}