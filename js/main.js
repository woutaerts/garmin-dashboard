// Entry point. Importeren van auth.js start meteen de onAuthStateChange-listener.
// De drie functies hieronder worden vanuit inline HTML (onclick=) aangeroepen,
// en moeten daarom expliciet op window staan — ES-modules zijn niet globaal.

import { signInWithGoogle } from './auth.js';
import { updateTrends } from './charts.js';
import { toggleDetails } from './activities.js';

window.signInWithGoogle = signInWithGoogle;
window.updateTrends = updateTrends;
window.toggleDetails = toggleDetails;