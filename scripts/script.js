// Espera o conteúdo da página carregar completamente
document.addEventListener('DOMContentLoaded', () => {

    // --- Seletores de Elementos Globais ---
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    const notification = document.getElementById('notification');
    
    // --- Funções Globais ---

    function showNotification(message, type = 'info') {
        if (!notification) return;
        notification.textContent = message;
        const typeClasses = { 'success': 'bg-green-500', 'error': 'bg-red-500', 'info': 'bg-blue-500' };
        notification.className = `notification-banner ${typeClasses[type] || 'bg-blue-500'}`;
        notification.classList.add('show');
        setTimeout(() => { notification.classList.remove('show'); }, 3000);
    }

    // --- Lógica do Menu Mobile ---
    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', () => { mobileMenu.classList.toggle('hidden'); });
    }

    // ===============================================
    //           LÓGICA DO CARRINHO (ITEM ÚNICO)
    // ===============================================

    let cart = JSON.parse(localStorage.getItem('cart')) || [];

    function saveCart() {
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartIcon();
    }
    
    function updateCartIcon() {
        const cartIconCount = document.getElementById('cart-item-count');
        if (cartIconCount) {
            const totalItems = cart.length; // Conta apenas se há 1 item ou 0
            cartIconCount.textContent = totalItems;
            cartIconCount.style.display = totalItems > 0 ? 'flex' : 'none';
        }
    }

    function addToCart(productName, productPrice) {
        const price = parseFloat(productPrice);
        if (isNaN(price)) return;

        // Limpa o carrinho e adiciona apenas o novo item
        cart = [{ name: productName, price: price, quantity: 1 }];

        saveCart();
        showNotification(`${productName} foi adicionado ao carrinho!`, 'success');
        
        // Redireciona o utilizador para o carrinho para finalizar a compra
        window.location.href = '/carrinho.html';
    }
    
    function removeFromCart(index) {
        if (index > -1 && index < cart.length) {
            const removedItemName = cart[index].name;
            cart.splice(index, 1);
            saveCart();
            renderCartPage(); // Atualiza a página do carrinho para mostrar que está vazio
            showNotification(`${removedItemName} foi removido do carrinho.`, 'info');
        }
    }

    // ========================================================
    //         LÓGICA DA PÁGINA DA LOJA (GRELHA DE PREÇOS)
    // ========================================================
    const pricingCards = document.querySelectorAll('.pricing-card');
    if (pricingCards.length > 0) {
        pricingCards.forEach(card => {
            const button = card.querySelector('.add-to-cart-btn');
            button.addEventListener('click', () => {
                const productName = button.dataset.productName;
                const productPrice = button.dataset.productPrice;
                addToCart(productName, productPrice);
            });
        });
    }

    // ========================================================
    //         LÓGICA DA PÁGINA DO CARRINHO (VISUAL)
    // ========================================================
    if (window.location.pathname.endsWith('/carrinho.html')) {
        renderCartPage();
    }

    function renderCartPage() {
        const container = document.getElementById('cart-items-container');
        const emptyMsg = document.getElementById('empty-cart-message');
        const subtotalEl = document.getElementById('cart-subtotal');
        const totalEl = document.getElementById('cart-total');
        const showPixButton = document.getElementById('show-pix-button');

        if (!container || !emptyMsg || !subtotalEl || !totalEl || !showPixButton) return;

        container.innerHTML = '';
        if (cart.length === 0) {
            container.appendChild(emptyMsg);
            emptyMsg.style.display = 'block';
            showPixButton.disabled = true;
            subtotalEl.textContent = 'R$ 0,00';
            totalEl.textContent = 'R$ 0,00';
        } else {
            emptyMsg.style.display = 'none';
            showPixButton.disabled = false;
            let subtotal = 0;
            cart.forEach((item, index) => {
                subtotal += item.price * item.quantity;
                const itemElement = document.createElement('div');
                itemElement.className = 'flex justify-between items-center py-2';
                itemElement.innerHTML = `
                    <div class="flex-grow"><p class="font-bold text-white">${item.name}</p></div>
                    <div class="flex items-center gap-4">
                        <span class="font-semibold text-white">R$ ${item.price.toFixed(2).replace('.', ',')}</span>
                        <button class="remove-from-cart-btn text-gray-500 hover:text-red-500 transition-colors" data-index="${index}" title="Remover Item">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pointer-events-none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                    </div>`;
                container.appendChild(itemElement);
            });
            subtotalEl.textContent = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
            totalEl.textContent = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
        }
        document.querySelectorAll('.remove-from-cart-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const itemIndex = parseInt(e.currentTarget.dataset.index);
                removeFromCart(itemIndex);
            });
        });
    }

    // ========================================================
    //         LÓGICA DE PAGAMENTO PIX (COM VERIFICAÇÃO DE LOGIN)
    // ========================================================
    const showPixButton = document.getElementById('show-pix-button');
    if(showPixButton) {
        showPixButton.addEventListener('click', async () => {
            const token = localStorage.getItem('userToken');
            if (!token) {
                showNotification('Você precisa de fazer login para continuar a compra.', 'error');
                setTimeout(() => { window.location.href = '/login.html'; }, 2500);
                return;
            }

            if (cart.length === 0) return;
            showPixButton.disabled = true;
            showPixButton.textContent = 'A gerar QR Code...';
            const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            try {
                const response = await fetch('http://localhost:3000/api/create-payment', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ items: cart, total: total })
                });

                if (!response.ok) {
                    throw new Error('Falha ao criar o pagamento.');
                }

                const paymentData = await response.json();
                
                const pixSection = document.getElementById('pix-payment-section');
                const cartItemsSection = document.getElementById('cart-items-section');
                const pixTotalValue = document.getElementById('pix-total-value');
                const cartTotalEl = document.getElementById('cart-total');
                const backToCartButton = document.getElementById('back-to-cart-button');
                const qrCodeImg = pixSection.querySelector('img');
                const qrCodeInput = pixSection.querySelector('input');
                
                qrCodeImg.src = `data:image/png;base64,${paymentData.qr_code_base64}`;
                qrCodeInput.value = paymentData.qr_code_text;
                pixTotalValue.textContent = cartTotalEl.textContent;
                
                pixSection.classList.remove('hidden');
                cartItemsSection.classList.add('hidden');
                showPixButton.classList.add('hidden');
                backToCartButton.classList.remove('hidden');

                startPollingOrderStatus(paymentData.orderId);

            } catch (error) {
                showNotification('Erro ao processar o pagamento. Tente novamente.', 'error');
                showPixButton.disabled = false;
                showPixButton.textContent = 'Continuar para Pagamento';
            }
        });
    }

    function startPollingOrderStatus(orderId) {
        const interval = setInterval(async () => {
            try {
                const response = await fetch(`http://localhost:3000/api/order-status/${orderId}`);
                const data = await response.json();
                if (data.status === 'paid') {
                    clearInterval(interval);
                    cart = [];
                    saveCart();
                    window.location.href = `/confirmacao.html?orderId=${orderId}`;
                }
            } catch (error) {
                console.error('Erro ao verificar o estado do pedido:', error);
            }
        }, 5000);
    }

    const backToCartButton = document.getElementById('back-to-cart-button');
    if(backToCartButton) {
        backToCartButton.addEventListener('click', () => {
            const pixSection = document.getElementById('pix-payment-section');
            const cartItemsSection = document.getElementById('cart-items-section');
            const showPixButton = document.getElementById('show-pix-button');

            pixSection.classList.add('hidden');
            cartItemsSection.classList.remove('hidden');
            showPixButton.classList.remove('hidden');
            backToCartButton.classList.add('hidden');
        });
    }

    const copyPixButton = document.getElementById('copy-pix-button');
    if (copyPixButton) {
        copyPixButton.addEventListener('click', () => {
            const pixCodeInput = document.getElementById('pix-code-input');
            pixCodeInput.select();
            pixCodeInput.setSelectionRange(0, 99999);
            try {
                document.execCommand('copy');
                showNotification('Código Pix copiado para a área de transferência!', 'success');
            } catch (err) {
                showNotification('Não foi possível copiar o código.', 'error');
            }
        });
    }

    // ========================================================
    //      LÓGICA DA PÁGINA DE CONFIRMAÇÃO
    // ========================================================
    if (window.location.pathname.endsWith('/confirmacao.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        const orderId = urlParams.get('orderId');
        const orderIdElement = document.getElementById('order-id');
        if (orderId && orderIdElement) {
            orderIdElement.textContent = orderId;
        }
    }

    // ========================================================
    //      LÓGICA DE AUTENTICAÇÃO
    // ========================================================
    function parseJwt(token) {
        try {
            return JSON.parse(atob(token.split('.')[1]));
        } catch (e) {
            return null;
        }
    }

    function checkLoginStatus() {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');

        if (token) {
            localStorage.setItem('userToken', token);
            window.history.replaceState({}, document.title, window.location.pathname);
            showNotification('Login efetuado com sucesso!', 'success');
        }

        const savedToken = localStorage.getItem('userToken');
        if (savedToken) {
            const userData = parseJwt(savedToken);
            updateUIAfterLogin(userData);
        }
    }

    function updateUIAfterLogin(userData) {
        const loginButtonDesktop = document.querySelector('header a[href="/login.html"]');
        const loginButtonMobile = document.querySelector('#mobile-menu a[href="/login.html"]');
        const welcomeMessage = document.getElementById('welcome-message');

        if (loginButtonDesktop) {
            loginButtonDesktop.textContent = 'Minha Conta';
            loginButtonDesktop.href = '/dashboard.html';
            
            if (!document.getElementById('logout-btn-desktop')) {
                const logoutButton = document.createElement('a');
                logoutButton.href = '#';
                logoutButton.id = 'logout-btn-desktop';
                logoutButton.textContent = 'Sair';
                logoutButton.className = 'hidden md:inline-block text-gray-400 hover:text-white transition-colors ml-4';
                logoutButton.onclick = (e) => {
                    e.preventDefault();
                    localStorage.removeItem('userToken');
                    showNotification('Sessão terminada.', 'info');
                    setTimeout(() => window.location.href = '/index.html', 1000);
                };
                loginButtonDesktop.parentElement.appendChild(logoutButton);
            }
        }
        
        if (loginButtonMobile) {
            loginButtonMobile.textContent = 'Minha Conta';
            loginButtonMobile.href = '/dashboard.html';
        }

        if (welcomeMessage && userData && (userData.username || userData.email)) {
            const displayName = userData.username || userData.email;
            welcomeMessage.textContent = `Bem-vindo de volta, ${displayName}!`;
            welcomeMessage.classList.remove('text-gray-400');
            welcomeMessage.classList.add('text-lg', 'text-white');
        }
    }
    
    // ========================================================
    // --- LÓGICA ESPECÍFICA DA PÁGINA DE LOGIN/REGISTO ---
    // ========================================================
    const loginFormContainer = document.getElementById('login-form-container');
    if (loginFormContainer) {
        const discordLoginBtn = document.getElementById('discord-login-btn');
        const loginView = document.getElementById('login-view');
        const registerView = document.getElementById('register-view');
        const switchToRegisterBtn = document.getElementById('switch-to-register');
        const switchToLoginBtn = document.getElementById('switch-to-login');
        
        if (discordLoginBtn) {
            discordLoginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = 'http://localhost:3000/api/auth/discord';
            });
        }
        
        if (switchToRegisterBtn && switchToLoginBtn) {
            switchToRegisterBtn.addEventListener('click', (e) => {
                e.preventDefault();
                loginView.classList.add('hidden');
                registerView.classList.remove('hidden');
            });
            switchToLoginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                registerView.classList.add('hidden');
                loginView.classList.remove('hidden');
            });
        }

        const registerForm = registerView.querySelector('form');
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            if (password !== confirmPassword) {
                showNotification('As senhas não coincidem.', 'error');
                return;
            }
            try {
                const response = await fetch('http://localhost:3000/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'Erro ao registar.');
                showNotification('Registo efetuado com sucesso! Por favor, faça login.', 'success');
                registerView.classList.add('hidden');
                loginView.classList.remove('hidden');
            } catch (error) {
                showNotification(error.message, 'error');
            }
        });

        const loginForm = loginView.querySelector('form');
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            try {
                const response = await fetch('http://localhost:3000/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'Erro ao fazer login.');
                
                localStorage.setItem('userToken', data.token);
                showNotification('Login efetuado com sucesso!', 'success');
                setTimeout(() => { window.location.href = '/dashboard.html'; }, 1000);
            } catch (error) {
                showNotification(error.message, 'error');
            }
        });
    }

    // ========================================================
    //      LÓGICA DO PAINEL DE CONTROLO
    // ========================================================
    if (window.location.pathname.endsWith('/dashboard.html')) {
        const token = localStorage.getItem('userToken');
        if (!token) {
            window.location.href = '/login.html';
        } else {
            fetchMyOrders(token);
        }
    }

    async function fetchMyOrders(token) {
        const ordersContainer = document.querySelector('.glass-effect:first-child');
        if (!ordersContainer) return;
        
        try {
            const response = await fetch('http://localhost:3000/api/my-orders', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Não foi possível obter as suas compras.');
            
            const orders = await response.json();
            
            const ordersList = document.createElement('div');
            ordersList.className = 'space-y-4';
            
            const placeholder = ordersContainer.querySelector('p');
            if (orders.length === 0) {
                placeholder.textContent = 'Você ainda não fez nenhuma compra.';
            } else {
                if (placeholder) placeholder.remove(); // Remove o texto de "placeholder"
                orders.forEach(order => {
                    const orderElement = document.createElement('div');
                    orderElement.className = 'border-b border-gray-700 pb-3';
                    orderElement.innerHTML = `
                        <div class="flex justify-between items-center">
                            <p class="font-bold text-white">${order.items[0].name}</p>
                            <span class="text-sm font-mono text-gray-400">#${order._id.slice(-6)}</span>
                        </div>
                        <div class="flex justify-between items-center text-sm mt-1">
                            <span>${new Date(order.date).toLocaleDateString('pt-BR')}</span>
                            <span class="font-semibold ${order.status === 'paid' ? 'text-green-400' : 'text-yellow-400'}">${order.status === 'paid' ? 'Pago' : 'Pendente'}</span>
                        </div>
                    `;
                    ordersList.appendChild(orderElement);
                });
                ordersContainer.appendChild(ordersList);
            }
        } catch (error) {
            ordersContainer.querySelector('p').textContent = error.message;
        }
    }

    // --- Inicialização ---
    checkLoginStatus();
    updateCartIcon();

}); // Fim do DOMContentLoaded

