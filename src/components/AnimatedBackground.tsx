'use client';

import React, { useEffect, useRef } from 'react';
import '@/styles/animated-background.css';

const AnimatedBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const image = new Image();

    // Set canvas to full window size
    function resizeCanvas() {
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    }

    resizeCanvas();

    let particles: Array<{
      x: number;
      y: number;
      size: number;
      color: string;
      speedX: number;
      speedY: number;
      history: Array<{x: number, y: number}>;
      lineWidth: number;
    }> = [];

    const numParticles = 200; // Number of particles
    const particleSpeed = 0.5; // Reduced particle speed for smoother animation
    const baseParticleSize = 2;
    const sizeVariation = 1;
    const baseOpacity = 0.5;
    const opacityVariation = 0.3;
    const lineLength = 150; // Line length
    const maxLineWidth = 1.5; // Max line width
    const minLineWidth = 0.5;
    const lineWidthVariation = 0.2;

    // Use your background.png image
    image.src = '/background.png';

    image.onload = () => {
      initializeParticles();
      animate();
    };

    function initializeParticles() {
      particles = []; // Clear existing particles
      for (let i = 0; i < numParticles; i++) {
        particles.push({
          x: Math.random() * (canvas?.width || 0),
          y: Math.random() * (canvas?.height || 0),
          size: baseParticleSize + Math.random() * sizeVariation,
          color: `rgba(0, 240, 255, ${baseOpacity + Math.random() * opacityVariation})`, // Cyber blue
          speedX: (Math.random() - 0.5) * particleSpeed,
          speedY: (Math.random() - 0.5) * particleSpeed,
          history: [], // Start with empty history
          lineWidth: Math.max(minLineWidth, Math.random() * maxLineWidth - lineWidthVariation),
        });

        // Initialize history with current position
        for (let j = 0; j < 10; j++) {
          particles[i].history.push({
            x: particles[i].x,
            y: particles[i].y
          });
        }
      }
    }

    function drawParticles() {
      if (!ctx) return;

      particles.forEach(particle => {
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = particle.color;
        ctx.fill();
        ctx.closePath();
      });
    }

    function updateParticles() {
      if (!canvas) return;

      particles.forEach(particle => {
        // Update position
        particle.x += particle.speedX;
        particle.y += particle.speedY;

        // Wrap around edges
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.x < 0) particle.x = canvas.width;
        if (particle.y > canvas.height) particle.y = 0;
        if (particle.y < 0) particle.y = canvas.height;

        // Store history
        particle.history.push({ x: particle.x, y: particle.y });
        if (particle.history.length > 10) { // Trail length
          particle.history.shift();
        }
      });
    }

    function drawLines() {
      if (!ctx) return;

      particles.forEach(particle => {
        if (particle.history.length < 2) return;

        for (let i = 0; i < particle.history.length - 1; i++) {
          const startPoint = particle.history[i];
          const endPoint = particle.history[i + 1];

          // Calculate distance
          const dx = endPoint.x - startPoint.x;
          const dy = endPoint.y - startPoint.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < lineLength) {
            // Calculate opacity based on position in history
            const opacity = 0.4 * (i / particle.history.length);

            ctx.beginPath();
            ctx.moveTo(startPoint.x, startPoint.y);
            ctx.lineTo(endPoint.x, endPoint.y);
            ctx.strokeStyle = particle.color;
            ctx.lineWidth = particle.lineWidth;
            ctx.globalAlpha = opacity;
            ctx.stroke();
            ctx.closePath();
          }
        }
      });

      ctx.globalAlpha = 1; // Reset global alpha
    }

    function connectNearbyParticles() {
      if (!ctx) return;

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < lineLength) {
            // Calculate opacity based on distance
            const opacity = 0.2 * (1 - distance / lineLength);

            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(0, 240, 255, ${opacity})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
            ctx.closePath();
          }
        }
      }
    }

    function animate() {
      if (!canvas || !ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw the background image
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

      // Add a semi-transparent overlay
      ctx.fillStyle = 'rgba(10, 14, 23, 0.4)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw particle effects
      drawLines();
      connectNearbyParticles();
      drawParticles();
      updateParticles();

      requestAnimationFrame(animate);
    }

    // Handle window resize
    window.addEventListener('resize', () => {
      resizeCanvas();
      initializeParticles();
    });

    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="animated-background-canvas"
    />
  );
};

export default AnimatedBackground;
