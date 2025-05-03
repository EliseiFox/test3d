// -------------------- НАСТРАИВАЕМЫЕ ПАРАМЕТРЫ ИГРЫ --------------------

// Параметры игрока
const PLAYER_SPEED = 50.0;       // Скорость движения игрока
const PLAYER_JUMP_HEIGHT = 7.0; // Начальная скорость прыжка игрока по Y
const PLAYER_HEIGHT = 2.0;      // Высота "глаз" игрока над поверхностью земли
const GRAVITY = 30.0;           // Ускорение свободного падения
const PLAYER_COLLISION_TOLERANCE = 0.3; // Небольшой допуск для коллизии, увеличено

// Параметры мира/ландшафта
const WORLD_SEED_NUMBER = 54321; // Измените для другого рельефа и расположения домов
const TERRAIN_SIZE = 512;         // Размер квадратного ландшафта
const TERRAIN_SEGMENTS = 256;     // Количество сегментов по каждой оси
const TERRAIN_HEIGHT_SCALE = 10;  // Максимальная высота/глубина холмов (увеличено)
const TERRAIN_NOISE_SCALE = 0.008; // Масштаб шума (чем меньше, тем крупнее холмы) (уменьшено)

// Параметры текстуры ландшафта
const TERRAIN_TEXTURE_PATH = 'grass_texture_1024.png'; // Путь к текстуре
const TERRAIN_TEXTURE_TILE_SIZE = 80;     // Размер в мировых единицах, на который натягивается один тайл текстуры

// Параметры генерации домов
const NUM_HOUSES = 100;                     // Количество генерируемых домов (попыток размещения)
const HOUSE_TEXTURE_PATH = 'house_texture_398_239.png'; // Путь к текстуре дома
const HOUSE_TEXTURE_WIDTH_PX = 398;         // Ширина текстуры дома в пикселях (для расчета соотношения сторон)
const HOUSE_TEXTURE_HEIGHT_PX = 239;        // Высота текстуры дома в пикселях (для расчета соотношения сторон)
const HOUSE_TEXTURE_REPEAT_WIDTH_UNITS = 5.0; // На сколько мировых единиц ширины дома натягивается вся ширина текстуры (398px)
const HOUSE_TEXTURE_REPEAT_HEIGHT_UNITS = 5.0 * (HOUSE_TEXTURE_HEIGHT_PX / HOUSE_TEXTURE_WIDTH_PX); // На сколько мировых единиц высоты дома натягивается вся высота текстуры (239px), рассчитано по соотношению сторон
const HOUSE_MIN_LENGTH_UNITS = 2;           // Минимальная длина дома (вдоль длинной стороны) в HOUSE_TEXTURE_REPEAT_WIDTH_UNITS
const HOUSE_MAX_LENGTH_UNITS = 10;          // Максимальная длина дома (вдоль длинной стороны) в HOUSE_TEXTURE_REPEAT_WIDTH_UNITS
const HOUSE_MIN_WIDTH = 5.0;                // Минимальная ширина дома (вдоль короткой стороны)
const HOUSE_MAX_WIDTH = 15.0;               // Максимальная ширина дома (вдоль короткой стороны)
const HOUSE_MIN_HEIGHT = 20.0;              // Минимальная высота дома
const HOUSE_MAX_HEIGHT = 80.0;              // Максимальная высота дома
const HOUSE_SUBMERSION_DEPTH = 2.0;         // Насколько дом "утоплен" в землю (увеличено)
const HOUSE_PLACEMENT_MARGIN = 50;           // Отступ от края ландшафта для размещения домов
const HOUSE_MAX_SLOPE_DEGREES = 25;         // Максимальный наклон рельефа в градусах


// -------------------- КОНЕЦ НАСТРАИВАЕМЫЕ ПАРАМЕТРОВ --------------------


// Объявляем основные переменные Three.js
let camera, scene, renderer;
let controls; // Переменная для PointerLockControls
let terrainMesh; // Ссылка на созданный меш ландшафта
let houseMeshes = []; // Массив для хранения всех мешей домов

// Переменные состояния игры
let isGameActive = false; // Флаг активности игры (когда PointerLockControls активен)

// Переменные для управления движением
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;

// Переменные для физики
let playerVelocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const tempVector = new THREE.Vector3(); // Временный вектор для расчетов

let prevTime = performance.now(); // Время предыдущего кадра для расчета deltaTime

// Элементы DOM для инструкций
const blocker = document.getElementById('blocker');
const instructions = document.getElementById('instructions');

// Переменные для определения высоты игрока над землей и горизонтальной коллизии
const raycaster = new THREE.Raycaster();
const down = new THREE.Vector3(0, -1, 0); // Вектор направления вниз
const horizontalRayOffset = PLAYER_COLLISION_TOLERANCE + 0.1; // Небольшой отступ для горизонтальных лучей


// Сидируемый генератор случайных чисел для повторяемости расположения объектов
let houseRandomSeed;
function setHouseSeed(seed) {
    // Используем простое LCG для генерации случайных чисел по сиду
    // Modulo и множитель выбраны для достаточно хорошего распределения
    houseRandomSeed = Math.abs(seed) % 2147474937; // Большое простое число
    if (houseRandomSeed <= 0) houseRandomSeed = 1; // Сид не должен быть 0
}

function houseRandom() {
    // Park-Miller PRNG
    houseRandomSeed = (houseRandomSeed * 16807) % 2147483647;
    // Нормализуем результат в диапазон [0, 1)
    return (houseRandomSeed - 1) / 2147483646;
}

// ------------- Инициализация сцены -------------
function init() {
    // Проверка на наличие глобального объекта noise
    if (typeof noise === 'undefined' || !noise.seed || !noise.simplex2) {
        console.error("Ошибка: Библиотека simplex-noise.js не найдена или загружена некорректно.");
        blocker.style.display = 'block';
        instructions.innerHTML = "<p style='color:red;'>Ошибка загрузки игры: Библиотека шума не найдена.</p><p style='font-size: 14px; color: grey;'>Убедитесь, что файл simplex-noise.js находится рядом с index.html и script.js и подключен в index.html.</p><p style='font-size: 14px; color: grey;'>Также проверьте консоль браузера (F12) на наличие других ошибок.</p>";
        return; // Останавливаем инициализацию
    }

    // Устанавливаем сид для генератора шума Simplex Noise
    const validatedSeed = Math.abs(WORLD_SEED_NUMBER) % 65536; // SimplexNoise supports 0-65535
    if (validatedSeed === 0) noise.seed(1); // Avoid seed 0 if it has issues
    else noise.seed(validatedSeed);
    console.log("Генерация ландшафта с сидом:", validatedSeed);

    // Устанавливаем сид для генератора случайных чисел домов
    setHouseSeed(WORLD_SEED_NUMBER); // Используем тот же сид для повторяемости
    console.log("Генерация домов с сидом:", WORLD_SEED_NUMBER);


    // Создаем сцену
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // Устанавливаем цвет неба
    scene.fog = new THREE.Fog(0xffffff, TERRAIN_SIZE * 0.5, TERRAIN_SIZE * 1.5); // Добавляем туман

    // Создаем камеру
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000); // Увеличена дальность обзора
    // Стартовая позиция в центре мира, чуть выше самой высокой возможной точки + высота игрока
    camera.position.set(0, TERRAIN_HEIGHT_SCALE + PLAYER_HEIGHT + 5, 0);


    // Создаем рендерер WebGL
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Включаем логарифмический буфер глубины
    renderer.logarithmicDepthBuffer = true;


    // ------------- Добавляем свет -------------
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Увеличена интенсивность
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1).normalize();
    scene.add(directionalLight);

    // ------------- Создаем и генерируем рельеф -------------
    generateTerrain();

    // ------------- Генерируем и размещаем дома -------------
    // Важно: Дома генерируются после ландшафта, т.к. raycaster'у нужен terrainMesh
    // и terrainMesh должен быть полностью готов (добавлен в сцену и обновлена матрица).
    // Генерируем после добавления terrainMesh в сцену
    generateHouses();


    // ------------- Настраиваем PointerLockControls -------------
    controls = new THREE.PointerLockControls(camera, document.body);

    // Добавляем обработчики событий блокировки/разблокировки указателя
    controls.addEventListener('lock', function () {
        isGameActive = true; // Активируем игровой процесс
        blocker.style.display = 'none';
        prevTime = performance.now(); // Сбрасываем время
    });

    controls.addEventListener('unlock', function () {
        isGameActive = false; // Деактивируем игровой процесс
        blocker.style.display = 'block';
        instructions.style.display = 'flex'; // Показываем инструкции
        playerVelocity.set(0, 0, 0); // Останавливаем движение при разблокировке
         // Сбрасываем флаги движения
         moveForward = false;
         moveBackward = false;
         moveLeft = false;
         moveRight = false;
    });

    // Добавляем объект контролов в сцену. Камера прикреплена к этому объекту.
    scene.add(controls.getObject());

    // ------------- Обработка событий клавиатуры -------------
    const onKeyDown = function (event) {
        // Обрабатываем ESC всегда, чтобы можно было выйти из PointerLock
        if (event.code === 'Escape') {
            controls.unlock();
            return;
        }

        if (!isGameActive) return; // Игнорируем ввод движения, если игра не активна

        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                moveForward = true;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                moveLeft = true;
                break;
            case 'ArrowDown':
            case 'KeyS':
                moveBackward = true;
                break;
            case 'ArrowRight':
            case 'KeyD':
                moveRight = true;
                break;
            case 'Space':
                if (canJump === true) {
                    playerVelocity.y = PLAYER_JUMP_HEIGHT; // Устанавливаем начальную скорость прыжка
                    canJump = false; // Нельзя прыгнуть снова, пока не приземлится
                }
                break;
        }
    };

    const onKeyUp = function (event) {
        // Не игнорируем keyup, даже если игра не активна, чтобы флаги сбрасывались корректно
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                moveForward = false;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                moveLeft = false;
                break;
            case 'ArrowDown':
            case 'KeyS':
                moveBackward = false;
                break;
            case 'ArrowRight':
            case 'KeyD':
                moveRight = false;
                break;
        }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    // ------------- Обработка события клика для захвата указателя -------------
    instructions.addEventListener('click', function () {
         // Требуется интеракция с пользователем для Pointer Lock API
         if (!isGameActive) { // Только если игра еще не активна
             controls.lock();
         }
    });

    // ------------- Обработка изменения размера окна -------------
    window.addEventListener('resize', onWindowResize);

    // Запускаем анимационный цикл
    animate();
}

// ------------- Функция генерации рельефа -------------
function generateTerrain() {
    const geometry = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);

    const textureLoader = new THREE.TextureLoader();
    const groundTexture = textureLoader.load(
        TERRAIN_TEXTURE_PATH,
        function (texture) {
            console.log("Текстура ландшафта загружена успешно:", TERRAIN_TEXTURE_PATH);
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(TERRAIN_SIZE / TERRAIN_TEXTURE_TILE_SIZE, TERRAIN_SIZE / TERRAIN_TEXTURE_TILE_SIZE);
            texture.magFilter = THREE.LinearFilter;
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

            if (terrainMesh && terrainMesh.material) {
                 terrainMesh.material.map = texture;
                 terrainMesh.material.color = null;
                 terrainMesh.material.needsUpdate = true;
            }
        },
        undefined,
        function (err) {
            console.error('Ошибка загрузки текстуры ландшафта:', TERRAIN_TEXTURE_PATH, err);
             if (terrainMesh && terrainMesh.material) {
                 terrainMesh.material = new THREE.MeshLambertMaterial({ color: 0x00aa00, side: THREE.DoubleSide }); // Запасной зеленый цвет
                 terrainMesh.material.needsUpdate = true;
                 instructions.innerHTML = "<p style='color:red;'>Ошибка загрузки текстуры ландшафта.</p><p style='font-size: 14px; color: grey;'>Убедитесь, что файл " + TERRAIN_TEXTURE_PATH + " находится рядом с index.html и script.js.</p><p style='font-size: 14px; color: grey;'>Также проверьте консоль браузера (F12) на наличие других ошибок (например, CORS).</p>";
                 blocker.style.display = 'block';
             }
        }
    );

    const positionAttribute = geometry.attributes.position;
    const uvAttribute = geometry.attributes.uv;
    const vertices = positionAttribute.array;
    const uvs = uvAttribute.array;

    const numVertices = (TERRAIN_SEGMENTS + 1) * (TERRAIN_SEGMENTS + 1);

    for (let i = 0; i < numVertices; i++) {
        const originalX = vertices[i * 3];
        const originalY = vertices[i * 3 + 1];

        const height = noise.simplex2(originalX * TERRAIN_NOISE_SCALE, originalY * TERRAIN_NOISE_SCALE) * TERRAIN_HEIGHT_SCALE;

        vertices[i * 3 + 2] = height;

        // UVs already correctly map -TERRAIN_SIZE/2 to TERRAIN_SIZE/2 to 0-1 range by default PlaneGeometry
        // We only need to scale them based on our desired tile size
        const u = (originalX + TERRAIN_SIZE / 2) / TERRAIN_TEXTURE_TILE_SIZE;
        const v = (originalY + TERRAIN_SIZE / 2) / TERRAIN_TEXTURE_TILE_SIZE; // Note: originalY is -height/2 to height/2, map to 0-1 range then scale

        uvs[i * 2] = u;
        uvs[i * 2 + 1] = v;
    }

    positionAttribute.needsUpdate = true;
    uvAttribute.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();


    const material = new THREE.MeshLambertMaterial({
        map: groundTexture,
        color: groundTexture.isTexture ? null : 0x00aa00,
        side: THREE.DoubleSide
    });

    terrainMesh = new THREE.Mesh(geometry, material);
    terrainMesh.rotation.x = -Math.PI / 2; // Поворачиваем плоскость, чтобы она лежала на XZ
     terrainMesh.receiveShadow = true; // Добавляем прием теней на ландшафт (если свет поддерживает тени)
    scene.add(terrainMesh);

    terrainMesh.updateMatrixWorld(true); // Обновляем мировую матрицу для корректной работы Raycaster
}


// ------------- Функция генерации домов -------------
function generateHouses() {
    const textureLoader = new THREE.TextureLoader();
    const houseTexture = textureLoader.load(
        HOUSE_TEXTURE_PATH,
        function(texture) {
            console.log("Текстура дома загружена успешно:", HOUSE_TEXTURE_PATH);
             texture.wrapS = THREE.RepeatWrapping;
             texture.wrapT = THREE.RepeatWrapping;
             texture.magFilter = THREE.LinearFilter;
             texture.minFilter = THREE.LinearMipmapLinearFilter;
             texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

             scene.traverse(function(object) {
                 if (object.isMesh && object !== terrainMesh && object.material.userData && object.material.userData.isHouseMaterial) {
                     object.material.map = texture;
                     object.material.color = null;
                     object.material.needsUpdate = true;
                 }
             });
        },
        undefined, // Progress callback
        function(err) {
            console.error('Ошибка загрузки текстуры дома:', HOUSE_TEXTURE_PATH, err);
             scene.traverse(function(object) {
                 if (object.isMesh && object !== terrainMesh && object.material.userData && object.material.userData.isHouseMaterial) {
                    object.material = new THREE.MeshLambertMaterial({ color: 0x8b4513 }); // Brown fallback
                    object.material.needsUpdate = true;
                 }
             });
             instructions.innerHTML = "<p style='color:red;'>Ошибка загрузки текстуры дома.</p><p style='font-size: 14px; color: grey;'>Убедитесь, что файл " + HOUSE_TEXTURE_PATH + " находится рядом с index.html и script.js.</p><p style='font-size: 14px; color: grey;'>Также проверьте консоль браузера (F12) на наличие других ошибок (например, CORS).</p>";
             blocker.style.display = 'block';
        }
    );

    const houseMaterial = new THREE.MeshLambertMaterial({
         map: houseTexture && houseTexture.isTexture ? houseTexture : null,
         color: houseTexture && houseTexture.isTexture ? null : 0x8b4513
    });
    houseMaterial.userData.isHouseMaterial = true;


    const houseRaycaster = new THREE.Raycaster();
    const raycastOriginHeight = TERRAIN_HEIGHT_SCALE + HOUSE_MAX_HEIGHT + 100;
    const raycastDistance = raycastOriginHeight + TERRAIN_HEIGHT_SCALE + 100;

    const maxSlopeCos = Math.cos(THREE.MathUtils.degToRad(HOUSE_MAX_SLOPE_DEGREES));

    const terrainHalfSize = TERRAIN_SIZE / 2;
    const minX = -terrainHalfSize + HOUSE_PLACEMENT_MARGIN;
    const maxX = terrainHalfSize - HOUSE_PLACEMENT_MARGIN;
    const minZ = -terrainHalfSize + HOUSE_PLACEMENT_MARGIN;
    const maxZ = terrainHalfSize - HOUSE_PLACEMENT_MARGIN;

    let placedHousesCount = 0;

    // Очищаем массив домов перед генерацией (на случай повторного вызова)
    houseMeshes = [];
    // Удаляем старые дома из сцены (если есть)
    scene.traverse(function(object) {
        if (object.isMesh && object !== terrainMesh && object.userData.isHouse) {
            scene.remove(object);
             // Освобождаем память
             if (object.geometry) object.geometry.dispose();
             if (object.material && object.material.dispose) object.material.dispose();
        }
    });


    for (let i = 0; i < NUM_HOUSES; i++) {
        const randX = houseRandom() * (maxX - minX) + minX;
        const randZ = houseRandom() * (maxZ - minZ) + minZ;

        const rayOrigin = new THREE.Vector3(randX, raycastOriginHeight, randZ);
        houseRaycaster.set(rayOrigin, down);
        houseRaycaster.far = raycastDistance;

        // Проверяем пересечение луча только с мешем рельефа для поиска места
        const intersects = houseRaycaster.intersectObject(terrainMesh, false);

        if (intersects.length > 0) {
            const hit = intersects[0];
            const groundPosition = hit.point;
            const groundNormal = hit.face.normal.clone();
            groundNormal.transformDirection(terrainMesh.matrixWorld).normalize();

            if (groundNormal.y < maxSlopeCos) {
                continue; // Слишком крутой склон
            }

            const houseLengthUnits = Math.floor(houseRandom() * (HOUSE_MAX_LENGTH_UNITS - HOUSE_MIN_LENGTH_UNITS + 1)) + HOUSE_MIN_LENGTH_UNITS;
            // Длина дома вдоль Z (глубина BoxGeometry) зависит от HOUSE_TEXTURE_REPEAT_WIDTH_UNITS
            const houseLength = houseLengthUnits * HOUSE_TEXTURE_REPEAT_WIDTH_UNITS;
            // Ширина дома вдоль X (ширина BoxGeometry)
            const houseWidth = houseRandom() * (HOUSE_MAX_WIDTH - HOUSE_MIN_WIDTH) + HOUSE_MIN_WIDTH;
            // Высота дома вдоль Y (высота BoxGeometry)
            const houseHeight = houseRandom() * (HOUSE_MAX_HEIGHT - HOUSE_MIN_HEIGHT) + HOUSE_MIN_HEIGHT;

            // Проверяем, не выходит ли дом за границы ландшафта после определения размеров
            const halfWidth = houseWidth / 2;
            const halfLength = houseLength / 2;
            if (randX - halfWidth < minX || randX + halfWidth > maxX || randZ - halfLength < minZ || randZ + halfLength > maxZ) {
                 continue; // Дом слишком большой для размещения в границах отступа
            }


            const houseGeometry = new THREE.BoxGeometry(houseWidth, houseHeight, houseLength);

            // --- Настройка UV координат ---
            const uvs = houseGeometry.attributes.uv.array;
            const positions = houseGeometry.attributes.position.array;

            // Определяем размеры граней в мировых единицах (относительно центра геометрии)
            const geomWidth = houseWidth;
            const geomHeight = houseHeight;
            const geomDepth = houseLength;

            const uTile = HOUSE_TEXTURE_REPEAT_WIDTH_UNITS; // Ширина одного тайла текстуры в мировых единицах
            const vTile = HOUSE_TEXTURE_REPEAT_HEIGHT_UNITS; // Высота одного тайла текстуры в мировых единицах

            // BoxGeometry UV mapping order: +X, -X, +Y, -Y, +Z, -Z
            // Each face has 4 vertices, 2 UV coordinates per vertex = 8 UVs per face.
            // 6 faces * 8 UVs/face = 48 UVs total for the 24 vertices.

            for (let j = 0; j < uvs.length; j += 2) {
                 const defaultU = uvs[j];
                 const defaultV = uvs[j + 1];
                 const vertexIndex = j / 2; // index 0-23

                 // Find the face index (0-5) and the vertex index within the face (0-3)
                 const faceIndex = Math.floor(vertexIndex / 4);
                 const vertexInFaceIndex = vertexIndex % 4;

                 // Get the local vertex position for reference (optional, but helps logic)
                 const localX = positions[vertexIndex * 3];
                 const localY = positions[vertexIndex * 3 + 1];
                 const localZ = positions[vertexIndex * 3 + 2];

                 let uScaled, vScaled;

                 switch (faceIndex) {
                      case 0: // +X face (Right side)
                      case 1: // -X face (Left side)
                          // Default UVs map Y to U, Z to V.
                          // Face maps along local Y (height) and local Z (depth/length).
                          // We want U to map local Z (depth/length), V to map local Y (height).
                          // U range: 0 to geomDepth. V range: 0 to geomHeight.
                          // Need to map local Z position to U, local Y position to V.
                          // Vertex coords are -geomWidth/2..geomWidth/2, -geomHeight/2..geomHeight/2, -geomDepth/2..geomDepth/2
                          // For +X/-X faces, local X is fixed at +/- geomWidth/2.
                          // We map local Z (-geomDepth/2 to geomDepth/2) to U (0 to num_repeats_U).
                          // We map local Y (-geomHeight/2 to geomHeight/2) to V (0 to num_repeats_V).
                          // Scale U by (geomDepth / uTile), V by (geomHeight / vTile).
                          // Default U is based on local Y extent (0-1), default V is based on local Z extent (0-1).
                          // We need to map defaultV (0-1 based on Z) to U, and defaultU (0-1 based on Y) to V.
                          uScaled = defaultV * (geomDepth / uTile); // V based on Z, scale by total repeats along depth
                          vScaled = defaultU * (geomHeight / vTile); // U based on Y, scale by total repeats along height
                          uvs[j] = uScaled;
                          uvs[j+1] = vScaled;
                          break;

                      case 2: // +Y face (Top)
                      case 3: // -Y face (Bottom)
                          // Default UVs map X to U, Z to V.
                          // Face maps along local X (width) and local Z (depth/length).
                          // We want U to map local X (width), V to map local Z (depth/length).
                          // U range: 0 to geomWidth. V range: 0 to geomDepth.
                          // Scale U by (geomWidth / uTile), V by (geomDepth / uTile) - typically top/bottom use same tile size for both axes.
                          // Default U is based on local X extent (0-1), default V is based on local Z extent (0-1).
                          uScaled = defaultU * (geomWidth / uTile); // U based on X, scale by repeats along width
                          vScaled = defaultV * (geomDepth / uTile); // V based on Z, scale by repeats along depth
                          uvs[j] = uScaled;
                          uvs[j+1] = vScaled;
                          break;

                      case 4: // +Z face (Back side)
                      case 5: // -Z face (Front side)
                          // Default UVs map X to U, Y to V.
                          // Face maps along local X (width) and local Y (height).
                          // We want U to map local X (width), V to map local Y (height).
                          // U range: 0 to geomWidth. V range: 0 to geomHeight.
                          // Scale U by (geomWidth / uTile), V by (geomHeight / vTile).
                          // Default U is based on local X extent (0-1), default V is based on local Y extent (0-1).
                          uScaled = defaultU * (geomWidth / uTile); // U based on X, scale by repeats along width
                          vScaled = defaultV * (geomHeight / vTile); // V based on Y, scale by repeats along height
                          uvs[j] = uScaled;
                          uvs[j+1] = vScaled;
                          break;
                 }
            }

            houseGeometry.attributes.uv.needsUpdate = true;
            // --- Конец настройки UV координат ---


            const houseMesh = new THREE.Mesh(houseGeometry, houseMaterial);

            houseMesh.position.copy(groundPosition);
            // Позиционируем центр дома так, чтобы нижняя грань была на groundPosition - HOUSE_SUBMERSION_DEPTH
            houseMesh.position.y += houseHeight / 2 - HOUSE_SUBMERSION_DEPTH;


            const upVector = new THREE.Vector3(0, 1, 0);
            houseMesh.quaternion.setFromUnitVectors(upVector, groundNormal);

            houseMesh.userData.isHouse = true; // Помечаем меш как дом для удобства
            houseMesh.castShadow = true; // Добавляем отбрасывание теней от дома
             houseMesh.receiveShadow = true; // Добавляем прием теней на дом

            scene.add(houseMesh);
            houseMeshes.push(houseMesh); // Добавляем дом в массив для коллизии
            placedHousesCount++;
             // console.log(`Successfully placed house ${placedHousesCount} at X: ${groundPosition.x.toFixed(2)}, Y: ${groundPosition.y.toFixed(2)}, Z: ${groundPosition.z.toFixed(2)}`);

        } else {
             // console.warn(`Raycast for house ${i+1} DID NOT hit terrain at X: ${randX.toFixed(2)}, Z: ${randZ.toFixed(2)}. Ray origin Y: ${rayOrigin.y.toFixed(2)}, Far: ${raycastDistance.toFixed(2)}. Terrain Y bounds approx [${-TERRAIN_HEIGHT_SCALE}, ${TERRAIN_HEIGHT_SCALE}]`);
        }
    }
     console.log(`Попыток разместить домов: ${NUM_HOUSES}. Успешно размещено: ${placedHousesCount}.`);
}


// ------------- Обработка изменения размера окна -------------
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ------------- Анимационный цикл -------------
function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const deltaTime = (time - prevTime) / 1000;

    // Обновляем физику и позицию игрока только если игра активна
    if (isGameActive) {

        // Применяем гравитацию
        playerVelocity.y -= GRAVITY * deltaTime;

        // Рассчитываем желаемое горизонтальное движение на основе нажатых клавиш
        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        // Нормализуем, только если есть движение по обеим осям
        if (direction.x !== 0 || direction.z !== 0) {
             direction.normalize();
        }

        // Рассчитываем предполагаемый горизонтальный сдвиг за этот кадр
        const moveDeltaX = direction.x * PLAYER_SPEED * deltaTime;
        const moveDeltaZ = direction.z * PLAYER_SPEED * deltaTime;

        // --- Горизонтальная коллизия с рельефом и домами ---
        // Создаем список объектов для проверки коллизии
        const collisionObjects = [terrainMesh, ...houseMeshes];

        // Проверяем коллизию для каждого направления движения отдельно
        let actualMoveX = moveDeltaX;
        let actualMoveZ = moveDeltaZ;

        // Raycast вперед/назад
        if (moveDeltaZ !== 0) {
             tempVector.copy(direction); // direction уже нормализован и в локальной горизонтальной плоскости камеры
             tempVector.y = 0; // Убедимся, что вектор строго горизонтальный
             tempVector.normalize(); // Пере-нормализуем на всякий случай
             // Получаем направление в мировых координатах
             const rayDirectionZ = tempVector.applyQuaternion(camera.quaternion); // Применяем вращение камеры

             // Начало луча - текущая позиция игрока
             const rayOrigin = camera.position.clone();

             // Проверяем спереди или сзади
             raycaster.set(rayOrigin, rayDirectionZ);
             raycaster.far = Math.abs(moveDeltaZ) + horizontalRayOffset; // Проверяем чуть дальше, чем предполагаемое движение

             const horizontalIntersectsZ = raycaster.intersectObjects(collisionObjects, true);

             if (horizontalIntersectsZ.length > 0 && horizontalIntersectsZ[0].distance <= Math.abs(moveDeltaZ) + horizontalRayOffset) {
                 // Столкнулись с чем-то при движении вперед/назад
                 actualMoveZ = 0; // Останавливаем движение по Z
                 // Можно добавить небольшое скольжение: actualMoveZ = Math.sign(moveDeltaZ) * Math.max(0, horizontalIntersectsZ[0].distance - horizontalRayOffset);
                 // Но полное прекращение движения проще и часто достаточно.
             }
        }

        // Raycast влево/вправо
        if (moveDeltaX !== 0) {
            tempVector.set(direction.x, 0, 0); // направление только по локальной X
            tempVector.normalize();
             const rayDirectionX = tempVector.applyQuaternion(camera.quaternion); // Применяем вращение камеры

             const rayOrigin = camera.position.clone();

             raycaster.set(rayOrigin, rayDirectionX);
             raycaster.far = Math.abs(moveDeltaX) + horizontalRayOffset;

             const horizontalIntersectsX = raycaster.intersectObjects(collisionObjects, true);

             if (horizontalIntersectsX.length > 0 && horizontalIntersectsX[0].distance <= Math.abs(moveDeltaX) + horizontalRayOffset) {
                 // Столкнулись с чем-то при движении влево/вправо
                 actualMoveX = 0; // Останавливаем движение по X
                 // Можно добавить скольжение: actualMoveX = Math.sign(moveDeltaX) * Math.max(0, horizontalIntersectsX[0].distance - horizontalRayOffset);
             }
        }

        // Применяем скорректированное горизонтальное движение
        controls.moveRight(actualMoveX);
        controls.moveForward(actualMoveZ); // Note: PointerLockControls moveForward is along *negative* Z axis

        // Применяем вертикальную скорость
        camera.position.y += playerVelocity.y * deltaTime;

        // --- Вертикальная коллизия с рельефом и домами (земля) ---
        // Создаем луч, идущий вниз от позиции игрока (уровень "ног")
        const feetYOffset = PLAYER_HEIGHT * 0.9; // Начинаем луч чуть выше "ног"
        const raycasterOrigin = camera.position.clone();
        raycasterOrigin.y -= feetYOffset;

        // Дальность луча должна покрывать высоту "ног" до нижнего края игрока + запас
        raycaster.set(raycasterOrigin, down);
        raycaster.far = feetYOffset + PLAYER_COLLISION_TOLERANCE;


        // Проверяем пересечение луча с рельефом и домами
        // intersectObjects вернет массив пересечений, отсортированных по расстоянию
        const intersects = raycaster.intersectObjects(collisionObjects, true);

        // Определяем целевую Y-позицию для ног игрока
        const targetPlayerFeetY = intersects.length > 0 ? intersects[0].point.y : -Infinity;

        // Определяем целевую Y-позицию для глаз игрока (камеры)
        const targetCameraY = targetPlayerFeetY + PLAYER_HEIGHT;


        // Проверяем, находится ли игрок ниже целевого уровня земли + высота игрока
        // Используем небольшой допуск для стабильности
        if (camera.position.y < targetCameraY - PLAYER_COLLISION_TOLERANCE) {
            // Если игрок провалился или ниже земли, перемещаем его ровно на поверхность
            camera.position.y = targetCameraY;

            // Если игрок падал (скорость Y отрицательная), останавливаем падение
            if (playerVelocity.y < 0) {
                 playerVelocity.y = 0;
                 canJump = true; // Разрешаем прыжок
            }

        } else if (camera.position.y <= targetCameraY + PLAYER_COLLISION_TOLERANCE) {
             // Если игрок очень близко к земле сверху (в пределах допуска) ИЛИ ниже земли,
             // и его скорость по Y <= 0 (не прыгает вверх), считаем, что он на земле
             if (playerVelocity.y <= 0) {
                 canJump = true;
                  // Корректируем позицию, если очень близко, чтобы не "висеть"
                  if (camera.position.y < targetCameraY) {
                      camera.position.y = targetCameraY;
                  }
             } else {
                 canJump = false; // Если игрок активно движется вверх (прыгает)
             }

        } else {
            // Если игрок заметно выше земли (за пределами допуска), он в воздухе
            canJump = false;
        }

    } else {
        // Если игра не активна (меню), останавливаем любое движение игрока
        playerVelocity.set(0,0,0);
         direction.x = 0;
         direction.z = 0;
    }


    prevTime = time; // Обновляем время предыдущего кадра

    // ------------- Рендеринг сцены -------------
    renderer.render(scene, camera);
}

// Запускаем инициализацию сцены после загрузки DOM и скриптов
window.addEventListener('load', init);
