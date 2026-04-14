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
});

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
