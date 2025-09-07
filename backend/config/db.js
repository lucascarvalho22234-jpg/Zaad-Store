const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // Tenta conectar-se ao MongoDB usando o "endereço secreto" do ficheiro .env
        const conn = await mongoose.connect(process.env.MONGO_URI);

        // Se a conexão for bem-sucedida, mostra uma mensagem de confirmação
        console.log(`MongoDB Conectado: ${conn.connection.host}`);
    } catch (error) {
        // Se a conexão falhar, mostra o erro e termina o programa
        console.error(`Erro ao conectar ao MongoDB: ${error.message}`);
        process.exit(1); // Sair do processo com falha
    }
};

module.exports = connectDB;