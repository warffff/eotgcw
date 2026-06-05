# Отображение моделей Garry's Mod на сайте

Браузер не умеет напрямую открывать `.mdl` Garry's Mod/Source. Сайт поддерживает два варианта:

1. PNG/WebP рендер модели:
```json
{
  "models/player/example.mdl": "https://site.ru/renders/example.webp"
}
```

2. GLB/GLTF модель через `<model-viewer>`:
```json
{
  "models/player/example.mdl": {
    "image": "https://site.ru/renders/example.webp",
    "glb": "https://site.ru/models/example.glb"
  }
}
```

Файл карты моделей: `content/model-images.json`.

Конвертация `.mdl` в `.glb/.gltf` делается вне Vercel: сначала извлекаются модель/текстуры из Source/GMod, затем они конвертируются в формат, поддерживаемый Blender или SourceIO, после чего экспортируются в `.glb`.
