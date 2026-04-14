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

    async add(data, file) {
        let imageUrl = data.imageUrl || '';
        if (file) {
            imageUrl = await compressImage(file);
        }
        const payload = {
            name: data.name || '',
            type: data.type || 'oro',
            category: data.category || '',
            material: data.material || '',
            description: data.description || '',
            imageUrl,
            available: data.available !== false,
            visible: data.visible !== false,
            featured: data.featured === true,
            createdAt: serverTimestamp()
        };
        return await addDoc(productsCol, payload);
    },

    async update(id, patch, file) {
        const update = { ...patch };
        if (file) {
            update.imageUrl = await compressImage(file);
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
function compressImage(file, maxWidth = 1200, quality = 0.85) {
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

/* ========== LIGHTBOX (zoom on click) ========== */
function initLightbox() {
    // Inject styles once
    if (!document.getElementById('lightbox-styles')) {
        const style = document.createElement('style');
        style.id = 'lightbox-styles';
        style.textContent = `
            .product-img img, .exclusive-img img { cursor: zoom-in; }
            .lightbox { position: fixed; inset: 0; background: rgba(0,0,0,0.92); z-index: 10000; display: none; align-items: center; justify-content: center; padding: 40px; animation: lbFade 0.25s ease; }
            .lightbox.active { display: flex; }
            .lightbox img { max-width: 90vw; max-height: 90vh; object-fit: contain; border-radius: 8px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); animation: lbZoom 0.3s ease; }
            .lightbox-close { position: absolute; top: 24px; right: 28px; width: 48px; height: 48px; background: rgba(255,255,255,0.1); border: 2px solid rgba(255,255,255,0.4); color: #fff; font-size: 1.4rem; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
            .lightbox-close:hover { background: rgba(255,255,255,0.2); border-color: #fff; transform: rotate(90deg); }
            .lightbox-caption { position: absolute; bottom: 28px; left: 50%; transform: translateX(-50%); color: #fff; font-family: 'Playfair Display', Georgia, serif; font-size: 1.15rem; text-align: center; padding: 10px 24px; background: rgba(0,0,0,0.5); border-radius: 50px; max-width: 80vw; }
            @keyframes lbFade { from { opacity: 0; } to { opacity: 1; } }
            @keyframes lbZoom { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
            body.lightbox-open { overflow: hidden; }
        `;
        document.head.appendChild(style);
    }
    // Inject overlay once
    if (!document.getElementById('lightboxEl')) {
        const el = document.createElement('div');
        el.id = 'lightboxEl';
        el.className = 'lightbox';
        el.innerHTML = `
            <button class="lightbox-close" aria-label="Cerrar"><i class="fas fa-times"></i></button>
            <img src="" alt="">
            <div class="lightbox-caption"></div>
        `;
        document.body.appendChild(el);

        const close = () => {
            el.classList.remove('active');
            document.body.classList.remove('lightbox-open');
        };
        el.addEventListener('click', (e) => { if (e.target === el) close(); });
        el.querySelector('.lightbox-close').addEventListener('click', close);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && el.classList.contains('active')) close();
        });
    }

    // Event delegation for product image clicks
    document.addEventListener('click', (e) => {
        const img = e.target.closest('.product-img img, .exclusive-img img');
        if (!img) return;
        const card = img.closest('.product-card, .exclusive-card');
        const name = card?.querySelector('h4')?.textContent || '';
        openLightbox(img.src, name);
    });
}

function openLightbox(src, caption) {
    const el = document.getElementById('lightboxEl');
    if (!el) return;
    el.querySelector('img').src = src;
    el.querySelector('.lightbox-caption').textContent = caption;
    el.classList.add('active');
    document.body.classList.add('lightbox-open');
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
        const imgSrc = product.imageUrl || '';
        const imgHtml = imgSrc
            ? `<img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(product.name)}" loading="lazy">`
            : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#f5f5e8,#e8e8e0);"><i class="fas fa-gem" style="font-size:3rem;color:#ccc;"></i></div>`;

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
            <div class="product-card${isAvailable ? '' : ' sold-out'}" data-category="${product.category}">
                <div class="product-img">
                    ${imgHtml}
                    <span class="product-badge">${escapeHtml(CATEGORY_LABELS[product.category] || product.category)}</span>
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
        const imgSrc = p.imageUrl || '';
        const imgHtml = imgSrc
            ? `<img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(p.name)}" loading="lazy">`
            : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#f5f5e8,#e8e8e0);"><i class="fas fa-gem" style="font-size:3rem;color:#ccc;"></i></div>`;
        const soldOut = isAvailable ? '' : `<div class="sold-out-overlay">Agotado</div>`;
        return `
            <div class="exclusive-card${isAvailable ? '' : ' sold-out'}">
                <div class="exclusive-img">${imgHtml}${soldOut}</div>
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
