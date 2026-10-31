/* =========================================
   LIWAN - MENU & SHOPPING CART
   Organized code for easy editing in VS Code
========================================= */

(function () {
    'use strict';

    const sections = window.LIWAN_SECTIONS || [];
    const $ = (id) => document.getElementById(id);
    const storageKey = 'liwan-cart-v2';

    const baseProducts = sections.flatMap((section) => {
        return section.items.map((item) => ({
            ...item,
            section: section.id,
            sectionName: section.name,
            image: item.image || section.image
        }));
    });
    const products = baseProducts.map(item => ({...item}));

    // Shared Firestore price overrides; base prices remain available if offline.
    const originalPrices = new Map(baseProducts.map(item => [item.id, item.price]));
    let lastCloudPrices = Object.create(null);
    function applySharedPrices(overrides) {
        let changed = false;
        for (const item of products) {
            if (item.isCustom) continue;
            const saved = Object.prototype.hasOwnProperty.call(overrides, item.id) ? overrides[item.id] : undefined;
            const valid = typeof saved === 'number' && Number.isFinite(saved) && saved >= 0 && saved <= 10000;
            const next = valid ? saved : originalPrices.get(item.id);
            if (item.price !== next) { item.price = next; changed = true; }
        }
        return changed;
    }

    const productsById = new Map(products.map((item) => [item.id, item]));
    function applyCustomItems(items) {
        // Most recently added item is FIRST immediately below its selected section heading.
        const dynamic = items.map(item => {
            const section = sections.find(section => section.id === item.sectionId);
            return {...item, section:item.sectionId, sectionName:section?.name || '',
                image:item.image || section?.image || ''};
        });
        products.splice(0, products.length,
            ...dynamic, ...baseProducts.map(item => ({...item})));
        productsById.clear();
        for (const item of products) productsById.set(item.id, item);
        applySharedPrices(lastCloudPrices);
        for (const id of Object.keys(cart)) if (!productsById.has(id)) delete cart[id];
        updateCartBadge();
        if (!$('home').hidden) renderMenu();
        if (!$('drawer').hidden) renderCart();
    }
    let activeSection = sections[0]?.id;
    let cart = {};
    let toastTimer;
    let splashTimer;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const revealObserver = !reducedMotion && 'IntersectionObserver' in window
        ? new IntersectionObserver((entries, observer) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            });
        }, { rootMargin: '0px 0px 65px 0px', threshold: 0.05 })
        : null;

    function animateCartIcon() {
        if (reducedMotion) return;
        const button = $('cartTop');
        button.classList.remove('cart-celebrate');
        void button.offsetWidth;
        button.classList.add('cart-celebrate');
    }


    // Start with an empty cart on every new page load.
    try {
        localStorage.removeItem(storageKey);
    } catch (error) {
        // The menu still works when localStorage is unavailable.
    }

    function formatMoney(amount) {
        return '$' + Number(amount.toFixed(2)).toString();
    }

    function cartTotal() {
        return Object.entries(cart).reduce((sum, [id, quantity]) => {
            const product = productsById.get(id);
            return sum + (product ? product.price * quantity : 0);
        }, 0);
    }

    function updateCartBadge() {
        const count = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
        $('cartCount').textContent = count;
        $('cartCount').hidden = count === 0;
    }

    function saveCart() {
        try {
            localStorage.setItem(storageKey, JSON.stringify(cart));
        } catch (error) {
            // Keep the cart in memory if storage is blocked.
        }
        updateCartBadge();
        animateCartIcon();
    }

    /* =========================================
       MENU CATEGORIES
    ========================================= */

    function renderTabs() {
        const container = $('tabs');
        const previousScroll = container.scrollLeft;
        container.replaceChildren();

        sections.forEach((section) => {
            const button = document.createElement('button');
            button.className = 'tab' + (section.id === activeSection ? ' active' : '');
            button.textContent = section.name;
            button.type = 'button';

            button.addEventListener('click', () => {
                activeSection = section.id;
                $('search').value = '';
                renderMenu();
            });

            container.appendChild(button);
        });

        container.scrollLeft = previousScroll;
    }

    function renderMenu() {
        const query = $('search').value.trim().toLocaleLowerCase('ar');
        const section = sections.find((item) => item.id === activeSection) || sections[0];
        const visibleProducts = query
            ? products.filter((item) => item.name.toLocaleLowerCase('ar').includes(query))
            : products.filter((item) => item.section === activeSection);

        renderTabs();

        const heading = $('sectionHead');
        const title = document.createElement('h2');
        const count = document.createElement('small');

        title.textContent = query ? 'نتائج البحث' : (section?.name || 'المنيو');
        count.textContent = visibleProducts.length + ' صنف';
        heading.replaceChildren(title, count);

        const container = $('items');
        container.replaceChildren();

        if (visibleProducts.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'empty';
            empty.textContent = 'ما لقينا أصناف مطابقة';
            container.appendChild(empty);
            return;
        }

        visibleProducts.forEach((product) => {
            const card = document.createElement('article');
            card.className = 'item' + (revealObserver ? ' reveal-card' : ' is-visible');

            const image = document.createElement('img');
            image.className = 'item-photo';
            if (product.image) image.src = product.image;
            else image.hidden = true;
            image.addEventListener('load', () => image.classList.add('image-ready'), { once: true });
            image.alt = product.name;
            image.loading = visibleProducts.indexOf(product) < 2 ? 'eager' : 'lazy';
            image.decoding = 'async';
            if (visibleProducts.indexOf(product) < 2) image.fetchPriority = 'high';
            image.addEventListener('error', () => {
                image.style.display = 'none';
            });

            const body = document.createElement('div');
            body.className = 'item-body';

            const info = document.createElement('div');
            info.className = 'item-info';

            const name = document.createElement('h3');
            name.textContent = product.name;

            const price = document.createElement('p');
            price.textContent = product.price == null ? 'السعر قريبًا' : formatMoney(product.price);
            info.append(name, price);
            if (product.description) {
                const description = document.createElement('small');
                description.className = 'item-description';
                description.textContent = product.description;
                info.append(description);
            }

            if (query) {
                const sectionButton = document.createElement('button');
                sectionButton.className = 'section-jump';
                sectionButton.textContent = 'القسم: ' + product.sectionName;
                sectionButton.addEventListener('click', () => {
                    activeSection = product.section;
                    $('search').value = '';
                    renderMenu();
                });
                info.appendChild(sectionButton);
            }

            const addButton = document.createElement('button');
            addButton.className = 'add';
            addButton.type = 'button';
            addButton.textContent = '+';
            addButton.setAttribute('aria-label', 'إضافة ' + product.name);
            if (product.price == null) {
                addButton.disabled = true;
                addButton.textContent = '+';
                addButton.title = 'السعر لم يُحدّد بعد';
            }
            addButton.addEventListener('click', () => {
                if (product.price == null) return;
                cart[product.id] = Math.min(99, (cart[product.id] || 0) + 1);
                saveCart();
                showToast();
                if (!reducedMotion) {
                    addButton.classList.remove('add-pop');
                    void addButton.offsetWidth;
                    addButton.classList.add('add-pop');
                }
            });

            body.append(info, addButton);
            card.append(image, body);
            container.appendChild(card);
            if (revealObserver) revealObserver.observe(card);
        });
    }

    /* =========================================
       SHOPPING CART
    ========================================= */

    function changeQuantity(id, difference) {
        const next = (cart[id] || 0) + difference;

        if (next <= 0) {
            delete cart[id];
        } else {
            cart[id] = Math.min(99, next);
        }

        saveCart();
        renderCart();
    }

    function renderCart() {
        const container = $('cartItems');
        const entries = Object.entries(cart);
        container.replaceChildren();

        if (entries.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'empty';
            empty.textContent = 'السلة فارغة';
            container.appendChild(empty);
        }

        entries.forEach(([id, quantity]) => {
            const product = productsById.get(id);
            if (!product) return;

            const row = document.createElement('div');
            row.className = 'cart-line';

            const image = document.createElement('img');
            image.className = 'cart-photo';
            if (product.image) image.src = product.image;
            else image.hidden = true;
            image.alt = product.name;
            image.loading = 'lazy';
            image.decoding = 'async';
            image.addEventListener('error', () => {
                image.style.visibility = 'hidden';
            });

            const details = document.createElement('div');
            details.className = 'cart-details';

            const name = document.createElement('strong');
            name.textContent = product.name;

            const price = document.createElement('small');
            price.textContent = product.price == null ? 'السعر قريبًا' : formatMoney(product.price);

            const actions = document.createElement('div');
            actions.className = 'cart-actions';

            const plus = document.createElement('button');
            plus.textContent = '+';
            plus.setAttribute('aria-label', 'زيادة ' + product.name);
            plus.addEventListener('click', () => changeQuantity(id, 1));

            const amount = document.createElement('span');
            amount.className = 'cart-quantity';
            amount.textContent = quantity;

            const minus = document.createElement('button');
            minus.textContent = '−';
            minus.setAttribute('aria-label', 'تقليل ' + product.name);
            minus.addEventListener('click', () => changeQuantity(id, -1));

            const remove = document.createElement('button');
            remove.className = 'remove';
            remove.textContent = 'حذف';
            remove.addEventListener('click', () => {
                delete cart[id];
                saveCart();
                renderCart();
            });

            actions.append(plus, amount, minus, remove);
            details.append(name, price, actions);
            row.append(image, details);
            container.appendChild(row);
        });

        $('drawerTotal').textContent = formatMoney(cartTotal());
        $('whatsapp').disabled = entries.length === 0;
    }

    function openCart() {
        $('drawer').hidden = false;
        document.body.classList.add('cart-is-open');
        renderCart();
    }

    function closeCart() {
        $('drawer').hidden = true;
        document.body.classList.remove('cart-is-open');
    }

    /* =========================================
       WHATSAPP ORDER
    ========================================= */

    function whatsappMessage() {
        const lines = ['طلب جديد من LIWAN', ''];

        Object.entries(cart).forEach(([id, quantity]) => {
            const product = productsById.get(id);
            if (!product) return;

            lines.push('• ' + product.name);
            lines.push(
                'الكمية: ' + quantity +
                ' | سعر الوحدة: ' + formatMoney(product.price) +
                ' | الإجمالي: ' + formatMoney(product.price * quantity)
            );
            lines.push('');
        });

        lines.push('المجموع النهائي: ' + formatMoney(cartTotal()));
        return lines.join('\n');
    }

    function sendWhatsApp() {
        if (Object.keys(cart).length === 0) return;

        const url = 'https://wa.me/96170490086?text=' +
            encodeURIComponent(whatsappMessage());

        window.open(url, '_blank', 'noopener,noreferrer');
    }

    /* =========================================
       CATEGORY SWIPE & MOUSE DRAG
    ========================================= */

    const tabsElement = $('tabs');
    let dragStart = null;
    let dragged = false;
    let suppressClick = false;

    tabsElement.addEventListener('pointerdown', (event) => {
        if (event.pointerType !== 'mouse' || event.button !== 0) return;

        dragStart = {
            x: event.clientX,
            scroll: tabsElement.scrollLeft
        };
        dragged = false;
    });

    tabsElement.addEventListener('pointermove', (event) => {
        if (!dragStart) return;

        const delta = event.clientX - dragStart.x;
        if (Math.abs(delta) <= 5) return;

        dragged = true;
        tabsElement.classList.add('dragging');
        tabsElement.scrollLeft = dragStart.scroll - delta;
    });

    function finishDrag() {
        if (dragged) suppressClick = true;
        dragStart = null;
        tabsElement.classList.remove('dragging');

        setTimeout(() => {
            suppressClick = false;
        }, 0);
    }

    tabsElement.addEventListener('pointerup', finishDrag);
    tabsElement.addEventListener('pointercancel', finishDrag);
    window.addEventListener('pointerup', () => {
        if (dragStart) finishDrag();
    });

    tabsElement.addEventListener('click', (event) => {
        if (!suppressClick) return;
        event.preventDefault();
        event.stopPropagation();
    }, true);

    tabsElement.addEventListener('wheel', (event) => {
        if (tabsElement.scrollWidth <= tabsElement.clientWidth) return;
        if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

        tabsElement.scrollLeft += event.deltaY;
        event.preventDefault();
    }, { passive: false });

    /* =========================================
       MENU BUTTON, TOAST & SPLASH
    ========================================= */

    function showToast() {
        const toast = $('toast');
        toast.hidden = false;
        clearTimeout(toastTimer);

        toastTimer = setTimeout(() => {
            toast.hidden = true;
        }, 2200);
    }

    const menuToggle = $('menuToggle');
    const menuPanel = $('menuPanel');

    function hideMenuPanel() {
        menuPanel.hidden = true;
        menuToggle.setAttribute('aria-expanded', 'false');
    }

    menuToggle.addEventListener('click', () => {
        menuPanel.hidden = !menuPanel.hidden;
        menuToggle.setAttribute('aria-expanded', String(!menuPanel.hidden));
    });

    $('menuCategories').addEventListener('click', () => {
        hideMenuPanel();
        $('tabs').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    $('menuCart').addEventListener('click', () => {
        hideMenuPanel();
        openCart();
    });

    $('search').addEventListener('input', renderMenu);
    $('cartTop').addEventListener('click', openCart);
    $('closeCart').addEventListener('click', closeCart);
    $('shade').addEventListener('click', closeCart);
    $('whatsapp').addEventListener('click', sendWhatsApp);

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !$('drawer').hidden) closeCart();
    });

    function showHome() {
        clearTimeout(splashTimer);
        $('splash').hidden = true;
        $('home').hidden = false;
        renderMenu();
        updateCartBadge();
        window.scrollTo(0, 0);
        updateReadingProgress();
    }

    // Slim scroll indicator makes long menus easier to navigate.
    function updateReadingProgress() {
        const indicator = $('readingProgress');
        if (!indicator || $('home').hidden) return;
        const available = document.documentElement.scrollHeight - window.innerHeight;
        const ratio = available > 0 ? Math.min(1, window.scrollY / available) : 0;
        indicator.style.transform = 'scaleX(' + ratio + ')';
    }
    window.addEventListener('scroll', updateReadingProgress, { passive: true });
    window.addEventListener('resize', updateReadingProgress, { passive: true });

    // Live Firestore updates without any visual changes to the customer menu.
    if (window.LIWAN_SYNC && window.LIWAN_SYNC.configured) {
        window.LIWAN_SYNC.listenMenuItems((items) => applyCustomItems(items), error => {
            console.warn('LIWAN: added menu items sync unavailable:', error);
        });
        window.LIWAN_SYNC.listenPrices((prices) => {
            lastCloudPrices = prices;
            if (!applySharedPrices(prices)) return;
            if (!$('home').hidden) renderMenu();
            if (!$('drawer').hidden) renderCart();
        }, (error) => {
            // If Firebase is temporarily unreachable, the menu still works with last known/base prices.
            console.warn('LIWAN: price sync unavailable:', error);
        });
    }

    $('explore').addEventListener('click', showHome);
    splashTimer = setTimeout(showHome, 2600);
    updateCartBadge();

    window.LIWAN_TEST = {
        total: cartTotal,
        whatsappText: whatsappMessage,
        byId: productsById
    };
})();
