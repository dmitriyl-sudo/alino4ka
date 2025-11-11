// Global variables
let scene, camera, renderer, backgroundMesh, particleSystem, confettiSystem;
let isOpened = false;
let animationId;
let transitioned = false;
let scene2Canvas, scene2Ctx;
let clouds = [];
let raindrops = [];
let sun = null;
let animationMode = 'waves'; // 'waves', 'crying', 'happy', 'calm', 'clouds', 'love'
let particles = [];
let breathingPhase = 0;
let hearts = [];

// GLSL Shaders
const vertexShader = `
    varying vec2 vUv;
    varying vec3 vPosition;
    
    void main() {
        vUv = uv;
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const fragmentShader = `
    uniform float uTime;
    uniform vec2 uResolution;
    uniform float uIntensity;
    
    varying vec2 vUv;
    varying vec3 vPosition;
    
    // Noise function
    vec3 mod289(vec3 x) {
        return x - floor(x * (1.0 / 289.0)) * 289.0;
    }
    
    vec4 mod289(vec4 x) {
        return x - floor(x * (1.0 / 289.0)) * 289.0;
    }
    
    vec4 permute(vec4 x) {
        return mod289(((x*34.0)+1.0)*x);
    }
    
    vec4 taylorInvSqrt(vec4 r) {
        return 1.79284291400159 - 0.85373472095314 * r;
    }
    
    float snoise(vec3 v) {
        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
        
        vec3 i = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);
        
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);
        
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;
        
        i = mod289(i);
        vec4 p = permute(permute(permute(
                    i.z + vec4(0.0, i1.z, i2.z, 1.0))
                + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                + i.x + vec4(0.0, i1.x, i2.x, 1.0));
        
        float n_ = 0.142857142857;
        vec3 ns = n_ * D.wyz - D.xzx;
        
        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
        
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);
        
        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        
        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);
        
        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        
        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
        
        vec3 p0 = vec3(a0.xy, h.x);
        vec3 p1 = vec3(a0.zw, h.y);
        vec3 p2 = vec3(a1.xy, h.z);
        vec3 p3 = vec3(a1.zw, h.w);
        
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;
        
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }
    
    void main() {
        // Simple black background
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    }
`;

// Particle vertex shader
const particleVertexShader = `
    attribute float size;
    attribute vec3 customColor;
    
    varying vec3 vColor;
    
    void main() {
        vColor = customColor;
        
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
    }
`;

// Particle fragment shader for glowing spheres
const particleFragmentShader = `
    uniform float uTime;
    
    varying vec3 vColor;
    
    void main() {
        vec2 center = vec2(0.5, 0.5);
        float distanceToCenter = distance(gl_PointCoord, center);
        
        // Create smooth circular shape
        float circle = 1.0 - smoothstep(0.0, 0.5, distanceToCenter);
        
        // Add inner glow effect
        float innerGlow = 1.0 - smoothstep(0.0, 0.3, distanceToCenter);
        innerGlow = pow(innerGlow, 2.0);
        
        // Add outer glow
        float outerGlow = 1.0 - smoothstep(0.3, 0.5, distanceToCenter);
        outerGlow = pow(outerGlow, 0.5);
        
        // Combine all effects
        float alpha = circle * 0.8 + innerGlow * 0.6 + outerGlow * 0.3;
        
        // Add subtle sparkle effect
        float sparkle = sin(uTime * 8.0 + gl_FragCoord.x * 0.02 + gl_FragCoord.y * 0.02) * 0.2 + 0.8;
        alpha *= sparkle;
        
        // Ensure we don't render outside the circle
        if (distanceToCenter > 0.5) {
            discard;
        }
        
        gl_FragColor = vec4(vColor, alpha);
    }
`;

// Initialize the application
function init() {
    // Create scene
    scene = new THREE.Scene();
    
    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    document.getElementById('canvas-container').appendChild(renderer.domElement);
    
    // Create background with shader
    createBackground();
    
    // Create particle system
    createParticles();
    
    // Setup event listeners
    setupEventListeners();
    
    // Start animation loop
    animate();
    
    // Initial animations
    gsap.from(camera.position, {
        duration: 3,
        z: 10,
        ease: "power2.out"
    });
}

function createBackground() {
    const geometry = new THREE.PlaneGeometry(20, 20);
    const material = new THREE.ShaderMaterial({
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        uniforms: {
            uTime: { value: 0 },
            uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
            uIntensity: { value: 0.8 }
        }
    });
    
    backgroundMesh = new THREE.Mesh(geometry, material);
    backgroundMesh.position.z = -5;
    scene.add(backgroundMesh);
}

function createParticles() {
    const particleCount = 100;
    const geometry = new THREE.BufferGeometry();
    
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    
    // Bright colorful sphere colors
    const colorPalette = [
        new THREE.Color(0.6, 0.8, 1.0), // Light blue
        new THREE.Color(0.9, 0.4, 0.7), // Pink
        new THREE.Color(0.4, 0.9, 0.9), // Cyan
        new THREE.Color(1.0, 0.8, 0.4), // Gold
        new THREE.Color(0.8, 0.4, 1.0), // Purple
        new THREE.Color(0.4, 1.0, 0.6), // Green
    ];
    
    for (let i = 0; i < particleCount; i++) {
        // Random positions around the scene
        positions[i * 3] = (Math.random() - 0.5) * 20;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 10;
        
        // Random bright colors
        const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
        
        // Random sizes for variety
        sizes[i] = Math.random() * 3 + 2;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('customColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    const material = new THREE.ShaderMaterial({
        vertexShader: particleVertexShader,
        fragmentShader: particleFragmentShader,
        uniforms: {
            uTime: { value: 0 }
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
        alphaTest: 0.001
    });
    
    particleSystem = new THREE.Points(geometry, material);
    scene.add(particleSystem);
}

function createConfetti() {
    const confettiCount = 200;
    const geometry = new THREE.BufferGeometry();
    
    const positions = new Float32Array(confettiCount * 3);
    const colors = new Float32Array(confettiCount * 3);
    const sizes = new Float32Array(confettiCount);
    const velocities = new Float32Array(confettiCount * 3);
    
    const confettiColors = [
        new THREE.Color(1.0, 0.2, 0.4), // Red
        new THREE.Color(0.2, 1.0, 0.4), // Green
        new THREE.Color(0.2, 0.4, 1.0), // Blue
        new THREE.Color(1.0, 1.0, 0.2), // Yellow
        new THREE.Color(1.0, 0.4, 1.0), // Magenta
        new THREE.Color(0.4, 1.0, 1.0), // Cyan
    ];
    
    for (let i = 0; i < confettiCount; i++) {
        // Start from center
        positions[i * 3] = (Math.random() - 0.5) * 2;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 2;
        positions[i * 3 + 2] = 2;
        
        // Random velocities
        velocities[i * 3] = (Math.random() - 0.5) * 0.2;
        velocities[i * 3 + 1] = Math.random() * 0.3 + 0.1;
        velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.1;
        
        // Random colors
        const color = confettiColors[Math.floor(Math.random() * confettiColors.length)];
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
        
        // Random sizes
        sizes[i] = Math.random() * 4 + 2;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('customColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    const material = new THREE.ShaderMaterial({
        vertexShader: particleVertexShader,
        fragmentShader: particleFragmentShader,
        uniforms: {
            uTime: { value: 0 }
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
        alphaTest: 0.001
    });
    
    confettiSystem = new THREE.Points(geometry, material);
    confettiSystem.userData = { velocities: velocities };
    scene.add(confettiSystem);
    
    // Animate confetti
    gsap.to(confettiSystem.material.uniforms.uTime, {
        duration: 5,
        value: 100,
        ease: "none"
    });
    
    // Remove confetti after animation
    setTimeout(() => {
        scene.remove(confettiSystem);
        confettiSystem = null;
    }, 5000);
}

function setupEventListeners() {
    const openBtn = document.getElementById('open-btn');
    
    openBtn.addEventListener('click', () => {
        if (!isOpened && !transitioned) {
            startTransition();
            isOpened = true;
        }
    });
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize);
}

function openCard() {
    const openBtn = document.getElementById('open-btn');
    const title = document.querySelector('.main-title');
    
    // Immediately disable button to prevent multiple clicks
    openBtn.disabled = true;
    openBtn.style.pointerEvents = 'none';
    
    // Button animation - очень плавное уменьшение прозрачности
    gsap.to(openBtn, {
        duration: 3,
        opacity: 0,
        ease: "none",
        onComplete: () => {
            openBtn.style.display = 'none';
            openBtn.style.pointerEvents = 'none';
        }
    });
    
    // Title animation - очень плавное уменьшение прозрачности с задержкой
    gsap.to(title, {
        duration: 3,
        opacity: 0,
        ease: "none",
        delay: 0.5,
        onComplete: () => {
            title.style.display = 'none';
        }
    });
    
    // Camera animation
    gsap.to(camera.position, {
        duration: 2,
        z: 2,
        ease: "power2.inOut"
    });
    
    // Background intensity animation
    gsap.to(backgroundMesh.material.uniforms.uIntensity, {
        duration: 2,
        value: 1.5,
        ease: "power2.out"
    });
    
    // Particle animation
    gsap.to(particleSystem.rotation, {
        duration: 10,
        y: Math.PI * 2,
        ease: "none",
        repeat: -1
    });
    
    // Create confetti
    setTimeout(() => {
        createConfetti();
    }, 1000);
    
    // Add sparkle effects to DOM
    createDOMSparkles();
}

function createDOMSparkles() {
    for (let i = 0; i < 20; i++) {
        setTimeout(() => {
            const sparkle = document.createElement('div');
            sparkle.className = 'sparkle';
            sparkle.style.left = Math.random() * 100 + '%';
            sparkle.style.top = Math.random() * 100 + '%';
            document.body.appendChild(sparkle);
            
            setTimeout(() => {
                sparkle.remove();
            }, 3000);
        }, i * 200);
    }
}

function animate() {
    animationId = requestAnimationFrame(animate);
    
    const time = Date.now() * 0.001;
    
    // Update background shader
    if (backgroundMesh) {
        backgroundMesh.material.uniforms.uTime.value = time;
    }
    
    // Update particle system
    if (particleSystem) {
        particleSystem.material.uniforms.uTime.value = time;
        particleSystem.rotation.y += 0.002;
        
        // Animate particle positions with floating effect
        const positions = particleSystem.geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
            positions[i + 1] += Math.sin(time + positions[i]) * 0.002;
        }
        particleSystem.geometry.attributes.position.needsUpdate = true;
    }
    
    // Update confetti
    if (confettiSystem) {
        const positions = confettiSystem.geometry.attributes.position.array;
        const velocities = confettiSystem.userData.velocities;
        
        for (let i = 0; i < positions.length; i += 3) {
            positions[i] += velocities[i];
            positions[i + 1] += velocities[i + 1];
            positions[i + 2] += velocities[i + 2];
            
            // Apply gravity
            velocities[i + 1] -= 0.002;
        }
        confettiSystem.geometry.attributes.position.needsUpdate = true;
    }
    
    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    if (backgroundMesh) {
        backgroundMesh.material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    }
}

// Scene transition functions
function startTransition() {
    if (transitioned) return;
    transitioned = true;
    
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    if (prefersReducedMotion) {
        // Simple fade for reduced motion
        const tl = gsap.timeline();
        tl.to("#scene1", { opacity: 0, duration: 0.4 })
          .to("#scene2", { opacity: 1, filter: "blur(0px)", duration: 0.4 }, 0.2)
          .add(() => {
              document.getElementById("scene2").style.pointerEvents = "auto";
              cleanupScene1();
              animateScene2Text();
          });
    } else {
        // Full cinematic transition
        const tl = gsap.timeline({ defaults: { ease: "power2.inOut" } });
        tl.to("#scene1", { filter: "blur(10px)", opacity: 0, duration: 1.8 }, 0)
          .to("#scene2", { opacity: 1, filter: "blur(0px)", duration: 2.0 }, 0.4)
          .add(() => {
              document.getElementById("scene2").style.pointerEvents = "auto";
              cleanupScene1();
              setTimeout(animateScene2Text, 300);
          });
    }
    
    initScene2();
}

function cleanupScene1() {
    // Stop animation loop
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
    
    // Hide scene 1
    setTimeout(() => {
        document.getElementById("scene1").style.display = "none";
    }, 2000);
}

function initScene2() {
    // Initialize scene 2 canvas for wave effects
    scene2Canvas = document.getElementById('scene2-canvas');
    scene2Ctx = scene2Canvas.getContext('2d');
    
    // Set canvas size
    function resizeCanvas() {
        scene2Canvas.width = window.innerWidth;
        scene2Canvas.height = window.innerHeight;
    }
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Start wave animation
    animateWaves();
    
    // Add hover effects to text
    const title = document.querySelector('.scene2-title');
    title.addEventListener('mouseenter', createWaveEffect);
}

function animateScene2Text() {
    const title = document.querySelector('.scene2-title');
    const scene2 = document.getElementById('scene2');
    
    // First text is immediately visible (no animation)
    gsap.set(title, { opacity: 1, y: 0 });
    
    // After 3 seconds, start transition to second text
    setTimeout(() => {
        // Create timeline for text and background transition
        const tl = gsap.timeline();
        
        // Fade out first text
        tl.to(title, {
            opacity: 0,
            y: -20,
            duration: 1,
            ease: "power2.inOut"
        })
        // Change background color during transition
        .to(scene2, {
            background: "radial-gradient(circle at 50% 50%, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
            duration: 2,
            ease: "power2.inOut"
        }, 0.5)
        // Change text and fade in
        .add(() => {
            title.textContent = "Без тебя - тучки плачут";
            // Start crying clouds animation
            initCryingClouds();
        }, 1)
        .to(title, {
            opacity: 1,
            y: 0,
            duration: 1.2,
            ease: "power2.out"
        }, 1.2);
        
    }, 3000);
    
    // After 6 more seconds, transition to happy clouds
    setTimeout(() => {
        const tl2 = gsap.timeline();
        
        // Fade out second text
        tl2.to(title, {
            opacity: 0,
            y: -20,
            duration: 1,
            ease: "power2.inOut"
        })
        // Change background to brighter colors
        .to(scene2, {
            background: "radial-gradient(circle at 50% 50%, #87CEEB 0%, #98D8E8 50%, #B0E0E6 100%)",
            duration: 2,
            ease: "power2.inOut"
        }, 0.5)
        // Change text and fade in
        .add(() => {
            title.textContent = "А с тобой всё улыбается";
            // Start happy clouds animation
            initHappyClouds();
        }, 1)
        .to(title, {
            opacity: 1,
            y: 0,
            duration: 1.2,
            ease: "power2.out"
        }, 1.2);
        
    }, 9000);
    
    // Scene 4: Calm scene - "можно просто быть. этого — уже достаточно"
    setTimeout(() => {
        const tl3 = gsap.timeline();
        
        tl3.to(title, {
            opacity: 0,
            y: -20,
            duration: 1.5,
            ease: "power2.inOut"
        })
        .to(scene2, {
            background: "linear-gradient(to top, #a8c8d8 0%, #c2dae8 30%, #ddeef5 70%, #f0f8fc 100%)",
            duration: 3,
            ease: "power1.inOut"
        }, 0.8)
        .set(scene2, {
            filter: "blur(0px)"
        }, 0)
        .add(() => {
            title.textContent = "можно просто быть. этого — уже достаточно";
            initCalmScene();
        }, 1.5)
        .to(title, {
            opacity: 1,
            y: 0,
            duration: 2,
            ease: "power2.out"
        }, 2);
        
    }, 15000);
    
    // Scene 5: Clouds scene - "всё не так срочно, как кажется"
    setTimeout(() => {
        const tl4 = gsap.timeline();
        
        tl4.to(title, {
            opacity: 0,
            y: -20,
            duration: 1.5,
            ease: "power2.inOut"
        })
        .to(scene2, {
            background: "linear-gradient(to bottom, #f5f9fc 0%, #e8f4f9 30%, #d8ecf4 60%, #c8e0ef 100%)",
            duration: 2,
            ease: "power2.inOut"
        }, 0.5)
        .add(() => {
            title.textContent = "всё не так срочно, как кажется";
            initCloudsScene();
        }, 1.5)
        .to(title, {
            opacity: 1,
            y: 0,
            duration: 2,
            ease: "power2.out"
        }, 2);
        
    }, 23000);
    
    // Scene 6: Love scene - "Открой, когда тебе будет грустно. я тебя обожаю :))"
    setTimeout(() => {
        const tl5 = gsap.timeline();
        
        tl5.to(title, {
            opacity: 0,
            y: -20,
            duration: 1.5,
            ease: "power2.inOut"
        })
        .to(scene2, {
            background: "linear-gradient(135deg, #fff8e1 0%, #ffdcd2 40%, #f8b7c6 100%)",
            duration: 2,
            ease: "power2.inOut"
        }, 0.5)
        .add(() => {
            title.textContent = "Открой, когда тебе будет грустно. я тебя обожаю :))";
            title.style.fontFamily = "'Caveat', cursive";
            title.style.fontWeight = "400";
            initLoveScene();
        }, 1.5)
        .to(title, {
            opacity: 1,
            y: 0,
            duration: 2.5,
            ease: "power2.out"
        }, 2);
        
    }, 31000);
}

function animateWaves() {
    let time = 0;
    
    function draw() {
        scene2Ctx.clearRect(0, 0, scene2Canvas.width, scene2Canvas.height);
        
        if (animationMode === 'waves') {
            // Initial wave patterns
            const gradient = scene2Ctx.createRadialGradient(
                scene2Canvas.width / 2, scene2Canvas.height / 2, 0,
                scene2Canvas.width / 2, scene2Canvas.height / 2, scene2Canvas.width / 2
            );
            
            const blueIntensity = 0.1 + Math.sin(time * 0.005) * 0.05;
            const purpleIntensity = 0.05 + Math.sin(time * 0.007 + 1) * 0.03;
            
            gradient.addColorStop(0, `rgba(147, 197, 253, ${blueIntensity})`);
            gradient.addColorStop(0.5, `rgba(168, 85, 247, ${purpleIntensity})`);
            gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
            
            scene2Ctx.fillStyle = gradient;
            scene2Ctx.fillRect(0, 0, scene2Canvas.width, scene2Canvas.height);
            
            // Add floating particles
            for (let i = 0; i < 3; i++) {
                const x = scene2Canvas.width / 2 + Math.sin(time * 0.01 + i * 2) * 100;
                const y = scene2Canvas.height / 2 + Math.cos(time * 0.008 + i * 1.5) * 80;
                const radius = 2 + Math.sin(time * 0.02 + i) * 1;
                
                scene2Ctx.beginPath();
                scene2Ctx.arc(x, y, radius, 0, Math.PI * 2);
                scene2Ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + Math.sin(time * 0.015 + i) * 0.2})`;
                scene2Ctx.fill();
            }
        } else if (animationMode === 'crying') {
            // Draw crying clouds animation
            drawCryingClouds();
        } else if (animationMode === 'happy') {
            // Draw happy clouds with sun
            drawHappyClouds();
        } else if (animationMode === 'calm') {
            // Draw calm breathing scene
            drawCalmScene();
        } else if (animationMode === 'clouds') {
            // Draw soft clouds scene
            drawSoftClouds();
        } else if (animationMode === 'love') {
            // Draw love scene with warm particles
            drawLoveScene();
        }
        
        time++;
        requestAnimationFrame(draw);
    }
    
    draw();
}

function initCryingClouds() {
    // Create clouds
    clouds = [];
    raindrops = [];
    
    // Create 3 clouds at different positions
    for (let i = 0; i < 3; i++) {
        clouds.push({
            x: (scene2Canvas.width / 4) * (i + 1),
            y: scene2Canvas.height * 0.25,
            size: 60 + Math.random() * 40,
            offsetY: 0,
            phase: Math.random() * Math.PI * 2,
            tears: []
        });
    }
    
    animationMode = 'crying';
}

function initHappyClouds() {
    // Transform existing clouds to happy ones
    clouds.forEach(cloud => {
        cloud.happy = true;
    });
    
    // Clear raindrops
    raindrops = [];
    
    // Create sun
    sun = {
        x: scene2Canvas.width * 0.8,
        y: scene2Canvas.height * 0.2,
        size: 80,
        rays: [],
        glowPhase: 0
    };
    
    // Create sun rays
    for (let i = 0; i < 12; i++) {
        sun.rays.push({
            angle: (i * Math.PI * 2) / 12,
            length: 30 + Math.random() * 20,
            phase: Math.random() * Math.PI * 2
        });
    }
    
    animationMode = 'happy';
}

function initCalmScene() {
    particles = [];
    breathingPhase = 0;
    
    // Create ripple centers
    for (let i = 0; i < 3; i++) {
        particles.push({
            x: scene2Canvas.width * (0.3 + i * 0.2),
            y: scene2Canvas.height * (0.4 + Math.random() * 0.3),
            ripples: [],
            nextRipple: Math.random() * 3000,
            phase: Math.random() * Math.PI * 2
        });
    }
    
    // Create floating hearts for calm scene
    hearts = [];
    for (let i = 0; i < 5; i++) {
        hearts.push({
            x: Math.random() * scene2Canvas.width,
            y: Math.random() * scene2Canvas.height,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.2,
            size: 8 + Math.random() * 12,
            opacity: 0.15 + Math.random() * 0.2,
            phase: Math.random() * Math.PI * 2,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.02
        });
    }
    
    // Add text reflection data attribute
    const title = document.querySelector('.scene2-title');
    title.setAttribute('data-text', title.textContent);
    
    animationMode = 'calm';
}

function initCloudsScene() {
    particles = [];
    
    // Create Perlin noise-like color fields
    for (let i = 0; i < 6; i++) {
        particles.push({
            x: Math.random() * scene2Canvas.width,
            y: Math.random() * scene2Canvas.height,
            vx: (Math.random() - 0.5) * 0.2,
            vy: (Math.random() - 0.5) * 0.15,
            size: 80 + Math.random() * 120,
            opacity: 0.05 + Math.random() * 0.1,
            phase: Math.random() * Math.PI * 2,
            noiseOffset: Math.random() * 1000
        });
    }
    
    // Create floating hearts for clouds scene
    hearts = [];
    for (let i = 0; i < 6; i++) {
        hearts.push({
            x: Math.random() * scene2Canvas.width,
            y: Math.random() * scene2Canvas.height,
            vx: (Math.random() - 0.5) * 0.4,
            vy: (Math.random() - 0.5) * 0.3,
            size: 6 + Math.random() * 10,
            opacity: 0.2 + Math.random() * 0.25,
            phase: Math.random() * Math.PI * 2,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.03
        });
    }
    
    // Update text styling for cloud scene
    const title = document.querySelector('.scene2-title');
    title.style.textShadow = '0 0 15px rgba(0,0,0,0.8), 0 0 30px rgba(0,0,0,0.4), 0 0 8px rgba(197,227,250,0.6)';
    title.style.webkitTextStroke = '2px rgba(0,0,0,0.5)';
    title.style.filter = 'drop-shadow(0 0 10px rgba(0,0,0,0.8))';
    
    animationMode = 'clouds';
}

function initLoveScene() {
    particles = [];
    
    // Create bokeh light spots
    for (let i = 0; i < 8; i++) {
        particles.push({
            x: Math.random() * scene2Canvas.width,
            y: Math.random() * scene2Canvas.height,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.2,
            size: 20 + Math.random() * 60,
            opacity: 0.1 + Math.random() * 0.2,
            phase: Math.random() * Math.PI * 2,
            hue: 20 + Math.random() * 40, // Warm yellow to orange
            blur: 15 + Math.random() * 25
        });
    }
    
    // Create floating hearts for love scene
    hearts = [];
    for (let i = 0; i < 8; i++) {
        hearts.push({
            x: Math.random() * scene2Canvas.width,
            y: Math.random() * scene2Canvas.height,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.4,
            size: 10 + Math.random() * 16,
            opacity: 0.25 + Math.random() * 0.3,
            phase: Math.random() * Math.PI * 2,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.04,
            hue: 320 + Math.random() * 60 // Pink to peach range
        });
    }
    
    // Update text styling for love scene
    const title = document.querySelector('.scene2-title');
    title.style.textShadow = '0 0 15px rgba(0,0,0,0.9), 0 0 30px rgba(0,0,0,0.5), 0 0 8px rgba(255,180,160,0.7)';
    title.style.webkitTextStroke = '2px rgba(0,0,0,0.6)';
    title.style.color = 'rgba(255, 255, 255, 0.98)';
    title.style.filter = 'drop-shadow(0 0 12px rgba(0,0,0,0.8))';
    
    animationMode = 'love';
}

function drawCryingClouds() {
    const time = Date.now() * 0.001;
    
    // Update and draw clouds
    clouds.forEach((cloud, index) => {
        // Gentle floating motion
        cloud.offsetY = Math.sin(time * 0.5 + cloud.phase) * 10;
        
        // Draw cloud
        drawCloud(cloud.x, cloud.y + cloud.offsetY, cloud.size);
        
        // Create teardrops randomly
        if (Math.random() < 0.1) {
            raindrops.push({
                x: cloud.x + (Math.random() - 0.5) * cloud.size,
                y: cloud.y + cloud.offsetY + cloud.size * 0.3,
                speed: 2 + Math.random() * 2,
                size: 2 + Math.random() * 3,
                opacity: 1
            });
        }
    });
    
    // Update and draw raindrops
    for (let i = raindrops.length - 1; i >= 0; i--) {
        const drop = raindrops[i];
        
        drop.y += drop.speed;
        drop.opacity -= 0.005;
        
        // Draw raindrop
        scene2Ctx.globalAlpha = drop.opacity;
        scene2Ctx.fillStyle = '#87CEEB';
        scene2Ctx.beginPath();
        scene2Ctx.ellipse(drop.x, drop.y, drop.size * 0.5, drop.size, 0, 0, Math.PI * 2);
        scene2Ctx.fill();
        scene2Ctx.globalAlpha = 1;
        
        // Remove if off screen or invisible
        if (drop.y > scene2Canvas.height || drop.opacity <= 0) {
            raindrops.splice(i, 1);
        }
    }
}

function drawCloud(x, y, size, isHappy = false) {
    // More realistic cloud colors and gradients
    const gradient = scene2Ctx.createRadialGradient(x, y - size * 0.2, 0, x, y, size);
    
    if (isHappy) {
        gradient.addColorStop(0, '#FFFFFF');
        gradient.addColorStop(0.6, '#F8F8FF');
        gradient.addColorStop(1, '#E6E6FA');
    } else {
        gradient.addColorStop(0, '#D3D3D3');
        gradient.addColorStop(0.6, '#C0C0C0');
        gradient.addColorStop(1, '#A9A9A9');
    }
    
    scene2Ctx.fillStyle = gradient;
    scene2Ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
    scene2Ctx.shadowBlur = 15;
    
    // More realistic cloud shape with more circles
    const circles = [
        { offsetX: 0, offsetY: 0, radius: size * 0.5 },
        { offsetX: -size * 0.35, offsetY: size * 0.15, radius: size * 0.35 },
        { offsetX: size * 0.35, offsetY: size * 0.15, radius: size * 0.35 },
        { offsetX: -size * 0.2, offsetY: -size * 0.25, radius: size * 0.25 },
        { offsetX: size * 0.2, offsetY: -size * 0.25, radius: size * 0.25 },
        { offsetX: -size * 0.5, offsetY: -size * 0.1, radius: size * 0.2 },
        { offsetX: size * 0.5, offsetY: -size * 0.1, radius: size * 0.2 },
        { offsetX: 0, offsetY: -size * 0.4, radius: size * 0.15 }
    ];
    
    circles.forEach(circle => {
        scene2Ctx.beginPath();
        scene2Ctx.arc(x + circle.offsetX, y + circle.offsetY, circle.radius, 0, Math.PI * 2);
        scene2Ctx.fill();
    });
    
    scene2Ctx.shadowBlur = 0;
}

function drawHappyClouds() {
    const time = Date.now() * 0.001;
    
    // Draw sun first (behind clouds)
    if (sun) {
        drawSun(sun.x, sun.y, sun.size, time);
    }
    
    // Update and draw happy clouds
    clouds.forEach((cloud, index) => {
        // Gentle floating motion
        cloud.offsetY = Math.sin(time * 0.5 + cloud.phase) * 8;
        
        // Draw happy cloud
        drawCloud(cloud.x, cloud.y + cloud.offsetY, cloud.size, true);
    });
}

function drawSun(x, y, size, time) {
    // Draw realistic sun rays with gradient
    sun.rays.forEach((ray, index) => {
        const rayLength = ray.length + Math.sin(time * 1.5 + ray.phase) * 8;
        const rayWidth = 3 + Math.sin(time * 2 + ray.phase) * 1;
        
        const startX = x + Math.cos(ray.angle) * (size * 0.55);
        const startY = y + Math.sin(ray.angle) * (size * 0.55);
        const endX = x + Math.cos(ray.angle) * (size * 0.55 + rayLength);
        const endY = y + Math.sin(ray.angle) * (size * 0.55 + rayLength);
        
        // Create gradient for each ray
        const rayGradient = scene2Ctx.createLinearGradient(startX, startY, endX, endY);
        rayGradient.addColorStop(0, '#FFF700');
        rayGradient.addColorStop(0.7, '#FFD700');
        rayGradient.addColorStop(1, 'rgba(255, 215, 0, 0.2)');
        
        scene2Ctx.strokeStyle = rayGradient;
        scene2Ctx.lineWidth = rayWidth;
        scene2Ctx.lineCap = 'round';
        
        scene2Ctx.beginPath();
        scene2Ctx.moveTo(startX, startY);
        scene2Ctx.lineTo(endX, endY);
        scene2Ctx.stroke();
    });
    
    // Draw multiple glow layers for realistic sun
    const glowIntensity = 0.7 + Math.sin(time * 2) * 0.3;
    
    // Outer glow
    const outerGlow = scene2Ctx.createRadialGradient(x, y, 0, x, y, size * 0.8);
    outerGlow.addColorStop(0, 'rgba(255, 255, 0, 0)');
    outerGlow.addColorStop(0.5, `rgba(255, 215, 0, ${glowIntensity * 0.1})`);
    outerGlow.addColorStop(1, 'rgba(255, 165, 0, 0)');
    
    scene2Ctx.fillStyle = outerGlow;
    scene2Ctx.beginPath();
    scene2Ctx.arc(x, y, size * 0.8, 0, Math.PI * 2);
    scene2Ctx.fill();
    
    // Main sun body with realistic gradient
    const sunGradient = scene2Ctx.createRadialGradient(
        x - size * 0.1, y - size * 0.1, 0, 
        x, y, size * 0.45
    );
    sunGradient.addColorStop(0, '#FFFF99');
    sunGradient.addColorStop(0.3, '#FFD700');
    sunGradient.addColorStop(0.7, '#FFA500');
    sunGradient.addColorStop(1, '#FF8C00');
    
    scene2Ctx.fillStyle = sunGradient;
    scene2Ctx.shadowColor = '#FFD700';
    scene2Ctx.shadowBlur = 25;
    scene2Ctx.beginPath();
    scene2Ctx.arc(x, y, size * 0.45, 0, Math.PI * 2);
    scene2Ctx.fill();
    scene2Ctx.shadowBlur = 0;
    
    // Add surface texture with small circles
    scene2Ctx.fillStyle = 'rgba(255, 200, 0, 0.3)';
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + time * 0.5;
        const radius = size * 0.25;
        const circleX = x + Math.cos(angle) * radius;
        const circleY = y + Math.sin(angle) * radius;
        const circleSize = 3 + Math.sin(time * 3 + i) * 2;
        
        scene2Ctx.beginPath();
        scene2Ctx.arc(circleX, circleY, circleSize, 0, Math.PI * 2);
        scene2Ctx.fill();
    }
}

function drawCalmScene() {
    const time = Date.now() * 0.001;
    breathingPhase += 0.008;
    
    // Breathing effect - subtle scale
    const breathingScale = 1 + Math.sin(breathingPhase) * 0.015;
    scene2Ctx.save();
    scene2Ctx.translate(scene2Canvas.width / 2, scene2Canvas.height / 2);
    scene2Ctx.scale(breathingScale, breathingScale);
    scene2Ctx.translate(-scene2Canvas.width / 2, -scene2Canvas.height / 2);
    
    // Water-like golden reflections
    const waterGlow = scene2Ctx.createRadialGradient(
        scene2Canvas.width * 0.5, scene2Canvas.height * 0.7, 0,
        scene2Canvas.width * 0.5, scene2Canvas.height * 0.7, scene2Canvas.width * 0.6
    );
    const glowIntensity = 0.08 + Math.sin(time * 0.4) * 0.03;
    waterGlow.addColorStop(0, `rgba(247, 233, 211, ${glowIntensity})`);
    waterGlow.addColorStop(0.6, `rgba(247, 233, 211, ${glowIntensity * 0.3})`);
    waterGlow.addColorStop(1, 'rgba(247, 233, 211, 0)');
    
    scene2Ctx.fillStyle = waterGlow;
    scene2Ctx.fillRect(0, 0, scene2Canvas.width, scene2Canvas.height);
    
    // Draw water ripples
    particles.forEach(center => {
        center.nextRipple -= 16;
        
        // Create new ripple
        if (center.nextRipple <= 0) {
            center.ripples.push({
                radius: 0,
                opacity: 0.3,
                maxRadius: 80 + Math.random() * 60
            });
            center.nextRipple = 4000 + Math.random() * 3000;
        }
        
        // Update and draw ripples
        for (let i = center.ripples.length - 1; i >= 0; i--) {
            const ripple = center.ripples[i];
            ripple.radius += 0.8;
            ripple.opacity *= 0.995;
            
            if (ripple.opacity < 0.01 || ripple.radius > ripple.maxRadius) {
                center.ripples.splice(i, 1);
                continue;
            }
            
            // Draw ripple
            scene2Ctx.strokeStyle = `rgba(247, 233, 211, ${ripple.opacity * 0.4})`;
            scene2Ctx.lineWidth = 1.5;
            scene2Ctx.beginPath();
            scene2Ctx.arc(center.x, center.y, ripple.radius, 0, Math.PI * 2);
            scene2Ctx.stroke();
        }
    });
    
    scene2Ctx.restore();
    
    // Draw subtle sun rays
    drawSunRays(scene2Ctx, scene2Canvas.width, scene2Canvas.height, time, 0.25);
    
    // Draw water surface
    drawWaterSurface(scene2Ctx, scene2Canvas.width, scene2Canvas.height, time);
    
    // Draw floating hearts
    hearts.forEach(heart => {
        heart.x += heart.vx;
        heart.y += heart.vy;
        heart.rotation += heart.rotationSpeed;
        
        // Wrap around edges
        if (heart.x < -20) heart.x = scene2Canvas.width + 20;
        if (heart.x > scene2Canvas.width + 20) heart.x = -20;
        if (heart.y < -20) heart.y = scene2Canvas.height + 20;
        if (heart.y > scene2Canvas.height + 20) heart.y = -20;
        
        // Breathing opacity
        const heartOpacity = heart.opacity + Math.sin(time * 1.5 + heart.phase) * 0.1;
        
        scene2Ctx.save();
        scene2Ctx.translate(heart.x, heart.y);
        scene2Ctx.rotate(heart.rotation);
        
        // Warm golden hearts for calm scene
        drawHeart(scene2Ctx, 0, 0, heart.size, 'rgba(255, 245, 220, ' + heartOpacity + ')', 1);
        
        scene2Ctx.restore();
    });
    
    // Add breathing animation to text
    const title = document.querySelector('.scene2-title');
    if (title) {
        const textScale = 0.98 + Math.sin(breathingPhase * 0.7) * 0.02;
        title.style.transform = `scale(${textScale})`;
    }
}

function drawSoftClouds() {
    const time = Date.now() * 0.001;
    
    // Horizontal drift effect
    const driftOffset = Math.sin(time * 0.2) * 15;
    scene2Ctx.save();
    scene2Ctx.translate(driftOffset, 0);
    
    // Breathing light effect
    const lightIntensity = 0.7 + Math.sin(time * 0.6) * 0.3;
    
    // Draw air brush color fields
    particles.forEach(particle => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.noiseOffset += 0.01;
        
        // Gentle wrapping
        if (particle.x < -particle.size) particle.x = scene2Canvas.width + particle.size;
        if (particle.x > scene2Canvas.width + particle.size) particle.x = -particle.size;
        if (particle.y < -particle.size) particle.y = scene2Canvas.height + particle.size;
        if (particle.y > scene2Canvas.height + particle.size) particle.y = -particle.size;
        
        // Create noise-like displacement
        const noiseX = Math.sin(particle.noiseOffset * 0.7) * 30;
        const noiseY = Math.cos(particle.noiseOffset * 0.5) * 20;
        
        // Draw soft air brush effect
        const airOpacity = particle.opacity * lightIntensity;
        const gradient = scene2Ctx.createRadialGradient(
            particle.x + noiseX, particle.y + noiseY, 0,
            particle.x + noiseX, particle.y + noiseY, particle.size
        );
        
        // Soft pink reflections
        gradient.addColorStop(0, `rgba(242, 212, 216, ${airOpacity * 0.8})`);
        gradient.addColorStop(0.4, `rgba(215, 231, 246, ${airOpacity * 0.6})`);
        gradient.addColorStop(1, 'rgba(215, 231, 246, 0)');
        
        scene2Ctx.fillStyle = gradient;
        scene2Ctx.beginPath();
        scene2Ctx.arc(particle.x + noiseX, particle.y + noiseY, particle.size, 0, Math.PI * 2);
        scene2Ctx.fill();
    });
    
    scene2Ctx.restore();
    
    // Draw gentle sun rays
    drawSunRays(scene2Ctx, scene2Canvas.width, scene2Canvas.height, time, 0.2);
    
    // Draw floating hearts
    hearts.forEach(heart => {
        heart.x += heart.vx;
        heart.y += heart.vy;
        heart.rotation += heart.rotationSpeed;
        
        // Wrap around edges
        if (heart.x < -20) heart.x = scene2Canvas.width + 20;
        if (heart.x > scene2Canvas.width + 20) heart.x = -20;
        if (heart.y < -20) heart.y = scene2Canvas.height + 20;
        if (heart.y > scene2Canvas.height + 20) heart.y = -20;
        
        // Floating opacity
        const heartOpacity = heart.opacity + Math.sin(time * 1.2 + heart.phase) * 0.08;
        
        scene2Ctx.save();
        scene2Ctx.translate(heart.x, heart.y);
        scene2Ctx.rotate(heart.rotation);
        
        // Light blue hearts for clouds scene
        drawHeart(scene2Ctx, 0, 0, heart.size, 'rgba(220, 240, 255, ' + heartOpacity + ')', 1);
        
        scene2Ctx.restore();
    });
    
    // Add floating text effect
    const title = document.querySelector('.scene2-title');
    if (title) {
        const floatY = Math.sin(time * 0.4) * 3;
        title.style.transform = `translateY(${floatY}px)`;
    }
}

function drawLoveScene() {
    const time = Date.now() * 0.001;
    
    // Multiple warm light sources (like window light)
    const lightSources = [
        { x: scene2Canvas.width * 0.2, y: scene2Canvas.height * 0.25, intensity: 0.12 },
        { x: scene2Canvas.width * 0.7, y: scene2Canvas.height * 0.4, intensity: 0.08 },
        { x: scene2Canvas.width * 0.5, y: scene2Canvas.height * 0.6, intensity: 0.06 }
    ];
    
    lightSources.forEach((light, index) => {
        const glowIntensity = light.intensity + Math.sin(time * 0.5 + index) * 0.03;
        const warmGlow = scene2Ctx.createRadialGradient(
            light.x, light.y, 0,
            light.x, light.y, scene2Canvas.width * 0.4
        );
        warmGlow.addColorStop(0, `rgba(255, 218, 185, ${glowIntensity})`);
        warmGlow.addColorStop(0.6, `rgba(255, 182, 193, ${glowIntensity * 0.4})`);
        warmGlow.addColorStop(1, 'rgba(255, 182, 193, 0)');
        
        scene2Ctx.fillStyle = warmGlow;
        scene2Ctx.fillRect(0, 0, scene2Canvas.width, scene2Canvas.height);
    });
    
    // Draw bokeh light spots (sunlight reflections)
    particles.forEach(particle => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        
        // Wrap around
        if (particle.x < -particle.size) particle.x = scene2Canvas.width + particle.size;
        if (particle.x > scene2Canvas.width + particle.size) particle.x = -particle.size;
        if (particle.y < -particle.size) particle.y = scene2Canvas.height + particle.size;
        if (particle.y > scene2Canvas.height + particle.size) particle.y = -particle.size;
        
        // Draw bokeh spot
        const spotOpacity = particle.opacity + Math.sin(time * 0.8 + particle.phase) * 0.05;
        const hue = particle.hue + Math.sin(time * 0.3 + particle.phase) * 15;
        
        // Create bokeh gradient
        const bokehGradient = scene2Ctx.createRadialGradient(
            particle.x, particle.y, 0,
            particle.x, particle.y, particle.size
        );
        bokehGradient.addColorStop(0, `hsla(${hue}, 60%, 85%, ${spotOpacity * 0.8})`);
        bokehGradient.addColorStop(0.7, `hsla(${hue}, 50%, 70%, ${spotOpacity * 0.3})`);
        bokehGradient.addColorStop(1, `hsla(${hue}, 40%, 60%, 0)`);
        
        scene2Ctx.fillStyle = bokehGradient;
        scene2Ctx.filter = `blur(${particle.blur}px)`;
        scene2Ctx.beginPath();
        scene2Ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        scene2Ctx.fill();
        scene2Ctx.filter = 'none';
    });
    
    // Draw floating hearts
    hearts.forEach(heart => {
        heart.x += heart.vx;
        heart.y += heart.vy;
        heart.rotation += heart.rotationSpeed;
        
        // Wrap around edges
        if (heart.x < -20) heart.x = scene2Canvas.width + 20;
        if (heart.x > scene2Canvas.width + 20) heart.x = -20;
        if (heart.y < -20) heart.y = scene2Canvas.height + 20;
        if (heart.y > scene2Canvas.height + 20) heart.y = -20;
        
        // Warm pulsing opacity
        const heartOpacity = heart.opacity + Math.sin(time * 1.8 + heart.phase) * 0.12;
        const hue = heart.hue + Math.sin(time * 0.5 + heart.phase) * 20;
        
        scene2Ctx.save();
        scene2Ctx.translate(heart.x, heart.y);
        scene2Ctx.rotate(heart.rotation);
        
        // Warm colored hearts for love scene
        const heartColor = `hsla(${hue}, 70%, 80%, ${heartOpacity})`;
        drawHeart(scene2Ctx, 0, 0, heart.size, heartColor, 1);
        
        scene2Ctx.restore();
    });
    
    // Add gentle glow to text
    const title = document.querySelector('.scene2-title');
    if (title) {
        const glowIntensity = 0.7 + Math.sin(time * 0.6) * 0.3;
        title.style.textShadow = `0 0 ${8 * glowIntensity}px rgba(255,180,160,${0.7 * glowIntensity})`;
    }
}

function drawHeart(ctx, x, y, size, color, opacity = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 16, size / 16); // Normalize to size 16
    
    ctx.fillStyle = color;
    ctx.globalAlpha = opacity;
    
    // More realistic heart shape
    ctx.beginPath();
    ctx.moveTo(0, 4);
    
    // Left side of heart
    ctx.bezierCurveTo(-8, -4, -16, -2, -12, 2);
    ctx.bezierCurveTo(-12, 6, -6, 10, 0, 16);
    
    // Right side of heart
    ctx.bezierCurveTo(6, 10, 12, 6, 12, 2);
    ctx.bezierCurveTo(16, -2, 8, -4, 0, 4);
    
    ctx.closePath();
    ctx.fill();
    
    // Add subtle inner highlight
    ctx.globalAlpha = opacity * 0.3;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.moveTo(-2, 1);
    ctx.bezierCurveTo(-6, -2, -10, -1, -8, 1);
    ctx.bezierCurveTo(-8, 3, -4, 6, -2, 8);
    ctx.fill();
    
    ctx.restore();
}

function drawWaterSurface(ctx, canvasWidth, canvasHeight, time) {
    // Draw water surface covering bottom 45% of screen
    const waterHeight = canvasHeight * 0.45;
    const waterY = canvasHeight - waterHeight;
    
    // Create bright water gradient with warmer tones
    const waterGradient = ctx.createLinearGradient(0, waterY, 0, canvasHeight);
    waterGradient.addColorStop(0, 'rgba(200, 220, 235, 0.3)');
    waterGradient.addColorStop(0.2, 'rgba(180, 205, 225, 0.5)');
    waterGradient.addColorStop(0.5, 'rgba(165, 190, 210, 0.7)');
    waterGradient.addColorStop(0.8, 'rgba(150, 175, 195, 0.8)');
    waterGradient.addColorStop(1, 'rgba(135, 160, 180, 0.9)');
    
    // Draw main water surface
    ctx.fillStyle = waterGradient;
    ctx.fillRect(0, waterY, canvasWidth, waterHeight);
    
    // Add water surface reflection effect
    const reflectionGradient = ctx.createRadialGradient(
        canvasWidth * 0.5, waterY + waterHeight * 0.3, 0,
        canvasWidth * 0.5, waterY + waterHeight * 0.3, canvasWidth * 0.8
    );
    reflectionGradient.addColorStop(0, 'rgba(200, 220, 235, 0.3)');
    reflectionGradient.addColorStop(0.6, 'rgba(180, 200, 215, 0.2)');
    reflectionGradient.addColorStop(1, 'rgba(160, 180, 195, 0.1)');
    
    ctx.fillStyle = reflectionGradient;
    ctx.fillRect(0, waterY, canvasWidth, waterHeight);
    
    // Add animated water ripples with better visibility
    for (let i = 0; i < 7; i++) {
        const rippleY = waterY + (waterHeight * 0.15) + (i * waterHeight * 0.12);
        const waveOffset = Math.sin(time * 0.4 + i * 0.7) * 12;
        
        // Create more visible ripple gradient
        const rippleGradient = ctx.createLinearGradient(0, rippleY - 8, 0, rippleY + 8);
        rippleGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
        rippleGradient.addColorStop(0.5, `rgba(255, 255, 255, ${0.2 + Math.sin(time * 0.8 + i) * 0.1})`);
        rippleGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.fillStyle = rippleGradient;
        
        // Draw wavy ripple line with more pronounced waves
        ctx.beginPath();
        ctx.moveTo(0, rippleY + waveOffset);
        for (let x = 0; x <= canvasWidth; x += 15) {
            const waveY = rippleY + Math.sin((x + time * 60) * 0.008) * 4 + waveOffset;
            ctx.lineTo(x, waveY);
        }
        ctx.lineTo(canvasWidth, rippleY + 15);
        ctx.lineTo(0, rippleY + 15);
        ctx.closePath();
        ctx.fill();
    }
    
    // Add stronger surface highlights
    const highlightGradient = ctx.createLinearGradient(0, waterY, 0, waterY + waterHeight * 0.25);
    highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
    highlightGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
    highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = highlightGradient;
    ctx.fillRect(0, waterY, canvasWidth, waterHeight * 0.25);
    
    // Add water edge effect
    const edgeGradient = ctx.createLinearGradient(0, waterY - 5, 0, waterY + 15);
    edgeGradient.addColorStop(0, 'rgba(181, 201, 214, 0)');
    edgeGradient.addColorStop(0.3, 'rgba(181, 201, 214, 0.4)');
    edgeGradient.addColorStop(1, 'rgba(159, 179, 192, 0.6)');
    
    ctx.fillStyle = edgeGradient;
    ctx.fillRect(0, waterY - 5, canvasWidth, 20);
}

function drawSunRays(ctx, canvasWidth, canvasHeight, time, intensity = 0.3) {
    // Draw subtle sun rays from top corners
    const rayCount = 8;
    const rayOrigins = [
        { x: canvasWidth * 0.15, y: -50 },
        { x: canvasWidth * 0.85, y: -30 },
        { x: canvasWidth * 0.5, y: -80 }
    ];
    
    rayOrigins.forEach((origin, originIndex) => {
        for (let i = 0; i < rayCount; i++) {
            const angle = (i / rayCount) * Math.PI * 0.8 + Math.PI * 0.1;
            const rayLength = canvasHeight * 1.2;
            const rayWidth = 40 + Math.sin(time * 0.5 + i + originIndex) * 15;
            
            // Calculate ray end point
            const endX = origin.x + Math.cos(angle) * rayLength;
            const endY = origin.y + Math.sin(angle) * rayLength;
            
            // Create ray gradient
            const rayGradient = ctx.createLinearGradient(origin.x, origin.y, endX, endY);
            const rayOpacity = intensity * (0.1 + Math.sin(time * 0.3 + i * 0.5 + originIndex) * 0.05);
            
            rayGradient.addColorStop(0, `rgba(255, 248, 220, ${rayOpacity})`);
            rayGradient.addColorStop(0.3, `rgba(255, 240, 200, ${rayOpacity * 0.7})`);
            rayGradient.addColorStop(0.7, `rgba(255, 235, 180, ${rayOpacity * 0.4})`);
            rayGradient.addColorStop(1, 'rgba(255, 235, 180, 0)');
            
            ctx.fillStyle = rayGradient;
            
            // Draw ray as a triangle
            ctx.beginPath();
            ctx.moveTo(origin.x, origin.y);
            
            // Calculate ray sides
            const perpX = -Math.sin(angle);
            const perpY = Math.cos(angle);
            
            ctx.lineTo(origin.x + perpX * rayWidth * 0.5, origin.y + perpY * rayWidth * 0.5);
            ctx.lineTo(endX, endY);
            ctx.lineTo(origin.x - perpX * rayWidth * 0.5, origin.y - perpY * rayWidth * 0.5);
            ctx.closePath();
            ctx.fill();
        }
    });
}

function createWaveEffect(event) {
    const rect = event.target.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Create ripple effect
    const ripple = document.createElement('div');
    ripple.style.position = 'absolute';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    ripple.style.width = '20px';
    ripple.style.height = '20px';
    ripple.style.borderRadius = '50%';
    ripple.style.background = 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)';
    ripple.style.pointerEvents = 'none';
    ripple.style.transform = 'translate(-50%, -50%)';
    
    event.target.style.position = 'relative';
    event.target.appendChild(ripple);
    
    gsap.to(ripple, {
        scale: 10,
        opacity: 0,
        duration: 1,
        ease: "power2.out",
        onComplete: () => ripple.remove()
    });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
