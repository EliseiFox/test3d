// -------------------- НАСТРАИВАЕМЫЕ ПАРАМЕТРЫ ИГРЫ --------------------

// Параметры игрока
const PLAYER_SPEED = 5.0;       // Скорость движения игрока
const PLAYER_JUMP_HEIGHT = 7.0; // Высота прыжка игрока
const PLAYER_HEIGHT = 1.8;      // Высота "глаз" игрока над поверхностью
const GRAVITY = 9.8;            // Ускорение свободного падения

// Параметры мира/ландшафта
// Сид для генерации рельефа. Ваша библиотека шума поддерживает числа от 0 до 1 или целые от 1 до 65536.
// Если вы хотите использовать строку, вам понадобится функция для преобразования строки в числовой сид.
// Для простоты, используем числовой сид здесь.
const WORLD_SEED_NUMBER = 12345;
const TERRAIN_SIZE = 256;         // Размер квадратного ландшафта (TERRAIN_SIZE x TERRAIN_SIZE)
const TERRAIN_SEGMENTS = 128;     // Количество сегментов по каждой оси (больше сегментов = больше деталей, но медленнее)
const TERRAIN_HEIGHT_SCALE = 15;  // Максимальная высота/глубина холмов
const TERRAIN_NOISE_SCALE = 0.02; // Масштаб шума (чем меньше, тем крупнее холмы)

// Параметры текстуры
const TEXTURE_PATH = 'grass_texture_1024.png'; // Путь к вашей текстуре PNG 1024x1024
const TEXTURE_TILE_SIZE = 10;     // Размер в мировых единицах, на который натягивается один тайл текстуры

// -------------------- КОНЕЦ НАСТРАИВАЕМЫХ ПАРАМЕТРОВ --------------------


// Объявляем основные переменные Three.js
let camera, scene, renderer;
let controls; // Переменная для PointerLockControls
let terrainMesh; // Ссылка на созданный меш ландшафта

// Переменные для управления движением
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;

// Переменные для физики (очень простой)
let playerVelocity = new THREE.Vector3();
const direction = new THREE.Vector3();

let prevTime = performance.now(); // Время предыдущего кадра для расчета deltaTime

// Элементы DOM для инструкций
const blocker = document.getElementById('blocker');
const instructions = document.getElementById('instructions');

// Переменные для определения высоты игрока над землей (для коллизии)
const raycaster = new THREE.Raycaster();
const down = new THREE.Vector3(0, -1, 0); // Вектор направления вниз

// Объект шума, который должен быть доступен глобально после загрузки simplex-noise.js
// Проверим его наличие в init()


// ------------- Инициализация сцены -------------
function init() {
    // Проверка на наличие глобального объекта noise
    if (typeof noise === 'undefined') {
        console.error("Ошибка: Библиотека simplex-noise.js не найдена или загружена некорректно.");
        // Возможно, здесь стоит вывести сообщение пользователю или остановить выполнение
        blocker.style.display = 'block';
        instructions.innerHTML = "<p style='color:red;'>Ошибка загрузки игры. Проверьте консоль (F12).</p>";
        return; // Останавливаем инициализацию
    }

    // Устанавливаем сид для генератора шума
    noise.seed(WORLD_SEED_NUMBER);
    console.log("Генерация мира с сидом:", WORLD_SEED_NUMBER);


    // Создаем сцену
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // Устанавливаем цвет неба
    // scene.fog = new THREE.Fog(0xffffff, 0, TERRAIN_SIZE * 1.5); // Опционально: туман

    // Создаем камеру
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    // Стартовая позиция над возможным самым высоким холмом, в центре мира
    camera.position.set(0, TERRAIN_HEIGHT_SCALE + PLAYER_HEIGHT + 5, 0);


    // Создаем рендерер WebGL
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // ------------- Добавляем свет -------------
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1).normalize();
    scene.add(directionalLight);

    // ------------- Создаем и генерируем рельеф -------------
    // Three.js PlaneGeometry по умолчанию создается в плоскости XY.
    // Для нашего рельефа мы будем использовать плоскость XZ, а Y будет высотой.
    // Параметры: ширина, высота, сегменты по ширине, сегменты по высоте
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
            // Делим размер ландшафта на размер тайла текстуры
            texture.repeat.set(TERRAIN_SIZE / TEXTURE_TILE_SIZE, TERRAIN_SIZE / TEXTURE_TILE_SIZE);
            // Опционально: фильтрация для сглаживания
            texture.magFilter = THREE.LinearFilter;
            texture.minFilter = THREE.LinearMipmapLinearFilter;

             // Если материал был создан до загрузки текстуры, обновите его
            if (terrainMesh && terrainMesh.material && !terrainMesh.material.map) {
                 terrainMesh.material.map = texture;
                 terrainMesh.material.needsUpdate = true;
            }
        },
        // Колбэк прогресса загрузки (опционально)
        undefined,
        // Колбэк при ошибке загрузки
        function (err) {
            console.error('Ошибка загрузки текстуры:', TEXTURE_PATH, err);
             // Можно использовать материал запасного цвета, если текстура не загрузилась
             if (terrainMesh && terrainMesh.material && !terrainMesh.material.map) {
                 terrainMesh.material = new THREE.MeshLambertMaterial({ color: 0x00ff00, side: THREE.DoubleSide });
                 terrainMesh.material.needsUpdate = true;
             }
        }
    );

    // Генерируем рельеф, изменяя Y-координаты вершин
    const positionAttribute = geometry.attributes.position;
    const uvAttribute = geometry.attributes.uv; // Получаем атрибут UV
    const vertices = positionAttribute.array;
    const uvs = uvAttribute.array;

    // PlaneGeometry создает вершины, расположенные в плоскости XY (-width/2 до width/2, -height/2 до height/2)
    // Нам нужно их интерпретировать как XZ (-TERRAIN_SIZE/2 до TERRAIN_SIZE/2)
    // Y будет высотой
    // Количество вершин = (TERRAIN_SEGMENTS + 1) * (TERRAIN_SEGMENTS + 1)
    const numVertices = (TERRAIN_SEGMENTS + 1) * (TERRAIN_SEGMENTS + 1);

    for (let i = 0; i < numVertices; i++) {
        // Координаты X и Z вершины в плоскости Three.js PlaneGeometry (по сути это X и Y в 2D плоскости геометрии)
        const currentX = vertices[i * 3];
        const currentZ = vertices[i * 3 + 1]; // В PlaneGeometry это Y, но мы используем его как Z мира

        // Генерируем высоту на основе шума Симплекса
        // Передаем координаты X и Z вершины (масштабированные для шума) в simplex2
        const y = noise.simplex2(currentX * TERRAIN_NOISE_SCALE, currentZ * TERRAIN_NOISE_SCALE) * TERRAIN_HEIGHT_SCALE;

        // Устанавливаем новую Y-координату вершины в массиве vertices
        vertices[i * 3 + 1] = y; // i * 3 + 1 это индекс Y координаты текущей вершины

        // Обновляем UV координаты для правильного наложения текстуры
        // Маппируем координаты X и Z вершины (в мировом пространстве) на UV координаты
        // PlaneGeometry генерирует UV от 0 до 1 по X и Y.
        // Мы хотим повторить текстуру, поэтому просто маппируем мировые координаты X и Z
        // на U и V, деля на размер тайла.
        // currentX и currentZ здесь уже в мировых единицах (-TERRAIN_SIZE/2 до TERRAIN_SIZE/2)
        const u = currentX / TEXTURE_TILE_SIZE;
        const v = currentZ / TEXTURE_TILE_SIZE;

        // i * 2 это индекс U координаты текущего UV в массиве uvs
        uvs[i * 2] = u;
        uvs[i * 2 + 1] = v;
    }

    // Сигнализируем Three.js, что атрибуты геометрии были изменены
    positionAttribute.needsUpdate = true;
    uvAttribute.needsUpdate = true;
    geometry.computeVertexNormals(); // Пересчитываем нормали для правильного освещения рельефа

    // Создаем материал. Используем временный цвет, если текстура еще не загружена.
    const material = new THREE.MeshLambertMaterial({
        map: groundTexture, // groundTexture может быть еще в процессе загрузки
        color: groundTexture.isTexture ? null : 0x00ff00, // Цвет по умолчанию, если текстура не загрузилась
        side: THREE.DoubleSide
    });

    terrainMesh = new THREE.Mesh(geometry, material);
    // PlaneGeometry создается в плоскости XY, поворачиваем ее, чтобы она лежала на XZ
    terrainMesh.rotation.x = -Math.PI / 2;
    scene.add(terrainMesh);

    // ------------- Настраиваем PointerLockControls -------------
    controls = new THREE.PointerLockControls(camera, document.body);

    // Добавляем обработчики событий блокировки/разблокировки указателя
    controls.addEventListener('lock', function () {
        instructions.style.display = 'none';
        blocker.style.display = 'none';
    });

    controls.addEventListener('unlock', function () {
        blocker.style.display = 'block';
        instructions.style.display = 'flex'; // Показываем инструкции снова
    });

    // Добавляем контролы в сцену (они управляют положением камеры)
    scene.add(controls.getObject()); // PointerLockControls создает объект, который управляет камерой

    // ------------- Обработка событий клавиатуры -------------
    const onKeyDown = function (event) {
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
                // Проверяем, можно ли прыгнуть, и находимся ли мы на земле (или близко)
                if (canJump === true) {
                    playerVelocity.y = PLAYER_JUMP_HEIGHT; // Устанавливаем начальную скорость прыжка
                    canJump = false; // Нельзя прыгнуть снова, пока не приземлится
                }
                break;
        }
    };

    const onKeyUp = function (event) {
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

    // Применяем гравитацию к вертикальной скорости
    playerVelocity.y -= GRAVITY * deltaTime;

    // Рассчитываем горизонтальное движение на основе нажатых клавиш
    // Сбрасываем горизонтальную скорость в начале каждого кадра,
    // чтобы движение прекращалось, когда клавиши отпущены.
    // Однако, PointerLockControls.move* учитывает время, поэтому
    // прямое присваивание playerVelocity здесь не совсем физически точно
    // для остановки, но работает для начала движения.
    // Более точное было бы применять ускорение, но для простоты оставим так.

    direction.z = Number(moveForward) - Number(moveBackward);
    direction.x = Number(moveRight) - Number(moveLeft);

    // Нормализуем вектор, только если есть движение по какой-либо оси
    if (moveForward || moveBackward || moveLeft || moveRight) {
        direction.normalize();
         // Устанавливаем желаемую горизонтальную скорость
        playerVelocity.z = direction.z * PLAYER_SPEED;
        playerVelocity.x = direction.x * PLAYER_SPEED;
    } else {
        // Если нет движения, постепенно уменьшаем горизонтальную скорость
        // Это имитирует трение. Коэффициент 0.9 уменьшает скорость на 10% за кадр.
        // Или можно просто сбросить:
         playerVelocity.x = 0;
         playerVelocity.z = 0;
    }


    // Перемещаем игрока горизонтально (через контролы), учитывая время
    controls.moveRight(playerVelocity.x * deltaTime);
    controls.moveForward(playerVelocity.z * deltaTime);


    // Применяем вертикальную скорость к позиции игрока (камере), учитывая время
    camera.position.y += playerVelocity.y * deltaTime;

    // ------------- Простая коллизия с рельефом (с использованием Raycasting) -------------
    // Создаем луч, идущий вниз от текущей позиции игрока
    // Позиция луча должна быть немного выше текущей позиции камеры, чтобы избежать
    // пересечения с самой камерой или проходить *сквозь* землю, если камера уже внутри.
    // Поднимем начало луча на небольшую величину выше PLAYER_HEIGHT.
    const raycasterOrigin = camera.position.clone();
    raycasterOrigin.y += 0.1; // Немного выше текущей позиции камеры

    raycaster.set(raycasterOrigin, down);
    raycaster.far = PLAYER_HEIGHT + 0.2; // Максимальное расстояние луча (немного больше высоты игрока)

    // Проверяем пересечение луча с мешем рельефа
    // Пересечения сортируются по расстоянию, поэтому первый элемент - ближайший
    const intersects = raycaster.intersectObject(terrainMesh, false); // false означает не проверять потомков

    if (intersects.length > 0) {
        const firstIntersection = intersects[0];
        const groundY = firstIntersection.point.y; // Y-координата точки пересечения на рельефе

        // Если игрок ниже уровня земли (плюс высота игрока)
        // Используем небольшую дельту (0.05) для избежания дрожания на поверхности
        if (camera.position.y < groundY + PLAYER_HEIGHT - 0.05) {
            playerVelocity.y = 0; // Останавливаем падение
            camera.position.y = groundY + PLAYER_HEIGHT; // Устанавливаем позицию на уровне земли + высота игрока
            canJump = true; // Разрешаем прыжок снова

        } else {
             // Если игрок находится НАД землей, но луч ее пересек (т.е. игрок очень близко к земле сверху)
             // Также разрешаем прыжок. Это покрывает случаи, когда игрок движется горизонтально
             // и его ноги находятся очень близко к неровной поверхности.
             if (camera.position.y < groundY + PLAYER_HEIGHT + 0.1) { // Небольшой допуск
                 canJump = true;
             } else {
                 canJump = false; // Если игрок заметно выше земли
             }
        }
    } else {
        // Если луч не пересек землю (например, игрок в воздухе после прыжка или падает)
        canJump = false; // Нельзя прыгнуть в воздухе
    }


    prevTime = time; // Обновляем время предыдущего кадра

    // ------------- Рендеринг сцены -------------
    renderer.render(scene, camera);
}

// Запускаем инициализацию сцены после загрузки DOM и скриптов
// Используем addEventListener вместо window.onload для более гибкого управления
window.addEventListener('load', init);