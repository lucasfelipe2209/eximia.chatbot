const qrcode = require('qrcode-terminal');
const { Client, Buttons, List, MessageMedia } = require('whatsapp-web.js');
const client = new Client();
const activeSessions = new Map();
const activeChats = new Map();
const sessionTimeouts = new Map();
const routingMap = new Map(); // IDA -> IDC (relacionamento de suporte)
const pendingSupportRequests = []; // Fila de IDAs aguardando suporte
const idcActiveSessions = new Map(); // Armazena IDCs ativos e os IDAs que estão atendendo
const activeSupportSessions = new Set();
const greetedUsers = new Set();
const IDB = '5511976516433@c.us'; // Número do bot
const IDC = '5511976518593@c.us'; // Número do IDC
const IDD = '5511945786620@c.us'; // Número do IDD
const supportAgents = [IDC, IDD];
const blockedCommands = ['atender','aceitar','sair','encerrar'];
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
        
        
        if (!isBusinessHours) {
            await client.sendMessage(chatId, 'Nosso atendimento funciona de segunda a sexta, das 07:30 às 18:00. Por favor, entre em contato dentro desse horário.');
             // Encerra o processamento da mensagem
             if (!isBusinessHours) return;
        }
    });
   
// Funil de mensagens
client.on('message', async msg => {
    const chatId = msg.from;
    const now = Date.now();
    console.log('chatId:', msg.from);

    
    if (msg.body.match(/(menu|Menu|dia|tarde|noite|oi|Oi|Olá|olá|ola|Ola)/i) && msg.from.endsWith('@c.us') && 
    !supportAgents.includes(chatId) && !activeSupportSessions.has(chatId)&& isBusinessHours) {
        const chat = await msg.getChat();
        if (!greetedUsers.has(chatId)){ 
         //delay de 3 segundos
        await chat.sendStateTyping(); // Simulando Digitação
        await delay(1000); 
        await chat.clearState();//Delay de 3000 milisegundos mais conhecido como 3 segundos
        const contact = await msg.getContact(); //Pegando o contato
        const name = contact.pushname; //Pegando o nome do contato
        await client.sendMessage(msg.from,'Olá! '+ name.split(" ")[0] + ' Sou o assistente virtual da Eximia Informática. Como posso ajudá-lo hoje? Por favor, digite uma das opções abaixo:\n\n1 - Abrir chamado\n2 - Suporte premium\n3 - Comercial\n4 - Financeiro\n5 - Outras perguntas'); //Primeira mensagem de texto
        await delay(1000);
        await chat.clearState(); //delay de 3 segundos
        //await chat.sendStateTyping(); // Simulando Digitação
        //await delay(5000); //Delay de 5 segundos
        greetedUsers.add(chatId);
        }
    }
     

    if (msg.body !== null && msg.body === '1' && msg.from.endsWith('@c.us')) {
        const chat = await msg.getChat();


        await delay(1000); //delay de 3 segundos
        await chat.sendStateTyping(); // Simulando Digitação
        await delay(1000);
  ;       await askUser(msg.from, [
            'Informe por gentileza o seu nome.',
            'Qual sua empresa?',
            'Nos informe por gentileza seu teamviewer e sua etiqueta de contrato.'
        ]);
    }
    const incompleteResponses = new Map(); // Movido para fora para persistência

if (msg.body === '2' && msg.from.endsWith('@c.us')) {
    
    const chat = await msg.getChat();
    const contact = await msg.getContact();
    const chatId = msg.from;
    const name = contact.pushname || contact.name || chatId;
    const firstName = name ? name.split(" ")[0] : "Usuário";

    await chat.sendStateTyping();
    await delay(3000);

    await client.sendMessage(chatId, 'Antes de conectarmos você ao atendente, precisamos de algumas informações:\n\n' +
        '1️⃣ Qual é o seu nome?\n' +
        '2️⃣ Qual é o nome da sua empresa?\n' +
        '3️⃣ Qual é o seu ID do TeamViewer?\n' +
        '4️⃣ Qual é a sua etiqueta de contrato?\n\n' +
        
        'Digite 0️⃣ caso não tenha etiqueta de contrato no equipamento.\n\n' +
        'Por favor, envie essas informações em uma única mensagem.');

    activeSupportSessions.add(chatId);
    incompleteResponses.set(chatId, true); // Marca o usuário como ativo no questionário

    client.on('message', async responseMsg => {
        const chatId = responseMsg.from;
        const userInfo = responseMsg.body.trim();

        if (!incompleteResponses.has(chatId)) return; // Garante que apenas usuários no questionário sejam processados
        
        // Expressões regulares para validação dos campos
        const nomePattern = /^[A-Za-zÀ-ÿ\s]+$/m; 
        const empresaPattern = /^.{3,}$/m; 
        const etiquetaPattern = /\b\d{5,6}\b/m;
        const teamviewerPattern = /\b\d{9,10}\b/m; 

        // **Se o usuário digitar "0" e estiver no questionário**
        if (userInfo === '0') {
            await client.sendMessage(chatId, 
                '⚠️ Para suporte sem número de contrato, envie um e-mail para:\n\n📧 suporte@eximia.com.br\n\n' +
                'Inclua seus dados e a descrição do problema para que possamos ajudá-lo.\n\n' +
                'Caso queira iniciar um novo atendimento, basta enviar uma nova mensagem.');

            console.log(`📤 Instrução de suporte via e-mail enviada para ${chatId}`);

            // Limpa os dados do usuário
            routingMap.delete(chatId);
            idcActiveSessions.delete(chatId);
            greetedUsers.delete(chatId);
            activeSupportSessions.delete(chatId);
            incompleteResponses.delete(chatId);

            await client.sendMessage(chatId, '🔄 Atendimento encerrado. Envie uma nova mensagem para recomeçar.');
            return;
        }

        // **Validação das respostas**
        const nomeMatch = userInfo.match(nomePattern);
        const empresaMatch = userInfo.match(empresaPattern);
        const etiquetaMatch = userInfo.match(etiquetaPattern);
        const teamviewerMatch = userInfo.match(teamviewerPattern);

        if (nomeMatch && empresaMatch && etiquetaMatch && teamviewerMatch) {
            const nome = nomeMatch[0];
            const empresa = empresaMatch[0];
            const etiqueta = etiquetaMatch[0];
            const teamviewer = teamviewerMatch[0];

            const formattedInfo = `${nome}\n${empresa}\n${etiqueta}\n${teamviewer}`;
            activeChats.set(chatId, formattedInfo); // Salva os dados coletados do cliente

            await client.sendMessage(chatId, '✅ Obrigado! Estamos conectando você ao próximo atendente disponível.');
            incompleteResponses.delete(chatId); // Marca o questionário como concluído

            if (!routingMap.has(chatId) && !pendingSupportRequests.includes(chatId)) {
                pendingSupportRequests.push(chatId);
                await notifySupportAgents(`📥 Novo cliente aguardando suporte.\n\n📝 Informações fornecidas:\n${formattedInfo}`);
                console.log(`📥 ${nome} entrou na fila de suporte.`);
            }
            return;
        }

        // **Se a resposta estiver incompleta ou incorreta**
        if (incompleteResponses.has(chatId)) {
            await client.sendMessage(chatId, '⚠️ Por favor, envie todas as informações corretamente em uma única mensagem:\n\n' +
            '*Nome:\n' +
            '*Nome da Empresa:\n' +
            '*Etiqueta Eximia:\n' +
            '*Número do TeamViewer:\n\n' +
            'Caso não tenha um número de contrato, digite *0*.\n\n' +
            'Exemplo de preenchimento correto:\n```João da Silva\nMinha Empresa Ltda\n54321\n123456789```');

            console.log(`❌ Entrada inválida de ${chatId}: "${userInfo}"`);
        }
    });
    }
    if (supportAgents.includes(chatId) && msg.body.toLowerCase() === 'fila') {
        const fila = pendingSupportRequests.length ? pendingSupportRequests.join(', ') : 'Nenhum cliente aguardando';
        await client.sendMessage(chatId, `Clientes aguardando: ${fila}`);
    }
    
    // Se um atendente responder, vincula ao cliente correto
    if (supportAgents.includes(chatId) && (msg.body.toLowerCase().startsWith('atender') || msg.body.toLowerCase().startsWith('aceitar'))) {
        if (pendingSupportRequests.length > 0) {
            const clienteAtual = idcActiveSessions.get(chatId);
            if (clienteAtual && routingMap.has(clienteAtual)) {
            await client.sendMessage(chatId, "Você já está atendendo um cliente. Encerre o atendimento atual antes de aceitar outro.");
            console.log('ERRO ATENDIMENTO A');
            return;
}
            const novoIda = pendingSupportRequests.shift();
            routingMap.set(novoIda, chatId);
            idcActiveSessions.set(chatId, novoIda);
            idcActiveSessions.set(novoIda, chatId);
            // Obtém as informações do atendente
            const contactInfo = await client.getContactById(chatId);
            const agentName = contactInfo.pushname || contactInfo.name || 'Atendente';
    
            await client.sendMessage(chatId, `Agora você está atendendo ${novoIda}.`);
            const userInfo = activeChats.get(novoIda) || 'Informações não coletadas.';
            await client.sendMessage(novoIda, `${agentName}: Está conectado. Como posso ajudar?`);
            await client.sendMessage(chatId, `🔹 Informações do cliente:\n${userInfo}`);
            console.log(`✅ ${chatId} agora está atendendo ${novoIda}`);
            console.log(`📢 Notificação enviada ao atendente ${chatId}`);
        }
    }
    
    // Encaminhamento de mensagens
    if (routingMap.has(chatId) || [...routingMap.values()].includes(chatId)) {
        let destinatario = routingMap.get(chatId);
    
        if (supportAgents.includes(chatId)) {
            destinatario = [...routingMap.entries()].find(([ida, agenteId]) => agenteId === chatId)?.[0];
        }
    
        if (destinatario) {
            // **Filtrar comandos bloqueados antes de encaminhar**
            if (blockedCommands.some(cmd => msg.body.toLowerCase().startsWith(cmd))) {
                console.log(`🚫 Comando bloqueado detectado: ${msg.body}`);
        
            }
    
               
            // **Finalizar atendimento se receber "sair" ou "encerrar"**
            if (msg.body.toLowerCase().startsWith('sair') || msg.body.toLowerCase().startsWith('encerrar')) {
                console.log(`🔴 Finalizando atendimento entre ${chatId} e ${destinatario}`);
    
                routingMap.delete(chatId);
                routingMap.delete(destinatario);
                idcActiveSessions.delete(chatId);
                greetedUsers.delete(chatId);
                activeSupportSessions.delete(chatId);
    
                await client.sendMessage(chatId, "O atendimento foi encerrado por um dos participantes.");
                await client.sendMessage(destinatario, "O atendimento foi encerrado por um dos participantes.");
    
                console.log('✅ Atendimento encerrado com sucesso.');
            }
        } else {
            console.log(`⚠️ Erro: Nenhum destinatário encontrado para ${chatId}`);
        }
        if (msg.hasMedia) {
            try {
                console.log(`📥 Baixando mídia de ${chatId}...`);
                const media = await msg.downloadMedia();
                console.log(`✅ Mídia baixada: ${media.mimetype}`);

                await client.sendMessage(destinatario, media, { caption: `📩 Mídia enviada de ${chatId}` });
                console.log(`📨 Mídia encaminhada de ${chatId} para ${destinatario}`);
            } catch (error) {
                console.error(`❌ Erro ao baixar ou encaminhar mídia:`, error);
            }
        } else {
            let formattedMessage = msg.body;

            if (supportAgents.includes(chatId)) {
                const contact = await client.getContactById(chatId);
                const agentName = contact.pushname || contact.name || 'Atendente';
                formattedMessage = `${agentName}: ${msg.body}`;
            }

            await client.sendMessage(destinatario, formattedMessage);
            console.log(`📨 Mensagem encaminhada de ${chatId} para ${destinatario}: ${formattedMessage}`);
        }
    }
    
   
    if (msg.body !== null && msg.body === '3' && msg.from.endsWith('@c.us')) {
        const chat = await msg.getChat();


        await delay(3000); //Delay de 3000 milisegundos mais conhecido como 3 segundos
        await chat.sendStateTyping(); // Simulando Digitação
        await delay(3000);
        await client.sendMessage(msg.from, 'Envie um e-mail para comercial@eximia.com.br, retornaremos o mais breve possível.');
        
        await delay(3000); //delay de 3 segundos
        await chat.sendStateTyping(); // Simulando Digitação
        await delay(3000);
        await client.sendMessage(msg.from,'https://eximia.com.br');

    }

    if (msg.body !== null && msg.body === '4' && msg.from.endsWith('@c.us')) {
        const chat = await msg.getChat();

        await delay(3000); //Delay de 3000 milisegundos mais conhecido como 3 segundos
        await chat.sendStateTyping(); // Simulando Digitação
        await delay(3000);
        await client.sendMessage(msg.from, 'Envie um e-mail para financeiro@eximia.com.br, retornaremos o mais breve possível.');


        //await delay(3000); //delay de 3 segundos
        //await chat.sendStateTyping(); // Simulando Digitação
        //await delay(3000);
        //await client.sendMessage(msg.from, 'Link para cadastro: https://site.com');


    }

    if (msg.body !== null && msg.body === '5' && msg.from.endsWith('@c.us')) {
        const chat = await msg.getChat();

        await delay(3000); //Delay de 3000 milisegundos mais conhecido como 3 segundos
        await chat.sendStateTyping(); // Simulando Digitação
        await delay(3000);
        await client.sendMessage(msg.from, 'Se você tiver outras dúvidas ou precisar de mais informações, por favor, fale aqui nesse whatsapp ou visite nosso site: https://eximia.com.br ');


    }
});