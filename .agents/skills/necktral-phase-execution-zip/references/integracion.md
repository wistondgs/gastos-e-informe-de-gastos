# Instalación e integración controlada

Contenido: activación sin tocar K2; inventario previo de hooks; guarda opcional;
archivos e impacto de integración; límites y reversión.

## Activación sin tocar K2

Instalar la Skill no modifica el ERP. En ChatGPT Work, el guardado de Skills se
hace por su repositorio de Skills; no equivale a instalarla en el Codex de la PC.
El ZIP solicitado contiene una carpeta `necktral-phase-execution/`, con
`SKILL.md` en su raíz. Mantener el nombre y no reemplazar governance.

En Codex local, extraer esa carpeta en `$HOME/.agents/skills/`, fuera de ERP V4.
En Windows 11 con WSL2, usar el HOME de la distribución donde corre Codex; en
Ubuntu, el HOME del usuario. No instalar una segunda copia en `.agents/skills`
del repositorio. La guarda y el fragmento se probaron en Linux; no se acredita
ejecución nativa en Windows ni en la PC del usuario.

Abrir una sesión nueva cuando termine la operación crítica actual. Comprobar
que la Skill aparece y seleccionarla como `$necktral-phase-execution`. Su metadata
desactiva invocación implícita para no inyectarla en sesiones ya iniciadas. Usar
el mandato integral relleno con el **estado actual leído**, sin arrancar otra fase.
Durante una campaña K2 válida viva, limitarse a observar; no recargar hooks,
reiniciar Codex, cambiar SHA ni editar su clon para activar esta herramienta.

## Inventario previo a cualquier hook

Leer configuración Git efectiva, `core.hooksPath` con su origen, dispatcher,
`pre-commit`, `commit-msg`, procedencia y gates actuales. Revisar D-80/D-81,
reglas bilaterales y contratos de commit. El ZIP histórico no contiene un hook
`commit-msg` activo, por lo que **no permite aprobar su composición actual**.
No inferir que el hook no existe en la PC.

Elegir una integración nueva solo si resuelve un hueco determinista sin control
equivalente existente. La opción predeterminada es **Skill sola, cero hooks nuevos**.

| Control | Responsable | Entrega nueva |
| --- | --- | --- |
| Marca bilateral, ficha y secuencia de commits | `procedencia`, `commit-msg` y gate vigentes | Ninguna duplicación |
| Fallo rojo real, causa y verde | Ejecución y evidencia de pruebas; revisión/gate | Instrucciones y plantilla, no un «certificador de rojo» |
| Rutas permitidas y prohibidas | Mandato; opcional `pre-commit` rápido | `phase_guard.py`, si falta equivalente |
| Rama, ascendencia, conflicto, operación Git activa | Guarda local y protocolo del escritor | Misma guarda, sin mutación |
| No escribir clon FAB/protegido ni candidato congelado | Corredores existentes, permisos y protocolo; preflight cooperativo | Rechazo local de esa operación declarada; no firewall global |
| Contratos API/eventos, aislamiento, invariantes y negativos | Compuerta oficial/corredor; CI si existe | Ningún gate nuevo ni traslado de Docker al hook |
| Certificado del SHA exacto y restauración | Corredor, revisión y cierre oficial | Verificación de evidencia; no recertificación paralela |

## Guarda opcional incluida

Requiere Python 3.10+ y Git; sin paquetes externos, red, Docker ni servicios.
Lee Git y una política JSON con hash SHA-256 aprobado. No escribe archivos, no
instala hooks, no hace commits, stash ni limpieza y no ejecuta hooks existentes.

El esquema está en `assets/policy.example.json`: es una **plantilla inválida hasta
rellenarla y aprobarla**, no autorización de la fase 4. Las rutas de ejemplo se
ajustan a la ficha leída; faltan rutas adicionales si el mandato actual las exige.
Declarar expresamente cada contrato, test o migración permitido. Las prohibiciones
prevalecen. Un literal con `/` final incluye descendientes; un literal sin `/`
solo el archivo exacto. No hay globs, negaciones implícitas ni prefijos ambiguos.

La guarda comprueba raíz física, rama, descendencia desde base, recursos protegidos,
rol FAB, congelación, conflictos y operaciones Git incompletas. Revisa rutas
staged, tracked modificadas y untracked no ignoradas; detecta origen/destino de
renombres, borrados, symlinks externos y submódulos cambiados. WIP ajeno bloquea:
preservarlo y coordinar; no borrarlo para conseguir PASS.

Antes de consultar diferencias del árbol, rechaza filtros Git externos configurados
y flags `assume-unchanged`/`skip-worktree` que podrían ocultar cambios. No desactiva
esos filtros ni limpia flags para continuar. Comprueba modos en HEAD e índice,
incluidas eliminaciones de enlaces o submódulos. Si el repo usa esos mecanismos,
mantener la Skill sin esta guarda hasta revisar la integración específica.

Uso manual con valores concretos aprobados:

```text
python3 /ruta/a/necktral-phase-execution/scripts/phase_guard.py --repo /raiz/fisica/ERP_V4 --policy /ruta/politica.json --policy-sha256 HASH_APROBADO --operation commit
```

`--operation mutate` comprueba las mismas precondiciones sin exigir staged. Solo
inspecciona el estado ya existente; **no analiza ni anticipa el próximo comando**.
PASS significa precondiciones locales satisfechas, no fase aprobada/certificada.
Código 1 bloquea el commit si el dispatcher respeta el resultado; código 0 pasa
el control local. Cada invocación Git tiene timeout de 5 segundos; no se ejecutan
campañas costosas dentro del hook.

## Archivos e impacto de una integración futura

Solo después de inspección y autorización, preparar un único cambio agrupado:

1. Skill de usuario fuera del repo: `$HOME/.agents/skills/necktral-phase-execution/`.
2. Política concreta: `<git-dir-del-escritor>/necktral-phase-policy.json`, fuera del
   árbol versionado, con base/rama/rutas/autoridad verificadas. No es un registro
   de fase; es la proyección mecánica de sus rutas, sin bugs ni campañas.
3. Una llamada del fragmento `assets/pre-commit.fragment.sh` en el `pre-commit` o
   dispatcher **efectivo**. El path definitivo depende del inventario actual:
   no afirmar que es `.git/hooks/pre-commit` si `core.hooksPath` lo redirige.
4. Hash literal de política en esa llamada; probar composición y retorno no cero
   junto a hooks existentes. No tocar `commit-msg`, `./v4`, scripts oficiales,
   constitución, roadmap ni decisiones para instalar.

Esta entrega **no aplica** esos cambios al repositorio ERP. No ofrece instalador
que sobrescriba hooks. Si la política cambia por una decisión autorizada, revisar
su nuevo contenido y actualizar su hash; no aceptar una edición silenciosa.

## Límites y reversión

Los hooks Git pueden omitirse con `--no-verify`; no detienen escrituras por editor,
otros agentes, un shell ajeno ni un proceso ya en curso. La guarda no adquiere
lock, no elimina la carrera entre chequeo y operación, no descubre todos los
procesos y no autentica a Wis con una firma. El hash liga bytes revisados y no
prueba aprobación por sí mismo. Rutas ignoradas y bases de datos quedan fuera de
su inspección. No presentar estas comprobaciones como exclusión mutua universal.

La exclusividad sigue en el protocolo oficial de escritor/FAB y sus controles;
si esos mecanismos necesitan reforzarse, consolidar la propuesta tras leer la
implementación viva. No inventar otro registro de campañas/locks por defecto.
No se añade un hook Codex `PreToolUse` que intente interpretar todo Bash: sus
superficies tienen excepciones y no sustituyen permisos ni gates.

Para revertir, retirar solo la llamada añadida y política creada por esta
integración, preservando hooks previos y su configuración. Retirar la Skill de
usuario en una sesión nueva no altera certificados, commits ni datos del ERP.

Fuentes oficiales consultadas: [Skills](https://learn.chatgpt.com/docs/build-skills)
y [Hooks](https://learn.chatgpt.com/docs/hooks). La disponibilidad real de la
versión instalada debe comprobarse en la PC antes de aplicar configuración.
