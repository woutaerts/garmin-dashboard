// Login, begroeting en orkestratie van alle dashboardblokken.

import { supabaseClient } from './config.js';
import { buildReadiness } from './readiness.js';
import { buildActivityHeatmap } from './heatmap.js';
import { buildWeeklyComparison } from './comparison.js';
import { buildHRZoneDistribution } from './hr-zone-distribution.js';
import { initFilterBar } from './filters.js';
import { initDayPanel } from './day-panel.js';
import { initNav, registerLazy } from './nav.js';
import { buildRecords } from './records.js';
import { buildPMC } from './pmc.js';

export async function signInWithGoogle() {
    await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + window.location.pathname }
    });
}

function setGreeting() {
    const hour = new Date().getHours();
    let greeting;
    if (hour >= 5 && hour < 11)  greeting = 'Goedemorgen, Wout';
    else if (hour < 17)          greeting = 'Goedemiddag, Wout';
    else if (hour < 24)          greeting = 'Goedenavond, Wout';
    else                         greeting = 'Goedenacht, Wout';
    document.getElementById('greeting-text').innerText = greeting;
}

supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session) {
        document.getElementById('login-form').classList.add('hidden');
        const dash = document.getElementById('dashboard');
        dash.classList.remove('hidden');
        dash.classList.add('has-nav');
        document.getElementById('main-nav').classList.remove('hidden');

        // Nav + dag-paneel direct initialiseren
        initNav();
        initDayPanel();

        // Pagina "Vandaag": direct bouwen
        setGreeting();
        buildReadiness();
        buildActivityHeatmap();
        buildWeeklyComparison();
        buildHRZoneDistribution();

        // Pagina "Activiteiten": direct bouwen (filter haalt data op)
        initFilterBar();

        // Pagina "Trends": charts worden al getriggerd vanuit buildReadiness → updateTrends

        // Pagina's "Records" en "Training": lazy bouwen bij eerste bezoek
        registerLazy('records', buildRecords);
        registerLazy('training', buildPMC);

    } else {
        document.getElementById('login-form').classList.remove('hidden');
        const dash = document.getElementById('dashboard');
        dash.classList.add('hidden');
        dash.classList.remove('has-nav');
        document.getElementById('main-nav').classList.add('hidden');
    }
});