// Activiteiten-filterbalk: sportcategorie-knoppen met multi-select logica.
// Rendert de knoppenbalk boven de activiteitenlijst en hertrekt de lijst bij elke wijziging.

import { supabaseClient, THEME } from './config.js';
import { buildActivitiesFromData } from './activities.js';

// Eén entry per zichtbare filterknop.
const FILTER_CATEGORIES = [
    {
        id: 'running',
        label: 'Lopen',
        icon: 'run.svg',
        color: THEME.sportRunning,
        match: k => k.includes('run') || k.includes('marathon') || k.includes('treadmill'),
    },
    {
        id: 'cycling',
        label: 'Fietsen',
        icon: 'biking.svg',
        color: THEME.sportCycling,
        match: k => k.includes('cycl') || k.includes('bik'),
    },
    {
        id: 'swimming',
        label: 'Zwemmen',
        icon: 'swimming.svg',
        color: THEME.sportSwimming,
        match: k => k.includes('swim'),
    },
    {
        id: 'skiing',
        label: 'Skiën',
        icon: 'alpine-skiing.svg',
        color: THEME.sportSkiing,
        match: k => k.includes('ski') || k.includes('snow'),
    },
    {
        id: 'strength',
        label: 'Kracht',
        icon: 'barbells.svg',
        color: THEME.sportStrength,
        match: k => k.includes('strength') || k.includes('weight') || k.includes('fitness') || k.includes('cardio') || k.includes('elliptical'),
    },
    {
        id: 'ball',
        label: 'Balsporten',
        icon: 'playing-soccer.svg',
        color: THEME.sportBall,
        match: k => k.includes('soccer') || k.includes('football') || k.includes('padel') || k.includes('tennis') || k.includes('basketball') || k.includes('volleyball') || k.includes('badminton') || k.includes('squash'),
    },
    {
        id: 'outdoor',
        label: 'Outdoor',
        icon: 'hiking.svg',
        color: THEME.sportOutdoor,
        match: k => k.includes('hik') || k.includes('walk') || k.includes('climb'),
    },
];

// Actieve categorieën — leeg = "Alle" actief.
let activeFilters = new Set();
let allActivities = [];

function categoryOf(activityType) {
    const k = (activityType || '').toLowerCase();
    const cat = FILTER_CATEGORIES.find(c => c.match(k));
    return cat ? cat.id : 'other';
}

function applyFilters() {
    const filtered = activeFilters.size === 0
        ? allActivities
        : allActivities.filter(a => activeFilters.has(categoryOf(a.activity_type)));

    buildActivitiesFromData(filtered);

    const countEl = document.getElementById('filter-count');
    if (countEl) {
        countEl.textContent = activeFilters.size === 0
            ? `${allActivities.length} activiteiten`
            : `${filtered.length} van ${allActivities.length} activiteiten`;
    }
}

function renderFilterBar() {
    const bar = document.getElementById('filter-bar');
    if (!bar) return;

    const allBtn = `
        <button
            id="filter-all"
            class="filter-btn filter-btn-all${activeFilters.size === 0 ? ' active' : ''}"
            data-cat="all"
        >Alle</button>`;

    const catBtns = FILTER_CATEGORIES.map(cat => {
        const isActive = activeFilters.has(cat.id);
        const activeStyle = isActive ? `background:${cat.color};border-color:${cat.color};` : '';
        return `
            <button
                class="filter-btn${isActive ? ' active' : ''}"
                data-cat="${cat.id}"
                style="${activeStyle}"
            >
                <span class="filter-icon" style="background:${isActive ? 'rgba(255,255,255,0.3)' : cat.color}">
                    <img src="icons/sports/${cat.icon}" alt="">
                </span>
                ${cat.label}
            </button>`;
    }).join('');

    bar.innerHTML = allBtn + catBtns;

    // Event-listeners op de verse knoppen zetten
    bar.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => toggleFilter(btn.dataset.cat));
    });
}

function toggleFilter(catId) {
    if (catId === 'all') {
        activeFilters.clear();
    } else {
        if (activeFilters.has(catId)) {
            activeFilters.delete(catId);
        } else {
            activeFilters.add(catId);
        }
    }
    renderFilterBar();
    applyFilters();
}

export async function initFilterBar() {
    // Haal genoeg activiteiten op voor de filters (meer dan de standaard 10)
    const { data, error } = await supabaseClient
        .from('garmin_activities')
        .select('*')
        .order('start_time', { ascending: false })
        .limit(100);

    if (error || !data) return;
    allActivities = data;

    renderFilterBar();
    applyFilters();

    // Verberg filterknoppen voor categorieën die geen activiteiten hebben
    const presentCats = new Set(data.map(a => categoryOf(a.activity_type)));
    document.querySelectorAll('#filter-bar .filter-btn[data-cat]').forEach(btn => {
        if (btn.dataset.cat !== 'all' && !presentCats.has(btn.dataset.cat)) {
            btn.style.display = 'none';
        }
    });
}
