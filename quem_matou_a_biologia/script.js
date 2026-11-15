const world = document.getElementById('world');
const stairs = document.getElementById('stairs');
const player = document.getElementById('player');
const fadeOverlay = document.getElementById('fade-overlay');
const interactionBubble = document.getElementById('intereaction-bubble');
const dialogBox = document.getElementById('dialog-box');
const dialogText = document.getElementById('dialog-text');

let playerx = 50; // Posição horizontal inicial
let playery = 50; // Posição vertical inicial
let velocityY = 0;

const speed = 6;       // Velocidade de movimento
const gravity = 0.6;   // Força da gravidade
const jump_force = 12; // Força do pulo
let can_jump = true;

const player_width = 22;
const player_height = 96;

let camerax = 0;
let cameray = 0;

// Variáveis para o Juice e Direção
let scaleX = 1;
let scaleY = 1;
let walkTimer = 0; // Controla o ciclo do balanço ao caminhar

// Configuração da Escada
const stairsx = 900;
const stairs_width = 200;

// Configuração dos Andares
const ground_level = 50;        // Altura do chão do térreo
const first_floor_y = 350;      // Altura da superfície do piso do 2º andar

// Limites do piso do segundo andar (apenas na casa principal)
const top_floor_min_x = 0;
const top_floor_max_x = 2000;

// =========================================
// SISTEMA DE ZONAS E PORTAS
// =========================================
let current_zone = 'main'; // 'main', 'estoque', 'biologia'
let is_transitioning = false;
let door_cooldown = false; // Evita entrar/sair repetidamente segurando W
let is_in_dialog = false;  // Trava o movimento durante o diálogo

const zone_bounds = {
    'main':     { minX: 0,    maxX: 2000 },
    'estoque':  { minX: 2500, maxX: 3300 },
    'biologia': { minX: 3800, maxX: 4600 }
};

// Definição de todas as portas
const doors = [
    {
        zone: 'main',
        x: 1350, y: 50, width: 66, height: 120,
        targetZone: 'estoque',
        targetX: 2500 + 80 + (66 / 2) - (player_width / 2),
        targetY: 50
    },
    {
        zone: 'estoque',
        x: 2580, y: 50, width: 66, height: 120,
        targetZone: 'main',
        targetX: 1350 + (66 / 2) - (player_width / 2),
        targetY: 50
    },
    {
        zone: 'main',
        x: 80, y: 350, width: 66, height: 120,
        targetZone: 'biologia',
        targetX: 3800 + 80 + (66 / 2) - (player_width / 2),
        targetY: 50
    },
    {
        zone: 'biologia',
        x: 3880, y: 50, width: 66, height: 120,
        targetZone: 'main',
        targetX: 80 + (66 / 2) - (player_width / 2),
        targetY: 350
    }
];

// =========================================
// SISTEMA DE INTERAÇÃO E DIÁLOGOS (.JSON SIMULADO)
// =========================================
const npc_dialogues = {
    'nemo': {
        first: "Ei, detetive! Eu estava estudando na biblioteca quando tudo aconteceu. Nem vi nada.",
        others: [
            "Você já olhou lá no estoque? Sempre deixam as coisas bagunçadas lá.",
            "A biologia era exigida por todos nós... Quem faria isso?",
            "Não olhe pra mim com essa cara de suspeito!"
        ]
    },
    'zny': {
        first: "Oi! A aula de laboratório ia ser hoje... que tragédia!",
        others: [
            "Eu vi alguém correndo para o segundo andar mais cedo.",
            "As pistas genéticas não mentem, detetive!",
            "Espero que a gente consiga resolver isso logo."
        ]
    },
    'lazaro': {
        first: "Hum? Não me incomode, estou ocupado analisando os relatórios.",
        others: [
            "O estoque trancado guarda segredos interessantes...",
            "Cuidado com quem você acusa por aí.",
            "A justiça tarda, mas não falha."
        ]
    },
    'biologia': {
        first: "[O corpo da vítima está estirado no chão, cercado por vestígios de DNA e anotações científicas espalhadas.]",
        others: [
            "[Há vestígios de marcadores STR e proteínas analisadas ao redor da cena do crime.]",
            "[A amostra biológica na camisa parece conter pistas cruciais sobre o assassino.]"
        ]
    }
};

// Objeto para rastrear o histórico de conversas com cada NPC
const npc_history = {
    'nemo': 0,
    'zny': 0,
    'lazaro': 0,
    'biologia': 0
};

// Lista de elementos interativos (Personagens e Portas)
const interactables = [
    // Personagens (com margem de proximidade maior / bônus de alcance)
    { type: 'npc', id: 'nemo', zone: 'main', x: 300, y: 50, width: 22, height: 96, extra_reach: 40 },
    { type: 'npc', id: 'zny', zone: 'main', x: 1500, y: 350, width: 22, height: 96, extra_reach: 40 },
    { type: 'npc', id: 'lazaro', zone: 'main', x: 1850, y: 50, width: 22, height: 96, extra_reach: 40 },
    { type: 'npc', id: 'biologia', zone: 'biologia', x: 4300, y: 50, width: 96, height: 22, extra_reach: 50 },
    
    // Portas (sem bônus extra, precisando encostar)
    { type: 'door', zone: 'main', x: 1350, y: 50, width: 66, height: 120, extra_reach: 0, targetZone: 'estoque', targetX: 2580 + 33 - 11, targetY: 50 },
    { type: 'door', zone: 'estoque', x: 2580, y: 50, width: 66, height: 120, extra_reach: 0, targetZone: 'main', targetX: 1350 + 33 - 11, targetY: 50 },
    { type: 'door', zone: 'main', x: 80, y: 350, width: 66, height: 120, extra_reach: 0, targetZone: 'biologia', targetX: 3880 + 33 - 11, targetY: 50 },
    { type: 'door', zone: 'biologia', x: 3880, y: 50, width: 66, height: 120, extra_reach: 0, targetZone: 'main', targetX: 80 + 33 - 11, targetY: 350 }
];

function getActiveInteractable() {
    const player_center_x = playerx + (player_width / 2);
    const player_center_y = playery + (player_height / 2);

    for (let item of interactables) {
        if (item.zone === current_zone) {
            const reach = item.extra_reach || 0;
            const expanded_x = item.x - reach;
            const expanded_width = item.width + (reach * 2);
            const expanded_y = item.y - reach;
            const expanded_height = item.height + (reach * 2);

            const inside_x = player_center_x >= expanded_x && player_center_x <= (expanded_x + expanded_width);
            const inside_y = player_center_y >= expanded_y && player_center_y <= (expanded_y + expanded_height);

            if (inside_x && inside_y) {
                return item;
            }
        }
    }
    return null;
}

function startDialogue(npc_id) {
    is_in_dialog = true;
    velocityY = 0;
    interactionBubble.classList.add('hidden');

    const data = npc_dialogues[npc_id];
    let speech = "";

    if (npc_history[npc_id] === 0) {
        speech = data.first;
        npc_history[npc_id]++;
    } else {
        const randIndex = Math.floor(Math.random() * data.others.length);
        speech = data.others[randIndex];
    }

    dialogText.textContent = speech;
    dialogBox.classList.remove('hidden');
}

function closeDialogue() {
    is_in_dialog = false;
    dialogBox.classList.add('hidden');
}

function enterDoorFromList(item) {
    is_transitioning = true;
    door_cooldown = true;
    velocityY = 0;

    fadeOverlay.classList.add('active');

    setTimeout(() => {
        current_zone = item.targetZone;
        playerx = item.targetX;
        playery = item.targetY;

        const bounds = zone_bounds[current_zone];
        let new_cam_x = playerx - 400;
        if (new_cam_x < bounds.minX) new_cam_x = bounds.minX;
        if (new_cam_x > bounds.maxX - 800) new_cam_x = bounds.maxX - 800;
        camerax = new_cam_x;

        let new_cam_y = playery - 50;
        if (new_cam_y < 0) new_cam_y = 0;
        if (new_cam_y > 200) new_cam_y = 200;
        cameray = new_cam_y;

        setTimeout(() => {
            is_transitioning = false;
        }, 50);

        fadeOverlay.classList.remove('active');

    }, 250);
}

// Objeto para rastrear as teclas pressionadas
const keys = {};

window.addEventListener('keydown', (e) => {
    keys[e.key] = true;

    // Se estiver em diálogo, pressionar Espaço, Enter ou E fecha a caixa
    if (is_in_dialog) {
        if (e.key === ' ' || e.key === 'Enter' || e.key === 'e' || e.key === 'E') {
            closeDialogue();
        }
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
    if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
        door_cooldown = false;
    }
});

function gameLoop() {

    // Trava a movimentação durante transição ou diálogo
    if (is_transitioning || is_in_dialog) {
        interactionBubble.classList.add('hidden');
        requestAnimationFrame(gameLoop);
        return;
    }

    let is_moving = false;
    const up_pressed = keys['ArrowUp'] || keys['w'] || keys['W'];
    const interact_pressed = keys['e'] || keys['E'];

    // Checar elemento ativo para interação
    const activeItem = getActiveInteractable();

    if (activeItem) {
        // Posiciona o balão de interação (!) na tela de forma correta (relativo ao game-container)
        const player_screen_x = playerx - camerax + (player_width / 2);
        // Altura do jogo = 450px. Player bottom = playery, height = player_height.
        const player_screen_y = 450 - (playery - cameray) - player_height - 15;
        
        interactionBubble.style.left = player_screen_x + 'px';
        interactionBubble.style.top = player_screen_y + 'px';
        interactionBubble.classList.remove('hidden');

        // Disparar interação baseada no tipo do item:
        // - Portas abrem com W / Seta para Cima (up_pressed)
        // - NPCs abrem com E (interact_pressed)
        if (activeItem.type === 'door' && up_pressed && !door_cooldown) {
            enterDoorFromList(activeItem);
            requestAnimationFrame(gameLoop);
            return;
        } else if (activeItem.type === 'npc' && interact_pressed) {
            startDialogue(activeItem.id);
        }
    } else {
        interactionBubble.classList.add('hidden');
    }

    // 0. Verificação adicional de portas caso o jogador aperte W em cima de uma porta sem o activeItem por algum motivo
    if (up_pressed && !door_cooldown) {
        const player_center_x = playerx + (player_width / 2);
        const player_center_y = playery + (player_height / 2);

        for (let item of interactables) {
            if (item.type === 'door' && item.zone === current_zone) {
                const inside_x = player_center_x >= item.x && player_center_x <= (item.x + item.width);
                const inside_y = player_center_y >= item.y && player_center_y <= (item.y + item.height);

                if (inside_x && inside_y) {
                    enterDoorFromList(item);
                    requestAnimationFrame(gameLoop);
                    return;
                }
            }
        }
    }

    // 1. Movimento Horizontal e Direção do Sprite
    if (keys['ArrowRight'] || keys['d'] || keys['D']) {
        playerx += speed;
        scaleX = 1;
        is_moving = true;
    }
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
        playerx -= speed;
        scaleX = -1;
        is_moving = true;
    }

    // Limites das bordas da zona atual
    const bounds = zone_bounds[current_zone];
    if (playerx < bounds.minX) playerx = bounds.minX;
    if (playerx > bounds.maxX - player_width) playerx = bounds.maxX - player_width;

    // 2. Checagem da Escada
    const player_center_x = playerx + (player_width / 2);
    const is_inside_stairs_x = current_zone === 'main' && player_center_x >= stairsx && player_center_x <= (stairsx + stairs_width);
    const is_inside_stairs_y = playery >= ground_level && playery <= first_floor_y;
    const is_on_stairs = is_inside_stairs_x && is_inside_stairs_y;

    if (is_on_stairs) {
        velocityY = 0;
        can_jump = true; 

        if (up_pressed) {
            playery += speed * 0.5;
            is_moving = true;
        }
        if (keys['ArrowDown'] || keys['s'] || keys['S']) {
            playery -= speed * 0.5;
            is_moving = true;
        }

        if (playery > first_floor_y) {
            playery = first_floor_y;
            can_jump = true;
        }
        if (playery < ground_level) playery = ground_level;

    } else {
        let current_ground = ground_level;

        if (current_zone === 'main') {
            const is_over_top_floor = playerx >= top_floor_min_x && (playerx + player_width) <= top_floor_max_x;
            if (playery >= first_floor_y - 10 && is_over_top_floor) {
                current_ground = first_floor_y;
            }
        }

        if (can_jump && keys[' ']) {
            velocityY = jump_force; 
            can_jump = false;       
        }

        velocityY -= gravity;
        playery += velocityY;

        if (playery <= current_ground) {
            playery = current_ground;
            velocityY = 0;
            can_jump = true; 
        }
    }

    // 3. Juice de Movimento
    let bobbing_y = 0;
    let bobbing_scale_x = scaleX;
    let bobbing_scale_y = 1;
    let rotation_deg = 0;

    if (is_moving && (playery === ground_level || playery === first_floor_y || is_on_stairs)) {
        walkTimer += 0.2;
        bobbing_y = Math.abs(Math.sin(walkTimer)) * 0.5;
        bobbing_scale_y = 1 + Math.sin(walkTimer * 2) * 0.1; 
        bobbing_scale_x = scaleX * (1 - Math.sin(walkTimer * 2) * 0.05);
        rotation_deg = Math.sin(walkTimer) * 4; 
    } else {
        walkTimer = 0;
    }

    // 4. Atualizar Posição e Transformações Visuais do Player no CSS
    player.style.left = Math.floor(playerx) + 'px';
    player.style.bottom = Math.floor(playery + bobbing_y) + 'px';
    player.style.transform = `scaleX(${bobbing_scale_x}) scaleY(${bobbing_scale_y}) rotate(${rotation_deg}deg)`;
    player.style.transformOrigin = 'bottom center';

    // 5. Câmera Suavizada
    let target_camerax = playerx - 400;
    if (target_camerax < bounds.minX) target_camerax = bounds.minX;
    if (target_camerax > bounds.maxX - 800) target_camerax = bounds.maxX - 800;
    camerax += (target_camerax - camerax) * 0.15;

    let target_cameray = playery - 50;
    if (target_cameray < 0) target_cameray = 0;
    if (target_cameray > 200) target_cameray = 200;
    cameray += (target_cameray - cameray) * 0.15;

    world.style.left = -Math.floor(camerax) + 'px';
    world.style.bottom = -Math.floor(cameray) + 'px';

    requestAnimationFrame(gameLoop);
}

gameLoop();
