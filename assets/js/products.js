/* ========================================
   ESENCIA VERDE - Products (Firestore)
   Real-time product rendering for:
     - categoria.html (grid by type)
     - index.html (featured "Diseños Exclusivos")
   Exports Inventory API used by admin.html
   ======================================== */

import { db } from './firebase-setup.js';
import {
    collection, doc, query, orderBy, onSnapshot,
    addDoc, updateDoc, deleteDoc, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

/* ========== LABELS ========== */
const MATERIAL_LABELS = {
    'oro': 'Oro 18k',
    'plata': 'Plata 925',
    'oro-esmeralda': 'Oro 18k + Esmeralda',
    'plata-esmeralda': 'Plata 925 + Esmeralda'
};
const CATEGORY_LABELS = {
    'anillos': 'Anillo',
    'aretes': 'Aretes',
    'dijes': 'Dije',
    'pulseras': 'Pulsera',
    'cadenas': 'Cadena',
    'sets': 'Set'
};

/* ========== STATE ========== */
let currentType = 'oro';
let currentFilter = 'todos';
let productsCache = [];
let unsubscribe = null;

/* ========== INVENTORY API (shared with admin) ========== */
const productsCol = collection(db, 'products');

export const Inventory = {
    /** Live subscribe to all products. Returns unsubscribe fn. */
    subscribeAll(callback) {
        const q = query(productsCol, orderBy('createdAt', 'asc'));
        return onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            callback(list);
        }, (err) => {
            console.error('Error loading products:', err);
        });
    },

    /** One-shot read of all products. */
    async getAll() {
        const snap = await getDocs(query(productsCol, orderBy('createdAt', 'asc')));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    async add(data) {
        const imageUrls = Array.isArray(data.imageUrls)
            ? data.imageUrls.filter(Boolean).slice(0, 2)
            : (data.imageUrl ? [data.imageUrl] : []);
        const payload = {
            name: data.name || '',
            type: data.type || 'oro',
            category: data.category || '',
            material: data.material || '',
            description: data.description || '',
            imageUrls,
            imageUrl: imageUrls[0] || '',
            available: data.available !== false,
            visible: data.visible !== false,
            featured: data.featured === true,
            createdAt: serverTimestamp()
        };
        return await addDoc(productsCol, payload);
    },

    async update(id, patch) {
        const update = { ...patch };
        if (Array.isArray(update.imageUrls)) {
            update.imageUrls = update.imageUrls.filter(Boolean).slice(0, 2);
            update.imageUrl = update.imageUrls[0] || '';
        }
        await updateDoc(doc(db, 'products', id), update);
    },

    async remove(id) {
        await deleteDoc(doc(db, 'products', id));
    }
};

// Expose on window so non-module code (if any) can use it
window.Inventory = Inventory;

/* ========== IMAGE COMPRESSION (client-side, no Storage needed) ========== */
export function compressImage(file, maxWidth = 1000, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const scale = Math.min(1, maxWidth / img.width);
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/* ========== PUBLIC PAGE BOOTSTRAP ========== */
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('productsGrid')) {
        initCategoryPage();
        initFilters();
    }
    if (document.getElementById('featuredGrid')) {
        initFeaturedSection();
    }
    initLightbox();
});

/* ========== IMAGE HELPERS ========== */
function getImages(product) {
    if (Array.isArray(product.imageUrls) && product.imageUrls.length) {
        return product.imageUrls.filter(Boolean);
    }
    return product.imageUrl ? [product.imageUrl] : [];
}

/* ========== LIGHTBOX WITH ZOOM & PAN ========== */
const lbState = {
    scale: 1, tx: 0, ty: 0, dragging: false, lastX: 0, lastY: 0, pinchDist: 0,
    gallery: [], index: 0, caption: ''
};

function initLightbox() {
    if (!document.getElementById('lightbox-styles')) {
        const style = document.createElement('style');
        style.id = 'lightbox-styles';
        style.textContent = `
            .product-img img, .exclusive-img img { cursor: zoom-in; }
            .lightbox { position: fixed; inset: 0; background: rgba(0,0,0,0.95); z-index: 10000; display: none; align-items: center; justify-content: center; animation: lbFade 0.25s ease; overflow: hidden; }
            .lightbox.active { display: flex; }
            .lightbox-stage { position: relative; width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; overflow: hidden; }
            .lightbox img { max-width: 90vw; max-height: 85vh; object-fit: contain; border-radius: 8px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); user-select: none; -webkit-user-drag: none; transform-origin: center center; transition: transform 0.15s ease-out; will-change: transform; touch-action: none; }
            .lightbox img.zoomed { cursor: grab; transition: none; }
            .lightbox img.dragging { cursor: grabbing; }
            .lightbox-close { position: absolute; top: 20px; right: 24px; width: 48px; height: 48px; background: rgba(255,255,255,0.1); border: 2px solid rgba(255,255,255,0.4); color: #fff; font-size: 1.4rem; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; z-index: 10; }
            .lightbox-close:hover { background: rgba(255,255,255,0.2); border-color: #fff; transform: rotate(90deg); }
            .lightbox-caption { position: absolute; bottom: 80px; left: 50%; transform: translateX(-50%); color: #fff; font-family: 'Playfair Display', Georgia, serif; font-size: 1.15rem; text-align: center; padding: 10px 24px; background: rgba(0,0,0,0.5); border-radius: 50px; max-width: 80vw; pointer-events: none; z-index: 10; }
            .lightbox-controls { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); display: flex; gap: 10px; z-index: 10; }
            .lightbox-btn { width: 44px; height: 44px; background: rgba(255,255,255,0.1); border: 2px solid rgba(255,255,255,0.4); color: #fff; font-size: 1rem; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
            .lightbox-btn:hover { background: rgba(255,255,255,0.2); border-color: #fff; }
            .lightbox-hint { position: absolute; top: 20px; left: 50%; transform: translateX(-50%); color: rgba(255,255,255,0.7); font-size: 0.82rem; font-family: 'Lato', sans-serif; background: rgba(0,0,0,0.4); padding: 6px 14px; border-radius: 50px; z-index: 10; pointer-events: none; }
            .lightbox-nav { position: absolute; top: 50%; transform: translateY(-50%); width: 54px; height: 54px; background: rgba(255,255,255,0.12); border: 2px solid rgba(255,255,255,0.4); color: #fff; font-size: 1.2rem; border-radius: 50%; cursor: pointer; display: none; align-items: center; justify-content: center; transition: all 0.2s; z-index: 10; }
            .lightbox-nav:hover { background: rgba(255,255,255,0.22); border-color: #fff; }
            .lightbox-nav.prev { left: 24px; }
            .lightbox-nav.next { right: 24px; }
            .lightbox.has-gallery .lightbox-nav { display: flex; }
            .lightbox-counter { position: absolute; top: 20px; left: 24px; color: rgba(255,255,255,0.85); font-size: 0.85rem; font-family: 'Lato', sans-serif; background: rgba(0,0,0,0.4); padding: 6px 14px; border-radius: 50px; z-index: 10; display: none; }
            .lightbox.has-gallery .lightbox-counter { display: block; }
            .multi-img-badge { position: absolute; top: 12px; right: 12px; background: rgba(0,0,0,0.65); color: #fff; font-size: 0.72rem; padding: 4px 10px; border-radius: 50px; font-family: 'Lato', sans-serif; display: flex; align-items: center; gap: 5px; z-index: 2; }
            @keyframes lbFade { from { opacity: 0; } to { opacity: 1; } }
            body.lightbox-open { overflow: hidden; }
            @media (max-width: 600px) {
                .lightbox-caption { bottom: 74px; font-size: 0.95rem; padding: 8px 18px; }
                .lightbox-hint { font-size: 0.72rem; }
            }
        `;
        document.head.appendChild(style);
    }
    if (!document.getElementById('lightboxEl')) {
        const el = document.createElement('div');
        el.id = 'lightboxEl';
        el.className = 'lightbox';
        el.innerHTML = `
            <button class="lightbox-close" aria-label="Cerrar"><i class="fas fa-times"></i></button>
            <div class="lightbox-counter">1 / 1</div>
            <div class="lightbox-hint">Rueda del mouse o doble clic para acercar · Arrastra para moverte</div>
            <button class="lightbox-nav prev" aria-label="Anterior"><i class="fas fa-chevron-left"></i></button>
            <div class="lightbox-stage"><img src="" alt=""></div>
            <button class="lightbox-nav next" aria-label="Siguiente"><i class="fas fa-chevron-right"></i></button>
            <div class="lightbox-caption"></div>
            <div class="lightbox-controls">
                <button class="lightbox-btn" data-zoom="out" aria-label="Alejar"><i class="fas fa-minus"></i></button>
                <button class="lightbox-btn" data-zoom="reset" aria-label="Restablecer"><i class="fas fa-expand"></i></button>
                <button class="lightbox-btn" data-zoom="in" aria-label="Acercar"><i class="fas fa-plus"></i></button>
            </div>
        `;
        document.body.appendChild(el);

        const img = el.querySelector('img');
        const stage = el.querySelector('.lightbox-stage');

        const close = () => {
            el.classList.remove('active');
            document.body.classList.remove('lightbox-open');
            resetZoom(img);
        };
        el.querySelector('.lightbox-close').addEventListener('click', close);
        stage.addEventListener('click', (e) => {
            if (e.target === stage && lbState.scale === 1) close();
        });
        document.addEventListener('keydown', (e) => {
            if (!el.classList.contains('active')) return;
            if (e.key === 'Escape') close();
            if (e.key === '+' || e.key === '=') zoomBy(img, 1.3);
            if (e.key === '-') zoomBy(img, 1 / 1.3);
            if (e.key === '0') resetZoom(img);
            if (e.key === 'ArrowLeft') navigateGallery(-1);
            if (e.key === 'ArrowRight') navigateGallery(1);
        });

        el.querySelector('.lightbox-nav.prev').addEventListener('click', (e) => {
            e.stopPropagation();
            navigateGallery(-1);
        });
        el.querySelector('.lightbox-nav.next').addEventListener('click', (e) => {
            e.stopPropagation();
            navigateGallery(1);
        });

        // Wheel zoom
        stage.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = img.getBoundingClientRect();
            const ox = e.clientX - rect.left - rect.width / 2;
            const oy = e.clientY - rect.top - rect.height / 2;
            const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
            zoomAt(img, factor, ox, oy);
        }, { passive: false });

        // Double click zoom
        img.addEventListener('dblclick', (e) => {
            if (lbState.scale > 1) {
                resetZoom(img);
            } else {
                const rect = img.getBoundingClientRect();
                const ox = e.clientX - rect.left - rect.width / 2;
                const oy = e.clientY - rect.top - rect.height / 2;
                zoomAt(img, 2.5, ox, oy);
            }
        });

        // Drag to pan
        img.addEventListener('pointerdown', (e) => {
            if (lbState.scale <= 1) return;
            lbState.dragging = true;
            lbState.lastX = e.clientX;
            lbState.lastY = e.clientY;
            img.classList.add('dragging');
            img.setPointerCapture(e.pointerId);
        });
        img.addEventListener('pointermove', (e) => {
            if (!lbState.dragging) return;
            lbState.tx += e.clientX - lbState.lastX;
            lbState.ty += e.clientY - lbState.lastY;
            lbState.lastX = e.clientX;
            lbState.lastY = e.clientY;
            applyTransform(img);
        });
        const endDrag = (e) => {
            lbState.dragging = false;
            img.classList.remove('dragging');
            try { img.releasePointerCapture(e.pointerId); } catch (_) {}
        };
        img.addEventListener('pointerup', endDrag);
        img.addEventListener('pointercancel', endDrag);

        // Pinch to zoom on touch
        let initialPinchDist = 0;
        let initialScale = 1;
        stage.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                initialPinchDist = touchDistance(e.touches);
                initialScale = lbState.scale;
            }
        }, { passive: true });
        stage.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2 && initialPinchDist > 0) {
                e.preventDefault();
                const dist = touchDistance(e.touches);
                const newScale = Math.max(1, Math.min(5, initialScale * (dist / initialPinchDist)));
                lbState.scale = newScale;
                if (newScale === 1) { lbState.tx = 0; lbState.ty = 0; }
                applyTransform(img);
            }
        }, { passive: false });

        // Control buttons
        el.querySelectorAll('[data-zoom]').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.zoom;
                if (action === 'in') zoomBy(img, 1.3);
                else if (action === 'out') zoomBy(img, 1 / 1.3);
                else resetZoom(img);
            });
        });
    }

    // Event delegation for product image clicks
    document.addEventListener('click', (e) => {
        const img = e.target.closest('.product-img img, .exclusive-img img');
        if (!img) return;
        const card = img.closest('.product-card, .exclusive-card');
        const name = card?.querySelector('h4')?.textContent || '';
        const pid = card?.dataset.pid;
        const product = productsCache.find(p => p.id === pid);
        const images = product ? getImages(product) : [img.src];
        openLightbox(images, 0, name);
    });
}

function navigateGallery(delta) {
    if (lbState.gallery.length < 2) return;
    const len = lbState.gallery.length;
    lbState.index = (lbState.index + delta + len) % len;
    const el = document.getElementById('lightboxEl');
    const img = el.querySelector('img');
    img.src = lbState.gallery[lbState.index];
    resetZoom(img);
    updateGalleryCounter();
}

function updateGalleryCounter() {
    const el = document.getElementById('lightboxEl');
    if (!el) return;
    const counter = el.querySelector('.lightbox-counter');
    counter.textContent = `${lbState.index + 1} / ${lbState.gallery.length}`;
}

function touchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
}

function zoomBy(img, factor) {
    zoomAt(img, factor, 0, 0);
}

function zoomAt(img, factor, ox, oy) {
    const prevScale = lbState.scale;
    const newScale = Math.max(1, Math.min(5, prevScale * factor));
    if (newScale === prevScale) return;
    // Keep the point under cursor stable
    const ratio = newScale / prevScale;
    lbState.tx = (lbState.tx - ox) * ratio + ox;
    lbState.ty = (lbState.ty - oy) * ratio + oy;
    lbState.scale = newScale;
    if (newScale === 1) { lbState.tx = 0; lbState.ty = 0; }
    applyTransform(img);
}

function resetZoom(img) {
    lbState.scale = 1;
    lbState.tx = 0;
    lbState.ty = 0;
    applyTransform(img);
}

function applyTransform(img) {
    img.style.transform = `translate(${lbState.tx}px, ${lbState.ty}px) scale(${lbState.scale})`;
    img.classList.toggle('zoomed', lbState.scale > 1);
}

function openLightbox(images, startIndex, caption) {
    const el = document.getElementById('lightboxEl');
    if (!el) return;
    const gallery = Array.isArray(images) ? images.filter(Boolean) : [images].filter(Boolean);
    if (!gallery.length) return;
    lbState.gallery = gallery;
    lbState.index = Math.max(0, Math.min(startIndex || 0, gallery.length - 1));
    lbState.caption = caption || '';
    const img = el.querySelector('img');
    img.src = gallery[lbState.index];
    el.querySelector('.lightbox-caption').textContent = caption || '';
    el.classList.toggle('has-gallery', gallery.length > 1);
    updateGalleryCounter();
    el.classList.add('active');
    document.body.classList.add('lightbox-open');
    resetZoom(img);
}

/* ========== CATEGORY PAGE ========== */
function initCategoryPage() {
    const params = new URLSearchParams(window.location.search);
    currentType = params.get('tipo') || 'oro';
    const cat = params.get('cat');

    const isGold = currentType === 'oro';
    document.getElementById('pageTitle').textContent = isGold ? 'Joyería en Oro' : 'Joyería en Plata';
    document.getElementById('pageSubtitle').textContent = isGold
        ? 'Piezas exclusivas en oro 18k con esmeraldas colombianas'
        : 'Elegancia y sofisticación en plata 925 de la más alta calidad';
    document.getElementById('breadcrumbCat').textContent = isGold ? 'Joyería en Oro' : 'Joyería en Plata';
    document.title = (isGold ? 'Joyería en Oro' : 'Joyería en Plata') + ' - Esencia Verde';

    if (cat) {
        currentFilter = cat;
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === cat);
        });
    }

    // Subscribe to real-time updates
    if (unsubscribe) unsubscribe();
    unsubscribe = Inventory.subscribeAll((list) => {
        productsCache = list;
        renderCategoryProducts();
    });
}

function renderCategoryProducts() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    const list = productsCache.filter(p =>
        p.type === currentType && p.visible !== false
    );
    const filtered = currentFilter === 'todos'
        ? list
        : list.filter(p => p.category === currentFilter);

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="no-products">
                <i class="fas fa-gem"></i>
                <h3>Próximamente</h3>
                <p>Estamos preparando nuevos productos para esta categoría. ¡Pronto los verás aquí!</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = filtered.map(product => {
        const images = getImages(product);
        const imgSrc = images[0] || '';
        const imgHtml = imgSrc
            ? `<img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(product.name)}" loading="lazy">`
            : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#f5f5e8,#e8e8e0);"><i class="fas fa-gem" style="font-size:3rem;color:#ccc;"></i></div>`;
        const multiBadge = images.length > 1
            ? `<span class="multi-img-badge"><i class="fas fa-images"></i> ${images.length}</span>`
            : '';

        const isAvailable = product.available !== false;
        const soldOutOverlay = isAvailable ? '' : `<div class="sold-out-overlay">Agotado</div>`;
        const btnHtml = isAvailable
            ? `<button class="btn-consult" onclick="consultProduct('${escapeHtml(product.name)}')">
                    <i class="fab fa-whatsapp"></i> Consultar
                </button>`
            : `<button class="btn-consult" disabled style="opacity:0.5;cursor:not-allowed;">
                    <i class="fas fa-ban"></i> Agotado
                </button>`;

        return `
            <div class="product-card${isAvailable ? '' : ' sold-out'}" data-category="${product.category}" data-pid="${escapeHtml(product.id)}">
                <div class="product-img">
                    ${imgHtml}
                    <span class="product-badge">${escapeHtml(CATEGORY_LABELS[product.category] || product.category)}</span>
                    ${multiBadge}
                    ${soldOutOverlay}
                </div>
                <div class="product-info">
                    <div class="product-material">${escapeHtml(MATERIAL_LABELS[product.material] || product.material)}</div>
                    <h4>${escapeHtml(product.name)}</h4>
                    <p>${escapeHtml(product.description || '')}</p>
                </div>
                <div class="product-actions">
                    ${btnHtml}
                </div>
            </div>
        `;
    }).join('');
}

/* ========== FILTERS ========== */
function initFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderCategoryProducts();
        });
    });
}

/* ========== FEATURED (index.html "Diseños Exclusivos") ========== */
function initFeaturedSection() {
    Inventory.subscribeAll((list) => {
        productsCache = list;
        renderFeatured();
    });
}

function renderFeatured() {
    const grid = document.getElementById('featuredGrid');
    if (!grid) return;

    const featured = productsCache.filter(p =>
        p.featured === true && p.visible !== false
    ).slice(0, 6);

    if (featured.length === 0) {
        grid.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;padding:40px 20px;color:#888;">
                <i class="fas fa-gem" style="font-size:2.5rem;opacity:0.3;margin-bottom:12px;display:block;"></i>
                <p>Próximamente nuevos diseños exclusivos</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = featured.map(p => {
        const isAvailable = p.available !== false;
        const images = getImages(p);
        const imgSrc = images[0] || '';
        const imgHtml = imgSrc
            ? `<img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(p.name)}" loading="lazy">`
            : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#f5f5e8,#e8e8e0);"><i class="fas fa-gem" style="font-size:3rem;color:#ccc;"></i></div>`;
        const multiBadge = images.length > 1
            ? `<span class="multi-img-badge"><i class="fas fa-images"></i> ${images.length}</span>`
            : '';
        const soldOut = isAvailable ? '' : `<div class="sold-out-overlay">Agotado</div>`;
        return `
            <div class="exclusive-card${isAvailable ? '' : ' sold-out'}" data-pid="${escapeHtml(p.id)}">
                <div class="exclusive-img">${imgHtml}${multiBadge}${soldOut}</div>
                <div class="exclusive-info">
                    <h4>${escapeHtml(p.name)}</h4>
                    <p>${escapeHtml(p.description || '')}</p>
                </div>
            </div>
        `;
    }).join('');
}

/* ========== CONSULT VIA WHATSAPP ========== */
window.consultProduct = function(productName) {
    const text = encodeURIComponent(
        `Hola, estoy interesado/a en el producto "${productName}" que vi en su página web. ¿Me pueden dar más información?`
    );
    window.open(`https://wa.me/573152435998?text=${text}`, '_blank');
};

/* ========== UTILITY ========== */
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}
