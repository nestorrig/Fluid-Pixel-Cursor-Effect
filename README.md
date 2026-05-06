# Interactividad

Proyecto web tipo portfolio enfocado en experiencias visuales interactivas con HTML, CSS y JavaScript.
Incluye animaciones tipograficas, composicion visual responsive y un cursor de fluido pixelado que reacciona al movimiento y al hover sobre elementos clave de la interfaz.

## Detalles tecnicos

- El efecto visual se renderiza en un `canvas` fullscreen con una simulacion 2D de velocidad, presion y densidad.
- El cursor se suaviza con friccion y convierte su velocidad en fuerza/radio para inyectar fluido en tiempo real.
- En elementos `.mask-p5`, el flujo cambia a un remolino continuo controlable con parametros via `Tweakpane`.