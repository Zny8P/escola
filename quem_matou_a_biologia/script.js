const world = document.getElementById('world');
const stairs = document.getElementById('stairs');
const player = document.getElementById('player');
const gameContainer = document.getElementById('game-container');
const fadeOverlay = document.getElementById('fade-overlay');
const interactionBubble = document.getElementById('intereaction-bubble');
const dialogBox = document.getElementById('dialog-box');
const dialogText = document.getElementById('dialog-text');
const flashcardOverlay = document.getElementById('flashcard-overlay');
const flashcardFolder = document.getElementById('flashcard-folder');
const flashcardMobileClose = document.getElementById('flashcard-mobile-close');
const flashcardViewer = document.getElementById('flashcard-viewer');
const flashcardLoadMessage = document.getElementById('flashcard-load-message');
const flashcardTitle = document.getElementById('flashcard-title');
const flashcardQuestion = document.getElementById('flashcard-question');
const flashcardAnswer = document.getElementById('flashcard-answer');
const flashcardContent = document.getElementById('flashcard-content');
const flashcardImage = document.getElementById('flashcard-image');
const flashcardBackToMenu = document.getElementById('flashcard-back-to-menu');
const evidenceMenuButton = document.getElementById('evidence-menu-button');
const evidenceNewIndicator = document.getElementById('evidence-new-indicator');
const evidenceMenuPanel = document.getElementById('evidence-menu-panel');
const evidenceMenuMessage = document.getElementById('evidence-menu-message');
const evidenceMenuEmpty = document.getElementById('evidence-menu-empty');
const evidenceCarousel = document.getElementById('evidence-carousel');
const evidenceCarouselTrack = document.getElementById('evidence-carousel-track');
const flyParticleContainer = document.getElementById('fly-particles');

const flyParticleCount = 4;
const flyParticleWidth = 140;
const flyParticleHeight = 48;
const flyParticles = [];
let flyParticleTime = 0;

for (let i = 0; i < flyParticleCount; i++) {
    const element = document.createElement('span');
    element.className = 'fly-particle';
    flyParticleContainer.appendChild(element);
    flyParticles.push({
        element,
        phase: Math.random() * Math.PI * 2,
        speed: 0.8 + Math.random() * 0.7,
        radiusX: 16 + Math.random() * 40,
        radiusY: 5 + Math.random() * 6
    });
}

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
let is_in_flashcard = false;

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
// SISTEMA DE INTERAÇÃO E DIÁLOGOS
// =========================================
const npc_dialogue_files = {
    nemo: 'speechs/nemo.json',
    zny: 'speechs/zny.json',
    lazaro: 'speechs/lazaro.json',
    biologia: 'speechs/biologia.json'
};
const npc_dialogue_cache = {};
const evidence_files = {
    'crime-weapon': 'flashcards/crime-weapon.json',
    biologia: 'flashcards/biologia.json',
    zny: 'flashcards/zny.json'
};
const evidence_cache = {};
const collected_evidence = [];
let current_evidence_id = null;

const npc_history = {
    'nemo': 0,
    'zny': 0,
    'lazaro': 0,
    'biologia': 0
};

async function loadNpcDialogue(npc_id) {
    if (npc_dialogue_cache[npc_id]) {
        return npc_dialogue_cache[npc_id];
    }

    const dialogue_file = npc_dialogue_files[npc_id];
    if (!dialogue_file) {
        throw new Error(`Arquivo de diálogo não definido para "${npc_id}".`);
    }

    const response = await fetch(dialogue_file);
    if (!response.ok) {
        throw new Error(`Falha ao carregar "${dialogue_file}": HTTP ${response.status}.`);
    }

    const data = await response.json();
    if (
        !data ||
        typeof data.first !== 'string' ||
        !Array.isArray(data.others) ||
        data.others.length === 0 ||
        data.others.some((line) => typeof line !== 'string')
    ) {
        throw new Error(`Formato inválido em "${dialogue_file}".`);
    }

    npc_dialogue_cache[npc_id] = data;
    return data;
}

async function loadEvidenceCard(evidence_id) {
    if (evidence_cache[evidence_id]) {
        return evidence_cache[evidence_id];
    }

    const evidence_file = evidence_files[evidence_id];
    if (!evidence_file) {
        throw new Error(`Arquivo de evidência não definido para "${evidence_id}".`);
    }

    const response = await fetch(evidence_file);
    if (!response.ok) {
        throw new Error(`Falha ao carregar "${evidence_file}": HTTP ${response.status}.`);
    }

    const data = await response.json();
    const required_fields = ['title', 'question', 'answer', 'img', 'content'];
    if (!data || required_fields.some((field) => typeof data[field] !== 'string' || !data[field].trim())) {
        throw new Error(`Formato inválido em "${evidence_file}".`);
    }

    const evidence = { id: evidence_id, ...data, isNew: true };
    evidence_cache[evidence_id] = evidence;
    return evidence;
}

function updateEvidenceMenuButton() {
    const has_new_evidence = collected_evidence.some((evidence) => evidence.isNew);
    evidenceNewIndicator.classList.toggle('hidden', !has_new_evidence);
}

async function collectEvidence(evidence_id) {
    const found = collected_evidence.find((evidence) => evidence.id === evidence_id);
    if (found) {
        return found;
    }

    const evidence = await loadEvidenceCard(evidence_id);
    collected_evidence.push(evidence);
    updateEvidenceMenuButton();
    evidenceMenuMessage.classList.add('hidden');
    return evidence;
}

function renderEvidenceMenu() {
    evidenceCarouselTrack.replaceChildren();

    if (collected_evidence.length === 0) {
        evidenceMenuEmpty.classList.remove('hidden');
        evidenceCarousel.classList.add('hidden');
        return;
    }

    evidenceMenuEmpty.classList.add('hidden');
    evidenceCarousel.classList.remove('hidden');

    for (const evidence of collected_evidence) {
        const card_button = document.createElement('button');
        card_button.className = 'evidence-card-thumb';
        card_button.type = 'button';
        card_button.setAttribute('aria-label', `Abrir evidência: ${evidence.title}`);

        const image = document.createElement('img');
        image.src = evidence.img;
        image.alt = '';

        const title = document.createElement('span');
        title.textContent = evidence.title;

        card_button.appendChild(image);
        card_button.appendChild(title);
        if (evidence.isNew) {
            const badge = document.createElement('span');
            badge.className = 'evidence-card-new';
            badge.textContent = '!';
            card_button.appendChild(badge);
        }

        card_button.addEventListener('click', () => openFlashcard(evidence.id, true));
        evidenceCarouselTrack.appendChild(card_button);
    }
}

function openEvidenceMenu() {
    if (is_transitioning || is_in_dialog) {
        return;
    }

    is_in_flashcard = true;
    flashcardOverlay.classList.remove('hidden');
    flashcardOverlay.setAttribute('aria-hidden', 'false');
    evidenceMenuPanel.classList.remove('hidden');
    flashcardViewer.classList.add('hidden');

    for (const evidence of collected_evidence) {
        evidence.isNew = false;
    }
    updateEvidenceMenuButton();
    renderEvidenceMenu();
    evidenceMenuButton.setAttribute('aria-expanded', 'true');
}

function toggleEvidenceMenu() {
    if (is_transitioning || is_in_dialog) {
        return;
    }

    if (is_in_flashcard) {
        closeFlashcard();
    } else {
        openEvidenceMenu();
    }
}

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
    { type: 'door', zone: 'biologia', x: 3880, y: 50, width: 66, height: 120, extra_reach: 0, targetZone: 'main', targetX: 80 + 33 - 11, targetY: 350 },
    { type: 'item', id: 'crime-weapon', zone: 'estoque', x: 2990, y: 112, width: 32, height: 32, extra_reach: 40 }

];

const breathing_npcs = [
    { id: 'nemo', element: document.getElementById('nemo'), x: 300, width: 22, phase: 0 },
    { id: 'zny', element: document.getElementById('zny'), x: 1500, width: 22, phase: 2 },
    { id: 'lazaro', element: document.getElementById('lazaro'), x: 1850, width: 22, phase: 4 }
];
let npcBreathingTime = 0;

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

function updateNpcAnimations(activeItem) {
    npcBreathingTime += 0.02;

    for (const npc of breathing_npcs) {
        const breath = Math.sin(npcBreathingTime + npc.phase);
        const is_facing_player = (npc.id === 'nemo' || npc.id === 'zny') &&
            activeItem &&
            activeItem.type === 'npc' &&
            activeItem.id === npc.id;
        const direction = is_facing_player && playerx + (player_width / 2) < npc.x + (npc.width / 2) ? -1 : 1;
        const scale_x = 1 - breath * 0.012;
        const scale_y = 1 + breath * 0.025;

        npc.element.style.transform = `scaleX(${direction * scale_x}) scaleY(${scale_y})`;
        npc.element.style.transformOrigin = 'bottom center';
    }
}

function updateFlyParticles() {
    flyParticleTime += 0.025;

    for (const particle of flyParticles) {
        const angle = flyParticleTime * particle.speed + particle.phase;
        const x = flyParticleWidth / 2 + Math.cos(angle) * particle.radiusX;
        const y = flyParticleHeight / 2 + Math.sin(angle * 1.3) * particle.radiusY;
        particle.element.style.left = `${Math.round(x)}px`;
        particle.element.style.top = `${Math.round(y)}px`;
    }
}

async function startDialogue(npc_id) {
    is_in_dialog = true;
    velocityY = 0;
    gameContainer.classList.add('dialog-open');
    interactionBubble.classList.add('hidden');
    dialogText.textContent = 'Carregando...';
    dialogBox.classList.remove('hidden');

    if (evidence_files[npc_id]) {
        collectEvidence(npc_id).catch((error) => {
            console.error(`Não foi possível registrar a evidência de "${npc_id}".`, error);
            evidenceMenuMessage.textContent = 'Uma evidência não pôde ser carregada. Abra o jogo usando um servidor local.';
            evidenceMenuMessage.classList.remove('hidden');
        });
    }

    try {
        const data = await loadNpcDialogue(npc_id);
        if (!is_in_dialog) {
            return;
        }

        if (npc_history[npc_id] === 0) {
            dialogText.textContent = data.first;
            npc_history[npc_id]++;
        } else {
            const randIndex = Math.floor(Math.random() * data.others.length);
            dialogText.textContent = data.others[randIndex];
        }
    } catch (error) {
        console.error(`Não foi possível carregar o diálogo de "${npc_id}".`, error);
        if (is_in_dialog) {
            dialogText.textContent = 'Não foi possível carregar a fala. Abra o jogo usando um servidor local.';
        }
    }
}

function closeDialogue() {
    is_in_dialog = false;
    gameContainer.classList.remove('dialog-open');
    dialogBox.classList.add('hidden');
    keys.e = false;
    keys.E = false;
    keys[' '] = false;
}

async function openFlashcard(evidence_id, from_menu = false) {
    is_in_flashcard = true;
    velocityY = 0;
    interactionBubble.classList.add('hidden');
    current_evidence_id = evidence_id;
    flashcardFolder.classList.remove('is-open');
    flashcardFolder.classList.add('hidden');
    flashcardFolder.setAttribute('aria-pressed', 'false');
    flashcardFolder.setAttribute('aria-label', 'Pasta fechada. Pressione Enter para abrir.');
    flashcardOverlay.classList.remove('hidden');
    flashcardOverlay.setAttribute('aria-hidden', 'false');
    evidenceMenuButton.setAttribute('aria-expanded', 'false');
    evidenceMenuPanel.classList.add('hidden');
    flashcardViewer.classList.remove('hidden');
    flashcardBackToMenu.classList.toggle('hidden', !from_menu);
    flashcardLoadMessage.textContent = 'Carregando evidência...';
    flashcardLoadMessage.classList.remove('hidden');

    try {
        const evidence = await collectEvidence(evidence_id);
        if (!is_in_flashcard || current_evidence_id !== evidence_id) {
            return;
        }

        flashcardTitle.textContent = evidence.title;
        flashcardQuestion.textContent = evidence.question;
        flashcardAnswer.textContent = evidence.answer;
        flashcardContent.textContent = evidence.content;
        flashcardImage.src = evidence.img;
        flashcardImage.alt = evidence.title;
        flashcardLoadMessage.classList.add('hidden');
        flashcardFolder.classList.remove('hidden');
        flashcardFolder.focus();
    } catch (error) {
        console.error(`Não foi possível abrir a evidência "${evidence_id}".`, error);
        flashcardLoadMessage.textContent = 'Não foi possível carregar esta evidência. Abra o jogo usando um servidor local.';
        evidenceMenuMessage.textContent = flashcardLoadMessage.textContent;
        evidenceMenuMessage.classList.remove('hidden');
    }
}

function closeFlashcard() {
    is_in_flashcard = false;
    current_evidence_id = null;
    flashcardOverlay.classList.add('hidden');
    flashcardOverlay.setAttribute('aria-hidden', 'true');
    evidenceMenuPanel.classList.add('hidden');
    flashcardViewer.classList.add('hidden');
    flashcardFolder.classList.remove('is-open');
    flashcardFolder.classList.add('hidden');
    flashcardFolder.setAttribute('aria-pressed', 'false');
    evidenceMenuButton.setAttribute('aria-expanded', 'false');
    keys.e = false;
    keys.E = false;
    keys.q = false;
    keys.Q = false;
    keys[' '] = false;
}

function toggleFlashcardFolder() {
    const isOpen = flashcardFolder.classList.toggle('is-open');
    flashcardFolder.setAttribute('aria-pressed', String(isOpen));
    flashcardFolder.setAttribute(
        'aria-label',
        isOpen
            ? `Pasta aberta. Pressione Enter para fechar. ${flashcardTitle.textContent}`
            : `Pasta fechada. Pressione Enter para abrir. ${flashcardTitle.textContent}`
    );
}

flashcardFolder.addEventListener('click', toggleFlashcardFolder);
flashcardFolder.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault();
        toggleFlashcardFolder();
    }
});

flashcardMobileClose.addEventListener('click', (event) => {
    event.stopPropagation();
    closeFlashcard();
});

evidenceMenuButton.addEventListener('click', toggleEvidenceMenu);
document.getElementById('evidence-menu-close').addEventListener('click', closeFlashcard);
flashcardBackToMenu.addEventListener('click', openEvidenceMenu);
document.getElementById('evidence-carousel-prev').addEventListener('click', () => {
    evidenceCarouselTrack.scrollBy({ left: -200, behavior: 'smooth' });
});
document.getElementById('evidence-carousel-next').addEventListener('click', () => {
    evidenceCarouselTrack.scrollBy({ left: 200, behavior: 'smooth' });
});

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

function blurFocusedButton() {
    if (document.activeElement instanceof HTMLButtonElement) {
        document.activeElement.blur();
    }
}

const touch_control_keys = {
    left: ['ArrowLeft'],
    right: ['ArrowRight'],
    jump: ['ArrowUp', ' '],
    interact: ['e']
};
const touchControlButtons = document.querySelectorAll('[data-touch-control]');

for (const button of touchControlButtons) {
    const control_keys = touch_control_keys[button.dataset.touchControl];
    let release_timer;

    button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        clearTimeout(release_timer);
        button.setPointerCapture(event.pointerId);
        for (const key of control_keys) {
            keys[key] = true;
        }
    });

    button.addEventListener('pointerup', (event) => {
        event.preventDefault();
        release_timer = setTimeout(() => {
            for (const key of control_keys) {
                keys[key] = false;
                if (key === 'ArrowUp') {
                    door_cooldown = false;
                }
            }
        }, 75);
    });

    button.addEventListener('pointercancel', () => {
        clearTimeout(release_timer);
        for (const key of control_keys) {
            keys[key] = false;
            if (key === 'ArrowUp') {
                door_cooldown = false;
            }
        }
    });
}

window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    const is_evidence_menu_key = e.key === 'q' || e.key === 'Q';

    if (is_evidence_menu_key && e.repeat) {
        return;
    }

    if (is_in_flashcard) {
        if (e.key === ' ') {
            e.preventDefault();
            closeFlashcard();
        } else if (is_evidence_menu_key) {
            e.preventDefault();
            closeFlashcard();
            blurFocusedButton();
        }
        return;
    }

    // Se estiver em diálogo, pressionar Espaço, Enter ou E fecha a caixa
    if (is_in_dialog) {
        if (e.key === ' ' || e.key === 'Enter' || e.key === 'e' || e.key === 'E') {
            if (e.key === ' ') {
                e.preventDefault();
            }
            closeDialogue();
        }
        return;
    }

    if (is_evidence_menu_key && !is_transitioning) {
        e.preventDefault();
        openEvidenceMenu();
        blurFocusedButton();
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
    if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
        door_cooldown = false;
    }
});

document.addEventListener('pointerdown', (event) => {
    if (
        event.pointerType === 'mouse' &&
        event.target instanceof Element &&
        event.target.closest('button')
    ) {
        event.preventDefault();
    }
});

document.addEventListener('click', (event) => {
    if (
        event.detail > 0 &&
        event.target instanceof Element &&
        event.target.closest('button') &&
        document.activeElement instanceof HTMLElement
    ) {
        document.activeElement.blur();
    }
});

function gameLoop() {
    updateFlyParticles();
    const activeItem = getActiveInteractable();
    updateNpcAnimations(activeItem);

    // Trava a movimentação durante transição ou diálogo
    if (is_transitioning || is_in_dialog || is_in_flashcard) {
        interactionBubble.classList.add('hidden');
        requestAnimationFrame(gameLoop);
        return;
    }

    let is_moving = false;
    const up_pressed = keys['ArrowUp'] || keys['w'] || keys['W'];
    const interact_pressed = keys['e'] || keys['E'];

    // Checar elemento ativo para interação
    if (activeItem) {
        // Posiciona o balão de interação (!) na tela de forma correta (relativo ao game-container)
        const player_screen_x = playerx - camerax + (player_width / 2);
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
            requestAnimationFrame(gameLoop);
            return;
        } else if (activeItem.type === 'item' && interact_pressed) {
            openFlashcard(activeItem.id);
            requestAnimationFrame(gameLoop);
            return;
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
