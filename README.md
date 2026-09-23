# Koyomi — Bullet journal

*Koyomi* (暦) es la palabra japonesa para el almanaque: el cómputo del tiempo en días, meses y años.

PWA móvil para gestión personal de tareas siguiendo la metodología *bullet journal*. Guarda primero en
IndexedDB, funciona sin conexión y sincroniza en segundo plano con una identidad anónima de Firebase.
Misma arquitectura de persistencia y despliegue que [Agatsu](../habits-tracker).

## Qué hace

Cuatro escalas de tiempo en el menú inferior, más una pestaña de herramientas:

- **Día** — el *daily log*. Tira de la semana para saltar de día, repaso de lo que quedó abierto y
  recuento de hechas/pendientes.
- **Mes** — el *monthly log*, con calendario del mes que marca los días con entradas y permite bajar a
  cualquiera de ellos.
- **Trimestre** — escala intermedia, útil para objetivos que no caben en un mes ni llegan al año.
- **Año** — el *future log*.
- **Más** — colecciones, buscador, estadísticas y ajustes.

### Mover tareas

Mover es la operación central del método, así que está a un toque:

- Botón de migrar en cada entrada → hoja con destinos rápidos (mañana, próximo lunes, este mes, mes que
  viene, trimestre, año…), selector de fecha concreta y cualquier colección.
- **Repaso de pendientes**: al abrir el día actual, si quedaron tareas abiertas en días o periodos
  anteriores aparece un aviso para traerlas a hoy, moverlas en bloque o descartarlas.
- **Deshacer** el último movimiento desde la propia lista.
- Cada entrada recuerda cuántas veces se ha migrado; a partir de la primera se dibuja con el símbolo `›`.

### Bullet journal clásico

| Símbolo | Significado |
| --- | --- |
| `•` | tarea pendiente |
| `×` | tarea hecha |
| `›` | tarea migrada (se ha movido al menos una vez) |
| `~` | tarea descartada |
| `○` | evento |
| `—` | nota |
| `★` | prioritaria |
| `!` | inspiración |

### Además

- **CRUD completo** con hoja de edición: tipo, título, notas, marcas, etiquetas, estado y periodo.
- **Alta rápida** desde la caja superior, con atajos al escribir: `*` prioritaria, `!` inspiración,
  `-` nota, `o` evento y `#etiqueta` (crea la etiqueta si no existe).
- **Reordenar** arrastrando dentro de cada periodo.
- **Colecciones** temáticas fuera del calendario (libros, ideas, compras…), archivables.
- **Etiquetas** con color, editables desde Ajustes.
- **Buscador** por texto, estado, tipo y etiqueta, sin tildes ni mayúsculas.
- **Estadísticas**: racha de días cerrados, recuento por escala, uso de etiquetas del año y ranking de
  lo que más has aplazado.
- **Copias de seguridad**: exportar/importar JSON validado y exportar un resumen en Markdown.
- **PWA** instalable, con aviso de actualización y funcionamiento offline.

## Desarrollo local

Requisitos: Node.js 24 y npm.

```bash
npm install
npm run dev
```

Comprobaciones habituales:

```bash
npm run lint
npm test
npm run build
npm run check   # las tres anteriores
```

La compilación usa `/bullet-journal/` como ruta base para GitHub Pages.

## Datos

Modelo (`src/types.ts`):

- `JournalEntry` — entrada del diario: tipo, título, notas, estado, marcas, etiquetas, orden, número de
  migraciones y **clave de periodo**.
- `Tag`, `Collection`, `Preferences`.

La clave de periodo (`periodKey`) identifica dónde vive cada entrada y es lo único que cambia al migrarla:

| Ámbito | Formato | Ejemplo |
| --- | --- | --- |
| Día | `AAAA-MM-DD` | `2026-09-23` |
| Mes | `AAAA-MM` | `2026-09` |
| Trimestre | `AAAA-Qn` | `2026-Q3` |
| Año | `AAAA` | `2026` |
| Colección | `col:<id>` | `col:1f2e…` |

Toda la aritmética de periodos (navegar, subir de escala, saber qué contiene qué, proponer destinos de
migración) vive en `src/lib/periods.ts` y está cubierta por tests.

### Persistencia

Igual que en Agatsu: escritura local inmediata en IndexedDB (`idb`) con una cola de operaciones
pendientes; un proceso de sincronización (`src/data/cloud-sync.ts`) sube la cola y escucha cambios
remotos, resolviendo conflictos por `updatedAt` (gana el más reciente). Los borrados son lápidas
(`deletedAt`), nunca eliminaciones físicas, para que se propaguen entre dispositivos.

## Firebase

Comparte proyecto con Agatsu: `habits-tracker-78d9b`. Para no mezclar datos, esta app escribe en
colecciones propias dentro del mismo documento de usuario:

```
users/{uid}/bujoEntries
users/{uid}/bujoTags
users/{uid}/bujoCollections
```

Las reglas ya publicadas (`users/{userId}/{document=**}` sólo para su propio `uid`) cubren estas
colecciones sin cambios. Se incluye [firestore.rules](./firestore.rules) por si hay que republicarlas:

```bash
npx firebase deploy --only firestore:rules
```

Requisitos ya configurados en el proyecto: acceso **Anónimo** habilitado, creación de cuentas activada y
`crueda.github.io` entre los dominios autorizados.

La configuración web incluida en `src/data/firebase.ts` es pública; nunca se debe añadir una cuenta de
servicio, una clave privada ni un token personal al repositorio.

## Publicación en GitHub Pages

1. Crear el repositorio `crueda/bullet-journal` y subir la rama `main`:

   ```bash
   git remote add origin https://github.com/crueda/bullet-journal.git
   git push -u origin main
   ```

2. En **Settings → Pages**, elegir *Source: GitHub Actions*.
3. Cada push a `main` ejecuta [deploy-pages.yml](./.github/workflows/deploy-pages.yml): instala, pasa los
   tests, compila y publica.

La app queda en `https://crueda.github.io/bullet-journal/`.
