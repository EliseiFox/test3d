// -------------------- НАСТРАИВАЕМЫЕ ПАРАМЕТРЫ ИГРЫ --------------------

// Параметры игрока
const PLAYER_SPEED = 50.0;       // Скорость движения игрока
const PLAYER_JUMP_HEIGHT = 7.0; // Начальная скорость прыжка игрока по Y
const PLAYER_HEIGHT = 2.0;      // Высота "глаз" игрока над поверхностью земли
const GRAVITY = 30.0;           // Ускорение свободного падения (увеличено для более выраженного падения/прыжка)
const PLAYER_COLLISION_TOLERANCE = 0.2; // Небольшой допуск для коллизии, чтобы избежать дрожания

// Параметры мира/ландшафта
// Сид для генерации рельефа и расположения объектов. Ваша библиотека шума поддерживает числовые сиды.
// Если вы хотите использовать строку, вам понадобится функция для преобразования строки в число от 1 до 65536.
const WORLD_SEED_NUMBER = 54321; // Измените для другого рельефа и расположения домов
const TERRAIN_SIZE = 512;         // Размер квадратного ландшафта (TERRAIN_SIZE x TERRAIN_SIZE) - увеличено для большего мира
const TERRAIN_SEGMENTS = 256;     // Количество сегментов по каждой оси (больше сегментов = больше деталей, но медленнее) - увеличено для детализации
const TERRAIN_HEIGHT_SCALE = 5;  // Максимальная высота/глубина холмов - увеличено для более выраженного рельефа
const TERRAIN_NOISE_SCALE = 0.01; // Масштаб шума (чем меньше, тем крупнее холмы) - уменьшено для более крупных холмов

// Параметры текстуры ландшафта
const TERRAIN_TEXTURE_PATH = 'grass_texture_1024.png'; // Путь к вашей текстуре PNG 1024x1024
const TERRAIN_TEXTURE_TILE_SIZE = 80;     // Размер в мировых единицах, на который натягивается один тайл текстуры - увеличено, чтобы текстура не была слишком мелкой

// Параметры генерации домов
const NUM_HOUSES = 100;                     // Количество генерируемых домов (попыток размещения)
const HOUSE_TEXTURE_PATH = 'house_texture_398_239.png'; // Путь к текстуре дома (398x239)
const HOUSE_TEXTURE_WIDTH_PX = 398;         // Ширина текстуры дома в пикселях
const HOUSE_TEXTURE_HEIGHT_PX = 239;        // Высота текстуры дома в пикселях
const HOUSE_BASE_UNIT_SIZE = 5.0;           // Базовый размер в мировых единицах, на который натягивается один "тайл" текстуры дома (ширина 398px)
const HOUSE_MIN_LENGTH_UNITS = 2;           // Минимальная длина дома (вдоль длинной стороны) в HOUSE_BASE_UNIT_SIZE
const HOUSE_MAX_LENGTH_UNITS = 10;          // Максимальная длина дома (вдоль длинной стороны) в HOUSE_BASE_UNIT_SIZE
const HOUSE_MIN_WIDTH = 5.0;                // Минимальная ширина дома (вдоль короткой стороны)
const HOUSE_MAX_WIDTH = 15.0;               // Максимальная ширина дома (вдоль короткой стороны)
const HOUSE_MIN_HEIGHT = 20.0;              // Минимальная высота дома
const HOUSE_MAX_HEIGHT = 80.0;              // Максимальная высота дома
const HOUSE_SUBMERSION_DEPTH = 0.5;         // Насколько дом "утоплен" в землю
// const HOUSE_PLACEMENT_RADIUS = TERRAIN_SIZE / 2 - 20; // Радиус внутри мира, где могут появляться дома (немного меньше размера ландшафта) - Заменено на квадратную область с отступом
const HOUSE_PLACEMENT_MARGIN = 50;           // Отступ от края ландшафта для размещения домов
const HOUSE_MAX_SLOPE_DEGREES = 25;         // Максимальный наклон рельефа в градусах, на котором можно поставить дом


// -------------------- КОНЕЦ НАСТРАИВАЕМЫХ ПАРАМЕТРОВ --------------------


// Объявляем основные переменные Three.js
let camera, scene, renderer;
let controls; // Переменная для PointerLockControls
let terrainMesh; // Ссылка на созданный меш ландшафта

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

let prevTime = performance.now(); // Время предыдущего кадра для расчета deltaTime

// Элементы DOM для инструкций
const blocker = document.getElementById('blocker');
const instructions = document.getElementById('instructions');

// Переменные для определения высоты игрока над землей (для коллизии)
const raycaster = new THREE.Raycaster();
const down = new THREE.Vector3(0, -1, 0); // Вектор направления вниз

// Сидируемый генератор случайных чисел для повторяемости расположения объектов
let houseRandomSeed;
function setHouseSeed(seed) {
    // Используем простое LCG для генерации случайных чисел по сиду
    // Modulo и множитель выбраны для достаточно хорошего распределения
    // Используем validatedSeed от Simplex Noise для совместимости, но сбросим его
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
    scene.fog = new THREE.Fog(0xffffff, TERRAIN_SIZE * 0.5, TERRAIN_SIZE * 1.5); // Добавляем туман для оптимизации (скрывает удаленные объекты)

    // Создаем камеру
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    // Стартовая позиция в центре мира, чуть выше самой высокой возможной точки + высота игрока
    camera.position.set(0, TERRAIN_HEIGHT_SCALE + PLAYER_HEIGHT + 5, 0);


    // Создаем рендерер WebGL
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Включаем логарифмический буфер глубины для лучшей точности на больших расстояниях (может повлиять на производительность)
    // renderer.logarithmicDepthBuffer = true;


    // ------------- Добавляем свет -------------
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1).normalize();
    scene.add(directionalLight);

    // ------------- Создаем и генерируем рельеф -------------
    generateTerrain();

    // ------------- Генерируем и размещаем дома -------------
    // Важно: Дома генерируются после ландшафта, т.к. raycaster'у нужен terrainMesh
    generateHouses();


    // ------------- Настраиваем PointerLockControls -------------
    controls = new THREE.PointerLockControls(camera, document.body);

    // Добавляем обработчики событий блокировки/разблокировки указателя
    controls.addEventListener('lock', function () {
        isGameActive = true; // Активируем игровой процесс
        blocker.style.display = 'none';
        prevTime = performance.now(); // Сбрасываем время, чтобы избежать большого deltaTime после паузы
    });

    controls.addEventListener('unlock', function () {
        isGameActive = false; // Деактивируем игровой процесс
        blocker.style.display = 'block';
        instructions.style.display = 'flex'; // Показываем инструкции снова
        playerVelocity.set(0, 0, 0); // Останавливаем движение при разблокировке
    });

    // Добавляем объект контролов в сцену. Камера прикреплена к этому объекту.
    scene.add(controls.getObject());

    // ------------- Обработка событий клавиатуры -------------
    const onKeyDown = function (event) {
        if (!isGameActive) return; // Игнорируем ввод, если игра не активна

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
        controls.lock();
    });

    // ------------- Обработка изменения размера окна -------------
    window.addEventListener('resize', onWindowResize);

    // Запускаем анимационный цикл
    animate();
}

// ------------- Функция генерации рельефа -------------
function generateTerrain() {
    // PlaneGeometry создается в плоскости XY (-width/2 до width/2, -height/2 до height/2)
    // и Z=0. Мы будем использовать X и Y геометрии для мировых X и Z, а Z геометрии для мировой Y (высоты).
    const geometry = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);

    // Загружаем текстуру ландшафта
    const textureLoader = new THREE.TextureLoader();
    const groundTexture = textureLoader.load(
        TERRAIN_TEXTURE_PATH,
        // Колбэк при успешной загрузке
        function (texture) {
            console.log("Текстура ландшафта загружена успешно:", TERRAIN_TEXTURE_PATH);
            texture.wrapS = THREE.RepeatWrapping; // Устанавливаем повторение текстуры по горизонтали
            texture.wrapT = THREE.RepeatWrapping; // Устанавливаем повторение текстуры по вертикали
            // Настраиваем количество повторений текстуры на весь ландшафт
            texture.repeat.set(TERRAIN_SIZE / TERRAIN_TEXTURE_TILE_SIZE, TERRAIN_SIZE / TERRAIN_TEXTURE_TILE_SIZE);
            // Фильтрация для сглаживания и уменьшения мерцания
            texture.magFilter = THREE.LinearFilter;
            texture.minFilter = THREE.LinearMipmapLinearFilter; // Используем мипмапы для лучшей производительности и качества на расстоянии
            // Анизотропная фильтрация - значительно улучшает качество текстур на плоских поверхностях, удаляющихся вдаль
            texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

             // Если материал был создан до загрузки текстуры, обновите его
            if (terrainMesh && terrainMesh.material) {
                 terrainMesh.material.map = texture;
                 terrainMesh.material.color = null; // Убираем цвет по умолчанию
                 terrainMesh.material.needsUpdate = true;
            }
        },
        // Колбэк прогресса загрузки (опционально)
        undefined,
        // Колбэк при ошибке загрузки
        function (err) {
            console.error('Ошибка загрузки текстуры ландшафта:', TERRAIN_TEXTURE_PATH, err);
             // Используем материал запасного цвета, если текстура не загрузилась
             if (terrainMesh && terrainMesh.material) {
                 terrainMesh.material = new THREE.MeshLambertMaterial({ color: 0x00ff00, side: THREE.DoubleSide });
                 terrainMesh.material.needsUpdate = true;
                 // Выведем более заметное сообщение об ошибке загрузки текстуры
                 instructions.innerHTML = "<p style='color:red;'>Ошибка загрузки текстуры ландшафта.</p><p style='font-size: 14px; color: grey;'>Убедитесь, что файл " + TERRAIN_TEXTURE_PATH + " находится рядом с index.html и script.js.</p><p style='font-size: 14px; color: grey;'>Также проверьте консоль браузера (F12) на наличие других ошибок (например, CORS).</p>";
                 blocker.style.display = 'block'; // Показываем блок с ошибкой
             }
        }
    );

    // Генерируем рельеф, изменяя Z-координаты вершин (которая станет мировой Y после поворота)
    const positionAttribute = geometry.attributes.position;
    const uvAttribute = geometry.attributes.uv; // Получаем атрибут UV
    const vertices = positionAttribute.array;
    const uvs = uvAttribute.array;

    const numVertices = (TERRAIN_SEGMENTS + 1) * (TERRAIN_SEGMENTS + 1);

    for (let i = 0; i < numVertices; i++) {
        // Оригинальные координаты вершины в локальной системе PlaneGeometry (XY плоскость, Z=0)
        const originalX = vertices[i * 3];      // Это станет мировой X после поворота
        const originalY = vertices[i * 3 + 1];  // Это станет минус мировой Z после поворота

        // Генерируем высоту на основе шума Симплекса
        // Используем оригинальные X и Y (которые маппятся на мировые X и Z) для генерации шума
        const height = noise.simplex2(originalX * TERRAIN_NOISE_SCALE, originalY * TERRAIN_NOISE_SCALE) * TERRAIN_HEIGHT_SCALE;

        // Устанавливаем рассчитанную высоту в Z-координату вершины в локальной системе геометрии.
        // После поворота PlaneGeometry на -PI/2 вокруг X, эта Z-координата станет мировой Y.
        vertices[i * 3 + 2] = height;

        // Обновляем UV координаты для правильного наложения текстуры
        // Маппируем координаты, которые станут мировыми X и Z, на U и V
        const u = originalX / TERRAIN_TEXTURE_TILE_SIZE;
        const v = -originalY / TERRAIN_TEXTURE_TILE_SIZE; // Используем -originalY для корректного маппинга по "мировой Z"

        uvs[i * 2] = u;
        uvs[i * 2 + 1] = v;
    }

    // Сигнализируем Three.js, что атрибуты геометрии были изменены
    positionAttribute.needsUpdate = true;
    uvAttribute.needsUpdate = true;
    geometry.computeVertexNormals(); // Пересчитываем нормали для правильного освещения рельефа после изменения вершин

    // Создаем материал.
    const material = new THREE.MeshLambertMaterial({
        map: groundTexture, // Текстура (может быть еще в процессе загрузки)
        color: groundTexture.isTexture ? null : 0x00ff00, // Цвет по умолчанию, если текстура еще не загрузилась или ошибка
        side: THREE.DoubleSide // Отображаем обе стороны полигона
    });

    terrainMesh = new THREE.Mesh(geometry, material);
    // PlaneGeometry создается в плоскости XY, поворачиваем ее, чтобы она лежала на XZ
    terrainMesh.rotation.x = -Math.PI / 2;
    scene.add(terrainMesh);
}


// ------------- Функция генерации домов -------------
function generateHouses() {
    const textureLoader = new THREE.TextureLoader();
    const houseTexture = textureLoader.load(
        HOUSE_TEXTURE_PATH,
        // Success callback
        function(texture) {
            console.log("Текстура дома загружена успешно:", HOUSE_TEXTURE_PATH);
             texture.wrapS = THREE.RepeatWrapping;
             texture.wrapT = THREE.RepeatWrapping;
             texture.magFilter = THREE.LinearFilter;
             texture.minFilter = THREE.LinearMipmapLinearFilter;
             texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

             // Update materials if they were created with a placeholder
             scene.traverse(function(object) {
                 if (object.isMesh && object !== terrainMesh && object.material.userData && object.material.userData.isHouseMaterial) {
                     object.material.map = texture;
                     object.material.color = null;
                     object.material.needsUpdate = true;
                 }
             });
        },
        undefined, // Progress callback
        // Error callback
        function(err) {
            console.error('Ошибка загрузки текстуры дома:', HOUSE_TEXTURE_PATH, err);
             scene.traverse(function(object) {
                 if (object.isMesh && object !== terrainMesh && object.material.userData && object.material.userData.isHouseMaterial) {
                    // Fallback to a solid color material
                    object.material = new THREE.MeshLambertMaterial({ color: 0x8b4513 }); // Brown color fallback
                    object.material.needsUpdate = true;
                 }
             });
             // Update instructions to indicate texture error
             instructions.innerHTML = "<p style='color:red;'>Ошибка загрузки текстуры дома.</p><p style='font-size: 14px; color: grey;'>Убедитесь, что файл " + HOUSE_TEXTURE_PATH + " находится рядом с index.html и script.js.</p><p style='font-size: 14px; color: grey;'>Также проверьте консоль браузера (F12) на наличие других ошибок (например, CORS).</p>";
             blocker.style.display = 'block'; // Show error block
        }
    );

    const houseMaterial = new THREE.MeshLambertMaterial({
         map: houseTexture && houseTexture.isTexture ? houseTexture : null, // Use texture if loaded, otherwise null
         color: houseTexture && houseTexture.isTexture ? null : 0x8b4513 // Brown fallback color if texture not loaded yet
    });
    // Add a flag to identify house materials later for updating
    houseMaterial.userData.isHouseMaterial = true;


    // Raycaster для определения высоты и нормали рельефа под домом
    const houseRaycaster = new THREE.Raycaster();
    // Начало луча значительно выше максимальной возможной высоты рельефа
    const raycastOriginHeight = TERRAIN_HEIGHT_SCALE + TERRAIN_HEIGHT_SCALE * 2 + HOUSE_MAX_HEIGHT + 10; // Достаточно высоко
    // Длина луча от raycastOriginHeight до самой низкой точки рельефа (-TERRAIN_HEIGHT_SCALE) плюс запас
    const raycastDistance = raycastOriginHeight + TERRAIN_HEIGHT_SCALE + 5;


    const maxSlopeCos = Math.cos(THREE.MathUtils.degToRad(HOUSE_MAX_SLOPE_DEGREES));

    // Определяем границы квадратной области для размещения домов с учетом отступа
    const terrainHalfSize = TERRAIN_SIZE / 2;
    const minX = -terrainHalfSize + HOUSE_PLACEMENT_MARGIN;
    const maxX = terrainHalfSize - HOUSE_PLACEMENT_MARGIN;
    const minZ = -terrainHalfSize + HOUSE_PLACEMENT_MARGIN;
    const maxZ = terrainHalfSize - HOUSE_PLACEMENT_MARGIN;

    let placedHousesCount = 0; // Счетчик успешно размещенных домов

    for (let i = 0; i < NUM_HOUSES; i++) {
        // Генерируем случайные координаты равномерно в пределах квадратной области с отступом
        const randX = houseRandom() * (maxX - minX) + minX;
        const randZ = houseRandom() * (maxZ - minZ) + minZ;

        // Точка, с которой начинаем луч вниз
        const rayOrigin = new THREE.Vector3(randX, raycastOriginHeight, randZ);
        houseRaycaster.set(rayOrigin, down);
        houseRaycaster.far = raycastDistance; // Устанавливаем достаточную длину луча

        // Проверяем пересечение луча с мешем рельефа
        // Добавляем terrainMesh в массив объектов для проверки
        const intersects = houseRaycaster.intersectObject(terrainMesh, false); // Передаем terrainMesh как единственный объект для проверки

        if (intersects.length > 0) {
            const hit = intersects[0];
            const groundPosition = hit.point; // Позиция на земле в мировых координатах
            const groundNormal = hit.face.normal.clone(); // Нормаль рельефа в локальных координатах меша
            groundNormal.transformDirection(terrainMesh.matrixWorld).normalize(); // Преобразуем нормаль в мировые координаты

            // Проверяем наклон рельефа
            if (groundNormal.y < maxSlopeCos) {
                // Слишком крутой склон, пропускаем этот дом
                // console.log(`Skipped house at ${randX.toFixed(2)}, ${randZ.toFixed(2)} due to slope: ${THREE.MathUtils.radToDeg(Math.acos(groundNormal.y)).toFixed(2)} degrees`);
                continue;
            }

            // Генерируем случайные размеры дома
            const houseLengthUnits = Math.floor(houseRandom() * (HOUSE_MAX_LENGTH_UNITS - HOUSE_MIN_LENGTH_UNITS + 1)) + HOUSE_MIN_LENGTH_UNITS;
            const houseLength = houseLengthUnits * HOUSE_BASE_UNIT_SIZE; // Длина вдоль Z в BoxGeometry
            const houseWidth = houseRandom() * (HOUSE_MAX_WIDTH - HOUSE_MIN_WIDTH) + HOUSE_MIN_WIDTH; // Ширина вдоль X в BoxGeometry
            const houseHeight = houseRandom() * (HOUSE_MAX_HEIGHT - HOUSE_MIN_HEIGHT) + HOUSE_MIN_HEIGHT; // Высота вдоль Y в BoxGeometry


            // Создаем геометрию коробки. BoxGeometry(width, height, depth) -> (X, Y, Z)
            // width = houseWidth, height = houseHeight, depth = houseLength
            const houseGeometry = new THREE.BoxGeometry(houseWidth, houseHeight, houseLength);

            // Настраиваем UV координаты для правильного наложения текстуры с повторением
            const textureAspectRatio = HOUSE_TEXTURE_WIDTH_PX / HOUSE_TEXTURE_HEIGHT_PX;

            const uvs = houseGeometry.attributes.uv.array;
            // const positions = houseGeometry.attributes.position.array; // Не нужен для этой логики UV

            // Проходим по всем UV координатам и масштабируем их
            // U мапится по горизонтали грани, V по вертикали грани.
            // Текстура дома шире, чем выше (398x239), повторение предполагается по горизонтали текстуры.
            // +/-X грани (Width sides, face YZ): горизонталь грани - ось Z геометрии (длина). Вертикаль грани - ось Y геометрии (высота).
            //   Дефолт: U по Y, V по Z. Надо поменять: U по Z (длина), V по Y (высота).
            // +/-Z грани (Length sides, face XY): горизонталь грани - ось X геометрии (ширина). Вертикаль грани - ось Y геометрии (высота).
            //   Дефолт: U по X, V по Y. Не надо менять: U по X (ширина), V по Y (высота).
            // +/-Y грани (Top/Bottom, face XZ): горизонталь грани - ось X геометрии (ширина). Вертикаль грани - ось Z геометрии (длина).
            //   Дефолт: U по X, V по Z. Не надо менять: U по X (ширина), V по Z (длина).

            for (let j = 0; j < uvs.length; j += 2) {
                 const defaultU = uvs[j];
                 const defaultV = uvs[j + 1];

                 const vertexIndex = j / 2; // Index of the vertex in the uv array
                 const faceIndex = Math.floor(vertexIndex / 4); // Index of the face (0-5)

                 let uScale = 1.0;
                 let vScale = 1.0;

                 switch (faceIndex) {
                      case 0: // +X face (Width sides)
                      case 1: // -X face (Width sides)
                          // Face dimensions: length (Z) x height (Y). Default U maps Y, V maps Z.
                          // We want U maps Z (length), V maps Y (height). Swap and scale.
                          uScale = houseLength / HOUSE_BASE_UNIT_SIZE; // U maps length (Z)
                          vScale = 1.0; // V maps height (Y) - texture height covers full building height
                          uvs[j] = defaultV * uScale; // Default V is based on Z extent
                          uvs[j+1] = defaultU * vScale; // Default U is based on Y extent
                          break;

                      case 2: // +Y face (Top)
                      case 3: // -Y face (Bottom)
                          // Face dimensions: width (X) x length (Z). Default U maps X, V maps Z.
                          // We want U maps X (width), V maps Z (length). No swap needed, just scale.
                          uScale = houseWidth / HOUSE_BASE_UNIT_SIZE * textureAspectRatio; // U maps width (X)
                          vScale = houseLength / HOUSE_BASE_UNIT_SIZE; // V maps length (Z)
                          uvs[j] = defaultU * uScale;
                          uvs[j+1] = defaultV * vScale;
                          break;

                      case 4: // +Z face (Length sides)
                      case 5: // -Z face (Length sides)
                          // Face dimensions: width (X) x height (Y). Default U maps X, V maps Y.
                          // We want U maps X (width), V maps Y (height). No swap needed, just scale.
                          uScale = houseWidth / HOUSE_BASE_UNIT_SIZE * textureAspectRatio; // U maps width (X)
                          vScale = 1.0; // V maps height (Y)
                          uvs[j] = defaultU * uScale;
                          uvs[j+1] = defaultV * vScale;
                          break;
                 }
            }

            houseGeometry.attributes.uv.needsUpdate = true;

            const houseMesh = new THREE.Mesh(houseGeometry, houseMaterial);

            // Позиционируем дом. Центр меша должен быть на groundPosition + половина высоты - submersion.
            houseMesh.position.copy(groundPosition);
            houseMesh.position.y += houseHeight / 2 - HOUSE_SUBMERSION_DEPTH;

            // Ориентируем дом по нормали рельефа. Вектор (0,1,0) в локальной системе меша (Y Up)
            // должен совпасть с worldNormal (нормалью рельефа).
            const upVector = new THREE.Vector3(0, 1, 0);
            houseMesh.quaternion.setFromUnitVectors(upVector, groundNormal);

            scene.add(houseMesh);
            placedHousesCount++; // Увеличиваем счетчик успешно размещенных домов

        } else {
             // Если луч не попал в рельеф, это ожидаемо, если точка находится за пределами допустимой области
             // или на слишком крутом склоне (который отфильтрован выше).
             // Убираем это сообщение, т.к. оно засоряет консоль и является нормальным поведением, если
             // точки генерируются по всему миру, а дома ставятся только на части.
             // console.warn(`Raycast для дома не попал в рельеф на координатах: ${randX.toFixed(2)}, ${randZ.toFixed(2)}`);
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

        // Применяем гравитацию к вертикальной скорости
        playerVelocity.y -= GRAVITY * deltaTime;

        // Рассчитываем горизонтальное движение на основе нажатых клавиш
        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);

        // Если есть горизонтальное движение, нормализуем
        if (moveForward || moveBackward || moveLeft || moveRight) {
            direction.normalize();
        } else {
            // Если нет горизонтального движения, сбрасываем горизонтальную скорость
             direction.x = 0;
             direction.z = 0;
        }

        // Перемещаем игрока горизонтально (через контролы), учитывая время и скорость
        // controls.moveRight и controls.moveForward ожидают расстояние
        controls.moveRight(direction.x * PLAYER_SPEED * deltaTime);
        controls.moveForward(direction.z * PLAYER_SPEED * deltaTime);


        // Применяем вертикальную скорость к позиции игрока (камере), учитывая время
        // THREE.PointerLockControls управляет положением controls.getObject(),
        // а камера прикреплена к нему. Изменение camera.position напрямую
        // изменяет ее позицию относительно controls.getObject().
        // Это работает для вертикального движения.
        camera.position.y += playerVelocity.y * deltaTime;

        // ------------- Простая коллизия с рельефом (с использованием Raycasting) -------------
        // Создаем луч, идущий вниз от позиции игрока
        // Начало луча должно быть чуть выше ног игрока, чтобы избежать самопересечения
        const raycasterOrigin = camera.position.clone();
        raycasterOrigin.y -= PLAYER_HEIGHT * 0.5; // Начинаем луч примерно посередине игрока или ниже

        // Максимальное расстояние луча должно покрывать высоту игрока плюс небольшой запас
        raycaster.set(raycasterOrigin, down);
        raycaster.far = PLAYER_HEIGHT; // Проверяем на расстояние, равное высоте игрока

        // Проверяем пересечение луча с мешем рельефа
        const intersects = raycaster.intersectObject(terrainMesh, false);

        // Определяем целевую Y-позицию для ног игрока
        const targetPlayerFeetY = intersects.length > 0 ? intersects[0].point.y : -Infinity; // -Infinity, если нет пересечения

        // Определяем целевую Y-позицию для глаз игрока (где находится камера)
        const targetCameraY = targetPlayerFeetY + PLAYER_HEIGHT;


        // Проверяем, находится ли игрок ниже целевого уровня земли + высота игрока
        // Используем небольшой допуск для стабильности
        if (camera.position.y < targetCameraY - PLAYER_COLLISION_TOLERANCE) {
            // Если игрок провалился или ниже земли, перемещаем его ровно на поверхность
            camera.position.y = targetCameraY;

            // Если игрок падал (скорость Y отрицательная), останавливаем падение
            if (playerVelocity.y < 0) {
                 playerVelocity.y = 0;
                 canJump = true; // Разрешаем прыжок, так как коснулись земли
            }

        } else if (camera.position.y <= targetCameraY + PLAYER_COLLISION_TOLERANCE) {
             // Если игрок находится очень близко к земле сверху (в пределах допуска) ИЛИ ниже земли,
             // и его скорость по Y <= 0 (не прыгает вверх), считаем, что он на земле
             if (playerVelocity.y <= 0) {
                 canJump = true;
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
        // Camera position is not updated by controls.move if controls are unlocked,
        // and vertical physics loop is inside the isGameActive check. So camera position
        // remains fixed vertically when unlocked.
    }


    prevTime = time; // Обновляем время предыдущего кадра

    // ------------- Рендеринг сцены -------------
    renderer.render(scene, camera);
}

// Запускаем инициализацию сцены после загрузки DOM и скриптов
window.addEventListener('load', init);
