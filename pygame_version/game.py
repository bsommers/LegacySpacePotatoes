import pygame
import math
import random
import os

# Try to import numpy for synthetic audio
try:
    import numpy as np
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False

# Initialize PyGame
pygame.mixer.pre_init(44100, -16, 1, 512)
pygame.init()

# Constants
WIDTH, HEIGHT = 1280, 720
FPS = 60

# Setup Display
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Space Potatoes")
clock = pygame.time.Clock()

# Fonts
try:
    font_hud = pygame.font.SysFont('Arial', 24, bold=True)
    font_large = pygame.font.SysFont('Arial', 48, bold=True)
except:
    font_hud = pygame.font.Font(None, 36)
    font_large = pygame.font.Font(None, 72)

# Audio Generation
def generate_sound(freq, duration, vol=0.1, wave_type='sine', mod_freq=0):
    if not HAS_NUMPY:
        return None
    try:
        sample_rate = 44100
        n_samples = int(duration * sample_rate)
        t = np.linspace(0, duration, n_samples, False)
        
        # apply slight frequency modulation if mod_freq is set (howl effect)
        current_freq = freq + np.sin(t * mod_freq * 2 * np.pi) * (freq * 0.2) if mod_freq else freq
        
        if wave_type == 'sine':
            wave = np.sin(current_freq * t * 2 * np.pi)
        elif wave_type == 'square':
            wave = np.sign(np.sin(current_freq * t * 2 * np.pi))
        elif wave_type == 'sawtooth':
            wave = 2 * (t * current_freq - np.floor(t * current_freq + 0.5))
        
        # Envelope to prevent clicking
        envelope = np.exp(-t * 5)
        wave = wave * envelope * vol * 32767
        
        wave = wave.astype(np.int16)
        if pygame.mixer.get_init()[2] == 2: # Stereo
            wave = np.column_stack((wave, wave))
        return pygame.sndarray.make_sound(wave)
    except Exception as e:
        print(f"Warning: Could not generate sound ({e})")
        return None

sounds = {
    'swat': generate_sound(800, 0.1, 0.1, 'sine'),
    'explosion': generate_sound(100, 0.3, 0.2, 'sawtooth'),
    'meow': generate_sound(500, 0.4, 0.1, 'sine'),
    'howl': generate_sound(200, 0.6, 0.2, 'sawtooth', mod_freq=10),
    'damage': generate_sound(200, 0.5, 0.3, 'sawtooth'),
    'fart': generate_sound(80, 0.4, 0.3, 'sawtooth'),
    'purr': generate_sound(45, 0.3, 0.2, 'sawtooth', mod_freq=20)
}

def play_sound(name):
    if sounds.get(name):
        sounds[name].play()

# Load Assets
def load_image(name, size=None):
    path = os.path.join(os.path.dirname(__file__), 'assets', name)
    try:
        img = pygame.image.load(path).convert_alpha()
        if size:
            img = pygame.transform.smoothscale(img, size)
        return img
    except Exception as e:
        print(f"Warning: Could not load image {name}. Using fallback.")
        s = pygame.Surface(size if size else (50,50), pygame.SRCALPHA)
        s.fill((255, 100, 100, 100))
        return s

img_cat = load_image('cat.png', (60, 60))
img_potato_large = load_image('potato.png', (80, 80))
img_potato_small = load_image('potato.png', (40, 40))
img_food = load_image('cat_food.png', (40, 40))
img_bg = load_image('space_bg.png')

# State
state = {
    'health': 100,
    'score': 0,
    'food': 0,
    'farts': 0,
    'swatted': 0,
    'level': 1,
    'timer': 0,
    'potatoes_to_spawn': 0,
    'game_over': False,
    'paused': False
}

def start_level(l):
    state['level'] = l
    state['potatoes_to_spawn'] = 5 + l * 2
    state['timer'] = (30 + l * 10) * FPS
    potatoes.clear()
    projectiles.clear()
    particles.clear()

# Entities
class Cat:
    def __init__(self):
        self.x = WIDTH / 2
        self.y = HEIGHT / 2
        self.vx = 0
        self.vy = 0
        self.angle = 0
        self.hit_radius = 30
        self.speed = 0.3
        self.friction = 0.98
        self.using_mouse = True
        
        self.shield_active = False
        self.shield_energy = 300
        self.max_shield_energy = 300
        self.shield_cooldown = 0
        
        self.zoomies_active = False
        self.zoomies_timer = 0

    def update(self, keys, mouse_pos):
        # Rotation
        if self.using_mouse:
            dx = mouse_pos[0] - self.x
            dy = mouse_pos[1] - self.y
            self.angle = math.atan2(dy, dx)
        else:
            if keys[pygame.K_LEFT] or keys[pygame.K_a]:
                self.angle -= 0.1
            if keys[pygame.K_RIGHT] or keys[pygame.K_d]:
                self.angle += 0.1

        # Asteroids style Relative Thrust
        current_speed = self.speed * 2 if self.zoomies_active else self.speed
        if keys[pygame.K_w] or keys[pygame.K_UP]:
            self.vx += math.cos(self.angle) * current_speed
            self.vy += math.sin(self.angle) * current_speed
        if keys[pygame.K_s] or keys[pygame.K_DOWN]:
            self.vx -= math.cos(self.angle) * current_speed * 0.5
            self.vy -= math.sin(self.angle) * current_speed * 0.5

        self.vx *= self.friction
        self.vy *= self.friction
        
        self.x += self.vx
        self.y += self.vy

        # Screen wrap
        self.x = self.x % WIDTH
        self.y = self.y % HEIGHT
        
        # Shield Logic
        if self.shield_cooldown > 0:
            self.shield_cooldown -= 1
            self.shield_active = False
            if self.shield_cooldown == 0:
                self.shield_energy = self.max_shield_energy
        else:
            if keys[pygame.K_z] and self.shield_energy > 0:
                self.shield_active = True
                self.shield_energy -= 1
                state['health'] -= (1 / 60)
                if self.shield_energy <= 0:
                    self.shield_active = False
                    self.shield_cooldown = 600
            else:
                self.shield_active = False
                if keys[pygame.K_z] and self.shield_energy <= 0:
                    self.shield_cooldown = 600

        # Zoomies Logic
        if self.zoomies_active:
            self.zoomies_timer -= 1
            if self.zoomies_timer % 30 == 0:
                play_sound('fart')
                for _ in range(5):
                    particles.append(Particle(self.x, self.y))
            if self.zoomies_timer <= 0:
                self.zoomies_active = False

    def draw(self, surface):
        draw_hit_radius = self.hit_radius * 2 if self.zoomies_active else self.hit_radius
        
        if self.shield_active:
            # Draw glowing shield
            alpha = int(50 + (self.shield_energy / self.max_shield_energy) * 150)
            shield_surf = pygame.Surface((120, 120), pygame.SRCALPHA)
            pygame.draw.circle(shield_surf, (0, 255, 100, alpha), (60, 60), draw_hit_radius + 15)
            pygame.draw.circle(shield_surf, (0, 255, 100, 200), (60, 60), draw_hit_radius + 15, 3)
            rect = shield_surf.get_rect(center=(int(self.x), int(self.y)))
            surface.blit(shield_surf, rect.topleft)

        # Rotate image
        angle_deg = -math.degrees(self.angle)
        
        draw_img = img_cat
        if self.zoomies_active:
            draw_img = pygame.transform.smoothscale(img_cat, (120, 120))
            
        rotated = pygame.transform.rotate(draw_img, angle_deg)
        
        if self.zoomies_active:
            alpha = int(((math.sin(pygame.time.get_ticks() / 50.0) + 1) / 2 * 0.5 + 0.5) * 255)
            rotated.set_alpha(alpha)
            
        rect = rotated.get_rect(center=(int(self.x), int(self.y)))
        surface.blit(rotated, rect.topleft)

class Projectile:
    def __init__(self, x, y, angle):
        self.x = x
        self.y = y
        self.vx = math.cos(angle) * 15
        self.vy = math.sin(angle) * 15
        self.angle = angle
        self.life = 60
        self.size = 20

    def update(self):
        self.x += self.vx
        self.y += self.vy
        self.life -= 1

    def draw(self, surface):
        angle_deg = -math.degrees(self.angle)
        surf = pygame.Surface((40, 20), pygame.SRCALPHA)
        pygame.draw.polygon(surf, (0, 240, 255, 200), [(0, 5), (40, 10), (0, 15)])
        rotated = pygame.transform.rotate(surf, angle_deg)
        rect = rotated.get_rect(center=(int(self.x), int(self.y)))
        surface.blit(rotated, rect.topleft)

class Potato:
    def __init__(self, x, y, is_large=True):
        self.x = x
        self.y = y
        self.is_large = is_large
        self.hit_radius = 32 if is_large else 16
        self.img = img_potato_large if is_large else img_potato_small
        
        angle = random.uniform(0, math.pi * 2)
        # Less aggressive speed, slightly scaled by level
        speed = random.uniform(0.2, 0.7) * (1 if is_large else 1.2)
        speed *= (1 + state['level'] * 0.1)
        
        self.vx = math.cos(angle) * speed
        self.vy = math.sin(angle) * speed
        self.angle = 0
        self.rot_speed = random.uniform(-1, 1)

    def update(self, cat):
        self.x += self.vx
        self.y += self.vy
        self.angle += self.rot_speed
        
        # Screen wrap
        self.x = self.x % WIDTH
        self.y = self.y % HEIGHT
        
        # Collision with cat
        dx = self.x - cat.x
        dy = self.y - cat.y
        dist = math.hypot(dx, dy)
        cat_hit_radius = cat.hit_radius * 2 if cat.zoomies_active else cat.hit_radius
        
        if cat.zoomies_active and dist < self.hit_radius + cat_hit_radius:
            # Plow through potatoes
            if self in potatoes:
                play_sound('purr')
                for _ in range(10): particles.append(Particle(self.x, self.y))
                if self.is_large:
                    state['score'] += 10 * state['level']
                    for _ in range(3): potatoes.append(Potato(self.x, self.y, False))
                else:
                    state['score'] += 20 * state['level']
                potatoes.remove(self)
        elif cat.shield_active and dist < self.hit_radius + cat_hit_radius + 15:
            # Bounce off shield
            push_angle = math.atan2(dy, dx)
            self.vx = math.cos(push_angle) * 3
            self.vy = math.sin(push_angle) * 3
            # Push cat slightly
            cat.vx -= math.cos(push_angle) * 0.5
            cat.vy -= math.sin(push_angle) * 0.5
        elif not cat.shield_active and not cat.zoomies_active and dist < self.hit_radius + cat_hit_radius:
            state['health'] -= 10
            play_sound('howl')
            if state['health'] <= 0:
                state['game_over'] = True
            
            # Pushback
            push_angle = math.atan2(dy, dx)
            self.vx = math.cos(push_angle) * 3
            self.vy = math.sin(push_angle) * 3
            cat.vx = math.cos(push_angle + math.pi) * 2
            cat.vy = math.sin(push_angle + math.pi) * 2

    def draw(self, surface):
        rotated = pygame.transform.rotate(self.img, self.angle)
        rect = rotated.get_rect(center=(int(self.x), int(self.y)))
        surface.blit(rotated, rect.topleft)

class Particle:
    def __init__(self, x, y):
        self.x = x
        self.y = y
        angle = random.uniform(0, math.pi * 2)
        speed = random.uniform(1, 4)
        self.vx = math.cos(angle) * speed
        self.vy = math.sin(angle) * speed
        self.life = 255
        self.decay = random.uniform(5, 10)

    def update(self):
        self.x += self.vx
        self.y += self.vy
        self.life -= self.decay

    def draw(self, surface):
        if self.life > 0:
            pygame.draw.circle(surface, (200, 200, 200, int(self.life)), (int(self.x), int(self.y)), 3)

cat = Cat()
projectiles = []
potatoes = []
particles = []

def spawn_potato():
    if random.random() < 0.5:
        x = -50 if random.random() < 0.5 else WIDTH + 50
        y = random.uniform(0, HEIGHT)
    else:
        x = random.uniform(0, WIDTH)
        y = -50 if random.random() < 0.5 else HEIGHT + 50
    potatoes.append(Potato(x, y, True))
    state['potatoes_to_spawn'] -= 1

def draw_hud(surface):
    # Top bar
    hud_bg = pygame.Surface((WIDTH, 60), pygame.SRCALPHA)
    hud_bg.fill((10, 15, 25, 200))
    surface.blit(hud_bg, (0,0))
    
    # Health
    pygame.draw.rect(surface, (50, 60, 70), (20, 20, 200, 20), border_radius=10)
    health_width = max(0, int(200 * (state['health'] / 100)))
    color = (0, 240, 255) if state['health'] > 30 else (255, 0, 85)
    pygame.draw.rect(surface, color, (20, 20, health_width, 20), border_radius=10)
    
    # HUD Elements
    texts = [
        (f"LEVEL: {state['level']}", (WIDTH // 2 - 200, 20)),
        (f"TIME: {state['timer'] // 60 // 60}:{str(state['timer'] // 60 % 60).zfill(2)}", (WIDTH // 2, 20)),
        (f"SCORE: {int(state['score'])}", (WIDTH // 2 + 200, 20))
    ]
    for text, pos in texts:
        render = font_hud.render(text, True, (255, 255, 255))
        surface.blit(render, (pos[0] - render.get_width() // 2, pos[1]))
    
    # Food & Farts
    surface.blit(img_food, (WIDTH - 150, 10))
    txt_food = font_hud.render(f"x {state['food']}", True, (255, 215, 0))
    surface.blit(txt_food, (WIDTH - 100, 20))
    
    txt_farts = font_hud.render(f"FARTS: {state['farts']}", True, (0, 255, 100))
    surface.blit(txt_farts, (WIDTH - 150, 50))

def reset_game():
    global cat, spawn_rate
    state['health'] = 100
    state['score'] = 0
    state['food'] = 0
    state['farts'] = 0
    state['swatted'] = 0
    state['game_over'] = False
    state['paused'] = False
    cat = Cat()
    start_level(1)
    spawn_rate = 180

bg_offset_x = 0
bg_offset_y = 0
spawn_timer = 0
spawn_rate = 180
ambient_timer = 300

start_level(1)

# Main loop
running = True
while running:
    clock.tick(FPS)
    
    keys = pygame.key.get_pressed()
    mouse_pos = pygame.mouse.get_pos()
    
    # Process Events
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
            
        elif event.type == pygame.KEYDOWN:
            if event.key in [pygame.K_LEFT, pygame.K_RIGHT, pygame.K_a, pygame.K_d]:
                cat.using_mouse = False
                
            if event.key == pygame.K_ESCAPE:
                if not state['game_over']:
                    state['paused'] = not state['paused']
            
            if event.key == pygame.K_q and state['paused']:
                state['paused'] = False
                state['health'] = 0
                state['game_over'] = True
            
            if event.key == pygame.K_SPACE and not state['paused'] and not state['game_over']:
                play_sound('swat')
                proj = Projectile(cat.x + math.cos(cat.angle)*cat.hit_radius, cat.y + math.sin(cat.angle)*cat.hit_radius, cat.angle)
                projectiles.append(proj)
                
            if event.key == pygame.K_f and not state['paused'] and not state['game_over']:
                if state['farts'] > 0:
                    state['farts'] -= 1
                    play_sound('fart')
                    for _ in range(30):
                        particles.append(Particle(cat.x, cat.y))
                    radius = min(WIDTH, HEIGHT) * 0.3
                    for pot in potatoes[:]:
                        dist = math.hypot(pot.x - cat.x, pot.y - cat.y)
                        if dist < radius:
                            play_sound('purr')
                            for _ in range(10): particles.append(Particle(pot.x, pot.y))
                            potatoes.remove(pot)
                            if pot.is_large:
                                state['score'] += 10 * state['level']
                                for _ in range(3): potatoes.append(Potato(pot.x, pot.y, False))
                            else:
                                state['score'] += 20 * state['level']
                                
            if event.key == pygame.K_e and not state['paused'] and not state['game_over']:
                if state['food'] > 0 and not cat.zoomies_active:
                    state['food'] -= 1
                    cat.zoomies_active = True
                    cat.zoomies_timer = 300
                    play_sound('fart')
                
        elif event.type == pygame.MOUSEMOTION:
            cat.using_mouse = True
            
        elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            if not state['game_over'] and not state['paused']:
                cat.using_mouse = True
                play_sound('swat')
                proj = Projectile(cat.x + math.cos(cat.angle)*cat.hit_radius, cat.y + math.sin(cat.angle)*cat.hit_radius, cat.angle)
                projectiles.append(proj)
    
    if not state['game_over'] and not state['paused']:
        cat.update(keys, mouse_pos)
        
        for p in projectiles[:]:
            p.update()
            if p.life <= 0:
                projectiles.remove(p)
                continue
            
            # Check collision
            hit = False
            for pot in potatoes[:]:
                dist = math.hypot(pot.x - p.x, pot.y - p.y)
                if dist < pot.hit_radius + p.size:
                    hit = True
                    play_sound('purr')
                    for _ in range(10):
                        particles.append(Particle(pot.x, pot.y))
                    potatoes.remove(pot)
                    
                    if pot.is_large:
                        state['score'] += 10 * state['level']
                        for _ in range(3):
                            potatoes.append(Potato(pot.x, pot.y, False))
                    else:
                        state['score'] += 20 * state['level']
                        
                    state['swatted'] += 1
                    if state['swatted'] >= 10:
                        state['swatted'] = 0
                        state['food'] += 1
                        state['farts'] += 1
                        state['health'] = min(100, state['health'] + 5)
                        if state['health'] < 30:
                            play_sound('howl')
                        else:
                            play_sound('meow')
                    break
            if hit:
                projectiles.remove(p)
        
        for pot in potatoes:
            pot.update(cat)
            
        for p in particles[:]:
            p.update()
            if p.life <= 0:
                particles.remove(p)
                
        if state['potatoes_to_spawn'] > 0:
            spawn_timer -= 1
            if spawn_timer <= 0:
                spawn_potato()
                spawn_timer = max(60, spawn_rate - (state['level'] * 5))
                
        # Level progression
        state['timer'] -= 1
        if state['timer'] <= 0 or (state['potatoes_to_spawn'] <= 0 and len(potatoes) == 0):
            start_level(state['level'] + 1)
            
        # Ambient audio
        ambient_timer -= 1
        if ambient_timer <= 0:
            ambient_timer = random.uniform(300, 900)
            if state['health'] < 30:
                play_sound('howl')
            elif random.random() < 0.5:
                play_sound('meow')

    # Drawing
    if not state['game_over'] and not state['paused']:
        bg_offset_x -= cat.vx * 0.5
        bg_offset_y -= cat.vy * 0.5
        
    bw, bh = img_bg.get_width() or WIDTH, img_bg.get_height() or HEIGHT
    bg_offset_x %= bw
    bg_offset_y %= bh
    
    screen.fill((5, 5, 10))
    if img_bg.get_width() > 0:
        for x in range(int(bg_offset_x) - bw, WIDTH + bw, bw):
            for y in range(int(bg_offset_y) - bh, HEIGHT + bh, bh):
                screen.blit(img_bg, (x, y))

    for p in particles:
        p.draw(screen)
    for p in projectiles:
        p.draw(screen)
    for pot in potatoes:
        pot.draw(screen)
        
    if not state['game_over']:
        cat.draw(screen)
        
    draw_hud(screen)

    if state['paused']:
        overlay = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
        overlay.fill((0, 0, 0, 180))
        screen.blit(overlay, (0, 0))
        
        txt_p = font_large.render("PAUSED", True, (0, 240, 255))
        screen.blit(txt_p, (WIDTH // 2 - txt_p.get_width() // 2, HEIGHT // 2 - 100))
        txt_res = font_hud.render("Press ESC to Resume", True, (200, 200, 200))
        screen.blit(txt_res, (WIDTH // 2 - txt_res.get_width() // 2, HEIGHT // 2 + 20))
        txt_quit = font_hud.render("Press Q to Quit/Restart", True, (200, 200, 200))
        screen.blit(txt_quit, (WIDTH // 2 - txt_quit.get_width() // 2, HEIGHT // 2 + 60))

    if state['game_over']:
        overlay = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
        overlay.fill((0, 0, 0, 180))
        screen.blit(overlay, (0, 0))
        
        txt_go = font_large.render("GAME OVER", True, (255, 50, 100))
        screen.blit(txt_go, (WIDTH // 2 - txt_go.get_width() // 2, HEIGHT // 2 - 100))
        txt_restart = font_hud.render("Press SPACE or Click to Restart", True, (200, 200, 200))
        screen.blit(txt_restart, (WIDTH // 2 - txt_restart.get_width() // 2, HEIGHT // 2 + 20))
        if keys[pygame.K_SPACE] or (pygame.mouse.get_pressed()[0]):
            reset_game()

    pygame.display.flip()

pygame.quit()
