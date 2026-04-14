/* ========================================
   ESENCIA VERDE - Products & Inventory System
   Productos se guardan en localStorage.
   Campos de inventario: available (en stock),
   visible (mostrar en la página pública).
   ======================================== */

document.addEventListener('DOMContentLoaded', () => {
    initCategoryPage();
    initFilters();
    initAdminPanel();
});

/* ========== DEFAULT PRODUCTS ========== */
const DEFAULT_PRODUCTS = {
    oro: [
        {
            id: 'oro-1',
            name: 'Collar Esmeralda Corazón',
            category: 'dijes',
            material: 'oro-esmeralda',
            description: 'Oro 18k con esmeralda colombiana en talla corazón rodeada de diamantes naturales',
            image: 'assets/images/collar-esmeralda.png',
            available: true,
            visible: true
        },
        {
            id: 'oro-2',
            name: 'Aretes Esmeralda y Diamantes',
            category: 'aretes',
            material: 'oro-esmeralda',
            description: 'Oro 18k, esmeraldas naturales certificadas con 26 diamantes naturales',
            image: 'assets/images/aretes-certificado.jpeg',
            available: true,
            visible: true
        },
        {
            id: 'oro-3',
            name: 'Aretes Colgantes Halo',
            category: 'aretes',
            material: 'oro-esmeralda',
            description: 'Oro 18k con esmeraldas colombianas y halo de diamantes',
            image: 'assets/images/aretes-oro.jpeg',
            available: true,
            visible: true
        },
        {
            id: 'oro-4',
            name: 'Anillo Solitario Esmeralda',
            category: 'anillos',
            material: 'oro-esmeralda',
            description: 'Oro 18k con esmeralda natural y diamantes laterales',
            image: 'assets/images/anillo-esmeralda.png',
            available: true,
            visible: true
        },
        {
            id: 'oro-5',
            name: 'Collares Layering Esmeralda',
            category: 'cadenas',
            material: 'oro-esmeralda',
            description: 'Oro 18k, set de collares con esmeraldas en cortes rectangulares',
            image: 'assets/images/collar-modelo.png',
            available: true,
            visible: true
        },
        {
            id: 'oro-6',
            name: 'Collar Delicado Esmeralda',
            category: 'cadenas',
            material: 'oro-esmeralda',
            description: 'Oro 18k, esmeralda natural talla esmeralda en cadena delicada',
            image: 'assets/images/collar-modelo2.png',
            available: true,
            visible: true
        }
    ],
    plata: [
        {
            id: 'plata-1',
            name: 'Anillo Esmeralda Plata',
            category: 'anillos',
            material: 'plata-esmeralda',
            description: 'Plata 925 con esmeralda colombiana natural, diseño clásico',
            image: '',
            available: true,
            visible: true
        },
        {
            id: 'plata-2',
            name: 'Aretes Esmeralda Plata',
            category: 'aretes',
            material: 'plata-esmeralda',
            description: 'Plata 925, esmeraldas naturales con acabado rodio',
            image: '',
            available: true,
            visible: true
        },
        {
            id: 'plata-3',
            name: 'Dije Gota Esmeralda',
            category: 'dijes',
            material: 'plata-esmeralda',
            description: 'Plata 925, esmeralda natural en talla gota',
            image: '',
            available: true,
            visible: true
        },
        {
            id: 'plata-4',
            name: 'Pulsera Tennis Esmeralda',
            category: 'pulseras',
            material: 'plata-esmeralda',
            description: 'Plata 925, pulsera tennis con esmeraldas naturales',
            image: '',
            available: true,
            visible: true
        },
        {
            id: 'plata-5',
            name: 'Cadena Plata 925',
            category: 'cadenas',
            material: 'plata',
            description: 'Cadena en plata 925 con acabado brillante, varios largos disponibles',
            image: '',
            available: true,
            visible: true
        },
        {
            id: 'plata-6',
            name: 'Set Esmeralda Plata',
            category: 'sets',
            material: 'plata-esmeralda',
            description: 'Set completo en plata 925: aretes, dije y anillo con esmeraldas',
            image: '',
            available: true,
            visible: true
        }
    ]
};

/* ========== STATE ========== */
let currentType = 'oro';
let currentFilter = 'todos';

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

/* ========== STORAGE ========== */
function getProducts(type) {
    const stored = localStorage.getItem(`ev_products_${type}`);
    if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.map(p => ({
            available: true,
            visible: true,
            ...p
        }));
    }
    return DEFAULT_PRODUCTS[type] || [];
}

function saveProducts(type, products) {
    localStorage.setItem(`ev_products_${type}`, JSON.stringify(products));
}

/* ========== INVENTORY API (used by admin.html) ========== */
window.Inventory = {
    getAll(type) {
        return getProducts(type);
    },
    update(type, id, patch) {
        const products = getProducts(type);
        const idx = products.findIndex(p => p.id === id);
        if (idx === -1) return false;
        products[idx] = { ...products[idx], ...patch };
        saveProducts(type, products);
        return true;
    },
    remove(type, id) {
        const products = getProducts(type).filter(p => p.id !== id);
        saveProducts(type, products);
    },
    add(type, product) {
        const products = getProducts(type);
        products.push({
            available: true,
            visible: true,
            ...product,
            id: product.id || type + '-' + Date.now()
        });
        saveProducts(type, products);
    },
    resetDefaults(type) {
        localStorage.removeItem(`ev_products_${type}`);
    }
};

/* ========== INIT CATEGORY PAGE ========== */
function initCategoryPage() {
    if (!document.getElementById('productsGrid')) return;

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

    renderProducts();
}

/* ========== RENDER PRODUCTS (public page) ========== */
function renderProducts() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    const products = getProducts(currentType).filter(p => p.visible !== false);
    const filtered = currentFilter === 'todos'
        ? products
        : products.filter(p => p.category === currentFilter);

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
        const imgSrc = product.image || '';
        const imgHtml = imgSrc
            ? `<img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(product.name)}" loading="lazy">`
            : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#f5f5e8,#e8e8e0);"><i class="fas fa-gem" style="font-size:3rem;color:#ccc;"></i></div>`;

        const isAvailable = product.available !== false;
        const soldOutOverlay = isAvailable
            ? ''
            : `<div class="sold-out-overlay">Agotado</div>`;
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
                    <p>${escapeHtml(product.description)}</p>
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
            renderProducts();
        });
    });
}

/* ========== CONSULT VIA WHATSAPP ========== */
function consultProduct(productName) {
    const text = encodeURIComponent(
        `Hola, estoy interesado/a en el producto "${productName}" que vi en su página web. ¿Me pueden dar más información?`
    );
    window.open(`https://wa.me/573152435998?text=${text}`, '_blank');
}

/* ========== ADMIN PANEL (quick add on category page) ========== */
function initAdminPanel() {
    const fab = document.getElementById('adminFab');
    const modal = document.getElementById('addProductModal');
    const closeBtn = document.getElementById('closeModal');
    const form = document.getElementById('addProductForm');
    const imageInput = document.getElementById('prodImage');
    const preview = document.getElementById('filePreview');

    if (!fab || !modal) return;

    fab.addEventListener('click', () => modal.classList.add('active'));

    closeBtn.addEventListener('click', () => {
        modal.classList.remove('active');
        form.reset();
        preview.innerHTML = '';
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
            form.reset();
            preview.innerHTML = '';
        }
    });

    let imageData = '';
    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            imageData = ev.target.result;
            preview.innerHTML = `<img src="${imageData}" alt="Preview">`;
        };
        reader.readAsDataURL(file);
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('prodName').value.trim();
        const category = document.getElementById('prodCategory').value;
        const material = document.getElementById('prodMaterial').value;
        const description = document.getElementById('prodDesc').value.trim();
        if (!name || !category || !material) return;

        window.Inventory.add(currentType, {
            name, category, material, description,
            image: imageData || ''
        });

        form.reset();
        preview.innerHTML = '';
        imageData = '';
        modal.classList.remove('active');
        renderProducts();
        showNotification('Producto agregado exitosamente');
    });
}

/* ========== NOTIFICATION ========== */
function showNotification(message) {
    const notif = document.createElement('div');
    notif.textContent = message;
    Object.assign(notif.style, {
        position: 'fixed',
        bottom: '100px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#0B6E4F',
        color: '#fff',
        padding: '14px 28px',
        borderRadius: '8px',
        fontSize: '0.92rem',
        fontFamily: "'Lato', sans-serif",
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        zIndex: '9999',
        transition: 'opacity 0.3s ease'
    });
    document.body.appendChild(notif);
    setTimeout(() => {
        notif.style.opacity = '0';
        setTimeout(() => notif.remove(), 300);
    }, 2500);
}

/* ========== UTILITY ========== */
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}
