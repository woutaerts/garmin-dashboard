// Entry point. Importeren van auth.js start de onAuthStateChange-listener.
// Alle functies die vanuit inline HTML (onclick=) worden aangeroepen moeten
// expliciet op window staan — ES-modules zijn niet globaal.

import { signInWithGoogle } from './auth.js';
import { updateTrends } from './charts.js';
import { toggleDetails } from './activities.js';
import { openDayPanel, closeDayPanel } from './day-panel.js';
import { updatePMCPeriod } from './pmc.js';

window.signInWithGoogle  = signInWithGoogle;
window.updateTrends      = updateTrends;
window.toggleDetails     = toggleDetails;
window.openDayPanel      = openDayPanel;
window.closeDayPanel     = closeDayPanel;
window.updatePMCPeriod   = updatePMCPeriod;