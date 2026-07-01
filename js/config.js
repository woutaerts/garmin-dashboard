// Supabase-client, gedeelde state en kleurtokens (uit tokens.css).
// Alle andere modules importeren hiervandaan zodat er één bron van
// waarheid is voor zowel de databaseverbinding als de huisstijlkleuren.

const SUPABASE_URL = 'https://jshftlhzljrwdjaaszib.supabase.co';
const SUPABASE_KEY = 'sb_publishable_GcNLfeb-B_vxbCR-soS_Fw_RO8ocMIL';

export const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Bewaart actieve Chart.js-instanties zodat ze netjes vernietigd kunnen
// worden voor een herbouw (anders klaagt Chart.js over een dubbel canvas).
export const chartInstances = {};

// Leest één CSS-variabele uit :root op.
function token(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// THEME spiegelt tokens.css naar JS, zodat Chart.js en de inline
// badge-kleuren altijd exact dezelfde kleuren gebruiken als de rest van de site.
export const THEME = {
    success: token('--color-success'),
    successBg: token('--color-success-bg'),
    successText: token('--color-success-text'),
    danger: token('--color-danger'),
    dangerBg: token('--color-danger-bg'),
    dangerText: token('--color-danger-text'),
    textFaint: token('--color-text-faint'),

    sleep: token('--color-sleep'),
    sleepDeep: token('--color-sleep-deep'),
    sleepRem: token('--color-sleep-rem'),
    sleepLight: token('--color-sleep-light'),
    sleepAwake: token('--color-sleep-awake'),
    hrv: token('--color-hrv'),
    rhr: token('--color-rhr'),
    vo2max: token('--color-vo2max'),
    steps: token('--color-steps'),
    bodyBattery: token('--color-body-battery'),
    stress: token('--color-stress'),
    stressSecondary: token('--color-stress-secondary'),
    training: token('--color-training'),
    trainingDistance: token('--color-training-distance'),
    aerobicHigh: token('--color-aerobic-high'),
    aerobicLow: token('--color-aerobic-low'),

    zone1: token('--zone-1'),
    zone2: token('--zone-2'),
    zone3: token('--zone-3'),
    zone4: token('--zone-4'),
    zone5: token('--zone-5'),

    statusProductive: token('--status-productive'),
    statusMaintaining: token('--status-maintaining'),
    statusRecovery: token('--status-recovery'),
    statusAttention: token('--status-attention'),
    statusNeutral: token('--status-neutral'),

    heatmap0: token('--heatmap-0'),
    heatmap1: token('--heatmap-1'),
    heatmap2: token('--heatmap-2'),
    heatmap3: token('--heatmap-3'),
    heatmap4: token('--heatmap-4'),

    readinessGreat:    token('--readiness-great'),
    readinessGood:     token('--readiness-good'),
    readinessModerate: token('--readiness-moderate'),
    readinessPoor:     token('--readiness-poor'),

    pmcCtl:    token('--pmc-ctl'),
    pmcAtl:    token('--pmc-atl'),
    pmcTsbPos: token('--pmc-tsb-pos'),
    pmcTsbNeg: token('--pmc-tsb-neg'),
    pmcTsbZero: token('--pmc-tsb-zero'),

    sportRunning: token('--sport-running'),
    sportCycling: token('--sport-cycling'),
    sportSwimming: token('--sport-swimming'),
    sportSkiing: token('--sport-skiing'),
    sportStrength: token('--sport-strength'),
    sportBall: token('--sport-ball'),
    sportOutdoor: token('--sport-outdoor'),
    sportWater: token('--sport-water'),
    sportMindbody: token('--sport-mindbody'),
    sportRowing: token('--sport-rowing'),
    sportGolf: token('--sport-golf'),
    sportBoxing: token('--sport-boxing'),
    sportDefault: token('--sport-default'),
};
