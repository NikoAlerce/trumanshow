# Truman Show · EJX Cube

Un cubo de EyeJack X con seis escenas de *The Truman Show*, una por cara.

**Verlo:** https://nikoalerce.github.io/trumanshow/ — tocá «Tap to start» y esperá a que cargue.

**Cómo se mira** (como un visor de GLB): arrastrar con el botón izquierdo gira la cámara alrededor del cubo; con el botón derecho la desplaza; la rueda acerca y aleja. En pantallas táctiles, un dedo gira y dos dedos acercan y desplazan.

## Las seis caras

| Cara | Escena |
|---|---|
| Derecha | El final: el velero contra la pared del cielo y la puerta EXIT |
| Izquierda | La sala de control de Christof |
| Frente | La tormenta, con Truman atado al mástil |
| Atrás | «Good morning» y el foco SIRIUS que cae del cielo |
| Arriba | Truman frente al espejo del baño (vos sos la cámara escondida) |
| Abajo | La lluvia que cae solo sobre él |

El detalle de cada escena está en [LEEME_objkt.md](LEEME_objkt.md).

## Estructura

- `docs/`: el sitio publicado, que sirve GitHub Pages.
- `src/content/`: el código de las escenas (three.js r151 dentro del reproductor EyeJack X).
- `original/`: el reproductor EyeJack X y la escena exportada.
- `tools/`: el build, el servidor local y utilidades de desarrollo.

## Volver a generar

```bash
pip install numpy pillow
python tools/build.py --zip --pages
```

- `--zip` escribe `trumanshow_objkt.zip`, el archivo para mintear en objkt.
- `--pages` copia el sitio a `docs/`.

Para probarlo en local: `python tools/serve.py` y abrir `http://127.0.0.1:8766/dist/index.html`.
