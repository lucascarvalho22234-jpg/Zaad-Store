// Importar os pacotes necessários
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { Client, GatewayIntentBits } = require('discord.js');
const crypto = require('crypto');
const path = require('path');

// Importar os nossos modelos e a função de conexão
const User = require('./models/User');
const Order = require('./models/Order');
const connectDB = require('./config/db');

// Carregar as variáveis de ambiente do ficheiro .env
dotenv.config({ path: path.join(__dirname, '.env') });

// ================== CONFIGURAÇÃO DO BOT DO DISCORD ==================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

client.once('ready', () => {
    console.log(`Bot do Discord logado como ${client.user.tag}!`);
});

client.login(process.env.DISCORD_BOT_TOKEN);


// Conectar à base de dados MongoDB
connectDB();

// Inicializar a aplicação Express
const app = express();
const port = process.env.PORT || 3000;

// Middlewares
app.use(cors()); 
app.use(express.json()); 

// ================== SERVIR OS FICHEIROS DO FRONTEND ==================
app.use(express.static(path.join(__dirname, '..')));


// ================== MIDDLEWARE DE AUTENTICAÇÃO ==================
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// ================== ROTAS DA API ==================

// --- ROTAS DE AUTENTICAÇÃO ---
// (As suas rotas de registo, login e Discord continuam aqui, exatamente iguais)
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Este email já está em uso.' });
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const newUser = new User({ email, password: hashedPassword });
        await newUser.save();
        res.status(201).json({ message: 'Utilizador registado com sucesso!' });
    } catch (error) {
        res.status(500).json({ message: 'Erro no servidor ao tentar registar.' });
    }
});
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'Email ou senha inválidos.' });
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Email ou senha inválidos.' });
        const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.status(200).json({ token });
    } catch (error) {
        res.status(500).json({ message: 'Erro no servidor ao tentar fazer login.' });
    }
});
app.get('/api/auth/discord', (req, res) => {
    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.DISCORD_REDIRECT_URI)}&response_type=code&scope=identify%20email`;
    res.redirect(discordAuthUrl);
});
app.get('/api/auth/discord/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send('Erro: Código de autorização não fornecido.');
    try {
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: process.env.DISCORD_CLIENT_ID,
            client_secret: process.env.DISCORD_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code,
            redirect_uri: process.env.DISCORD_REDIRECT_URI,
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
        
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { authorization: `Bearer ${tokenResponse.data.access_token}` },
        });
        const discordUser = userResponse.data;

        let user = await User.findOne({ discordId: discordUser.id });
        if (!user) {
            user = new User({
                discordId: discordUser.id,
                email: discordUser.email,
            });
            await user.save();
        }

        const nossoToken = jwt.sign({ id: user._id, discordId: user.discordId, username: discordUser.username }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.redirect(`/dashboard.html?token=${nossoToken}`);
    } catch (error) {
        console.error('Erro na autenticação com Discord:', error.response ? error.response.data : error.message);
        res.status(500).send('Ocorreu um erro ao tentar fazer login com o Discord.');
    }
});

// --- ROTA DE PAGAMENTO (AGORA COM SIMULAÇÃO INTERNA) ---
app.post('/api/create-payment', authMiddleware, async (req, res) => {
    const { items, total } = req.body;
    try {
        // 1. Criar e guardar o pedido na base de dados
        const newOrder = new Order({
            userId: req.user.id,
            items,
            total,
            status: 'paid', // 2. Marcar como "pago" imediatamente
            paymentId: `sim_${crypto.randomBytes(8).toString('hex')}` // Gerar um ID de pagamento simulado
        });
        await newOrder.save();

        console.log(`SIMULAÇÃO: Pagamento de R$ ${total.toFixed(2)} para a compra ${newOrder._id} aprovado.`);

        // 3. Acionar a nossa própria lógica de notificações
        triggerWebhookLogic(newOrder);

        // 4. Devolver uma resposta de sucesso ao frontend
        res.status(200).json({
            orderId: newOrder._id,
            message: "Pagamento simulado com sucesso!"
        });

    } catch (error) {
        console.error('Erro ao simular pagamento:', error);
        res.status(500).json({ message: 'Erro ao processar o pagamento.' });
    }
});

// --- LÓGICA DE NOTIFICAÇÃO (AGORA UMA FUNÇÃO INTERNA) ---
async function triggerWebhookLogic(order) {
    try {
        console.log(`A processar notificações para a compra ${order._id}.`);
        
        const populatedOrder = await Order.findById(order._id).populate('userId');

        // Notificação para a Administração
        const adminWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
        if (adminWebhookUrl) {
            const adminMessage = { embeds: [{ color: 3447003, title: "✅ Nova Venda Aprovada!", fields: [{ name: "Produto", value: populatedOrder.items[0].name, inline: true }, { name: "Valor", value: `R$ ${populatedOrder.total.toFixed(2)}`, inline: true }, { name: "Email do Cliente (se houver)", value: populatedOrder.userId.email || 'Não disponível', inline: true }, { name: "ID da Compra", value: populatedOrder._id.toString() }], timestamp: new Date().toISOString() }] };
            await axios.post(adminWebhookUrl, adminMessage);
            console.log("Notificação enviada para a administração.");
        }

        // Notificação para o Cliente
        if (populatedOrder.userId && populatedOrder.userId.discordId) {
            try {
                const discordUser = await client.users.fetch(populatedOrder.userId.discordId);
                const dmMessage = `🎉 Olá! O seu pagamento para a compra de **${populatedOrder.items[0].name}** foi aprovado com sucesso!\n\nObrigado por comprar na Zaad System. Para a entrega do seu produto, por favor, abra um ticket no nosso servidor.`;
                await discordUser.send(dmMessage);
                console.log(`DM de confirmação enviada para o utilizador do Discord: ${populatedOrder.userId.discordId}`);
            } catch (dmError) {
                console.error("Não foi possível enviar a DM para o cliente:", dmError);
            }
        }
    } catch (error) {
        console.error('Erro ao processar a lógica de notificação:', error);
    }
}

// --- ROTA PARA VERIFICAR O ESTADO DO PAGAMENTO ---
app.get('/api/order-status/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ message: 'Pedido não encontrado.' });
        res.json({ status: order.status });
    } catch (error) {
        res.status(500).json({ message: 'Erro no servidor.' });
    }
});

// --- ROTA PARA O HISTÓRICO DE COMPRAS ---
app.get('/api/my-orders', authMiddleware, async (req, res) => {
    try {
        const orders = await Order.find({ userId: req.user.id }).sort({ date: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: "Erro ao obter o histórico de compras." });
    }
});

// ================== ROTAS "CATCH-ALL" PARA O FRONTEND ==================
app.get('*', (req, res) => {
    // ... (a sua rota catch-all continua aqui)
});

// ================== INICIAR O SERVIDOR ==================
app.listen(port, () => {
    console.log(`Servidor a correr. O seu site está agora disponível em http://localhost:${port}`);
});

