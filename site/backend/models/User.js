const mongoose = require('mongoose');

// Criação do "molde" (Schema) para os nossos utilizadores
const UserSchema = new mongoose.Schema({
    // Campo para o email
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
    },
    // Campo para a senha
    password: {
        type: String,
        // ***** A MUDANÇA ESTÁ AQUI *****
        // A senha já não é obrigatória, porque os utilizadores do Discord não têm uma.
        required: false, 
    },
    // Campo para guardar o ID do Discord
    discordId: { 
        type: String,
        required: false,
        unique: true,
        sparse: true // Permite múltiplos utilizadores sem discordId, mas garante que os que o têm são únicos
    },
    // Campo para a data de registo
    date: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('User', UserSchema);

