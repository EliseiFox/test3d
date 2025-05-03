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
const NUM_HOUSES = 100;                     // Количество генерируемых домов
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
const HOUSE_PLACEMENT_RADIUS = TERRAIN_SIZE / 2 - 20; // Радиус внутри мира, где могут появляться дома (немного меньше размера ландшафта)
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
    setHouseSeed(WORLD_SEED_NUMBER);
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
         map: houseTexture.isTexture ? houseTexture : null, // Use texture if loaded, otherwise null
         color: houseTexture.isTexture ? null : 0x8b4513 // Brown fallback color if texture not loaded yet
    });
    // Add a flag to identify house materials later for updating
    houseMaterial.userData.isHouseMaterial = true;


    // Raycaster для определения высоты и нормали рельефа под домом
    const houseRaycaster = new THREE.Raycaster();
    const raycastOriginHeight = TERRAIN_HEIGHT_SCALE * 2 + HOUSE_MAX_HEIGHT + 10; // Достаточно высоко над любой возможной точкой рельефа

    const maxSlopeCos = Math.cos(THREE.MathUtils.degToRad(HOUSE_MAX_SLOPE_DEGREES));


    for (let i = 0; i < NUM_HOUSES; i++) {
        // Генерируем случайные координаты для дома в пределах радиуса
        const angle = houseRandom() * Math.PI * 2;
        const radius = houseRandom() * HOUSE_PLACEMENT_RADIUS;
        const randX = Math.cos(angle) * radius;
        const randZ = Math.sin(angle) * radius;

        // Точка, с которой начинаем луч вниз
        const rayOrigin = new THREE.Vector3(randX, raycastOriginHeight, randZ);
        houseRaycaster.set(rayOrigin, down);
        houseRaycaster.far = raycastOriginHeight + TERRAIN_HEIGHT_SCALE * 2 + 10; // Длина луча достаточна, чтобы достать до самой низкой точки

        const intersects = houseRaycaster.intersectObject(terrainMesh, false);

        if (intersects.length > 0) {
            const hit = intersects[0];
            const groundPosition = hit.point; // Позиция на земле в мировых координатах
            const groundNormal = hit.face.normal.clone(); // Нормаль рельефа в локальных координатах меша
            groundNormal.transformDirection(terrainMesh.matrixWorld).normalize(); // Преобразуем нормаль в мировые координаты

            // Проверяем наклон рельефа
            if (groundNormal.y < maxSlopeCos) {
                // Слишком крутой склон, пропускаем этот дом
                continue;
            }

            // Генерируем случайные размеры дома
            const houseLengthUnits = Math.floor(houseRandom() * (HOUSE_MAX_LENGTH_UNITS - HOUSE_MIN_LENGTH_UNITS + 1)) + HOUSE_MIN_LENGTH_UNITS;
            const houseLength = houseLengthUnits * HOUSE_BASE_UNIT_SIZE; // Длина вдоль Z в BoxGeometry
            const houseWidth = houseRandom() * (HOUSE_MAX_WIDTH - HOUSE_MIN_WIDTH) + HOUSE_MIN_WIDTH; // Ширина вдоль X в BoxGeometry
            const houseHeight = houseRandom() * (HOUSE_MAX_HEIGHT - HOUSE_MIN_HEIGHT) + HOUSE_MIN_HEIGHT; // Высота вдоль Y в BoxGeometry


            // Создаем геометрию коробки. BoxGeometry(width, height, depth) -> (X, Y, Z)
            // Мы хотим, чтобы "длина" дома была вдоль оси Z геометрии, "ширина" вдоль оси X.
            const houseGeometry = new THREE.BoxGeometry(houseWidth, houseHeight, houseLength);

            // Настраиваем UV координаты для правильного наложения текстуры с повторением
            // Текстура 398x239. Хотим, чтобы 398px натягивались на HOUSE_BASE_UNIT_SIZE мировых единиц.
            // Вертикаль текстуры (239px) должна натягиваться на полную высоту дома.
            // Соотношение сторон текстуры: 398 / 239
            const textureAspectRatio = HOUSE_TEXTURE_WIDTH_PX / HOUSE_TEXTURE_HEIGHT_PX;

            const uvs = houseGeometry.attributes.uv.array;
            const positions = houseGeometry.attributes.position.array; // Нужны для определения, к какой грани принадлежит вершина

            // Проходим по всем UV координатам (48 значений: 6 граней * 4 вершины * 2 компонента UV)
            for (let j = 0; j < uvs.length; j += 2) {
                 const defaultU = uvs[j];
                 const defaultV = uvs[j + 1];

                 // Определяем грань по индексу UV
                 const faceIndex = Math.floor(j / 8); // Каждые 8 значений UV относятся к одной из 6 граней (0-5)

                 let uScale = 1.0;
                 let vScale = 1.0;
                 let swapUV = false; // Нужно ли поменять местами U и V

                 switch (faceIndex) {
                     case 0: // +X face (Ширина, справа)
                     case 1: // -X face (Ширина, слева)
                         // На этих гранях горизонталь грани - это Y геометрии, вертикаль грани - это Z геометрии по умолчанию UV (0-1).
                         // Мы хотим, чтобы U мапилось по ширине дома (X геометрии), V по высоте (Y геометрии).
                         // Дефолтные UV для +/-X мапят Y(height) на U, Z(length) на V. Это не то.
                         // Нужно вручную сопоставить координаты вершин на грани с желаемыми UV.
                         // Vertex position: positions[j*3/2], positions[j*3/2+1], positions[j*3/2+2]
                         // На +/-X грани, positions[j*3/2] (X) = +/-houseWidth/2. Y = positions[j*3/2+1], Z = positions[j*3/2+2].
                         // Мы хотим U маппить по Z (длина дома), V по Y (высота дома).
                         // U: маппируем Z от -houseLength/2 до +houseLength/2 с повторением
                         // V: маппируем Y от -houseHeight/2 до +houseHeight/2 (или 0 до houseHeight) без повторения (один раз на всю высоту)
                         // Дефолтные UV: u = (vy + height/2) / height, v = (vz + length/2) / length  ? Нет, это не так.
                         // Дефолтные UV на +/-X мапят (y, z) этой грани на (u, v) [0,1]x[0,1].
                         // Реальная горизонталь грани (+/-X) - это Ось Z геометрии (длина дома).
                         // Реальная вертикаль грани (+/-X) - это Ось Y геометрии (высота дома).
                         // Мы хотим U маппить по Z (length), V по Y (height).
                         // UScale: повторение по Z = length / HOUSE_BASE_UNIT_SIZE
                         // VScale: повторение по Y = height / (HOUSE_BASE_UNIT_SIZE / textureAspectRatio) ? No, just map 0-1 V to height.
                         // Let's map U to the Z coordinate, scaled by HOUSE_BASE_UNIT_SIZE
                         // Let's map V to the Y coordinate, scaled to 0-1 over height.
                         // Default U on +/-X is based on local Y, Default V is based on local Z.
                         // We need U based on global Z (building length axis), V based on global Y (building height axis).
                         // For +/-X face, the default UVs cover the YZ plane of the face. Default U is based on Y coord, Default V on Z coord.
                         // We want U = scaled Z, V = scaled Y.
                         // U: map vertex Z pos (-length/2 to length/2) to U, scaled by repeat factor.
                         // V: map vertex Y pos (-height/2 to height/2) to V, scaled to 0-1.
                         const vY = positions[j * 1.5 + 1]; // Y coordinate of vertex
                         const vZ = positions[j * 1.5 + 2]; // Z coordinate of vertex (this is building length axis)

                         uvs[j] = (vZ / houseLength + 0.5) * (houseLength / HOUSE_BASE_UNIT_SIZE); // Map Z (-length/2 to +length/2) to U, then scale
                         uvs[j + 1] = vY / houseHeight + 0.5; // Map Y (-height/2 to +height/2) to V (0 to 1)
                         break;

                     case 2: // +Y face (Верх)
                     case 3: // -Y face (Низ)
                         // На этих гранях горизонталь грани - это X геометрии (ширина), вертикаль грани - это Z геометрии (длина) по умолчанию UV (0-1).
                         // Мы хотим U маппить по X (ширина), V по Z (длина).
                         // Default U on +/-Y is based on local X, Default V is based on local Z.
                         // This is mostly correct, just need scaling.
                         uScale = houseWidth / HOUSE_BASE_UNIT_SIZE * textureAspectRatio; // Scale U by width, adjusted by texture aspect
                         vScale = houseLength / HOUSE_BASE_UNIT_SIZE; // Scale V by length
                         uvs[j] = defaultU * uScale;
                         uvs[j+1] = defaultV * vScale;
                         break;

                     case 4: // +Z face (Длина, спереди)
                     case 5: // -Z face (Длина, сзади)
                          // На этих гранях горизонталь грани - это X геометрии (ширина), вертикаль грани - это Y геометрии (высота) по умолчанию UV (0-1).
                          // Мы хотим U маппить по Z (длина дома), V по Y (высота дома).
                          // Дефолтные UV для +/-Z мапят X(width) на U, Y(height) на V.
                          // Реальная горизонталь грани (+/-Z) - это Ось X геометрии (ширина дома).
                          // Реальная вертикаль грани (+/-Z) - это Ось Y геометрии (высота дома).
                          // Мы хотим U маппить по Z (length), V по Y (height).
                          // This is the same issue as +/-X. Need manual mapping based on vertex position.
                          // On +/-Z face, X = positions[j*1.5], Y = positions[j*1.5+1], Z = +/-houseLength/2.
                          // U: map Z (-length/2 to length/2) to U, scaled by repeat factor.
                          // V: map Y (-height/2 to height/2) to V (0 to 1).
                           const vX_z = positions[j * 1.5]; // X coordinate of vertex (this is building width axis on this face)
                           const vY_z = positions[j * 1.5 + 1]; // Y coordinate of vertex (this is building height axis)
                           const vZ_z = positions[j * 1.5 + 2]; // Z coordinate of vertex (constant +/-length/2 for this face)

                           // U should map along the *building's* Z axis (length). The vertex Z is constant on this face.
                           // This confirms my initial confusion. The texture needs to tile along the *horizontal direction of the face* which is the building's *width* axis (X) for +/-Z faces.
                           // The request "текстура при удлинении дома должна повторятся" implies the texture repeats along the *building's length* axis.
                           // Let's assume the texture repeats along the Z axis of the BoxGeometry (our houseLength).
                           // The faces along the length are +/-Z. The horizontal direction on the +/-Z face is the X axis (building width).
                           // Okay, the texture should repeat along the Z axis *in world space*.
                           // The BoxGeometry's Z axis will be aligned with the world Z axis *only if the building is not rotated*.
                           // When the building is rotated to match the slope, its local Z axis points in some arbitrary world direction.
                           // The most common way texture mapping works for repeating textures on walls is: U maps along the *base perimeter*, V maps height.
                           // For a box, U maps along the width on width faces, and along the length on length faces.
                           // Let's use the UV mapping strategy that makes sense for the face dimensions:
                           // +/- Z faces (Length sides, width x height): U maps X (width), V maps Y (height). Scale U by `width / BASE_UNIT`, V by `height / (BASE_UNIT / aspect)`.
                           // +/- X faces (Width sides, length x height): U maps Z (length), V maps Y (height). Scale U by `length / BASE_UNIT`, V by `height / (BASE_UNIT / aspect)`.
                           // Let's use V scale 1.0 for simplicity (texture height maps to full building height).
                           uScale = houseWidth / HOUSE_BASE_UNIT_SIZE * textureAspectRatio; // U maps width
                           vScale = 1.0; // V maps height
                           uvs[j] = defaultU * uScale;
                           uvs[j+1] = defaultV * vScale;
                           break;
                 }

                 // Re-read the request: "текстура у которого длина по горизонту", "текстура при удлинении дома должна повторятся".
                 // This suggests the texture is wider than tall, and the wider dimension should repeat along the *length* of the house.
                 // BoxGeometry(width, height, length). X=width, Y=height, Z=length.
                 // The length sides are +/-Z faces. They span X (width) and Y (height).
                 // We want U to map along the building's Z axis (length), and V along the building's Y axis (height).
                 // On the +/-Z face, the horizontal axis is X (width), vertical is Y (height).
                 // This means we need to map the Z coordinate of the building (which varies along its length) to U, and Y coordinate (height) to V.
                 // This requires manual UV calculation based on the building's world position and rotation.

                 // Let's simplify again. Assume the texture should repeat along the *face's horizontal axis*, and this axis is related to the *building's* length or width.
                 // For +/-Z faces (length sides): Face is width x height. Horizontal is width. We want texture to repeat along *length*. This is confusing.

                 // Alternative interpretation: Texture is designed to tile seamlessly on a wall. The "horizontal" dimension of the texture is the repeating part.
                 // We have faces of size (width x height) and (length x height).
                 // For width x height faces (+/-Z): U maps width, V maps height. Repeat U by `width / BASE_UNIT`, V by `height / (BASE_UNIT / aspect)`.
                 // For length x height faces (+/-X): U maps length, V maps height. Repeat U by `length / BASE_UNIT`, V by `height / (BASE_UNIT / aspect)`.
                 // Use VScale = 1.0 for simplicity.
                 // This seems the most standard UV mapping approach for repeating textures on box sides.
                 switch (faceIndex) {
                      case 0: // +X face (Width sides)
                      case 1: // -X face (Width sides)
                          // Face dimensions: length (Z) x height (Y). Default U maps Y, V maps Z.
                          // We want U maps Z (length), V maps Y (height). Need to swap and scale.
                          uScale = houseLength / HOUSE_BASE_UNIT_SIZE; // U maps length (Z)
                          vScale = 1.0; // V maps height (Y)
                          swapUV = true; // Swap default U/V
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
        } else {
            // Если луч не попал в рельеф (например, за границами TERRAIN_SIZE, если не ограничить),
            // можно пропустить этот дом или попробовать другое место.
            console.warn("Raycast для дома не попал в рельеф на координатах:", randX, randZ);
        }
    }
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

        // Если есть горизонтальное движение, нормализуем и устанавливаем скорость
        if (moveForward || moveBackward || moveLeft || moveRight) {
            direction.normalize();
            // Горизонтальная скорость игрока
            const speed = PLAYER_SPEED * deltaTime;
            playerVelocity.x = direction.x * speed;
            playerVelocity.z = direction.z * speed;
        } else {
            // Если движения нет, замедляем игрока по горизонтали (можно использовать трение)
            // Для простоты просто сбросим горизонтальную скорость, если нет нажатых клавиш движения
            playerVelocity.x = 0;
            playerVelocity.z = 0;
        }

        // Перемещаем игрока горизонтально (через контролы)
        //controls.moveRight и controls.moveForward уже учитывают множитель скорости,
        //поэтому умножать на deltaTime тут не нужно, если speed уже его включает.
        //Correct usage: controls.moveRight(distance) and controls.moveForward(distance)
        //The distance should be velocity * deltaTime
        controls.moveRight(playerVelocity.x); // playerVelocity.x already has deltaTime included if calculated as direction.x * PLAYER_SPEED * deltaTime
        controls.moveForward(playerVelocity.z); // playerVelocity.z already has deltaTime included

        // Применяем вертикальную скорость к позиции игрока (камере), учитывая время
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
