## Как собрать билды .html:
- Скачать NodeJS с официального сайта и установить его (если он не установлен);
- Собрать билды по сеткам с помощью playable-adapter;
- Вставить название проекта в файл builder/zipper.js;
- Вставить ссылки на сторы в файл builder/start.js;
- В контексте корня проекта вызвать терминал и ввести 3 команды:
    - `npm i` - Загружает зависимые покеты (при необходимости);
    - `npm run build` - Собирает билды по рекламным сеткам;
    - `npm run zip` - Архивирует билды.
- Билды по сеткам лежат в корне проекта в папке Buildes -> zip.

## Порядок действий, чтобы собрать физику PhysX wasm в cocos (возможно еще и Spine нормально соберет):
- Перейти на версию Cocos Creator 3.8.4;
- Перейти на версию playable adapter 1.3.10;
- Сделать копию каталога “engine”, которую потом будем редактировать, он находится по пути: `C:\ProgramData\cocos\editors\Creator\3.8.4\resources\resources\3d\`;
- В копии найти  файл “wasm-web.ts” по пути: `.\pal\wasm`;
- Заменить в нем строку 60: `binaryUrl = new URL(binaryUrl, import.meta.url).href;” на “binaryUrl = ‘cocos-js/’ + binaryUrl;`;
- Внутри Cocos Creator перейти во вкладку `“Preferences” -> “Engine Manager” -> галочка “Use Custom”`;
- Указать путь к новому “engine”;
- Перезапустить Cocos Creator;
- Во время билда внутри “Build config”, прокрутить конфиг до “Bundle Mode Of Native Code” и указать “Wasm”.
