// Scene setup
let scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a2d43);
let camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
let renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
let sky = null;
let controls = null;
let ground = null;

// Game state
let gameStarted = false;
let gameOver = false;
let score = 0;
let coins = 0;
let highScore = 0;
let activePowerUp = null;
let powerUpDuration = 0;
let player = null;
let speed = 0.1;
let lane = 0;
const laneWidth = 3;
let isMoving = false;
let moveStartTime = 0;

// Arrays for game objects
let obstacles = [];
let collectibles = [];
let powerUps = [];

// Performance optimization
const objectPool = {
    obstacles: [],
    collectibles: [],
    powerUps: []
};

// UI elements
let startScreen, gameOverScreen, shopScreen, startButton, restartButton, shopButton, shopButton2, closeShopButton;
let scoreDisplay, coinsDisplay, powerupDisplay, finalScoreDisplay, highScoreDisplay;

// Shop items
let shopItems = {
    blueCharacter: { price: 100, purchased: false },
    redCharacter: { price: 150, purchased: false },
    extraShield: { price: 50, purchased: false },
    doubleCoins: { price: 200, purchased: false }
};

// Add mobile controls
function setupMobileControls() {
    const controls = document.createElement('div');
    controls.id = 'mobile-controls';
    controls.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 0;
        right: 0;
        display: flex;
        justify-content: space-between;
        padding: 0 20px;
        z-index: 1000;
        display: none;
    `;

    // Left controls (move left/right)
    const leftControls = document.createElement('div');
    leftControls.style.cssText = `
        display: flex;
        gap: 20px;
    `;

    const leftBtn = document.createElement('button');
    leftBtn.textContent = '←';
    leftBtn.style.cssText = `
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.2);
        border: 2px solid white;
        color: white;
        font-size: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    leftBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (lane > -1) {
            lane--;
            player.position.x = lane * laneWidth;
        }
    });

    const rightBtn = document.createElement('button');
    rightBtn.textContent = '→';
    rightBtn.style.cssText = leftBtn.style.cssText;
    rightBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (lane < 1) {
            lane++;
            player.position.x = lane * laneWidth;
        }
    });

    leftControls.appendChild(leftBtn);
    leftControls.appendChild(rightBtn);

    // Right controls (jump/slide)
    const rightControls = document.createElement('div');
    rightControls.style.cssText = `
        display: flex;
        gap: 20px;
    `;

    const jumpBtn = document.createElement('button');
    jumpBtn.textContent = '↑';
    jumpBtn.style.cssText = leftBtn.style.cssText;
    jumpBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (!isJumping && !isSliding) {
            isJumping = true;
            jumpHeight = 0;
            player.position.y = 0.5;
        }
    });

    const slideBtn = document.createElement('button');
    slideBtn.textContent = '↓';
    slideBtn.style.cssText = leftBtn.style.cssText;
    slideBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (!isJumping && !isSliding) {
            isSliding = true;
            slideDuration = 0;
            player.scale.y = 0.5;
            player.position.y = 0.25;
        }
    });
    slideBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (isSliding) {
            isSliding = false;
            player.scale.y = 1;
            player.position.y = 0.5;
        }
    });

    rightControls.appendChild(jumpBtn);
    rightControls.appendChild(slideBtn);

    controls.appendChild(leftControls);
    controls.appendChild(rightControls);
    document.body.appendChild(controls);

    // Show mobile controls on mobile devices
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        controls.style.display = 'flex';
        document.getElementById('startScreen').style.padding = '20px';
        document.getElementById('gameOver').style.padding = '20px';
    }

    // Prevent default touch behaviors
    document.addEventListener('touchmove', (e) => {
        if (e.target.id === 'mobile-controls' || e.target.tagName === 'BUTTON') {
            e.preventDefault();
        }
    }, { passive: false });

    // Handle touch events for game controls
    const gameContainer = document.getElementById('gameContainer');
    gameContainer.addEventListener('touchstart', (e) => {
        if (!gameStarted || gameOver) return;
        e.preventDefault();
    }, { passive: false });
}

// Initialize game with mobile support
function init() {
    // Create new scene
    const newScene = new THREE.Scene();
    newScene.background = new THREE.Color(0x87CEEB); // Sky blue background
    
    // Create a more vibrant sky
    const skyGeometry = new THREE.SphereGeometry(500, 32, 32);
    const skyMaterial = new THREE.MeshBasicMaterial({
        color: 0x87CEEB,
        side: THREE.BackSide
    });
    const newSky = new THREE.Mesh(skyGeometry, skyMaterial);
    newScene.add(newSky);

    // Add dynamic lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    newScene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    newScene.add(directionalLight);

    // Add point lights for collectibles and power-ups
    const collectibleLight = new THREE.PointLight(0xffd700, 2, 10);
    collectibleLight.position.set(0, 5, 0);
    newScene.add(collectibleLight);

    const powerUpLight = new THREE.PointLight(0x4ecdc4, 2, 10);
    powerUpLight.position.set(0, 5, 0);
    newScene.add(powerUpLight);

    // Add fog for depth
    newScene.fog = new THREE.FogExp2(0x87CEEB, 0.002);

    // Create ground with better texture
    const groundGeometry = new THREE.PlaneGeometry(100, 20);
    const groundMaterial = new THREE.MeshPhongMaterial({ color: 0x808080, side: THREE.DoubleSide });
    ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = Math.PI / 2;
    ground.position.y = -1;
    ground.receiveShadow = true;
    newScene.add(ground);

    // Add decorative elements
    addClouds(newScene);
    addStars(newScene);

    // Update global variables
    scene = newScene;
    sky = newSky;

    // Set up renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('gameContainer').appendChild(renderer.domElement);

    // Set up camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 4, 6);
    camera.lookAt(0, 0, 0);

    // Add OrbitControls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.maxPolarAngle = Math.PI / 2.5;
    controls.minPolarAngle = Math.PI / 3;
    controls.maxAzimuthAngle = Math.PI / 4;
    controls.minAzimuthAngle = -Math.PI / 4;

    // Create game elements
    player = createPlayer();
    scene.add(player);

    // Create city background
    const cityBackground = createCityBackground();
    scene.add(cityBackground);

    // Create floor
    const floor = createFloor();
    scene.add(floor);

    // Create lanes
    const lanes = createLanes();
    scene.add(lanes);

    // Create clouds
    const clouds = createClouds();
    scene.add(clouds);

    // Initialize object pools
    initializeObjectPools();

    // Get UI elements
    startScreen = document.getElementById('startScreen');
    gameOverScreen = document.getElementById('gameOver');
    shopScreen = document.getElementById('shopScreen');
    startButton = document.getElementById('startButton');
    restartButton = document.getElementById('restartButton');
    shopButton = document.getElementById('shopButton');
    shopButton2 = document.getElementById('shopButton2');
    closeShopButton = document.getElementById('closeShop');
    scoreDisplay = document.getElementById('score');
    coinsDisplay = document.getElementById('coins');
    powerupDisplay = document.getElementById('powerup');
    finalScoreDisplay = document.getElementById('finalScore');
    highScoreDisplay = document.getElementById('highScoreDisplay');

    // Add event listeners
    startButton.addEventListener('click', startGame);
    restartButton.addEventListener('click', restartGame);
    shopButton.addEventListener('click', openShop);
    shopButton2.addEventListener('click', openShop);
    closeShopButton.addEventListener('click', closeShop);
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Set up shop item buttons
    document.getElementById('buyBlue').addEventListener('click', () => buyItem('blueCharacter'));
    document.getElementById('buyRed').addEventListener('click', () => buyItem('redCharacter'));
    document.getElementById('buyShield').addEventListener('click', () => buyItem('extraShield'));
    document.getElementById('buyDoubleCoins').addEventListener('click', () => buyItem('doubleCoins'));

    // Initialize UI
    updateUI();
    updateShopButtons();

    // Start animation loop
    animate();

    // Add mobile controls
    setupMobileControls();

    // Adjust camera for mobile
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        camera.position.set(0, 2, 5);
        camera.lookAt(0, 1, 0);
    }
}

// Call init when the window loads
window.addEventListener('load', init);

// Game control functions
function startGame() {
    console.log('Starting game...');
    gameStarted = true;
    gameOver = false;
    score = 0;
    coins = 0;
    activePowerUp = null;
    powerUpDuration = 0;
    startScreen.style.display = 'none';
    gameOverScreen.style.display = 'none';
    shopScreen.style.display = 'none';
    updateUI();
}

function restartGame() {
    console.log('Restarting game...');
    gameStarted = true;
    gameOver = false;
    score = 0;
    activePowerUp = null;
    powerUpDuration = 0;
    
    // Hide all screens
    startScreen.style.display = 'none';
    gameOverScreen.style.display = 'none';
    shopScreen.style.display = 'none';
    
    // Reset player position and state
    player.position.set(0, 0.5, -1);
    player.rotation.set(0, 0, 0);
    player.userData.isJumping = false;
    player.userData.isSliding = false;
    player.scale.y = 1;
    
    // Clear all obstacles, collectibles, and power-ups
    obstacles.forEach(obstacle => scene.remove(obstacle));
    collectibles.forEach(collectible => scene.remove(collectible));
    powerUps.forEach(powerUp => scene.remove(powerUp.mesh));
    obstacles = [];
    collectibles = [];
    powerUps = [];
    
    // Reset city background position
    if (cityBackground) {
        cityBackground.position.z = 0;
    }
    
    // Reset lanes position
    if (lanes) {
        lanes.position.z = 0;
    }
    
    // Reset floor position
    if (floor) {
        floor.position.z = 0;
    }
    
    // Reset clouds position
    if (clouds) {
        clouds.position.z = 0;
    }
    
    // Update UI
    updateUI();
    
    // Start spawning objects again
    spawnObjects();
}

function openShop() {
    console.log('Opening shop...');
    shopScreen.style.display = 'block';
    startScreen.style.display = 'none';
    gameOverScreen.style.display = 'none';
    updateShopButtons();
}

function closeShop() {
    console.log('Closing shop...');
    shopScreen.style.display = 'none';
    if (gameOver) {
        gameOverScreen.style.display = 'block';
    } else if (!gameStarted) {
        startScreen.style.display = 'block';
    }
}

function buyItem(item) {
    if (coins >= shopItems[item].price && !shopItems[item].purchased) {
        coins -= shopItems[item].price;
        shopItems[item].purchased = true;
        updateUI();
        updateShopButtons();
    }
}

// UI update functions
function updateUI() {
    // Update score display
    if (scoreDisplay) {
        scoreDisplay.textContent = `Score: ${Math.floor(score)}`;
    }
    
    // Update coins display
    if (coinsDisplay) {
        coinsDisplay.textContent = `Coins: ${coins}`;
    }
    
    // Update power-up display
    if (powerupDisplay) {
        powerupDisplay.textContent = `Power-up: ${activePowerUp || 'None'}`;
    }
    
    // Update final score display
    if (finalScoreDisplay) {
        finalScoreDisplay.textContent = `Final Score: ${Math.floor(score)}`;
    }
    
    // Update high score display
    if (highScoreDisplay) {
        highScoreDisplay.textContent = `High Score: ${Math.floor(highScore)}`;
    }
    
    // Update shop buttons
    updateShopButtons();
}

function updateShopButtons() {
    const buttons = {
        buyBlue: 'blueCharacter',
        buyRed: 'redCharacter',
        buyShield: 'extraShield',
        buyDoubleCoins: 'doubleCoins'
    };

    for (const [buttonId, item] of Object.entries(buttons)) {
        const button = document.getElementById(buttonId);
        if (!button) continue;
        
        const itemData = shopItems[item];
        
        if (itemData.purchased) {
            button.textContent = 'Purchased';
            button.disabled = true;
            button.classList.add('purchased');
        } else {
            button.textContent = `Buy (${itemData.price} coins)`;
            button.disabled = coins < itemData.price;
        }
    }
}

// Animation loop with performance optimizations
function animate() {
    requestAnimationFrame(animate);

    if (gameStarted && !gameOver) {
        // Move city background buildings
        cityBackground.children.forEach(building => {
            building.position.z += 0.1; // Increased from 0.05
            
            // Reset building position when it goes past the camera
            if (building.position.z > 10) {
                building.position.z = -200;
                
                // Randomize x position while keeping on correct side
                const playableArea = laneWidth * 3;
                const cityWidth = 40;
                const buildingWidth = 4;
                
                let xPosition;
                if (building.position.x < 0) {
                    xPosition = -playableArea/2 - buildingWidth/2 - Math.random() * (cityWidth/2 - playableArea/2);
                } else {
                    xPosition = playableArea/2 + buildingWidth/2 + Math.random() * (cityWidth/2 - playableArea/2);
                }
                building.position.x = xPosition;
                
                // Randomize height
                const minHeight = 5;
                const maxHeight = 15;
                const newHeight = minHeight + Math.random() * (maxHeight - minHeight);
                building.scale.y = newHeight;
            }
        });

        // Update sky animation
        if (sky && sky.userData.update) {
            sky.userData.update(Date.now());
        }

        // Handle jumping animation
        if (isJumping) {
            jumpHeight += 0.05; // Slower jump animation
            const jumpCurve = Math.sin(jumpHeight) * 2;
            player.position.y = 0.5 + jumpCurve;
            
            // Reset jump when animation completes
            if (jumpHeight >= Math.PI) {
                isJumping = false;
                jumpHeight = 0;
                player.position.y = 0.5;
            }
        }

        // Move and spawn objects
        moveObjects();
        spawnObjects();
        animateObjects();
        checkCollisions();

        // Update score
        score += 0.02; // Increased from 0.01
        if (score > highScore) {
            highScore = score;
        }
        updateUI();
    } else if (gameOver) {
        // Continue moving city background even in game over state
        if (cityBackground) {
            cityBackground.position.z += cityBackground.userData.speed;
            if (cityBackground.position.z > 0) {
                cityBackground.position.z = cityBackground.userData.resetPosition;
            }
        }
    }

    renderer.render(scene, camera);
}

// Move objects with pooling
function moveObjects() {
    // Move obstacles
    obstacles.forEach((obstacle, index) => {
        obstacle.position.z += 0.08; // Increased from 0.02
        if (obstacle.position.z > 10) {
            scene.remove(obstacle);
            obstacles.splice(index, 1);
            returnObjectToPool(obstacle, 'obstacles');
        }
    });

    // Move collectibles
    collectibles.forEach((collectible, index) => {
        collectible.position.z += 0.08; // Increased from 0.02
        if (collectible.position.z > 10) {
            scene.remove(collectible);
            collectibles.splice(index, 1);
            returnObjectToPool(collectible, 'collectibles');
        }
    });

    // Move power-ups
    powerUps.forEach((powerUp, index) => {
        powerUp.position.z += 0.08; // Increased from 0.02
        if (powerUp.position.z > 10) {
            scene.remove(powerUp);
            powerUps.splice(index, 1);
            returnObjectToPool(powerUp, 'powerUps');
        }
    });
}

// Spawn objects with pooling
function spawnObjects() {
    if (!gameStarted || gameOver) return;

    // Helper function to check if a position is occupied
    function isPositionOccupied(x, z) {
        const checkBox = new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(x, 0.5, z),
            new THREE.Vector3(1, 1, 1)
        );

        // Check against obstacles
        for (const obstacle of obstacles) {
            const obstacleBox = new THREE.Box3().setFromObject(obstacle);
            if (checkBox.intersectsBox(obstacleBox)) {
                return true;
            }
        }

        // Check against collectibles
        for (const collectible of collectibles) {
            const collectibleBox = new THREE.Box3().setFromObject(collectible);
            if (checkBox.intersectsBox(collectibleBox)) {
                return true;
            }
        }

        // Check against power-ups
        for (const powerUp of powerUps) {
            const powerUpBox = new THREE.Box3().setFromObject(powerUp);
            if (checkBox.intersectsBox(powerUpBox)) {
                return true;
            }
        }

        return false;
    }

    // Spawn obstacles with increased rate but maintained spacing
    if (Math.random() < 0.004) {
        const lane = Math.floor(Math.random() * 3) - 1;
        const x = lane * laneWidth;
        const z = -70;

        if (!isPositionOccupied(x, z)) {
            const obstacle = getObjectFromPool('obstacles');
            if (obstacle) {
                obstacle.position.set(x, 0.5, z);
                scene.add(obstacle);
                obstacles.push(obstacle);
            }
        }
    }

    // Spawn collectibles with increased rate but maintained spacing
    if (Math.random() < 0.006) {
        const lane = Math.floor(Math.random() * 3) - 1;
        const x = lane * laneWidth;
        const z = -70;

        if (!isPositionOccupied(x, z)) {
            const collectible = getObjectFromPool('collectibles');
            if (collectible) {
                collectible.position.set(x, 0.5, z);
                scene.add(collectible);
                collectibles.push(collectible);
            }
        }
    }

    // Spawn power-ups with significantly reduced rate
    if (Math.random() < 0.0002) { // Reduced from 0.001
        const lane = Math.floor(Math.random() * 3) - 1;
        const x = lane * laneWidth;
        const z = -70;

        if (!isPositionOccupied(x, z)) {
            const powerUp = getObjectFromPool('powerUps');
            if (powerUp) {
                powerUp.position.set(x, 0.5, z);
                scene.add(powerUp);
                powerUps.push(powerUp);
            }
        }
    }
}

// Animate objects
function animateObjects() {
    // Animate collectibles
    collectibles.forEach(collectible => {
        collectible.rotation.y += collectible.userData.rotationSpeed;
        collectible.position.y = 0.5 + Math.sin(Date.now() * 0.002) * 0.2;
        
        // Animate particles
        if (collectible.userData.particles) {
            collectible.userData.particles.forEach((particle, index) => {
                const time = Date.now() * 0.001;
                const angle = (index / collectible.userData.particles.length) * Math.PI * 2 + time;
                const radius = 0.6;
                particle.position.set(
                    Math.cos(angle) * radius,
                    Math.sin(angle) * radius,
                    0
                );
            });
        }
    });

    // Animate power-ups
    powerUps.forEach(powerUp => {
        powerUp.rotation.y += powerUp.userData.rotationSpeed;
        powerUp.position.y = 0.5 + Math.sin(Date.now() * 0.002) * 0.2;
        
        // Animate particles
        if (powerUp.userData.particles) {
            powerUp.userData.particles.forEach((particle, index) => {
                const time = Date.now() * 0.001;
                const angle = (index / powerUp.userData.particles.length) * Math.PI * 2 + time;
                const radius = 0.8;
                particle.position.set(
                    Math.cos(angle) * radius,
                    Math.sin(angle) * radius,
                    0
                );
            });
        }
    });
}

// Handle window resize
function onWindowResize() {
    // Update camera aspect ratio
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    
    // Update renderer size
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Game state variables
let isJumping = false;
let isSliding = false;
let jumpHeight = 0;
let slideDuration = 0;
let canSwitchLane = true;
let lastLaneSwitch = 0;
let totalCoins = parseInt(localStorage.getItem('totalCoins')) || 0;

// Create player with basic model
function createPlayer() {
    const playerGroup = new THREE.Group();
    
    // Body with armor plating
    const bodyGeometry = new THREE.BoxGeometry(0.8, 1.2, 0.4);
    const bodyMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x4ecdc4,
        shininess: 100,
        specular: 0xffffff,
        emissive: 0x4ecdc4,
        emissiveIntensity: 0.2
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.6;
    body.castShadow = true;
    playerGroup.add(body);

    // Armor plates
    const armorGeometry = new THREE.BoxGeometry(0.85, 0.2, 0.45);
    const armorMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x16213e,
        shininess: 150,
        specular: 0xffffff
    });
    
    // Chest armor
    const chestArmor = new THREE.Mesh(armorGeometry, armorMaterial);
    chestArmor.position.set(0, 0.8, 0);
    chestArmor.castShadow = true;
    playerGroup.add(chestArmor);

    // Shoulder pads
    const shoulderGeometry = new THREE.SphereGeometry(0.2, 16, 16);
    const shoulderMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x16213e,
        shininess: 150,
        specular: 0xffffff
    });
    
    const leftShoulder = new THREE.Mesh(shoulderGeometry, shoulderMaterial);
    leftShoulder.position.set(-0.5, 0.8, 0);
    leftShoulder.castShadow = true;
    playerGroup.add(leftShoulder);

    const rightShoulder = new THREE.Mesh(shoulderGeometry, shoulderMaterial);
    rightShoulder.position.set(0.5, 0.8, 0);
    rightShoulder.castShadow = true;
    playerGroup.add(rightShoulder);

    // Head with visor
    const headGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const headMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xffcc99,
        shininess: 50
    });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 1.3;
    head.castShadow = true;
    playerGroup.add(head);

    // Visor
    const visorGeometry = new THREE.BoxGeometry(0.4, 0.1, 0.3);
    const visorMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x00ffff,
        transparent: true,
        opacity: 0.8,
        emissive: 0x00ffff,
        emissiveIntensity: 0.5
    });
    const visor = new THREE.Mesh(visorGeometry, visorMaterial);
    visor.position.set(0, 1.3, 0.2);
    playerGroup.add(visor);

    // Arms with armor
    const armGeometry = new THREE.BoxGeometry(0.2, 0.8, 0.2);
    const armMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x4ecdc4,
        shininess: 100,
        specular: 0xffffff
    });
    
    const leftArm = new THREE.Mesh(armGeometry, armMaterial);
    leftArm.position.set(-0.5, 0.6, 0);
    leftArm.castShadow = true;
    playerGroup.add(leftArm);

    const rightArm = new THREE.Mesh(armGeometry, armMaterial);
    rightArm.position.set(0.5, 0.6, 0);
    rightArm.castShadow = true;
    playerGroup.add(rightArm);

    // Arm armor
    const armArmorGeometry = new THREE.BoxGeometry(0.25, 0.2, 0.25);
    const armArmorMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x16213e,
        shininess: 150,
        specular: 0xffffff
    });

    const leftArmArmor = new THREE.Mesh(armArmorGeometry, armArmorMaterial);
    leftArmArmor.position.set(-0.5, 0.3, 0);
    leftArmArmor.castShadow = true;
    playerGroup.add(leftArmArmor);

    const rightArmArmor = new THREE.Mesh(armArmorGeometry, armArmorMaterial);
    rightArmArmor.position.set(0.5, 0.3, 0);
    rightArmArmor.castShadow = true;
    playerGroup.add(rightArmArmor);

    // Legs with armor
    const legGeometry = new THREE.BoxGeometry(0.3, 0.8, 0.3);
    const legMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x0f3460,
        shininess: 100,
        specular: 0xffffff
    });
    
    const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
    leftLeg.position.set(-0.2, 0, 0);
    leftLeg.castShadow = true;
    playerGroup.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
    rightLeg.position.set(0.2, 0, 0);
    rightLeg.castShadow = true;
    playerGroup.add(rightLeg);

    // Knee armor
    const kneeGeometry = new THREE.BoxGeometry(0.35, 0.15, 0.35);
    const kneeMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x16213e,
        shininess: 150,
        specular: 0xffffff
    });

    const leftKnee = new THREE.Mesh(kneeGeometry, kneeMaterial);
    leftKnee.position.set(-0.2, -0.3, 0);
    leftKnee.castShadow = true;
    playerGroup.add(leftKnee);

    const rightKnee = new THREE.Mesh(kneeGeometry, kneeMaterial);
    rightKnee.position.set(0.2, -0.3, 0);
    rightKnee.castShadow = true;
    playerGroup.add(rightKnee);

    // Boots
    const bootGeometry = new THREE.BoxGeometry(0.4, 0.2, 0.4);
    const bootMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x16213e,
        shininess: 150,
        specular: 0xffffff
    });

    const leftBoot = new THREE.Mesh(bootGeometry, bootMaterial);
    leftBoot.position.set(-0.2, -0.5, 0);
    leftBoot.castShadow = true;
    playerGroup.add(leftBoot);

    const rightBoot = new THREE.Mesh(bootGeometry, bootMaterial);
    rightBoot.position.set(0.2, -0.5, 0);
    rightBoot.castShadow = true;
    playerGroup.add(rightBoot);

    // Energy core
    const coreGeometry = new THREE.SphereGeometry(0.1, 16, 16);
    const coreMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x00ffff,
        emissive: 0x00ffff,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.9
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    core.position.set(0, 0.6, 0.25);
    playerGroup.add(core);

    // Add glow effect to core
    const glowGeometry = new THREE.SphereGeometry(0.15, 16, 16);
    const glowMaterial = new THREE.MeshPhongMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.set(0, 0.6, 0.25);
    playerGroup.add(glow);

    // Add energy trails
    const trailGeometry = new THREE.CylinderGeometry(0.05, 0.1, 0.3, 8);
    const trailMaterial = new THREE.MeshPhongMaterial({
        color: 0x00ffff,
        emissive: 0x00ffff,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.7
    });

    const leftTrail = new THREE.Mesh(trailGeometry, trailMaterial);
    leftTrail.position.set(-0.2, -0.6, 0);
    leftTrail.rotation.x = Math.PI / 2;
    playerGroup.add(leftTrail);

    const rightTrail = new THREE.Mesh(trailGeometry, trailMaterial);
    rightTrail.position.set(0.2, -0.6, 0);
    rightTrail.rotation.x = Math.PI / 2;
    playerGroup.add(rightTrail);

    playerGroup.userData = {
        isRunning: false,
        armRotation: 0,
        legRotation: 0,
        rotationSpeed: 0.1,
        corePulse: 0
    };

    return playerGroup;
}

// Ground and tracks
const groundGeometry = new THREE.PlaneGeometry(100, 20);
const groundMaterial = new THREE.MeshPhongMaterial({ color: 0x808080, side: THREE.DoubleSide });
ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = Math.PI / 2;
ground.position.y = -1;
ground.receiveShadow = true;
scene.add(ground);

// Create tracks
const trackMaterial = new THREE.MeshPhongMaterial({ color: 0x333333, side: THREE.DoubleSide });
for (let i = -1; i <= 1; i++) {
    const track = new THREE.Mesh(new THREE.PlaneGeometry(100, 0.5), trackMaterial);
    track.rotation.x = Math.PI / 2;
    track.position.set(i * laneWidth, -0.9, 0);
    track.receiveShadow = true;
    scene.add(track);
}

// Create sky background
function createSky() {
    // Create sky sphere with gradient
    const skyGeometry = new THREE.SphereGeometry(500, 32, 32);
    const skyMaterial = new THREE.ShaderMaterial({
        uniforms: {
            topColor: { value: new THREE.Color(0x000000) },
            bottomColor: { value: new THREE.Color(0x1a1a2e) },
            offset: { value: 0 },
            exponent: { value: 0.6 }
        },
        vertexShader: `
            varying vec3 vWorldPosition;
            void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            uniform float offset;
            uniform float exponent;
            varying vec3 vWorldPosition;
            void main() {
                float h = normalize(vWorldPosition + offset).y;
                gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
            }
        `,
        side: THREE.BackSide
    });
    const sky = new THREE.Mesh(skyGeometry, skyMaterial);
    sky.position.y = 100;

    // Create stars
    const starsGeometry = new THREE.BufferGeometry();
    const starsMaterial = new THREE.PointsMaterial({
        color: 0xFFFFFF,
        size: 1,
        transparent: true,
        opacity: 0.8
    });

    const starsVertices = [];
    for (let i = 0; i < 10000; i++) {
        const x = (Math.random() - 0.5) * 2000;
        const y = (Math.random() - 0.5) * 2000;
        const z = (Math.random() - 0.5) * 2000;
        starsVertices.push(x, y, z);
    }

    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    sky.add(stars);

    // Add twinkling effect to stars
    stars.userData = {
        twinkleSpeed: 0.1,
        twinkleAmount: 0.2
    };

    // Add animation to sky
    sky.userData = {
        update: function(time) {
            // Update sky gradient
            skyMaterial.uniforms.offset.value = time * 0.0001;
            
            // Update star twinkling
            const positions = starsGeometry.attributes.position.array;
            for (let i = 0; i < positions.length; i += 3) {
                const twinkle = Math.sin(time * stars.userData.twinkleSpeed + i) * stars.userData.twinkleAmount;
                positions[i + 1] += twinkle;
            }
            starsGeometry.attributes.position.needsUpdate = true;
        }
    };

    return sky;
}

// Create city background
function createCityBackground() {
    const cityBackground = new THREE.Group();
    const buildingGeometry = new THREE.BoxGeometry(4, 10, 4);
    
    // Create buildings for both sides
    for (let i = 0; i < 10; i++) {
        // Left side buildings
        const leftBuilding = new THREE.Mesh(
            buildingGeometry,
            new THREE.MeshPhongMaterial({ 
                color: 0xff6b6b,
                shininess: 30,
                specular: 0xffffff
            })
        );
        leftBuilding.position.x = -laneWidth * 2;
        leftBuilding.position.z = -i * 20;
        leftBuilding.position.y = 5; // Set proper height
        leftBuilding.castShadow = true;
        cityBackground.add(leftBuilding);

        // Right side buildings
        const rightBuilding = new THREE.Mesh(
            buildingGeometry,
            new THREE.MeshPhongMaterial({ 
                color: 0xff6b6b,
                shininess: 30,
                specular: 0xffffff
            })
        );
        rightBuilding.position.x = laneWidth * 2;
        rightBuilding.position.z = -i * 20;
        rightBuilding.position.y = 5; // Set proper height
        rightBuilding.castShadow = true;
        cityBackground.add(rightBuilding);
    }
    
    return cityBackground;
}

// Create visual lanes
function createLanes() {
    const laneGroup = new THREE.Group();
    const laneWidth = 3;
    const laneLength = 100;
    const laneCount = 3;
    
    // Create lane markers
    for (let i = -1; i <= 1; i++) {
        // Lane dividers
        const dividerGeometry = new THREE.BoxGeometry(0.1, 0.1, laneLength);
        const dividerMaterial = new THREE.MeshPhongMaterial({ 
            color: 0xffffff,
            emissive: 0xffffff,
            emissiveIntensity: 0.5
        });
        const divider = new THREE.Mesh(dividerGeometry, dividerMaterial);
        divider.position.set(i * laneWidth, 0.05, -1); // Moved lanes closer
        laneGroup.add(divider);
        
        // Lane markers
        for (let j = 0; j < laneLength; j += 2) {
            const markerGeometry = new THREE.BoxGeometry(0.5, 0.1, 0.5);
            const markerMaterial = new THREE.MeshPhongMaterial({ 
                color: 0xffffff,
                emissive: 0xffffff,
                emissiveIntensity: 0.5
            });
            const marker = new THREE.Mesh(markerGeometry, markerMaterial);
            marker.position.set(i * laneWidth, 0.05, -j - 1); // Moved markers closer
            laneGroup.add(marker);
        }
    }
    
    return laneGroup;
}

// Create textured floor
function createFloor() {
    const floorGroup = new THREE.Group();
    const roadWidth = 12;
    const roadLength = 200;
    const laneWidth = 3;
    const sidewalkWidth = 100;

    const roadGeometry = new THREE.PlaneGeometry(roadWidth, roadLength);
    const roadMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x16213e,
        side: THREE.DoubleSide
    });
    const road = new THREE.Mesh(roadGeometry, roadMaterial);
    road.rotation.x = -Math.PI / 2;
    road.position.y = -0.1;
    road.position.z = -1; // Moved floor closer
    road.receiveShadow = true;
    floorGroup.add(road);

    const sidewalkGeometry = new THREE.PlaneGeometry(sidewalkWidth, roadLength);
    const sidewalkMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x0f3460,
        side: THREE.DoubleSide
    });

    const leftSidewalk = new THREE.Mesh(sidewalkGeometry, sidewalkMaterial);
    leftSidewalk.rotation.x = -Math.PI / 2;
    leftSidewalk.position.set(-roadWidth/2 - sidewalkWidth/2, -0.1, -1); // Moved sidewalk closer
    leftSidewalk.receiveShadow = true;
    floorGroup.add(leftSidewalk);

    const rightSidewalk = new THREE.Mesh(sidewalkGeometry, sidewalkMaterial);
    rightSidewalk.rotation.x = -Math.PI / 2;
    rightSidewalk.position.set(roadWidth/2 + sidewalkWidth/2, -0.1, -1); // Moved sidewalk closer
    rightSidewalk.receiveShadow = true;
    floorGroup.add(rightSidewalk);

    // Add manhole covers
    const manholeGeometry = new THREE.CircleGeometry(0.5, 16);
    const manholeMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x1a1a2e,
        side: THREE.DoubleSide
    });

    for (let z = -roadLength/2; z < roadLength/2; z += 20) {
        const manhole = new THREE.Mesh(manholeGeometry, manholeMaterial);
        manhole.rotation.x = -Math.PI / 2;
        manhole.position.set(0, -0.05, z - 1); // Moved manholes closer
        manhole.receiveShadow = true;
        floorGroup.add(manhole);
    }

    return floorGroup;
}

// Create clouds
function createClouds() {
    const cloudGroup = new THREE.Group();
    const cloudCount = 10;
    const cloudSize = 5;
    const cloudHeight = 15;

    for (let i = 0; i < cloudCount; i++) {
        const cloud = new THREE.Group();
        const cloudGeometry = new THREE.SphereGeometry(cloudSize * 0.3, 8, 8);
        const cloudMaterial = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.8
        });

        // Create cloud cluster
        for (let j = 0; j < 5; j++) {
            const cloudPart = new THREE.Mesh(cloudGeometry, cloudMaterial);
            cloudPart.position.set(
                (Math.random() - 0.5) * cloudSize,
                (Math.random() - 0.5) * cloudSize * 0.5,
                (Math.random() - 0.5) * cloudSize
            );
            cloudPart.scale.set(
                1 + Math.random() * 0.5,
                1 + Math.random() * 0.5,
                1 + Math.random() * 0.5
            );
            cloud.add(cloudPart);
        }

        // Position cloud
        cloud.position.set(
            (Math.random() - 0.5) * 100,
            cloudHeight + Math.random() * 5,
            -Math.random() * 200
        );

        // Add random movement
        cloud.userData = {
            speed: 0.01 + Math.random() * 0.02,
            direction: Math.random() < 0.5 ? 1 : -1
        };

        cloudGroup.add(cloud);
    }

    return cloudGroup;
}

// Add city background and lanes to scene
const cityBackground = createCityBackground();
scene.add(cityBackground);

const lanes = createLanes();
scene.add(lanes);

// Add floor and clouds to scene
const floor = createFloor();
scene.add(floor);

const clouds = createClouds();
scene.add(clouds);

// Movement variables
const keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    ' ': false
};

// Event listeners
document.addEventListener('keydown', (event) => {
    if (keys.hasOwnProperty(event.key.toLowerCase())) {
        keys[event.key.toLowerCase()] = true;
    }
});

document.addEventListener('keyup', (event) => {
    if (keys.hasOwnProperty(event.key.toLowerCase())) {
        keys[event.key.toLowerCase()] = false;
    }
});

// Create basic obstacle
function createObstacle() {
    const obstacleGroup = new THREE.Group();
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshPhongMaterial({ 
        color: 0xef476f,
        shininess: 50,
        specular: 0xffffff
    });
    const obstacle = new THREE.Mesh(geometry, material);
    obstacleGroup.add(obstacle);
    obstacleGroup.castShadow = true;
    return obstacleGroup;
}

// Create better-looking collectibles with enhanced effects
function createCollectible() {
    const collectibleGroup = new THREE.Group();
    
    // Main collectible
    const geometry = new THREE.SphereGeometry(0.4, 16, 16);
    const material = new THREE.MeshPhongMaterial({
        color: 0xffd700,
        shininess: 100,
        specular: 0xffffff,
        emissive: 0xffd700,
        emissiveIntensity: 0.5
    });
    const collectible = new THREE.Mesh(geometry, material);
    collectible.castShadow = true;
    collectibleGroup.add(collectible);

    // Add glow effect
    const glowGeometry = new THREE.SphereGeometry(0.5, 16, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0xffd700,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    collectibleGroup.add(glow);

    // Add particles
    const particleCount = 6;
    const particleGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const particleMaterial = new THREE.MeshBasicMaterial({
        color: 0xffd700,
        transparent: true,
        opacity: 0.8
    });

    for (let i = 0; i < particleCount; i++) {
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        const angle = (i / particleCount) * Math.PI * 2;
        const radius = 0.6;
        particle.position.set(
            Math.cos(angle) * radius,
            Math.sin(angle) * radius,
            0
        );
        collectibleGroup.add(particle);
    }

    collectibleGroup.userData = {
        rotationSpeed: 0.05,
        particles: collectibleGroup.children.slice(1)
    };

    return collectibleGroup;
}

// Create better-looking power-ups
function createPowerUp() {
    const powerUpGroup = new THREE.Group();
    
    // Randomly select power-up type
    const types = ['shield', 'speed', 'magnet'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    let geometry, material, color;
    
    switch(type) {
        case 'shield':
            geometry = new THREE.OctahedronGeometry(0.6);
            color = 0x4ecdc4; // Cyan
            break;
        case 'speed':
            geometry = new THREE.TetrahedronGeometry(0.6);
            color = 0xff6b6b; // Red
            break;
        case 'magnet':
            geometry = new THREE.IcosahedronGeometry(0.6);
            color = 0xffd166; // Yellow
            break;
    }
    
    material = new THREE.MeshPhongMaterial({ 
        color: color,
        shininess: 100,
        specular: 0xffffff,
        emissive: color,
        emissiveIntensity: 0.5
    });
    
    const powerUp = new THREE.Mesh(geometry, material);
    powerUp.castShadow = true;
    powerUpGroup.add(powerUp);
    
    // Add glow effect
    const glowGeometry = new THREE.SphereGeometry(0.7, 16, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    powerUpGroup.add(glow);
    
    // Add particles
    const particleCount = 8;
    const particleGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const particleMaterial = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.8
    });
    
    for (let i = 0; i < particleCount; i++) {
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        const angle = (i / particleCount) * Math.PI * 2;
        const radius = 0.8;
        particle.position.set(
            Math.cos(angle) * radius,
            Math.sin(angle) * radius,
            0
        );
        powerUpGroup.add(particle);
    }
    
    powerUpGroup.userData = { 
        rotationSpeed: 0.03,
        type: type,
        particles: powerUpGroup.children.slice(1) // Store particles for animation
    };
    
    return powerUpGroup;
}

// Check collisions
function checkCollisions() {
    if (!gameStarted || gameOver) return;

    const playerBox = new THREE.Box3().setFromObject(player);
    
    // Check obstacle collisions
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obstacleBox = new THREE.Box3().setFromObject(obstacles[i]);
        if (playerBox.intersectsBox(obstacleBox)) {
            if (activePowerUp === 'shield') {
                // Use shield power-up
                activePowerUp = null;
                powerUpDuration = 0;
                document.getElementById('powerup').textContent = 'Power-up: None';
                scene.remove(obstacles[i]);
                obstacles.splice(i, 1);
            } else {
                // Game over
                gameOver = true;
                document.getElementById('gameOver').style.display = 'block';
                document.getElementById('finalScore').textContent = `Final Score: ${Math.floor(score)}`;
                if (score > highScore) {
                    highScore = score;
                    document.getElementById('highScoreDisplay').textContent = `High Score: ${Math.floor(highScore)}`;
                }
                return;
            }
        }
    }
    
    // Check collectible collisions
    for (let i = collectibles.length - 1; i >= 0; i--) {
        const collectibleBox = new THREE.Box3().setFromObject(collectibles[i]);
        if (playerBox.intersectsBox(collectibleBox)) {
            scene.remove(collectibles[i]);
            collectibles.splice(i, 1);
            coins += shopItems.doubleCoins.purchased ? 2 : 1;
            document.getElementById('coins').textContent = `Coins: ${coins}`;
        }
    }

    // Check power-up collisions
    for (let i = powerUps.length - 1; i >= 0; i--) {
        const powerUpBox = new THREE.Box3().setFromObject(powerUps[i]);
        if (playerBox.intersectsBox(powerUpBox)) {
            applyPowerUp(powerUps[i].userData.type);
            scene.remove(powerUps[i]);
            powerUps.splice(i, 1);
        }
    }
}

// Apply power-up effects with visual feedback
function applyPowerUp(type) {
    // Clear any existing power-up first
    if (activePowerUp) {
        player.children[0].material.emissive.setHex(0x000000);
        player.children[0].material.emissiveIntensity = 0;
        if (activePowerUp === 'speed') {
            speed = 0.1; // Reset speed
        }
    }

    activePowerUp = type;
    powerUpDuration = 300;

    // Add visual effect to player
    let effectColor;
    
    switch(type) {
        case 'shield':
            effectColor = 0x4ecdc4;
            document.getElementById('powerup').textContent = 'Power-up: Shield';
            break;
        case 'speed':
            effectColor = 0xff6b6b;
            document.getElementById('powerup').textContent = 'Power-up: Speed Boost';
            speed = 0.15; // Increase speed
            break;
        case 'magnet':
            effectColor = 0xffd166;
            document.getElementById('powerup').textContent = 'Power-up: Magnet';
            break;
    }
    
    player.children[0].material.emissive.setHex(effectColor);
    player.children[0].material.emissiveIntensity = 0.5;

    // Reset visual effect when power-up ends
    setTimeout(() => {
        if (activePowerUp === type) {
            player.children[0].material.emissive.setHex(0x000000);
            player.children[0].material.emissiveIntensity = 0;
            if (type === 'speed') {
                speed = 0.1; // Reset speed
            }
            activePowerUp = null;
            document.getElementById('powerup').textContent = 'Power-up: None';
        }
    }, powerUpDuration * 16.67); // Convert frames to milliseconds
}

// Reset game state with improved feedback
function resetGame() {
    // Reset game state
    score = 0;
    coins = 0;
    gameOver = false;
    speed = 0.1;
    lane = 0;
    isJumping = false;
    isSliding = false;
    
    // Clear any active power-up
    if (activePowerUp) {
        player.children[0].material.emissive.setHex(0x000000);
        player.children[0].material.emissiveIntensity = 0;
        activePowerUp = null;
        powerUpDuration = 0;
    }
    
    // Reset player position and state
    player.position.set(0, 0.5, 0);
    player.rotation.set(0, 0, 0);
    player.userData.armRotation = 0;
    player.userData.legRotation = 0;
    
    // Clear all objects
    obstacles.forEach(obstacle => scene.remove(obstacle));
    collectibles.forEach(collectible => scene.remove(collectible));
    powerUps.forEach(powerUp => scene.remove(powerUp));
    obstacles.length = 0;
    collectibles.length = 0;
    powerUps.length = 0;
    
    // Reset UI displays
    updateUI();
}

// Move lane markers
function moveLanes() {
    lanes.position.z += speed;
    if (lanes.position.z > 2) {
        lanes.position.z = 0;
    }
}

// Move clouds
function moveClouds() {
    clouds.children.forEach(cloud => {
        cloud.position.x += cloud.userData.speed * cloud.userData.direction;
        if (cloud.position.x > 60) {
            cloud.position.x = -60;
        } else if (cloud.position.x < -60) {
            cloud.position.x = 60;
        }
    });
}

// Optimize player movement and animation
function movePlayer() {
    if (keys.w && !isJumping && !isSliding) {
        isJumping = true;
        jumpHeight = 0;
    }

    if (isJumping) {
        jumpHeight += 0.1;
        player.position.y = 0.5 + Math.sin(jumpHeight) * 2;
        if (jumpHeight >= Math.PI) {
            isJumping = false;
            player.position.y = 0.5;
        }
    }

    if (keys.s && !isJumping && !isSliding) {
        isSliding = true;
        slideDuration = 0;
        player.scale.y = 0.5;
        player.position.y = 0.25;
    }

    if (isSliding) {
        slideDuration++;
        if (slideDuration >= 60) {
            isSliding = false;
            player.scale.y = 1;
            player.position.y = 0.5;
        }
    }

    const currentTime = performance.now() / 1000;
    if (currentTime - lastLaneSwitch >= laneSwitchDelay) {
        canSwitchLane = true;
    }

    if (canSwitchLane) {
        if (keys.a && lane > -1) {
            lane--;
            player.position.x = lane * laneWidth;
            canSwitchLane = false;
            lastLaneSwitch = currentTime;
        }
        if (keys.d && lane < 1) {
            lane++;
            player.position.x = lane * laneWidth;
            canSwitchLane = false;
            lastLaneSwitch = currentTime;
        }
    }
}

// Initialize object pools for better performance
function initializeObjectPools() {
    // Create initial pool of objects
    for (let i = 0; i < 10; i++) {
        objectPool.obstacles.push(createObstacle());
        objectPool.collectibles.push(createCollectible());
        objectPool.powerUps.push(createPowerUp());
    }
}

// Get object from pool or create new one
function getObjectFromPool(type) {
    const pool = objectPool[type];
    if (pool.length > 0) {
        return pool.pop();
    }
    // Create new object if pool is empty
    switch (type) {
        case 'obstacles':
            return createObstacle();
        case 'collectibles':
            return createCollectible();
        case 'powerUps':
            return createPowerUp();
    }
}

// Return object to pool
function returnObjectToPool(object, type) {
    objectPool[type].push(object);
}

// Start the game
animate();

// Add handleKeyDown function
function handleKeyDown(event) {
    if (!gameStarted || gameOver) return;
    
    switch(event.key.toLowerCase()) {
        case 'arrowleft':
        case 'a':
            if (lane > -1) {
                lane--;
                player.position.x = lane * laneWidth;
            }
            break;
        case 'arrowright':
        case 'd':
            if (lane < 1) {
                lane++;
                player.position.x = lane * laneWidth;
            }
            break;
        case 'arrowup':
        case 'w':
            if (!isJumping) {
                isJumping = true;
                player.position.y = 1;
            }
            break;
        case 'arrowdown':
        case 's':
            if (!isSliding) {
                isSliding = true;
                player.scale.y = 0.5;
            }
            break;
    }
}

// Add handleKeyUp function
function handleKeyUp(event) {
    if (!gameStarted || gameOver) return;
    
    switch(event.key.toLowerCase()) {
        case 'arrowdown':
        case 's':
            if (isSliding) {
                isSliding = false;
                player.scale.y = 1;
            }
            break;
    }
}

// Add decorative clouds
function addClouds(scene) {
    const cloudGeometry = new THREE.SphereGeometry(2, 8, 8);
    const cloudMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.8
    });

    for (let i = 0; i < 10; i++) {
        const cloud = new THREE.Mesh(cloudGeometry, cloudMaterial);
        cloud.position.set(
            Math.random() * 100 - 50,
            Math.random() * 10 + 10,
            Math.random() * 100 - 50
        );
        cloud.scale.set(
            Math.random() * 2 + 1,
            Math.random() * 0.5 + 0.5,
            Math.random() * 2 + 1
        );
        scene.add(cloud);
    }
}

// Add decorative stars
function addStars(scene) {
    const starGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const starMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.8
    });

    for (let i = 0; i < 100; i++) {
        const star = new THREE.Mesh(starGeometry, starMaterial);
        star.position.set(
            Math.random() * 200 - 100,
            Math.random() * 50 + 50,
            Math.random() * 200 - 100
        );
        scene.add(star);
    }
}

// Add touch event handlers
document.addEventListener('DOMContentLoaded', () => {
    // Prevent default touch behaviors
    document.addEventListener('touchmove', (e) => {
        if (e.target.id === 'mobile-controls' || e.target.tagName === 'BUTTON') {
            e.preventDefault();
        }
    }, { passive: false });

    // Handle touch events for game controls
    const gameContainer = document.getElementById('gameContainer');
    gameContainer.addEventListener('touchstart', (e) => {
        if (!gameStarted || gameOver) return;
        e.preventDefault();
    }, { passive: false });
}); 