import { useEffect, useRef, useState, useCallback } from "react";
import { Volume2, VolumeX, RotateCcw, Trophy, Sparkles, WifiOff, ArrowLeft, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Web Audio sound synthesizer (zero external audio files needed, works 100% offline)
class SoundFX {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }
  init() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }
  jump() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(180, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(520, this.ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.13);
    } catch {}
  }
  score() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(now + 0.23);
    } catch {}
  }
  collect() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(659.25, now);
      osc.frequency.exponentialRampToValueAtTime(1318.5, now + 0.15);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(now + 0.17);
    } catch {}
  }
  hit() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.25);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(now + 0.26);
    } catch {}
  }
}

const sfx = new SoundFX();

const SOCRATIC_QUOTES = [
  "“The unexamined jump is not worth taking.”",
  "“Wisdom begins in wonder — and quick reflexes!”",
  "“I know that I know nothing, but I know when to jump.”",
  "“Falling down is not failure. Failure is staying down.”",
  "“To know thyself is the beginning of high scores.”",
  "“Be as you wish to seem: swift and unstoppable.”",
];

// Physical Dimensions of Socrates
const STAND_HEIGHT = 50;
const STAND_WIDTH = 32;
const DUCK_HEIGHT = 26;
const DUCK_WIDTH = 44;

export default function SocratesRunner({ className, standalone = false, onBack }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const [gameState, setGameState] = useState("idle"); // 'idle' | 'running' | 'gameover'
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    try {
      return parseInt(localStorage.getItem("socrates-runner-high-score") || "0", 10) || 0;
    } catch {
      return 0;
    }
  });
  const [muted, setMuted] = useState(false);
  const [quote, setQuote] = useState(SOCRATIC_QUOTES[0]);

  // Touch gesture tracking for mobile swipe-to-duck and tap-to-jump
  const touchStartY = useRef(null);
  const touchStartX = useRef(null);
  const isTouchDucking = useRef(false);

  // Game internal mutable state
  const stateRef = useRef({
    gameState: "idle",
    score: 0,
    highScore: 0,
    distance: 0,
    speed: 6.5,
    lastObstacleDist: 0,
    lastOwlDist: 0,
    lastLaurelDist: 0,
    nextObstacleGap: 300,
    groundY: 196,
    canvasWidth: 800,
    canvasHeight: 240,

    // Player Socrates
    player: {
      x: 70,
      y: 196 - STAND_HEIGHT,
      w: STAND_WIDTH,
      h: STAND_HEIGHT,
      vy: 0,
      isGrounded: true,
      isDucking: false,
      runFrame: 0,
      runTimer: 0,
    },

    // Obstacles: columns, owls
    obstacles: [],
    // Collectibles: golden laurels
    laurels: [],
    // Particles (dust, sparks)
    particles: [],
    // Clouds in background
    clouds: [
      { x: 120, y: 35, s: 0.6, w: 60 },
      { x: 380, y: 22, s: 0.4, w: 75 },
      { x: 650, y: 45, s: 0.5, w: 50 },
    ],
    // Distant Greek Temples / Parthenon
    temples: [
      { x: 50, y: 110, w: 100 },
      { x: 420, y: 115, w: 85 },
      { x: 740, y: 105, w: 120 },
    ],
    // Ground stones texture offset
    groundOffset: 0,
  });

  // Sync high score to ref
  useEffect(() => {
    stateRef.current.highScore = highScore;
  }, [highScore]);

  // Toggle sound
  const toggleMute = () => {
    setMuted((m) => {
      sfx.muted = !m;
      return !m;
    });
  };

  // Restart game
  const restart = useCallback(() => {
    const s = stateRef.current;
    s.gameState = "running";
    s.score = 0;
    s.distance = 0;
    s.speed = 6.5;
    s.obstacles = [];
    s.laurels = [];
    s.particles = [];
    s.lastObstacleDist = 0;
    s.nextObstacleGap = 240;

    s.player.isDucking = false;
    s.player.isGrounded = true;
    s.player.y = s.groundY - STAND_HEIGHT;
    s.player.vy = 0;
    s.player.runFrame = 0;

    setGameState("running");
    setScore(0);
    sfx.jump();
  }, []);

  // Jump action
  const jump = useCallback(() => {
    const s = stateRef.current;
    if (s.gameState === "idle" || s.gameState === "gameover") {
      restart();
      return;
    }
    if (s.gameState === "running" && s.player.isGrounded) {
      // Release ducking stance if jumping
      s.player.isDucking = false;
      s.player.vy = -12.5;
      s.player.isGrounded = false;
      sfx.jump();

      // Spawn jump dust particles
      for (let i = 0; i < 4; i++) {
        s.particles.push({
          x: s.player.x + 10 + (Math.random() - 0.5) * 15,
          y: s.groundY - 2,
          vx: -(Math.random() * 2 + 1),
          vy: -(Math.random() * 1.5 + 0.5),
          life: 18,
          maxLife: 18,
          size: Math.random() * 3 + 2,
          color: "#a8b89a",
        });
      }
    }
  }, [restart]);

  // Duck action (anchors flush to the ground line or executes fast-dive from mid-air)
  const setDuck = useCallback((isDucking) => {
    const s = stateRef.current;
    if (s.gameState === "running") {
      s.player.isDucking = isDucking;
      if (isDucking) {
        if (s.player.isGrounded) {
          // Immediately anchor flush to the bottom ground line
          s.player.y = s.groundY - DUCK_HEIGHT;
        } else {
          // Fast dive straight down to the ground
          s.player.vy = Math.max(s.player.vy, 16);
        }
      } else {
        if (s.player.isGrounded) {
          // Return to upright stance on the ground
          s.player.y = s.groundY - STAND_HEIGHT;
        }
      }
    }
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        jump();
      } else if (e.code === "ArrowDown" || e.code === "KeyS") {
        e.preventDefault();
        setDuck(true);
      } else if (e.code === "KeyR" && stateRef.current.gameState === "gameover") {
        restart();
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === "ArrowDown" || e.code === "KeyS") {
        setDuck(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [jump, setDuck, restart]);

  // Main Canvas Game Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let animId;
    let lastTime = performance.now();

    const resize = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.floor(rect.width);
      const height = 240;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.scale(dpr, dpr);
      stateRef.current.canvasWidth = width;
      stateRef.current.canvasHeight = height;
      stateRef.current.groundY = height - 44;
      if (stateRef.current.player.isGrounded) {
        stateRef.current.player.y = stateRef.current.groundY - (stateRef.current.player.isDucking ? DUCK_HEIGHT : STAND_HEIGHT);
      }
    };

    resize();
    window.addEventListener("resize", resize);

    // Initial random quote
    setQuote(SOCRATIC_QUOTES[Math.floor(Math.random() * SOCRATIC_QUOTES.length)]);

    // Loop
    const loop = (now) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const s = stateRef.current;
      const W = s.canvasWidth;
      const H = s.canvasHeight;
      const GY = s.groundY;

      // 1. UPDATE STATE
      if (s.gameState === "running") {
        s.distance += s.speed;
        const currentScore = Math.floor(s.distance / 10);
        if (currentScore !== s.score) {
          s.score = currentScore;
          setScore(currentScore);
          // High score milestone sound every 100 points
          if (currentScore > 0 && currentScore % 100 === 0) {
            sfx.score();
          }
        }

        // Slowly increase speed
        if (s.speed < 13.5) {
          s.speed += dt * 0.08;
        }

        // Running animation
        s.player.runTimer += dt * 12;
        if (s.player.runTimer > 1) {
          s.player.runTimer = 0;
          s.player.runFrame = (s.player.runFrame + 1) % 4;

          // Running dust
          if (s.player.isGrounded && !s.player.isDucking && Math.random() < 0.6) {
            s.particles.push({
              x: s.player.x + 6,
              y: GY - 2,
              vx: -(Math.random() * 2 + 1),
              vy: -(Math.random() * 1),
              life: 14,
              maxLife: 14,
              size: Math.random() * 2.5 + 1.5,
              color: "#c2cfb8",
            });
          }
        }

        // Physics: Gravity & Jump
        const currentHeight = s.player.isDucking ? DUCK_HEIGHT : STAND_HEIGHT;
        if (!s.player.isGrounded) {
          s.player.vy += 32 * dt; // gravity
          s.player.y += s.player.vy;

          if (s.player.y >= GY - currentHeight) {
            s.player.y = GY - currentHeight;
            s.player.vy = 0;
            s.player.isGrounded = true;

            // Landing dust
            for (let i = 0; i < 3; i++) {
              s.particles.push({
                x: s.player.x + 12 + (Math.random() - 0.5) * 12,
                y: GY - 2,
                vx: (Math.random() - 0.5) * 2,
                vy: -(Math.random() * 1.5),
                life: 12,
                maxLife: 12,
                size: Math.random() * 2.5 + 1.5,
                color: "#a8b89a",
              });
            }
          }
        } else {
          // Strictly anchor to the ground line based on current stance height
          s.player.y = GY - currentHeight;
          s.player.vy = 0;

          // Continuous skid dust while sliding flush along the ground
          if (s.player.isDucking && Math.random() < 0.7) {
            s.particles.push({
              x: s.player.x + 36 + (Math.random() - 0.5) * 8,
              y: GY - 2,
              vx: -(s.speed * 0.4 + Math.random() * 2),
              vy: -(Math.random() * 1.2 + 0.3),
              life: 14,
              maxLife: 14,
              size: Math.random() * 2.5 + 1.5,
              color: "#b4c3aa",
            });
          }
        }

        // Ground scroll
        s.groundOffset = (s.groundOffset + s.speed) % 40;

        // Background temples & clouds scroll (parallax)
        for (const t of s.temples) {
          t.x -= s.speed * 0.25;
          if (t.x + t.w < -20) t.x = W + Math.random() * 100;
        }
        for (const c of s.clouds) {
          c.x -= s.speed * 0.12 * c.s;
          if (c.x + c.w < -30) {
            c.x = W + Math.random() * 80;
            c.y = Math.random() * 45 + 15;
          }
        }

        // Spawn Obstacles (Greek Pillars & Owls)
        s.lastObstacleDist += s.speed;
        if (s.lastObstacleDist >= s.nextObstacleGap) {
          s.lastObstacleDist = 0;
          s.nextObstacleGap = Math.random() * 180 + 260 - Math.min(s.speed * 8, 80);

          // Owls start appearing after score 90
          const allowOwls = s.score > 90 && Math.random() < 0.38;
          if (allowOwls) {
            // Owl flight height types:
            // "mid": flies at chest level (must duck! ducks glide cleanly underneath)
            // "high": flies overhead (standing clears safely; jumping hits it)
            // "low": flies low along ground (must jump)
            const owlRand = Math.random();
            let owlY = GY - 52;
            let owlType = "mid";

            if (owlRand < 0.55) {
              // MID: Must duck to dodge!
              owlY = GY - 52;
              owlType = "mid";
            } else if (owlRand < 0.82) {
              // HIGH: Overhead trap for jumping players
              owlY = GY - 74;
              owlType = "high";
            } else {
              // LOW: Low skimmer (must jump over)
              owlY = GY - 30;
              owlType = "low";
            }

            s.obstacles.push({
              type: "owl",
              x: W + 20,
              y: owlY,
              w: 32,
              h: 18,
              wingState: 0,
              wingTimer: 0,
              owlType,
            });
          } else {
            // Greek Columns
            const colType = Math.random();
            let cw = 20;
            let ch = 40;
            let label = "Doric";

            if (colType < 0.4) {
              cw = 18;
              ch = 36;
            } else if (colType < 0.75) {
              cw = 24;
              ch = 50;
            } else {
              // Double pillars
              cw = 42;
              ch = 42;
              label = "Double";
            }

            s.obstacles.push({
              type: "column",
              x: W + 20,
              y: GY - ch,
              w: cw,
              h: ch,
              label,
            });
          }

          // Chance to spawn a Golden Laurel wreath above an obstacle
          if (Math.random() < 0.45) {
            s.laurels.push({
              x: W + 120 + Math.random() * 80,
              y: GY - 75 - Math.random() * 25,
              size: 20,
              collected: false,
              pulse: 0,
            });
          }
        }

        // Update Obstacles
        for (let i = s.obstacles.length - 1; i >= 0; i--) {
          const obs = s.obstacles[i];
          obs.x -= s.speed;

          if (obs.type === "owl") {
            obs.wingTimer += dt * 12;
            if (obs.wingTimer > 1) {
              obs.wingTimer = 0;
              obs.wingState = (obs.wingState + 1) % 2;
            }
          }

          // Collision detection with player
          const currentH = s.player.isDucking ? DUCK_HEIGHT : STAND_HEIGHT;
          const currentW = s.player.isDucking ? DUCK_WIDTH : STAND_WIDTH;
          const playerX = s.player.x + 4;
          const playerY = s.player.y;
          const playerW = currentW - 6;
          const playerH = currentH;

          // Bounding box overlap test with 3px forgiving padding
          const pad = 3;
          const collides =
            playerX + pad < obs.x + obs.w &&
            playerX + playerW - pad > obs.x &&
            playerY + pad < obs.y + obs.h &&
            playerY + playerH - pad > obs.y;

          if (collides) {
            s.gameState = "gameover";
            setGameState("gameover");
            sfx.hit();

            // Save High Score
            if (s.score > s.highScore) {
              s.highScore = s.score;
              setHighScore(s.score);
              try {
                localStorage.setItem("socrates-runner-high-score", s.score.toString());
              } catch {}
            }

            setQuote(SOCRATIC_QUOTES[Math.floor(Math.random() * SOCRATIC_QUOTES.length)]);
            break;
          }

          if (obs.x + obs.w < -30) {
            s.obstacles.splice(i, 1);
          }
        }

        // Update Laurels
        for (let i = s.laurels.length - 1; i >= 0; i--) {
          const lau = s.laurels[i];
          lau.x -= s.speed;
          lau.pulse += dt * 5;

          // Pickup check
          const px = s.player.x + 16;
          const py = s.player.y + 25;
          const dist = Math.hypot(px - lau.x, py - lau.y);
          if (dist < 32 && !lau.collected) {
            lau.collected = true;
            s.distance += 500; // +50 pts bonus!
            sfx.collect();

            // Golden sparkle explosion
            for (let p = 0; p < 8; p++) {
              const ang = Math.random() * Math.PI * 2;
              const spd = Math.random() * 3 + 1.5;
              s.particles.push({
                x: lau.x,
                y: lau.y,
                vx: Math.cos(ang) * spd,
                vy: Math.sin(ang) * spd,
                life: 20,
                maxLife: 20,
                size: Math.random() * 3 + 2,
                color: "#e8c68c",
              });
            }
          }

          if (lau.x < -30 || lau.collected) {
            s.laurels.splice(i, 1);
          }
        }

        // Update particles
        for (let i = s.particles.length - 1; i >= 0; i--) {
          const pt = s.particles[i];
          pt.x += pt.vx;
          pt.y += pt.vy;
          pt.life -= 1;
          if (pt.life <= 0) s.particles.splice(i, 1);
        }
      }

      // 2. RENDER SCENE
      ctx.clearRect(0, 0, W, H);

      // Background Sky subtle gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, GY);
      skyGrad.addColorStop(0, "#f8f7f3");
      skyGrad.addColorStop(1, "#f1efe8");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, GY);

      // Distant Greek Temples
      ctx.fillStyle = "#e3decb";
      for (const t of s.temples) {
        // Pediment (triangle)
        ctx.beginPath();
        ctx.moveTo(t.x, t.y);
        ctx.lineTo(t.x + t.w / 2, t.y - 18);
        ctx.lineTo(t.x + t.w, t.y);
        ctx.closePath();
        ctx.fill();

        // Architrave beam
        ctx.fillRect(t.x, t.y, t.w, 4);

        // Columns
        const numCols = 5;
        const colW = 5;
        const step = (t.w - colW) / (numCols - 1);
        for (let i = 0; i < numCols; i++) {
          ctx.fillRect(t.x + i * step, t.y + 4, colW, GY - t.y - 4);
        }
      }

      // Clouds
      ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
      for (const c of s.clouds) {
        ctx.beginPath();
        ctx.arc(c.x, c.y, 14 * c.s, 0, Math.PI * 2);
        ctx.arc(c.x + 12 * c.s, c.y - 4 * c.s, 16 * c.s, 0, Math.PI * 2);
        ctx.arc(c.x + 28 * c.s, c.y, 12 * c.s, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
      }

      // Ground Base
      ctx.fillStyle = "#e7e5dd";
      ctx.fillRect(0, GY, W, H - GY);

      // Ground Line
      ctx.strokeStyle = "#243b35";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, GY);
      ctx.lineTo(W, GY);
      ctx.stroke();

      // Cobblestone dashes on ground
      ctx.strokeStyle = "#a8b89a";
      ctx.lineWidth = 1.5;
      for (let x = -s.groundOffset; x < W; x += 35) {
        ctx.beginPath();
        ctx.moveTo(x, GY + 6);
        ctx.lineTo(x + 14, GY + 6);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x + 18, GY + 14);
        ctx.lineTo(x + 30, GY + 14);
        ctx.stroke();
      }

      // Draw Collectible Laurels
      for (const lau of s.laurels) {
        ctx.save();
        ctx.translate(lau.x, lau.y);
        const sPulse = 1 + Math.sin(lau.pulse) * 0.12;
        ctx.scale(sPulse, sPulse);

        // Golden glow
        ctx.fillStyle = "rgba(216, 185, 130, 0.35)";
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();

        // Wreath ring
        ctx.strokeStyle = "#c89a3c";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 1.85);
        ctx.stroke();

        // Little leaves
        ctx.fillStyle = "#e5b95a";
        for (let a = 0; a < Math.PI * 1.8; a += 0.8) {
          const lx = Math.cos(a) * 9;
          const ly = Math.sin(a) * 9;
          ctx.beginPath();
          ctx.ellipse(lx, ly, 3, 1.5, a, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      // Draw Obstacles (Doric Columns & Owls)
      for (const obs of s.obstacles) {
        if (obs.type === "column") {
          // Column capital (top wider slab)
          ctx.fillStyle = "#243b35";
          ctx.fillRect(obs.x - 2, obs.y, obs.w + 4, 6);
          // Shaft fluting
          ctx.fillRect(obs.x, obs.y + 6, obs.w, obs.h - 10);
          // Column base (bottom wider slab)
          ctx.fillRect(obs.x - 2, obs.y + obs.h - 4, obs.w + 4, 4);

          // Internal vertical fluting lines
          ctx.strokeStyle = "#35574f";
          ctx.lineWidth = 1;
          for (let fx = obs.x + 4; fx < obs.x + obs.w; fx += 5) {
            ctx.beginPath();
            ctx.moveTo(fx, obs.y + 8);
            ctx.lineTo(fx, obs.y + obs.h - 6);
            ctx.stroke();
          }
        } else if (obs.type === "owl") {
          // Athenian Owl flying
          ctx.save();
          ctx.translate(obs.x, obs.y);

          // Body
          ctx.fillStyle = "#243b35";
          ctx.beginPath();
          ctx.ellipse(14, 10, 10, 7, 0, 0, Math.PI * 2);
          ctx.fill();

          // Big golden owl eyes
          ctx.fillStyle = "#d8b982";
          ctx.beginPath();
          ctx.arc(6, 8, 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#121417";
          ctx.beginPath();
          ctx.arc(5.5, 8, 1.5, 0, Math.PI * 2);
          ctx.fill();

          // Beak
          ctx.fillStyle = "#e5b95a";
          ctx.beginPath();
          ctx.moveTo(2, 9);
          ctx.lineTo(0, 11);
          ctx.lineTo(3, 12);
          ctx.closePath();
          ctx.fill();

          // Wing animation (flapping up/down)
          ctx.fillStyle = "#1e322d";
          ctx.beginPath();
          if (obs.wingState === 0) {
            // Wing up
            ctx.moveTo(10, 8);
            ctx.lineTo(20, 0);
            ctx.lineTo(16, 12);
          } else {
            // Wing down
            ctx.moveTo(10, 8);
            ctx.lineTo(18, 18);
            ctx.lineTo(16, 12);
          }
          ctx.closePath();
          ctx.fill();

          ctx.restore();
        }
      }

      // Draw Particles
      for (const pt of s.particles) {
        ctx.fillStyle = pt.color;
        ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      // Draw Socrates (Player)
      const p = s.player;
      ctx.save();
      ctx.translate(p.x, p.y);

      if (p.isDucking) {
        // Ducking / sliding Socrates (anchored directly flush to ground line at y = 26)

        // Ground skid shadow / contact line
        ctx.fillStyle = "rgba(36, 59, 53, 0.28)";
        ctx.fillRect(6, 24.5, 36, 1.5);

        // Head lower & forward
        ctx.fillStyle = "#243b35";
        ctx.beginPath();
        ctx.arc(13, 11, 7.5, 0, Math.PI * 2);
        ctx.fill();

        // Socrates Beard
        ctx.fillStyle = "#243b35";
        ctx.beginPath();
        ctx.moveTo(8, 12);
        ctx.lineTo(3, 18);
        ctx.lineTo(13, 16);
        ctx.closePath();
        ctx.fill();

        // Golden Laurel wreath on head
        ctx.strokeStyle = "#d8b982";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(13, 7, 5.5, Math.PI * 0.8, Math.PI * 1.8);
        ctx.stroke();

        // Eye glint
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(9, 10, 1.2, 0, Math.PI * 2);
        ctx.fill();

        // Horizontal Toga body (sliding forward)
        ctx.fillStyle = "#28765a";
        ctx.beginPath();
        ctx.roundRect(8, 12, 30, 13, [4, 4, 3, 3]);
        ctx.fill();

        // Golden toga sash
        ctx.strokeStyle = "#d8b982";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(10, 14);
        ctx.lineTo(28, 24);
        ctx.stroke();

        // Rear sliding foot / sandal (touching ground line at y = 26)
        ctx.fillStyle = "#243b35";
        ctx.fillRect(34, 21, 9, 5); // bottom is 21 + 5 = 26 (touching ground line GY)
        ctx.fillStyle = "#d8b982";
        ctx.fillRect(36, 21, 2, 2); // sandal strap
      } else {
        // Upright running Socrates
        // Head
        ctx.fillStyle = "#243b35";
        ctx.beginPath();
        ctx.arc(18, 12, 10, 0, Math.PI * 2);
        ctx.fill();

        // Socrates Beard
        ctx.fillStyle = "#243b35";
        ctx.beginPath();
        ctx.moveTo(10, 16);
        ctx.lineTo(6, 26);
        ctx.lineTo(16, 22);
        ctx.closePath();
        ctx.fill();

        // Golden Laurel wreath
        ctx.strokeStyle = "#d8b982";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(18, 7, 7, Math.PI * 0.8, Math.PI * 1.8);
        ctx.stroke();

        // Eye glint
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(12, 11, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Flowing Toga Body
        ctx.fillStyle = "#28765a";
        ctx.beginPath();
        ctx.roundRect(8, 22, 20, 20, [4, 4, 6, 6]);
        ctx.fill();

        // Toga drape sash (cream gold)
        ctx.strokeStyle = "#d8b982";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(9, 23);
        ctx.lineTo(26, 38);
        ctx.stroke();

        // Running Legs Animation
        ctx.strokeStyle = "#243b35";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";

        const frame = p.isGrounded ? p.runFrame : 1;
        if (frame === 0) {
          // Left forward, right back
          ctx.beginPath();
          ctx.moveTo(13, 40);
          ctx.lineTo(8, 49);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(21, 40);
          ctx.lineTo(28, 48);
          ctx.stroke();
        } else if (frame === 1) {
          // Mid jump / passing
          ctx.beginPath();
          ctx.moveTo(14, 40);
          ctx.lineTo(12, 49);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(20, 40);
          ctx.lineTo(22, 48);
          ctx.stroke();
        } else if (frame === 2) {
          // Left back, right forward
          ctx.beginPath();
          ctx.moveTo(13, 40);
          ctx.lineTo(22, 49);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(21, 40);
          ctx.lineTo(10, 48);
          ctx.stroke();
        } else {
          // Both aligned
          ctx.beginPath();
          ctx.moveTo(14, 40);
          ctx.lineTo(15, 49);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(20, 40);
          ctx.lineTo(19, 49);
          ctx.stroke();
        }
      }

      ctx.restore();

      // Render HUD Score directly on canvas for ultra-crisp arcade look
      ctx.textAlign = "right";
      ctx.font = "bold 15px 'Plus Jakarta Sans', monospace";
      ctx.fillStyle = "#737a78";
      const padScore = (n) => n.toString().padStart(5, "0");

      if (s.highScore > 0) {
        ctx.fillText(`HI  ${padScore(s.highScore)}   ${padScore(s.score)}`, W - 16, 26);
      } else {
        ctx.fillText(padScore(s.score), W - 16, 26);
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  // Touch gesture handlers for mobile devices
  const handleTouchStart = (e) => {
    if (e.touches && e.touches[0]) {
      touchStartY.current = e.touches[0].clientY;
      touchStartX.current = e.touches[0].clientX;
      isTouchDucking.current = false;
    }
  };

  const handleTouchMove = (e) => {
    if (touchStartY.current !== null && e.touches && e.touches[0]) {
      const deltaY = e.touches[0].clientY - touchStartY.current;
      if (deltaY > 18) {
        // Swiping down -> Duck & Slide!
        if (!isTouchDucking.current) {
          isTouchDucking.current = true;
          setDuck(true);
        }
      } else if (deltaY < -18) {
        // Swiping up -> Jump!
        if (isTouchDucking.current) {
          isTouchDucking.current = false;
          setDuck(false);
        }
        jump();
      }
    }
  };

  const handleTouchEnd = () => {
    if (isTouchDucking.current) {
      setDuck(false);
      isTouchDucking.current = false;
    } else if (touchStartY.current !== null) {
      // Direct tap -> Jump / Restart
      jump();
    }
    touchStartY.current = null;
    touchStartX.current = null;
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full max-w-3xl overflow-hidden rounded-3xl border border-line bg-ivory shadow-card select-none",
        className
      )}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.code === "Space") e.preventDefault();
      }}
    >
      {/* Top Bar with Controls */}
      <div className="flex items-center justify-between border-b border-line/70 bg-white/60 px-4 py-2.5 backdrop-blur">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-grey hover:bg-black/5 hover:text-forest"
            >
              <ArrowLeft size={14} /> Back
            </button>
          )}
          <span className="flex items-center gap-1.5 font-display text-sm font-bold text-forest">
            <Sparkles size={16} className="text-brand" /> Socrates Runner
          </span>
          <span className="hidden sm:inline-block rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">
            Offline Mode
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-xs font-bold text-grey">
            <Trophy size={14} className="text-gold" />
            <span>HI: {highScore}</span>
          </div>

          <button
            onClick={toggleMute}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-grey hover:bg-black/5 hover:text-forest"
            aria-label={muted ? "Unmute audio" : "Mute audio"}
            title={muted ? "Unmute sound" : "Mute sound"}
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>
      </div>

      {/* Main Canvas Viewport */}
      <div
        className="relative h-[240px] w-full cursor-pointer touch-none"
        onClick={jump}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <canvas ref={canvasRef} className="block h-full w-full" />

        {/* Start Overlay */}
        {gameState === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/10 backdrop-blur-[1px] p-4 text-center">
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-md text-brand animate-bounce">
              <Sparkles size={22} />
            </div>
            <h3 className="font-display text-lg font-extrabold text-forest">
              <span className="hidden sm:inline">Press Spacebar to Play!</span>
              <span className="inline sm:hidden">Tap Screen to Play!</span>
            </h3>
            <p className="mt-1 text-xs text-grey max-w-xs">
              <span className="hidden sm:inline">Jump over pillars, duck under Athenian owls, and collect golden laurels.</span>
              <span className="inline sm:hidden">Tap to jump, swipe down to duck, and collect golden laurels!</span>
            </p>
            <div className="mt-3 flex items-center gap-2">
              <Button size="sm" onClick={(e) => { e.stopPropagation(); restart(); }}>
                <span className="hidden sm:inline">Start Game</span>
                <span className="inline sm:hidden">Tap to Play</span>
              </Button>
            </div>
          </div>
        )}

        {/* Game Over Overlay */}
        {gameState === "gameover" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/25 backdrop-blur-[2px] p-4 text-center animate-in fade-in zoom-in-95 duration-200">
            <p className="text-xs font-extrabold tracking-widest uppercase text-white/90">GAME OVER</p>
            <h3 className="font-display text-2xl font-black text-white mt-0.5">
              Score: {score}
            </h3>
            {score >= highScore && score > 0 && (
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-gold px-2.5 py-0.5 text-xs font-bold text-forest">
                <Trophy size={12} /> New High Score!
              </span>
            )}
            <p className="mt-2 text-xs italic text-white/80 max-w-sm">
              {quote}
            </p>
            <Button
              className="mt-3 gap-1.5 bg-white text-forest hover:bg-white/90 shadow-lg"
              size="sm"
              onClick={(e) => { e.stopPropagation(); restart(); }}
            >
              <RotateCcw size={14} /> Try Again
            </Button>
          </div>
        )}
      </div>

      {/* Control Instruction Hint Bar - Device Responsive */}
      <div className="flex items-center justify-between border-t border-line/70 bg-white/80 px-4 py-2 text-xs text-grey">
        {/* Desktop View: Keyboard Controls */}
        <div className="hidden sm:flex items-center gap-3">
          <span>
            <kbd className="rounded border border-line bg-ivory px-1.5 py-0.5 font-mono text-[11px] font-bold text-forest">Space</kbd> or <kbd className="rounded border border-line bg-ivory px-1.5 py-0.5 font-mono text-[11px] font-bold text-forest">▲</kbd> Jump
          </span>
          <span>
            <kbd className="rounded border border-line bg-ivory px-1.5 py-0.5 font-mono text-[11px] font-bold text-forest">▼</kbd> Duck / Slide
          </span>
          <span>
            <kbd className="rounded border border-line bg-ivory px-1.5 py-0.5 font-mono text-[11px] font-bold text-forest">R</kbd> Restart
          </span>
        </div>

        {/* Mobile View: Touch Instructions & On-screen Action Controls */}
        <div className="flex sm:hidden flex-col w-full gap-2 py-0.5">
          <div className="flex items-center justify-center gap-2 text-center text-[11px] font-medium text-grey">
            <span>👆 Tap screen to jump</span>
            <span className="text-line">•</span>
            <span>Swipe down to duck</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-forest/10 active:bg-forest text-forest active:text-white font-bold text-xs border border-forest/20 active:scale-95 transition-all select-none shadow-sm"
              onTouchStart={(e) => { e.preventDefault(); jump(); }}
              onClick={jump}
            >
              <ArrowUp size={15} /> Jump
            </button>
            <button
              type="button"
              className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-forest/10 active:bg-forest text-forest active:text-white font-bold text-xs border border-forest/20 active:scale-95 transition-all select-none shadow-sm"
              onTouchStart={(e) => { e.preventDefault(); setDuck(true); }}
              onTouchEnd={(e) => { e.preventDefault(); setDuck(false); }}
              onMouseDown={() => setDuck(true)}
              onMouseUp={() => setDuck(false)}
              onMouseLeave={() => setDuck(false)}
            >
              <ArrowDown size={15} /> Duck / Slide
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}