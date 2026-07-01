// "Gezondheid vandaag" — de zes KPI-kaarten op basis van de laatste
// rij uit daily_metrics.

import { supabaseClient, THEME } from './config.js';
import { updateTrends } from './charts.js';

const STATUS_COLORS = {
    PRODUCTIVE: THEME.statusProductive,
    MAINTAINING: THEME.statusMaintaining,
    RECOVERY: THEME.statusRecovery,
    UNPRODUCTIVE: THEME.statusAttention,
    OVERREACHING: THEME.statusAttention,
};

export async function buildDashboard() {
    const { data, error } = await supabaseClient
        .from('daily_metrics')
        .select('*')
        .order('date', { ascending: false })
        .limit(1);

    if (!error && data && data.length > 0) {
        const latest = data[0];
        const statusColor = STATUS_COLORS[latest.training_status] || THEME.statusNeutral;

        document.getElementById('summary-cards').innerHTML = `
        <div class="card summary-card">
            <h3 class="summary-title">Slaapscore</h3>
            <p class="summary-value" style="color:${THEME.sleep};">${latest.sleep_score || '-'}</p>
        </div>

        <div class="card summary-card">
            <h3 class="summary-title">VO2 Max</h3>
            <p class="summary-value" style="color:${THEME.vo2max};">${latest.vo2_max || '-'}</p>
        </div>

        <div class="card summary-card">
            <h3 class="summary-title">Stappen</h3>
            <p class="summary-value" style="color:${THEME.steps};">${latest.steps_total ? latest.steps_total.toLocaleString('nl-BE') : '-'}</p>
        </div>

        <div class="card summary-card">
            <h3 class="summary-title">Body Battery (Hoog / Laag)</h3>
            <p class="summary-value" style="color:${THEME.bodyBattery};">${latest.body_battery_high || '-'}<span class="summary-unit">/ ${latest.body_battery_low || '-'}</span></p>
        </div>

        <div class="card summary-card">
            <h3 class="summary-title">Training Status</h3>
            <p class="summary-value" style="font-size:24px; color:${statusColor}; margin-top:10px;">${latest.training_status ? latest.training_status.replace('_', ' ') : '-'}</p>
        </div>

        <div class="card summary-card">
            <h3 class="summary-title">HRV (Nacht)</h3>
            <p class="summary-value" style="color:${THEME.hrv};">${latest.hrv_nightly_avg || '-'}<span class="summary-unit">ms</span></p>
        </div>
        `;
    }

    // Trends standaard op de afgelopen week tonen
    updateTrends(7);
}
