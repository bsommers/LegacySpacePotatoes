// Audio Context Setup
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

function playTone(freq, type, duration, vol=0.1) {
  if(audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function playSwatSound() {
  playTone(800, 'sine', 0.1, 0.1);
  setTimeout(() => playTone(1200, 'square', 0.1, 0.05), 50);
}

function playExplosionSound() {
  playTone(100, 'sawtooth', 0.3, 0.2);
  setTimeout(() => playTone(50, 'square', 0.4, 0.2), 50);
}

function playMeowSound() {
  playTone(400, 'sine', 0.4, 0.1);
  setTimeout(() => playTone(600, 'sine', 0.3, 0.1), 100);
}

function playHowlSound() {
  playTone(200, 'sawtooth', 0.6, 0.2);
  setTimeout(() => playTone(150, 'sawtooth', 0.5, 0.2), 200);
}

function playFartSound() {
  playTone(80, 'sawtooth', 0.4, 0.3);
  setTimeout(() => playTone(50, 'sawtooth', 0.3, 0.2), 100);
}

function playPurrSound() {
  // A low frequency rumble that sounds like a purr
  playTone(40, 'sawtooth', 0.1, 0.2);
  setTimeout(() => playTone(45, 'sawtooth', 0.1, 0.2), 100);
  setTimeout(() => playTone(40, 'sawtooth', 0.1, 0.2), 200);
}

// Game Setup
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

let width, height;
function resize() {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
}
window.addEventListener('resize', resize);
resize();

// Assets
const images = {
  cat: new Image(),
  potato: new Image(),
  bg: new Image()
};
images.cat.src = '/cat.png';
images.potato.src = '/potato.png';
images.bg.src = '/space_bg.png';

// UI Elements
const healthFill = document.getElementById('health-bar-fill');
const scoreValue = document.getElementById('score-value');
const foodValue = document.getElementById('food-value');
const fartsValue = document.getElementById('farts-value');
const levelValue = document.getElementById('level-value');
const timerValue = document.getElementById('timer-value');
const gameOverScreen = document.getElementById('game-over-screen');
const pauseScreen = document.getElementById('pause-screen');
const finalScore = document.getElementById('final-score');
const finalFood = document.getElementById('final-food');
const finalLevel = document.getElementById('final-level');
const restartBtn = document.getElementById('restart-btn');

// Game State
let state = {
  health: 100,
  score: 0,
  swattedCount: 0,
  food: 0,
  farts: 0,
  level: 1,
  timer: 0, // frames
  potatoes_to_spawn: 0,
  gameOver: false,
  paused: false
};

// Input State
const keys = { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false, ' ': false, z: false, f: false, e: false };
const mouse = { x: width/2, y: height/2, isDown: false };
let usingMouse = true;

window.addEventListener('keydown', e => { 
  let k = e.key.toLowerCase();
  if(keys.hasOwnProperty(e.key)) keys[e.key] = true; 
  if(keys.hasOwnProperty(k)) keys[k] = true; 

  if(e.key === 'ArrowLeft' || e.key === 'ArrowRight' || k === 'a' || k === 'd') usingMouse = false;
  
  if (e.key === 'Escape') {
    if(!state.gameOver) {
      state.paused = !state.paused;
      pauseScreen.classList.toggle('hidden', !state.paused);
    }
  }
  
  if (k === 'q' && state.paused) {
    state.paused = false;
    pauseScreen.classList.add('hidden');
    state.health = 0; // force quit
    endGame();
  }

  if(e.key === ' ' && !state.paused) {
    if(state.gameOver) return;
    cat.swat();
  }
  
  if (k === 'f' && !state.paused) {
    if(state.gameOver) return;
    if(state.farts > 0) {
      state.farts--;
      playFartSound();
      let radius = Math.min(width, height) * 0.3; // 60% of min dimension
      for(let i=0; i<30; i++) particles.push(new Particle(cat.x, cat.y, '#00ff00'));
      for(let i=potatoes.length-1; i>=0; i--) {
        let p = potatoes[i];
        let d = Math.hypot(p.x - cat.x, p.y - cat.y);
        if(d < radius) {
          p.destroy(i);
        }
      }
      updateUI();
    }
  }
  
  if (k === 'e' && !state.paused) {
    if(state.gameOver) return;
    if(state.food > 0 && !cat.zoomiesActive) {
      state.food--;
      cat.zoomiesActive = true;
      cat.zoomiesTimer = 300; // 5 seconds
      playFartSound();
      updateUI();
    }
  }
});
window.addEventListener('keyup', e => { 
  let k = e.key.toLowerCase();
  if(keys.hasOwnProperty(e.key)) keys[e.key] = false; 
  if(keys.hasOwnProperty(k)) keys[k] = false;
});
window.addEventListener('mousemove', e => { 
  mouse.x = e.clientX; 
  mouse.y = e.clientY; 
  usingMouse = true;
});
window.addEventListener('mousedown', e => { 
  if(state.gameOver || state.paused) return;
  mouse.isDown = true; 
  usingMouse = true;
  cat.swat();
});
window.addEventListener('mouseup', e => { mouse.isDown = false; });

restartBtn.addEventListener('click', resetGame);

// Entities
const cat = {
  x: width / 2,
  y: height / 2,
  vx: 0,
  vy: 0,
  angle: 0,
  size: 60, // visual size
  hitRadius: 30, // collision radius
  speed: 0.3,
  friction: 0.98,
  swatting: false,
  swatTimer: 0,
  swatDuration: 15,
  
  // Shield logic
  shieldActive: false,
  shieldEnergy: 300, // 5 seconds * 60 fps
  shieldCooldown: 0,
  maxShieldEnergy: 300,
  
  // Zoomies logic
  zoomiesActive: false,
  zoomiesTimer: 0,
  
  update() {
    // Rotation
    if (usingMouse) {
      this.angle = Math.atan2(mouse.y - this.y, mouse.x - this.x);
    } else {
      if (keys.ArrowLeft || keys.a) this.angle -= 0.1;
      if (keys.ArrowRight || keys.d) this.angle += 0.1;
    }
    
    // Relative Thrust (Asteroids Style)
    let currentSpeed = this.zoomiesActive ? this.speed * 2 : this.speed;
    if (keys.w || keys.ArrowUp) {
      this.vx += Math.cos(this.angle) * currentSpeed;
      this.vy += Math.sin(this.angle) * currentSpeed;
    }
    if (keys.s || keys.ArrowDown) {
      this.vx -= Math.cos(this.angle) * currentSpeed * 0.5;
      this.vy -= Math.sin(this.angle) * currentSpeed * 0.5;
    }
    
    this.vx *= this.friction;
    this.vy *= this.friction;
    
    this.x += this.vx;
    this.y += this.vy;
    
    // Screen Wrap
    if (this.x < 0) this.x = width;
    if (this.x > width) this.x = 0;
    if (this.y < 0) this.y = height;
    if (this.y > height) this.y = 0;
    
    // Swat logic
    if (this.swatting) {
      this.swatTimer--;
      if (this.swatTimer <= 0) {
        this.swatting = false;
      }
    }
    
    // Shield Logic
    if (this.shieldCooldown > 0) {
      this.shieldCooldown--;
      this.shieldActive = false;
      // Rebuild energy slowly if cooldown is active but we want it to rebuild after 10s
      if (this.shieldCooldown === 0) {
        this.shieldEnergy = this.maxShieldEnergy;
      }
    } else {
      if (keys.z && this.shieldEnergy > 0) {
        this.shieldActive = true;
        this.shieldEnergy--;
        state.health -= (1 / 60); // 1% health per second
        updateUI();
        if (this.shieldEnergy <= 0) {
          this.shieldActive = false;
          this.shieldCooldown = 600; // 10 seconds cooldown
        }
      } else {
        this.shieldActive = false;
        if(keys.z && this.shieldEnergy <= 0) {
           this.shieldCooldown = 600; // force cooldown if let go at 0
        }
      }
    }
    
    // Zoomies Logic
    if (this.zoomiesActive) {
      this.zoomiesTimer--;
      if (this.zoomiesTimer % 30 === 0) {
        playFartSound();
        for(let i=0; i<5; i++) particles.push(new Particle(this.x, this.y, '#00ff00'));
      }
      if (this.zoomiesTimer <= 0) {
        this.zoomiesActive = false;
      }
    }
  },
  
  swat() {
    if (this.swatting) return;
    this.swatting = true;
    this.swatTimer = this.swatDuration;
    playSwatSound();
    
    // Spawn projectile
    projectiles.push(new Projectile(
      this.x + Math.cos(this.angle) * this.hitRadius, 
      this.y + Math.sin(this.angle) * this.hitRadius, 
      this.angle
    ));
  },
  
  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    
    // Draw Shield
    if (this.shieldActive) {
      let drawHitRadius = this.zoomiesActive ? this.hitRadius * 2 : this.hitRadius;
      ctx.beginPath();
      ctx.arc(0, 0, drawHitRadius + 15, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 255, 100, ${0.2 + (this.shieldEnergy/this.maxShieldEnergy)*0.3})`;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 255, 100, 0.8)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    
    ctx.rotate(this.angle);
    
    let drawSize = this.zoomiesActive ? this.size * 2 : this.size;
    let drawHitRadius = this.zoomiesActive ? this.hitRadius * 2 : this.hitRadius;
    
    // Zoomies Flashing
    if (this.zoomiesActive) {
      ctx.globalAlpha = (Math.sin(Date.now() / 50) + 1) / 2 * 0.5 + 0.5;
    }
    
    // Swat effect
    if (this.swatting) {
      ctx.beginPath();
      ctx.arc(drawSize/2, 0, 20, -1, 1);
      ctx.fillStyle = 'rgba(0, 240, 255, 0.5)';
      ctx.fill();
    }
    
    if (images.cat.complete && images.cat.naturalWidth > 0) {
      ctx.drawImage(images.cat, -drawSize/2, -drawSize/2, drawSize, drawSize);
    } else {
      ctx.fillStyle = 'orange';
      ctx.beginPath();
      ctx.arc(0, 0, drawHitRadius, 0, Math.PI*2);
      ctx.fill();
    }
    
    ctx.globalAlpha = 1.0;
    ctx.restore();
  }
};

let potatoes = [];
let particles = [];
let projectiles = [];

class Projectile {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * 15;
    this.vy = Math.sin(angle) * 15;
    this.angle = angle;
    this.size = 20;
    this.life = 100;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life--;
    
    // Check collisions with potatoes
    for (let i = potatoes.length - 1; i >= 0; i--) {
      let p = potatoes[i];
      let dx = p.x - this.x;
      let dy = p.y - this.y;
      let dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < p.hitRadius + this.size) {
        p.destroy(i);
        this.life = 0;
        break;
      }
    }
  }
  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(40, 0);
    ctx.lineTo(0, 10);
    ctx.fillStyle = 'rgba(0, 240, 255, 0.8)';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#00f0ff';
    ctx.fill();
    ctx.restore();
  }
}

class Potato {
  constructor(x, y, isLarge = true) {
    this.x = x;
    this.y = y;
    this.isLarge = isLarge;
    this.size = isLarge ? 80 : 40;
    this.hitRadius = this.size * 0.4;
    
    let angle = Math.random() * Math.PI * 2;
    // Lower aggressive speed based on requirements
    let speed = (Math.random() * 0.5 + 0.2) * (isLarge ? 1 : 1.2);
    // Slight difficulty modifier
    speed *= (1 + state.level * 0.1); 
    
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    
    this.angle = 0;
    this.rotSpeed = (Math.random() - 0.5) * 0.02;
  }
  
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.angle += this.rotSpeed;
    
    // Screen Wrap
    if (this.x < -this.size) this.x = width + this.size;
    if (this.x > width + this.size) this.x = -this.size;
    if (this.y < -this.size) this.y = height + this.size;
    if (this.y > height + this.size) this.y = -this.size;
    
    // Collision with cat
    let dx = this.x - cat.x;
    let dy = this.y - cat.y;
    let dist = Math.sqrt(dx*dx + dy*dy);
    let catHitRadius = cat.zoomiesActive ? cat.hitRadius * 2 : cat.hitRadius;
    
    if (cat.zoomiesActive && dist < this.hitRadius + catHitRadius) {
      // Plow through potatoes
      this.destroy(potatoes.indexOf(this));
    } else if (cat.shieldActive && dist < this.hitRadius + catHitRadius + 15) {
      // Bounce off shield
      let pushAngle = Math.atan2(dy, dx);
      this.vx = Math.cos(pushAngle) * 3;
      this.vy = Math.sin(pushAngle) * 3;
      // Slightly push cat back too to feel impacts
      cat.vx -= Math.cos(pushAngle) * 0.5;
      cat.vy -= Math.sin(pushAngle) * 0.5;
    } else if (!cat.shieldActive && !cat.zoomiesActive && dist < this.hitRadius + catHitRadius) {
      // Hit!
      state.health -= 10;
      playHowlSound(); // Hurt meow when hit
      updateUI();
      if (state.health <= 0) {
        endGame();
      }
      
      // Push back
      let pushAngle = Math.atan2(dy, dx);
      this.vx = Math.cos(pushAngle) * 3;
      this.vy = Math.sin(pushAngle) * 3;
      cat.vx = Math.cos(pushAngle + Math.PI) * 2;
      cat.vy = Math.sin(pushAngle + Math.PI) * 2;
    }
  }
  
  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    
    if (images.potato.complete && images.potato.naturalWidth > 0) {
      ctx.drawImage(images.potato, -this.size/2, -this.size/2, this.size, this.size);
    } else {
      ctx.fillStyle = '#6b5744';
      ctx.beginPath();
      ctx.arc(0, 0, this.hitRadius, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }
  
  destroy(index) {
    potatoes.splice(index, 1);
    playPurrSound(); // Purring when destroying potato
    
    // Create particles
    for (let i=0; i<10; i++) {
      particles.push(new Particle(this.x, this.y, '#ccc'));
    }
    
    if (this.isLarge) {
      state.score += 10 * state.level;
      // Spawn smaller potatoes
      for (let i=0; i<3; i++) {
        potatoes.push(new Potato(this.x, this.y, false));
      }
    } else {
      state.score += 20 * state.level;
    }
    
    state.swattedCount++;
    if (state.swattedCount >= 10) {
      state.swattedCount = 0;
      state.food++;
      state.farts++; // Earn a fart!
      if (state.health < 30) {
        playHowlSound();
      } else {
        playMeowSound();
      }
      
      // Heal a bit
      state.health = Math.min(100, state.health + 5);
    }
    updateUI();
  }
}

class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    let angle = Math.random() * Math.PI * 2;
    let speed = Math.random() * 3 + 1;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = 1.0;
    this.decay = Math.random() * 0.05 + 0.02;
    this.color = color;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life -= this.decay;
  }
  draw() {
    ctx.globalAlpha = this.life;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 2, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
  }
}

// Spawning and Level Logic
let spawnTimer = 0;
let spawnRate = 180; // frames - less aggressive base

function startLevel(l) {
  state.level = l;
  state.potatoes_to_spawn = 5 + l * 2;
  state.timer = (30 + l * 10) * 60; // frames
  potatoes = [];
  projectiles = [];
  particles = [];
  updateUI();
}

function spawnPotato() {
  let x, y;
  if (Math.random() < 0.5) {
    x = Math.random() < 0.5 ? -50 : width + 50;
    y = Math.random() * height;
  } else {
    x = Math.random() * width;
    y = Math.random() < 0.5 ? -50 : height + 50;
  }
  potatoes.push(new Potato(x, y, true));
  state.potatoes_to_spawn--;
}

// UI Updates
function updateUI() {
  healthFill.style.width = Math.max(0, state.health) + '%';
  if(state.health < 30) {
    healthFill.style.background = 'linear-gradient(90deg, #ff0055, #ff3300)';
  } else {
    healthFill.style.background = 'linear-gradient(90deg, #00f0ff, #0077ff)';
  }
  scoreValue.innerText = Math.floor(state.score);
  foodValue.innerText = state.food;
  if(fartsValue) fartsValue.innerText = state.farts;
  levelValue.innerText = state.level;
  
  let seconds = Math.max(0, Math.ceil(state.timer / 60));
  let mins = Math.floor(seconds / 60);
  let secs = seconds % 60;
  timerValue.innerText = `${mins}:${secs.toString().padStart(2, '0')}`;
}

function endGame() {
  state.gameOver = true;
  gameOverScreen.classList.remove('hidden');
  finalScore.innerText = Math.floor(state.score);
  finalFood.innerText = state.food;
  finalLevel.innerText = state.level;
}

function resetGame() {
  state.health = 100;
  state.score = 0;
  state.swattedCount = 0;
  state.food = 0;
  state.farts = 0;
  state.gameOver = false;
  state.paused = false;
  cat.x = width/2;
  cat.y = height/2;
  cat.vx = 0;
  cat.vy = 0;
  cat.shieldEnergy = cat.maxShieldEnergy;
  cat.shieldCooldown = 0;
  cat.zoomiesActive = false;
  cat.zoomiesTimer = 0;
  startLevel(1);
  gameOverScreen.classList.add('hidden');
  pauseScreen.classList.add('hidden');
}

// Draw Background (Tiling)
let bgOffset = {x: 0, y: 0};

function drawBackground() {
  if (images.bg.complete && images.bg.naturalWidth > 0) {
    // Parallax effect based on cat movement
    bgOffset.x -= cat.vx * 0.5;
    bgOffset.y -= cat.vy * 0.5;
    
    let bw = images.bg.width;
    let bh = images.bg.height;
    
    // Wrap offset
    if(bgOffset.x > 0) bgOffset.x -= bw;
    if(bgOffset.x < -bw) bgOffset.x += bw;
    if(bgOffset.y > 0) bgOffset.y -= bh;
    if(bgOffset.y < -bh) bgOffset.y += bh;
    
    // Draw tiled
    for(let x = bgOffset.x; x < width; x += bw) {
      for(let y = bgOffset.y; y < height; y += bh) {
        ctx.drawImage(images.bg, x, y);
      }
    }
  } else {
    ctx.fillStyle = '#05050a';
    ctx.fillRect(0, 0, width, height);
  }
}

// Random ambient cat sounds
let ambientTimer = 600;

// Main Loop
function loop() {
  requestAnimationFrame(loop);
  
  if (!state.gameOver && !state.paused) {
    cat.update();
    
    potatoes.forEach(p => p.update());
    
    projectiles.forEach(p => p.update());
    projectiles = projectiles.filter(p => p.life > 0);
    
    particles.forEach(p => p.update());
    particles = particles.filter(p => p.life > 0);
    
    // Level Spawning Logic
    if (state.potatoes_to_spawn > 0) {
      spawnTimer--;
      if (spawnTimer <= 0) {
        spawnPotato();
        // Spawns slightly faster at higher levels, but base is less aggressive
        spawnTimer = Math.max(60, spawnRate - (state.level * 5)); 
      }
    }
    
    // Timer and Level progression
    state.timer--;
    
    // Level completes if timer expires OR all potatoes cleared
    if (state.timer <= 0 || (state.potatoes_to_spawn <= 0 && potatoes.length === 0)) {
       startLevel(state.level + 1);
    }
    
    // Ambient sound
    ambientTimer--;
    if (ambientTimer <= 0) {
      ambientTimer = 300 + Math.random() * 600;
      if (state.health < 30) {
        playHowlSound();
      } else {
        if(Math.random() < 0.5) playMeowSound();
      }
    }
    
    // UI needs frequent updates for health drain and timer
    updateUI();
  }
  
  // Render
  drawBackground();
  
  particles.forEach(p => p.draw());
  projectiles.forEach(p => p.draw());
  potatoes.forEach(p => p.draw());
  
  if (!state.gameOver) {
    cat.draw();
  }
}

// Initialize
startLevel(1);
loop();
