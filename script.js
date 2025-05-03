// -------------------- НАСТРАИВАЕМЫЕ ПАРАМЕТРЫ ИГРЫ --------------------

// Параметры игрока
const PLAYER_SPEED = 50.0;       // Скорость движения игрока
const PLAYER_JUMP_HEIGHT = 7.0; // Начальная скорость прыжка игрока по Y
const PLAYER_HEIGHT = 2.0;      // Высота "глаз" игрока над поверхностью земли
const GRAVITY = 30.0;           // Ускорение свободного падения (увеличено для более выраженного падения/прыжка)
const PLAYER_COLLISION_TOLERANCE = 0.2; // Небольшой допуск для коллизии, чтобы избежать дрожания

// Параметры мира/ландшафта
// Сид для генерации рельефа. Ваша библиотека шума поддерживает числовые сиды.
// Если вы хотите использовать строку, вам понадобится функция для преобразования строки в число от 1 до 65536.
const WORLD_SEED_NUMBER = 54321; // Измените для другого рельефа
const TERRAIN_SIZE = 512;         // Размер квадратного ландшафта (TERRAIN_SIZE x TERRAIN_SIZE) - увеличено для большего мира
const TERRAIN_SEGMENTS = 256;     // Количество сегментов по каждой оси (больше сегментов = больше деталей, но медленнее) - увеличено для детализации
const TERRAIN_HEIGHT_SCALE = 5;  // Максимальная высота/глубина холмов - увеличено для более выраженного рельефа
const TERRAIN_NOISE_SCALE = 0.01; // Масштаб шума (чем меньше, тем крупнее холмы) - уменьшено для более крупных холмов

// Параметры текстуры
const TEXTURE_PATH = 'grass_texture_1024.png'; // Путь к вашей текстуре PNG 1024x1024
const TEXTURE_TILE_SIZE = 80;     // Размер в мировых единицах, на который натягивается один тайл текстуры - увеличено, чтобы текстура не была слишком мелкой

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


// ------------- Инициализация сцены -------------
function init() {
    // Проверка на наличие глобального объекта noise
    if (typeof noise === 'undefined') {
        console.error("Ошибка: Библиотека simplex-noise.js не найдена или загружена некорректно.");
        blocker.style.display = 'block';
        instructions.innerHTML = "<p style='color:red;'>Ошибка загрузки игры: Библиотека шума не найдена.</p><p style='font-size: 14px; color: grey;'>Убедитесь, что файл simplex-noise.js находится рядом с index.html и script.js и подключен в index.html.</p><p style='font-size: 14px; color: grey;'>Также проверьте консоль браузера (F12) на наличие других ошибок.</p>";
        return; // Останавливаем инициализацию
    }

    // Устанавливаем сид для генератора шума
    // Проверяем, что сид находится в поддерживаемом диапазоне, если есть информация о диапазоне (ваша библиотека поддерживает до 65536)
    const validatedSeed = Math.abs(WORLD_SEED_NUMBER) % 65536; // Преобразуем сид в диапазон 0-65535
    if (validatedSeed === 0) validatedSeed = 1; // Сид 0 может иметь особый смысл или быть запрещен
    noise.seed(validatedSeed);
    console.log("Генерация мира с сидом (числовой):", validatedSeed);


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
    // PlaneGeometry создается в плоскости XY (-width/2 до width/2, -height/2 до height/2)
    // и Z=0. Мы будем использовать X и Y геометрии для мировых X и Z, а Z геометрии для мировой Y (высоты).
    const geometry = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);

    // Загружаем текстуру
    const textureLoader = new THREE.TextureLoader();
    const groundTexture = textureLoader.load(
        TEXTURE_PATH,
        // Колбэк при успешной загрузке
        function (texture) {
            console.log("Текстура загружена успешно:", TEXTURE_PATH);
            texture.wrapS = THREE.RepeatWrapping; // Устанавливаем повторение текстуры по горизонтали
            texture.wrapT = THREE.RepeatWrapping; // Устанавливаем повторение текстуры по вертикали
            // Настраиваем количество повторений текстуры на весь ландшафт
            texture.repeat.set(TERRAIN_SIZE / TEXTURE_TILE_SIZE, TERRAIN_SIZE / TEXTURE_TILE_SIZE);
            // Фильтрация для сглаживания и уменьшения мерцания
            texture.magFilter = THREE.LinearFilter;
            texture.minFilter = THREE.LinearMipmapLinearFilter; // Используем мипмапы для лучшей производительности и качества на расстоянии
            // Анизотропная фильтрация - значительно улучшает качество текстур на плоских поверхностях, удаляющихся вдаль
            texture.anisotropy = renderer.capabilities.getMaxAnisotropy();


             // Если материал был создан до загрузки текстуры, обновите его
            if (terrainMesh && terrainMesh.material && !terrainMesh.material.map) {
                 terrainMesh.material.map = texture;
                 terrainMesh.material.color = null; // Убираем цвет по умолчанию
                 terrainMesh.material.needsUpdate = true;
            }
        },
        // Колбэк прогресса загрузки (опционально)
        undefined,
        // Колбэк при ошибке загрузки
        function (err) {
            console.error('Ошибка загрузки текстуры:', TEXTURE_PATH, err);
             // Используем материал запасного цвета, если текстура не загрузилась
             if (terrainMesh && terrainMesh.material && !terrainMesh.material.map) {
                 terrainMesh.material = new THREE.MeshLambertMaterial({ color: 0x00ff00, side: THREE.DoubleSide });
                 terrainMesh.material.needsUpdate = true;
                 // Выведем более заметное сообщение об ошибке загрузки текстуры
                 instructions.innerHTML = "<p style='color:red;'>Ошибка загрузки текстуры.</p><p style='font-size: 14px; color: grey;'>Убедитесь, что файл " + TEXTURE_PATH + " находится рядом с index.html и script.js.</p><p style='font-size: 14px; color: grey;'>Также проверьте консоль браузера (F12) на наличие других ошибок (например, CORS).</p>";
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
        // const originalZ = vertices[i * 3 + 2]; // Это станет мировой Y после поворота (изначально всегда 0)

        // Генерируем высоту на основе шума Симплекса
        // Используем оригинальные X и Y (которые маппятся на мировые X и Z) для генерации шума
        const height = noise.simplex2(originalX * TERRAIN_NOISE_SCALE, originalY * TERRAIN_NOISE_SCALE) * TERRAIN_HEIGHT_SCALE;

        // Устанавливаем рассчитанную высоту в Z-координату вершины в локальной системе геометрии.
        // После поворота PlaneGeometry на -PI/2 вокруг X, эта Z-координата станет мировой Y.
        vertices[i * 3 + 2] = height;

        // Обновляем UV координаты для правильного наложения текстуры
        // Маппируем координаты, которые станут мировыми X и Z, на U и V
        // Мировой X = originalX
        // Мировой Z = -originalY (из-за поворота)
        const u = originalX / TEXTURE_TILE_SIZE;
        const v = -originalY / TEXTURE_TILE_SIZE; // Используем -originalY для корректного маппинга по "мировой Z"

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
        // Оставляем playerVelocity как есть, чтобы при разблокировке в воздухе игрок продолжил падать.
        // Или можно сбросить: playerVelocity.set(0,0,0);
    });

    // Добавляем объект контролов в сцену. Камера прикреплена к этому объекту.
    scene.add(controls.getObject());

    // ------------- Обработка событий клавиатуры -------------
    // (Оставлены без изменений, так как они просто ставят флаги движения)
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
        // в случае, если клавиша была нажата до разблокировки
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
            playerVelocity.z = direction.z * PLAYER_SPEED;
            playerVelocity.x = direction.x * PLAYER_SPEED;
        } else {
            // Если движения нет, замедляем игрока (просто сбрасываем скорость для простоты)
            playerVelocity.x = 0;
            playerVelocity.z = 0;
        }

        // Перемещаем игрока горизонтально (через контролы), учитывая время
        controls.moveRight(playerVelocity.x * deltaTime);
        controls.moveForward(playerVelocity.z * deltaTime);

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

        } else if (camera.position.y < targetCameraY + PLAYER_COLLISION_TOLERANCE) {
             // Если игрок находится очень близко к земле сверху (в пределах допуска),
             // это тоже считается "на земле" для возможности прыжка.
             // Условие `playerVelocity.y <= 0` предотвращает разрешение прыжка во время подъема на холм.
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
        // Это предотвращает падение через землю в меню
        playerVelocity.set(0,0,0);
        // Оставляем камеру в ее текущей позиции, она не должна падать.
        // camera.position.y НЕ ДОЛЖНА изменяться, если игра не активна.
        // Но так как physics loop обернут в if(isGameActive), это и так не произойдет.
        // Однако, если игрок разблокировал контролы, находясь в воздухе,
        // playerVelocity.y будет все еще отрицательным. Если потом снова заблокировать,
        // он продолжит падать. Это может быть нежелательно.
        // Лучше сбрасывать playerVelocity при разблокировке.
    }


    prevTime = time; // Обновляем время предыдущего кадра

    // ------------- Рендеринг сцены -------------
    renderer.render(scene, camera);
}

// Запускаем инициализацию сцены после загрузки DOM и скриптов
window.addEventListener('load', init);
