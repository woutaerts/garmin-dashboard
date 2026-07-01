// Hash-gebaseerde paginanavigatie. Toont/verbergt page-section-elementen
// op basis van window.location.hash en markeert de actieve nav-link.

const PAGES = ['today', 'activiteiten', 'trends', 'records', 'training'];
const DEFAULT_PAGE = 'today';

// Lazy-load callbacks: worden ingesteld door auth.js nadat de data binnen is.
// Zo bouwen we een pagina pas wanneer de gebruiker er naartoe navigeert.
const lazyLoaders = {};

export function registerLazy(pageId, fn) {
    lazyLoaders[pageId] = fn;
}

function getPage(hash) {
    const p = hash.replace('#', '');
    return PAGES.includes(p) ? p : DEFAULT_PAGE;
}

function showPage(hash) {
    const page = getPage(hash);

    PAGES.forEach(p => {
        document.getElementById(`page-${p}`)?.classList.toggle('hidden', p !== page);
    });

    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.page === page);
    });

    // Roep de lazy-loader aan als die bestaat en nog niet gedraaid heeft
    if (lazyLoaders[page]) {
        lazyLoaders[page]();
        delete lazyLoaders[page];
    }
}

export function initNav() {
    showPage(window.location.hash);
    window.addEventListener('hashchange', () => showPage(window.location.hash));
}