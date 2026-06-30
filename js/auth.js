// Login, begroeting en de orkestratie die alle dashboardblokken opbouwt
// zodra de gebruiker ingelogd is.

import { supabaseClient } from './config.js';
import { buildDashboard } from './summary.js';
import { buildActivities } from './activities.js';
import { buildActivityHeatmap } from './heatmap.js';
import { buildWeeklyComparison } from './comparison.js';
import { buildHRZoneDistribution } from './hr-zone-distribution.js';

export async function signInWithGoogle() {
    await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + window.location.pathname }
    });
}

// Begroeting op basis van het tijdstip van de dag.
export function setGreeting() {
    const hour = new Date().getHours();
    let greeting;

    if (hour >= 5 && hour < 11) greeting = 'Goedemorgen, Wout';
    else if (hour >= 11 && hour < 17) greeting = 'Goedemiddag, Wout';
    else if (hour >= 17 && hour < 24) greeting = 'Goedenavond, Wout';
    else greeting = 'Goedenacht, Wout';

    document.getElementById('greeting-text').innerText = greeting;
}

supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session) {
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');

        setGreeting();
        buildDashboard();
        buildActivities();
        buildActivityHeatmap();
        buildWeeklyComparison();
        buildHRZoneDistribution();
    } else {
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('dashboard').classList.add('hidden');
    }
});