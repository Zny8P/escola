const world = document.getElementById('world');
const stairs = document.getElementById('stairs');
const player = document.getElementById('player');
const fadeOverlay = document.getElementById('fade-overlay');

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

const zone_bounds = {
    'main':     { minX: 0,    maxX: 2000 },
    'estoque':  { minX: 2500, maxX: 3300 }, // 800px de largura
    'biologia': { minX: 3800, maxX: 4600 }  // 800px de largura
};

// Definição de todas as portas (largura 66px, altura 120px)
const doors = [
    // Porta do Estoque (Térreo -> Zona Estoque)
    {
        zone: 'main',
        x: 1350, y: 50, width: 66, height: 120,
        targetZone: 'estoque',
        targetX: 2500 + 80 + (66 / 2) - (player_width / 2), // Centraliza na porta de saída
        targetY: 50
    },
    // Saída do Estoque (Zona Estoque -> Térreo)
    {
        zone: 'estoque',
        x: 2580, y: 50, width: 66, height: 120,
        targetZone: 'main',
        targetX: 1350 + (66 / 2) - (player_width / 2),
        targetY: 50
    },
    // Porta do Quarto da Biologia (1º Andar -> Zona Biologia)
    {
        zone: 'main',
        x: 80, y: 350, width: 66, height: 120,
        targetZone: 'biologia',
        targetX: 3800 + 80 + (66 / 2) - (player_width / 2),
        targetY: 50
    },
    // Saída do Quarto da Biologia (Zona Biologia -> 1º Andar)
    {
        zone: 'biologia',
        x: 3880, y: 50, width: 66, height: 120,
        targetZone: 'main',
        targetX: 80 + (66 / 2) - (player_width / 2),
        targetY: 350
    }
];

function enterDoor(door) {
    is_transitioning = true;
    door_cooldown = true;
    velocityY = 0;

    // Inicia o desvanecer (Fade Out)
    fadeOverlay.classList.add('active');

    // Na metade da animação (250ms), teleporta o player e atualiza a câmera
    setTimeout(() => {
        current_zone = door.targetZone;
        playerx = door.targetX;
        playery = door.targetY;

        // Reposiciona a câmera imediatamente para não haver arrasto visual
        const bounds = zone_bounds[current_zone];
        let new_cam_x = playerx - 400;
        if (new_cam_x < bounds.minX) new_cam_x = bounds.minX;
        if (new_cam_x > bounds.maxX - 800) new_cam_x = bounds.maxX - 800;
        camerax = new_cam_x;

        let new_cam_y = playery - 50;
        if (new_cam_y < 0) new_cam_y = 0;
        if (new_cam_y > 200) new_cam_y = 200;
        cameray = new_cam_y;

        // Libera o movimento ao final dos 500ms totais
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
});

window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
    // Libera o cooldown da porta quando o jogador solta a tecla de interação
    if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
        door_cooldown = false;
    }
});

function gameLoop() {

    // Trava a movimentação enquanto a tela está fazendo a transição
    if (is_transitioning) {
        requestAnimationFrame(gameLoop);
        return;
    }

    let is_moving = false;
    const up_pressed = keys['ArrowUp'] || keys['w'] || keys['W'];

    // 0. Checagem de Interação com Portas
    if (up_pressed && !door_cooldown) {
        const player_center_x = playerx + (player_width / 2);
        const player_center_y = playery + (player_height / 2);

        for (let door of doors) {
            if (door.zone === current_zone) {
                const inside_x = player_center_x >= door.x && player_center_x <= (door.x + door.width);
                const inside_y = player_center_y >= door.y && player_center_y <= (door.y + door.height);

                if (inside_x && inside_y) {
                    enterDoor(door);
                    requestAnimationFrame(gameLoop);
                    return;
                }
            }
        }
    }

    // 1. Movimento Horizontal e Direção do Sprite
    if (keys['ArrowRight'] || keys['d'] || keys['D']) {
        playerx += speed;
        scaleX = 1; // Olha para a direita
        is_moving = true;
    }
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
        playerx -= speed;
        scaleX = -1; // Olha para a esquerda
        is_moving = true;
    }

    // Limites das bordas da zona atual (impede atravessar paredes ou ir a pé para outras zonas)
    const bounds = zone_bounds[current_zone];
    if (playerx < bounds.minX) playerx = bounds.minX;
    if (playerx > bounds.maxX - player_width) playerx = bounds.maxX - player_width;

    // 2. Checagem da Escada (Apenas na zona principal 'main')
    const player_center_x = playerx + (player_width / 2);
    const is_inside_stairs_x = current_zone === 'main' && player_center_x >= stairsx && player_center_x <= (stairsx + stairs_width);
    const is_inside_stairs_y = playery >= ground_level && playery <= first_floor_y;
    const is_on_stairs = is_inside_stairs_x && is_inside_stairs_y;

    if (is_on_stairs) {
        // Dentro da escada: Gravidade desativada, controle vertical ativo
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

        // Não deixa passar do topo nem afundar no chão enquanto está na escada
        if (playery > first_floor_y) {
            playery = first_floor_y;
            can_jump = true;
        }
        if (playery < ground_level) playery = ground_level;

    } else {
        // Fora da escada: Aplica física e gravidade
        let current_ground = ground_level;

        if (current_zone === 'main') {
            const is_over_top_floor = playerx >= top_floor_min_x && (playerx + player_width) <= top_floor_max_x;
            if (playery >= first_floor_y - 10 && is_over_top_floor) {
                current_ground = first_floor_y;
            }
        }

        // COMANDO DO PULO
        if (can_jump && keys[' ']) {
            velocityY = jump_force; 
            can_jump = false;       
        }

        // Aplica a gravidade na velocidade vertical
        velocityY -= gravity;
        playery += velocityY;

        // Colisão ao pousar no chão
        if (playery <= current_ground) {
            playery = current_ground;
            velocityY = 0;
            can_jump = true; 
        }
    }

    // 3. Juice de Movimento (Balanço rítmico enquanto anda)
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

    // 5. Câmera Suavizada respeitando os limites da zona atual
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
