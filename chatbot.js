//Versão 1.0.10
//ChatbotEximia - Correção - tratamento de resposta
//Lucas felipe
const qrcode = require('qrcode-terminal');
const { Client, Buttons, List, MessageMedia } = require('whatsapp-web.js');
const client = new Client({
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});
const activeSessions = new Map();
const activeChats = new Map();
const sessionTimeouts = new Map();
const routingMap = new Map(); // IDA -> IDC (relacionamento de suporte)
const pendingSupportRequests = []; // Fila de IDAs aguardando suporte
const idcActiveSessions = new Map(); // Armazena IDCs ativos e os IDAs que estão atendendo
const activeSupportSessions = new Set();
const greetedUsers = new Set();
const IDB = '5511976516433@c.us'; // Número do bot Lucas suporte
const IDC = '5511976518593@c.us'; // Número do IDC José Luiz
const IDD = '5511945786620@c.us'; // Número do IDD Natália
const supportAgents = [IDC, IDD];
const blockedCommands = ['atender','aceitar','sair','encerrar'];
const incompleteResponses = new Map();
const moment = require('moment-timezone');
const now = moment().tz('America/Sao_Paulo'); // Ajuste o fuso horário conforme necessário
        const dayOfWeek = now.isoWeekday(); // 1 = segunda, 7 = domingo
        const currentHour = now.hours();
        const currentMinute = now.minutes();
        const isBusinessHours = dayOfWeek >= 1 && dayOfWeek <= 5 && 
                                (currentHour > 7 || (currentHour === 7 && currentMinute >= 30)) && 
                                (currentHour < 18);

//Leitor de QR Code
client.on('qr', qr => {
   qrcode.generate(qr, { small: true });
});

// Quando o cliente estiver pronto
client.on('ready', () => {
    console.log('Tudo certo! WhatsApp conectado.');
});

// Inicializa o cliente
client.initialize();

const delay = ms => new Promise(res => setTimeout(res, ms));

function startSessionTimeout(chatId) {
    if (sessionTimeouts.has(chatId)) clearTimeout(sessionTimeouts.get(chatId));
    const timeout = setTimeout(async () => {
        if (!routingMap.has(chatId) && !activeSupportSessions.has(chatId)) {
            activeChats.delete(chatId);
            await client.sendMessage(chatId, 'Sessão encerrada por inatividade. Para começar uma nova conversa, envie uma mensagem.');
        }
        sessionTimeouts.delete(chatId);
    }, 300000);
    sessionTimeouts.set(chatId, timeout);
    const warningTimeout = setTimeout(async () => {
        if (!routingMap.has(chatId) && !activeSupportSessions.has(chatId)) {
            await client.sendMessage(chatId, 'Sua sessão irá expirar em 1 minuto por inatividade.');
        }
    }, 60000); // 60 segundos
}
async function notifySupportAgents(message) {
    for (const agent of supportAgents) {
        await client.sendMessage(agent, message);
    }
}
async function askUser(chatId, messages) {
    const chat = await client.getChatById(chatId);
    for (const message of messages) {
            await delay(3000);
            await chat.sendStateTyping();
            
            await client.sendMessage(chatId, message);
        }
    }
    

    client.on('message', async msg => {
        const chatId = msg.from;
        const now = moment().tz('America/Sao_Paulo');
        const dayOfWeek = now.isoWeekday();
        const currentHour = now.hours();
        const currentMinute = now.minutes();
        const isBusinessHours = dayOfWeek >= 1 && dayOfWeek <= 5 &&
            (currentHour > 7 || (currentHour === 7 && currentMinute >= 30)) &&
            (currentHour < 18);
    
        // Fora do horário comercial
        if (!isBusinessHours) {
            await client.sendMessage(chatId, 'Nosso atendimento funciona de segunda a sexta, das 07:30 às 18:00. Por favor, entre em contato dentro desse horário.');
            return;
        }
    
        // Fila de atendimento
        if (supportAgents.includes(chatId) && msg.body.toLowerCase() === 'fila') {
            const fila = pendingSupportRequests.length ? pendingSupportRequests.join(', ') : 'Nenhum cliente aguardando';
            await client.sendMessage(chatId, `Clientes aguardando: ${fila}`);
            return;
        }
    
        // Atendente aceita atendimento
        if (supportAgents.includes(chatId) && (msg.body.toLowerCase().startsWith('atender') || msg.body.toLowerCase().startsWith('aceitar'))) {
            if (pendingSupportRequests.length > 0) {
                const clienteAtual = idcActiveSessions.get(chatId);
                if (clienteAtual && routingMap.has(clienteAtual)) {
                    await client.sendMessage(chatId, "Você já está atendendo um cliente. Encerre o atendimento atual antes de aceitar outro.");
                    return;
                }
    
                const novoIda = pendingSupportRequests.shift();
                routingMap.set(novoIda, chatId);
                idcActiveSessions.set(chatId, novoIda);
                idcActiveSessions.set(novoIda, chatId);
    
                const contactInfo = await client.getContactById(chatId);
                const agentName = contactInfo.pushname || contactInfo.name || 'Atendente';
                const userInfo = activeChats.get(novoIda) || 'Informações não coletadas.';
    
                await client.sendMessage(chatId, `Agora você está atendendo ${novoIda}.`);
                await client.sendMessage(novoIda, `${agentName}: Está conectado. Como posso ajudar?`);
                await client.sendMessage(chatId, `🔹 Informações do cliente:\n${userInfo}`);
            }
            return;
        }
    
        // Saudação inicial
if (
    msg.body.toLowerCase().match(/^(menu|bom dia|boa tarde|boa noite|oi|olá|ola)$/i) &&
    msg.from.endsWith('@c.us') &&
    !supportAgents.includes(msg.from) &&
    !activeSupportSessions.has(msg.from)
) {
    if (!greetedUsers.has(msg.from)) {
        const contact = await msg.getContact();
        const name = contact.pushname || 'Olá';

        await delay(1000); // simula digitação
        await client.sendMessage(
            msg.from,
            `Olá! ${name.split(" ")[0]} 👋 Sou o assistente virtual da Eximia Informática.\n\nComo posso ajudá-lo hoje? Por favor, digite uma das opções abaixo:\n\n1 - Abrir chamado\n2 - Suporte premium\n3 - Comercial\n4 - Financeiro\n5 - Outras perguntas`
        );

        greetedUsers.add(msg.from);
    }

    return;
}
    
        // Abertura de chamado (opção 1)
        if (msg.body === '1' && msg.from.endsWith('@c.us')) {
            const chat = await msg.getChat();
            await delay(1000);
            await chat.sendStateTyping();
            await delay(1000);
            await askUser(chatId, [
                'Informe por gentileza o seu nome.',
                'Qual sua empresa?',
                'Nos informe por gentileza seu TeamViewer e sua etiqueta de contrato.'
            ]);
            return;
        }
    
        // Suporte premium (opção 2)
        if (msg.body === '2' && msg.from.endsWith('@c.us')) {
            const chat = await msg.getChat();
            const contact = await msg.getContact();
            const name = contact.pushname || chatId;
            const firstName = name.split(" ")[0];
    
            await chat.sendStateTyping();
            await delay(3000);
    
            await client.sendMessage(chatId,
                'Antes de conectarmos você ao atendente, precisamos de algumas informações:\n\n' +
                '1️⃣ Qual é o seu nome?\n' +
                '2️⃣ Qual é o nome da sua empresa?\n' +
                '3️⃣ Qual é o seu ID do TeamViewer?\n' +
                '4️⃣ Qual é a sua etiqueta de contrato?\n\n' +
                'Digite 0️⃣ caso não tenha etiqueta de contrato no equipamento.\n\n' +
                'Por favor, envie essas informações em uma única mensagem.'
            );
    
            activeSupportSessions.add(chatId);
            incompleteResponses.set(chatId, true);
            return;
        }
    
        // Coleta das informações no fluxo do "2"
        if (incompleteResponses.has(chatId)) {
            const userInfo = msg.body.trim();
    
            if (userInfo === '0') {
                await client.sendMessage(chatId, '⚠️ Para suporte sem número de contrato, envie um e-mail para:\n\n📧 suporte@eximia.com.br');
                routingMap.delete(chatId);
                idcActiveSessions.delete(chatId);
                greetedUsers.delete(chatId);
                activeSupportSessions.delete(chatId);
                incompleteResponses.delete(chatId);
                await client.sendMessage(chatId, '🔄 Atendimento encerrado. Envie uma nova mensagem para recomeçar.');
                return;
            }
    
            const nomePattern = /^[A-Za-zÀ-ÿ\s]+$/m;
            const empresaPattern = /^.{3,}$/m;
            const etiquetaPattern = /\b\d{5,6}\b/m;
            const teamviewerPattern = /\b\d{9,10}\b/m;
    
            const nomeMatch = userInfo.match(nomePattern);
            const empresaMatch = userInfo.match(empresaPattern);
            const etiquetaMatch = userInfo.match(etiquetaPattern);
            const teamviewerMatch = userInfo.match(teamviewerPattern);
    
            if (nomeMatch && empresaMatch && etiquetaMatch && teamviewerMatch) {
                const formattedInfo = `${nomeMatch[0]}\n${empresaMatch[0]}\n${etiquetaMatch[0]}\n${teamviewerMatch[0]}`;
                activeChats.set(chatId, formattedInfo);
                incompleteResponses.delete(chatId);
                await client.sendMessage(chatId, '✅ Obrigado! Estamos conectando você ao próximo atendente disponível.');
    
                if (!routingMap.has(chatId) && !pendingSupportRequests.includes(chatId)) {
                    pendingSupportRequests.push(chatId);
                    await notifySupportAgents(`📥 Novo cliente aguardando suporte:\n${formattedInfo}`);
                }
            } else {
                await client.sendMessage(chatId,
                    '⚠️ Por favor, envie todas as informações corretamente em uma única mensagem:\n\n' +
                    '*Nome:\n*Empresa:\n*Etiqueta:\n*TeamViewer:\n\n' +
                    'Exemplo:\n```João da Silva\nMinha Empresa Ltda\n54321\n123456789```'
                );
            }
            return;
        }
    
        // Encaminhamento de mensagens
        if (routingMap.has(chatId) || [...routingMap.values()].includes(chatId)) {
            let destinatario = routingMap.get(chatId);
    
            if (supportAgents.includes(chatId)) {
                destinatario = [...routingMap.entries()].find(([ida, agente]) => agente === chatId)?.[0];
            }
    
            if (!destinatario) return;
    
            if (msg.body.toLowerCase().startsWith('sair') || msg.body.toLowerCase().startsWith('encerrar')) {
                routingMap.delete(chatId);
                routingMap.delete(destinatario);
                idcActiveSessions.delete(chatId);
                greetedUsers.delete(msg.from);
                activeSupportSessions.delete(chatId);
                await client.sendMessage(chatId, "O atendimento foi encerrado.");
                await client.sendMessage(destinatario, "O atendimento foi encerrado.");
                return;
            }
    
            if (blockedCommands.some(cmd => msg.body.toLowerCase().startsWith(cmd))) {
                return;
            }
    
            if (msg.hasMedia) {
                const media = await msg.downloadMedia();
                await client.sendMessage(destinatario, media, { caption: `📩 Mídia enviada de ${chatId}` });
            } else {
                const contact = await client.getContactById(chatId);
                const senderName = supportAgents.includes(chatId) ? (contact.pushname || contact.name || 'Atendente') : '';
                const formattedMessage = senderName ? `${senderName}: ${msg.body}` : msg.body;
                await client.sendMessage(destinatario, formattedMessage);
            }
            return;
        }
    
        // Comercial (3)
        if (msg.body === '3' && msg.from.endsWith('@c.us')) {
            const chat = await msg.getChat();
            await delay(3000);
            await chat.sendStateTyping();
            await delay(3000);
            await client.sendMessage(chatId, 'Envie um e-mail para comercial@eximia.com.br, retornaremos o mais breve possível.');
            await delay(3000);
            await client.sendMessage(chatId, 'https://eximia.com.br');
            return;
        }
    
        // Financeiro (4)
        if (msg.body === '4' && msg.from.endsWith('@c.us')) {
            const chat = await msg.getChat();
            await delay(3000);
            await chat.sendStateTyping();
            await delay(3000);
            await client.sendMessage(chatId, 'Envie um e-mail para financeiro@eximia.com.br, retornaremos o mais breve possível.');
            return;
        }
    
        // Outras perguntas (5 ou mais)
        if (msg.body === '5' && msg.from.endsWith('@c.us')) {
            await client.sendMessage(chatId, 'Por favor, nos diga como podemos ajudá-lo. Nossa equipe responderá em breve.');
            return;
        }
    });