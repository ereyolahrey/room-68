import React, { useEffect, useRef } from 'react';

const ROBOT_EMOJIS = ['🤖', '🦾', '🦿', '⚙️', '🔩', '🛸'];

function createRobot(canvas) {
  const side = Math.random() > 0.5 ? 'left' : 'right';
  return {
    emoji: ROBOT_EMOJIS[Math.floor(Math.random() * ROBOT_EMOJIS.length)],
    x: side === 'left' ? -60 : canvas.width + 60,
    y: canvas.height * (0.55 + Math.random() * 0.35),
    speed: (0.3 + Math.random() * 0.6) * (side === 'left' ? 1 : -1),
    size: 22 + Math.random() * 18,
    opacity: 0.08 + Math.random() * 0.12,
    bobPhase: Math.random() * Math.PI * 2,
    bobAmp: 2 + Math.random() * 4,
    bobSpeed: 0.02 + Math.random() * 0.02,
  };
}

function createParticle(canvas) {
  return {
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    size: 1 + Math.random() * 2,
    opacity: 0.05 + Math.random() * 0.15,
    speedY: -(0.1 + Math.random() * 0.3),
    speedX: (Math.random() - 0.5) * 0.2,
    hue: Math.random() > 0.5 ? 350 : 270, // red or purple
  };
}

export default function RobotBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    const robots = [];
    const particles = [];
    const MAX_ROBOTS = 6;
    const MAX_PARTICLES = 40;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    // Initial spawn
    for (let i = 0; i < 3; i++) robots.push(createRobot(canvas));
    for (let i = 0; i < MAX_PARTICLES; i++) particles.push(createParticle(canvas));

    let spawnTimer = 0;

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw particles
      particles.forEach((p, i) => {
        p.x += p.speedX;
        p.y += p.speedY;
        if (p.y < -10 || p.x < -10 || p.x > canvas.width + 10) {
          particles[i] = createParticle(canvas);
          particles[i].y = canvas.height + 10;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 70%, 60%, ${p.opacity})`;
        ctx.fill();
      });

      // Draw robots
      robots.forEach((r, i) => {
        r.x += r.speed;
        r.bobPhase += r.bobSpeed;
        const bobY = Math.sin(r.bobPhase) * r.bobAmp;

        ctx.globalAlpha = r.opacity;
        ctx.font = `${r.size}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(r.emoji, r.x, r.y + bobY);
        ctx.globalAlpha = 1;

        // Remove if off-screen
        if ((r.speed > 0 && r.x > canvas.width + 80) ||
            (r.speed < 0 && r.x < -80)) {
          robots[i] = createRobot(canvas);
        }
      });

      // Spawn new robots occasionally
      spawnTimer++;
      if (spawnTimer > 300 && robots.length < MAX_ROBOTS && Math.random() < 0.01) {
        robots.push(createRobot(canvas));
        spawnTimer = 0;
      }

      animId = requestAnimationFrame(animate);
    }

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="robot-bg-canvas"
      aria-hidden="true"
    />
  );
}
