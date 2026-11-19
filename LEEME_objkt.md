# Truman Show · EJX Cube — versión para objkt

## Qué entregar

| Archivo | Para qué |
|---|---|
| `trumanshow_objkt.zip` | El NFT interactivo (HTML), listo para subir a objkt. Pesa 4,6 MB con la realidad aumentada (`ar/`, 0,3 MB); el original pesaba 21 MB. |
| `captures/cover.jpg` | Portada / miniatura en 1000×1000: «TRUMAN.» en la luz del cielo. También va dentro del zip como `og:image`. |
| `captures/skywriting.jpg` | Imagen para difusión: la despedida escrita con humo. |
| `captures/exit_closeup.jpg` | Imagen para difusión: Truman entrando por la puerta EXIT. |
| `captures/face_*.jpg` | Una imagen de cada cara: tormenta, buenos días, espejo (dos momentos), lluvia y sala de control. |
| `captures/storm_lashed_closeup.jpg` | Primer plano: Truman atado al mástil en la tormenta. |

El zip original (`trumanshow (1).zip`) no se modificó.

## La historia del cubo (loop de 42 s)

1. **Cue the sun.** Amanece en el domo. Truman está arriba de la escalera, junto a la puerta EXIT.
2. **Christof habla desde el cielo.** El domo se oscurece y se abre una luz entre las nubes pintadas, con un rayo que cae sobre Truman. Sus palabras aparecen en esa luz: *TRUMAN. / I PAINTED THIS SKY FOR YOU. / OUT THERE, NOTHING IS TRUE. / STAY.* Truman mira hacia arriba. Mientras tanto, en la sala de control se enciende la luz del micrófono.
3. **Truman responde.** Saluda, y una avioneta escribe su despedida con humo sobre el cielo pintado. Las letras se deshacen como humo: *good morning, / and in case I don't see ya, / good afternoon, good evening, / and good night!*
4. **Reverencia y salida.** Se inclina, se da vuelta y desaparece en la oscuridad del EXIT.
5. **Se corta la transmisión.** En la sala de control, todas las pantallas pasan a estática y se apaga el ON AIR.
6. **Apagón del estudio**, y el loop vuelve a empezar.

## Las seis caras del cubo

Cada cara es una ventana a una escena distinta, fija a su cara como un cuadro en su marco: si girás el cubo, la escena gira con él. Arriba y abajo se leen derechas cuando inclinás la vista sobre el cubo desde el frente.

**Cómo se mira** (como un visor común de GLB): arrastrar con el botón izquierdo gira la cámara alrededor del cubo; con el botón derecho la desplaza; la rueda acerca y aleja. En pantallas táctiles: un dedo gira, dos dedos acercan y desplazan. El botón XR de EyeJack está oculto; en su lugar, cuando el cubo terminó de cargar, aparece **View in AR** abajo a la derecha (ver *La realidad aumentada en el NFT*).

**La carga**: desde el primer instante, una barra abajo dice cuánto falta: *Loading Seahaven* (descarga), *Building the set* (arma las escenas), *Lighting the stage* (prepara los sombreadores) y *Good morning!* al terminar. La carga empieza sola, sin esperar el toque de «Tap to start». La primera visita tarda unos segundos más, porque la placa de video compila los sombreadores (en paralelo, sin trabar la página). Después quedan guardados en el navegador.

| Cara | Escena |
|---|---|
| Derecha | **El final (EXIT)**: la historia de arriba, con el velero «SANTA MARIA» clavado en la pared-cielo. |
| Izquierda | **La sala de control de Christof** |
| Frente | **La tormenta** |
| Atrás | **Buenos días y el foco SIRIUS** |
| Arriba | **Truman frente al espejo** |
| Abajo | **La lluvia que cae solo sobre él** |

**La sala de control** (izquierda):
- Christof (el fantasma con boina y auriculares) en su escritorio, de espaldas.
- Pared curva de monitores con carcasas y una pantalla grande central. Muestra en vivo las cámaras de **todas** las otras escenas: el final, la tormenta, la casa, el espejo y la playa.
- Cartel LED que corre arriba de la pared y cartel ON AIR.
- Consola curva con dos técnicos con auriculares que miran sus pantallas y se dan vuelta hacia Christof.
- Estructura de luces en el techo, con haces de luz y polvo flotando sobre el escritorio.
- Racks con LEDs, el mapa de cámaras de la isla con luces que parpadean y un timecode que corre.
- Un ventanal a la noche del domo y una neblina que da profundidad.
- Cuando se corta la transmisión, todo pasa a estática.

**La tormenta** (frente): el velero, más grande y más cerca, escorado en olas grandes, con espuma en vetas sobre las crestas, rocío que salta de la proa, lluvia y relámpagos que iluminan las nubes. El barco flota sobre el agua más alta bajo la proa, el centro y la popa, así que no se hunde entre las olas.
- Truman está **atado al mástil**: tres vueltas de cuerda ceñidas al torso, ajustadas a la forma real de su cuerpo, y más vueltas en el palo. El nudo y la punta suelta caen hasta la cubierta.
- Levanta el puño cerrado al cielo del lado que se ve (el foque tapa el otro brazo) y con la otra mano se agarra de la cuerda. El puño no late como un metrónomo: lo sacude en ráfagas cuando grita, después tiembla de tensión, y la muñeca se dobla un poco hacia atrás en cada sacudida.

**Buenos días y SIRIUS** (atrás, loop de 26,5 s): la casa de Truman con cerca blanca, buzón, auto y vecinos, vista de cerca para que Truman se lea en su vereda. Luz de mañana: un sol bajo y dorado que entra de costado desde la izquierda y tira sombras largas sobre el pasto y la calle, sombras frías, poco relleno de cielo, una luz de contorno desde atrás, una bruma cálida que aclara los árboles lejanos, relieve en el pasto, el asfalto, las tejas y las tablas de la casa, y una viñeta suave en el borde de la ventana.
- Los árboles, los arbustos y el auto son **recortes pintados** (planos con alfa). Los árboles giran hacia quien los mira y, para su sombra, hacia el sol, así que la sombra conserva la forma; un relieve calculado desde el dibujo les da volumen (un lado al sol, el otro en sombra) y se mecen con el viento. El auto es utilería de set: de frente es un sedán de los 90 pintado; por detrás, madera terciada con dos puntales y bolsas de arena.
- Truman saluda. Detrás de la casa titila una estrella: es SIRIUS (9 CANIS MAJOR), un foco colgado del domo. Se suelta en tres tirones y cae encendido como una estrella fugaz, con un cable cortado azotándose detrás. Truman lo oye venir y lo sigue con la cabeza.
- Choca en la calle junto al auto: destello, chispas, vidrios que saltan y quedan en el asfalto, una nube de polvo, una grieta. La calle tiembla y el auto prende las balizas y se balancea.
- Truman se cubre la cara, mira el auto, camina hasta el foco, se agacha y lo toca: quema. Sacude la mano y se sopla los dedos. Lee la etiqueta, se para y busca en el cielo haciéndose sombra con la mano.
- Baja un gancho de grúa del cielo, engancha el foco por el aro y se lo lleva. Truman se sobresalta y lo mira subir. La estrella vuelve a su lugar y él se va a su casa mirándola.
- El barrio está vivo: pájaros pintados que aletean y planean, un aspersor en el pasto, humo de la chimenea y nubes que pasan.
- Al borde de la ventana, la calle está cortada: asfalto, ripio, tierra, un caño y los cables del estudio que pasan por debajo de Seahaven.

**El espejo** (arriba, loop de unos 28 s): la cara del cubo *es* el espejo del baño, con su marco satinado y un tornillo en cada esquina; es un espejo espía, y vos sos la cámara escondida detrás.
- Con una barra de jabón, Truman dibuja en el vidrio un gráfico de tez (XTZ) cayendo: ejes con marcas, una línea en zigzag que se desploma hacia la derecha con una flecha al final y «XTZ» arriba. Está dibujado para leerse bien desde nuestro lado.
- La barra de jabón en su mano sigue de verdad cada trazo, con movimiento de mano real: entra y sale de cada línea más despacio, frena en las esquinas, levanta la mano en un arco entre trazos y la muñeca acompaña la dirección del dibujo. Los dedos siguen trabajando sobre el jabón y el cuerpo se inclina un poco hacia donde dibuja.
- Se queda mirándolo, niega con la cabeza y se acerca a mirar fijo al lente.
- Al final lo borra con la mano y queda una mancha de jabón que se desvanece.

**La lluvia** (abajo, loop de 24 s): una playa de Seahaven con un sol bajo y dorado que llega desde el mar a la derecha: sombras largas hacia nosotros, contraluz en Truman, un camino de brillos sobre el agua y el reflejo cálido de la arena. Sombrilla, una toalla de verdad (rizo, rayas desteñidas, flecos, pliegues y una punta que levanta la brisa), reposera, torre de guardavidas, muelle y gaviotas pintadas. Las olas entran rompiendo y la espuma sube y baja por la arena; el mar se pierde en la bruma.
- Del cielo despejado cae una lluvia solo sobre Truman, con la sombra de una nubecita. La primera gota: se sobresalta y se toca la cabeza; después mira arriba y pone la palma.
- Se va caminando y la lluvia lo sigue tarde, como un seguidor de luz buscando a su actor. Un momento al sol (alivio) y la lluvia lo alcanza: se encoge de hombros. Sale corriendo para el otro lado y lo vuelve a alcanzar.
- Donde la lluvia se queda quieta se forma un charco con ondas, y la arena queda mojada.
- Al final se larga en toda la playa con viento: el cielo se pone gris, entra una neblina que se come el mar, la luz se vuelve fría y baja, la toalla se moja, la lluvia se inclina, la sombrilla tiembla y Truman se tapa la cabeza con las dos manos. Las gotas le rebotan en la cabeza y los hombros, y la ropa se le oscurece y brilla de mojada.
- Vuelve el sol: se sacude, sigue goteando, mira arriba desconfiado y al final se da vuelta y nos mira fijo a nosotros, la cámara escondida.

## Cómo mintear en objkt
1. Crear token → subir `trumanshow_objkt.zip` (HTML / interactivo).
2. Portada / miniatura: `captures/cover.jpg`.
3. **Probar la vista previa de objkt antes de confirmar**: esperar a que la barra diga «Good morning!», tocar «Tap to start» y girar el cubo para ver las seis caras. La prueba dentro de su iframe con sandbox no se pudo hacer acá.
4. En la misma vista previa, **View in AR**: en la compu muestra un QR; escanearlo con el teléfono (Android con Chrome) y ver el cubo en el lugar.

## Para volver a generar
```bash
python tools/build.py --zip --pages
```
- `tools/import_ar.py`: trae el visor de AR de amAr a `src/ar/` (ver *La realidad aumentada en el NFT*). Va antes del build cuando cambia algo en amAr.
- `--zip`: el archivo para objkt. `--pages`: copia el sitio a `docs/`, que GitHub Pages publica en https://nikoalerce.github.io/trumanshow/ (repo: https://github.com/NikoAlerce/trumanshow). Para actualizar la página: build con `--pages`, commit y push.
- `tools/gen_sky.py`: cielo pintado.
- `tools/gen_text.py`: textos del cielo, rasterizados con Segoe Script y Georgia. Solo se incluye la imagen; las fuentes no van en el zip.
- `tools/serve.py`: servidor local. Después se abre `http://127.0.0.1:8766/dist/index.html`.
- `tools/dev_capture.js`: solo para desarrollo, no va en el zip. Con `?debug`, filma cuadros de una cara y los guarda en `captures/` a través de `serve.py`.
- Con `?debug` en la URL se exponen controles de desarrollo en `window.__truman`; sin ese parámetro no hacen nada. Por ejemplo, `__truman.world.debug.sides.subTime = 9` congela las escenas de las otras caras en ese segundo.

El código nuevo está en `src/content/` (`app.js` + `lib/`).

## En realidad aumentada, con amAr
El mismo contenido se ve en amAr (`Desktop/amAr`) como un cubo que flota en el lugar: proyecto `truman`, escena `cubo`. Por eso `lib/` tiene que andar con el three.js del reproductor de EyeJack (r151) y con el de amAr (r160). Después de cada build, en la carpeta de amAr:
```bash
node herramientas/traer_cubo.mjs truman ../trumanshow/dist/content
```

## La realidad aumentada en el NFT (`ar/`)
El zip lleva adentro el visor de amAr para este cubo, en la carpeta `ar/`: lee las mismas escenas de `content/`, así que no se duplica nada (suma 0,3 MB). Va en inglés y sin el motor de 8th Wall, cuya licencia es revocable y no deja pasárselo a otros (y esto queda para siempre en IPFS).

**El botón View in AR** aparece cuando el cubo terminó de cargar:
- **En una compu**: muestra un QR y el link a `ar/` de la misma obra, en el mismo servidor desde donde se está viendo (en objkt, su servidor de archivos). Se escanea con el teléfono.
- **En un teléfono, adentro de objkt**: objkt muestra la obra en un recuadro aislado (sandbox sin `allow-same-origin`) y ahí el navegador no deja abrir la cámara, aunque objkt le da permiso de cámara y de AR. Se probó: Chrome responde «Invalid security origin». Por eso el panel explica eso y da el link para abrirlo en el navegador, con un botón **Copy**.
- **En un teléfono, con la obra abierta sola** (por ejemplo, desde ese link o desde GitHub Pages): abre la AR directo, en otra pestaña.

**En la AR**: en Android con Chrome (ARCore) es realidad aumentada de verdad, con WebXR: el cubo queda donde lo ponés, se camina alrededor, una persona delante lo tapa y con el dedo se gira. En el iPhone (Safari no tiene WebXR) el cubo flota sobre la cámara y se mira girando el teléfono, sin caminarlo. En una compu se ve en 3D.

objkt tiene además un «modo avanzado» (el ícono del frasco debajo de la obra) que le da a la obra su propio origen. Con ese modo la AR quizás abra adentro de objkt, pero no se probó en un teléfono.

**Para actualizarlo** (después de cambiar y commitear algo en amAr):
```bash
python tools/import_ar.py
python tools/build.py --zip
```
`import_ar.py` corre `herramientas/exportar.mjs` de amAr sobre su **último commit**, no sobre la carpeta de trabajo: en el NFT va solo lo commiteado. Los textos en inglés de la AR están en `import_ar.py`.

**Para probarlo en el teléfono antes de mintear**: `python tools/build.py --pages`, commit y push. Después, en el teléfono:
- https://nikoalerce.github.io/trumanshow/ es la obra sola: View in AR abre la AR directo.
- https://nikoalerce.github.io/trumanshow/objkt.html es la obra adentro de un recuadro igual al de objkt: View in AR da el link para abrir afuera.
