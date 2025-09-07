const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User' // Liga a compra a um utilizador
    },
    items: [
        {
            name: String,
            quantity: Number,
            price: Number,
        },
    ],
    total: {
        type: Number,
        required: true,
    },
    status: {
        type: String,
        required: true,
        default: 'pending', // Começa como pendente, muda para 'paid'
    },
    paymentId: { // ID da transação no Mercado Pago
        type: String,
    },
    date: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Order', OrderSchema);
