# Auditoría de progresión y balance — 14 de septiembre de 2026

> Esta auditoría describe el estado anterior a la corrección de fábricas. El procesamiento y los módulos ya se ajustaron posteriormente; los valores actuales están en [factory-balance.md](factory-balance.md).

Estado revisado: HM `868c0dc`, UC `0162d7e9`. Auditoría de scripts, recetas, componentes de ítems y máquinas, con pruebas locales. No se modificó el comportamiento del pack. Las cifras de tiempo suponen 20 ticks/s, suministro continuo, entradas suficientes y salidas libres.

## Resultado

La Exo tiene implementadas sus funciones principales. La ruta nuclear produce combustible, energía, waste y materiales para la Exo. Los reactores ya tienen explosiones por sobretemperatura. Hazmat tiene objetos y recetas, pero falta el sistema de radiación que le dé utilidad específica.

Antes de aumentar velocidades conviene corregir el procesamiento de las fábricas y la fórmula de sus módulos: actualmente pueden cambiar de rendimiento al abrir la interfaz y añadir Processing Modules puede empeorar el rendimiento energético y productivo.

## 1. Fábricas: corregir antes de balancear

### La frecuencia de actualización cambia la producción

En `BP/scripts/machinery/machines/crusherController.js`, el controlador acumula progreso o fabrica, en ramas excluyentes. Aunque alcanza el coste durante una actualización, espera a la siguiente para producir. Tampoco completa varios lotes por actualización cuando la velocidad lo permitiría.

Los controladores de Electro Press, Incinerator, Infuser, Autosieve, Magmatic Chamber y Reaction Chamber usan el mismo patrón. UC sí acumula y procesa operaciones completadas en la misma actualización, mediante `UtilityCore/simpleMachine.js`.

El scheduler actualiza interfaces abiertas cada 4 ticks y máquinas cerradas cada 20 ticks en el perfil predeterminado `fast`; otros perfiles usan 40/80 ticks. La compensación de energía por intervalo no compensa esa espera adicional ni el límite de lotes.

**Reproducción local:** ejecutando el código real de Crusher Controller con inventario y energía simulados, receta de 800 DE, un Processing Module, sin Speed/Efficiency y durante 400 ticks:

| Intervalo | Ítems producidos en 20 segundos |
|---|---:|
| 4 ticks, interfaz abierta | 22 |
| 20 ticks, cerrada en fast | 14 |
| 40 ticks | 10 |
| 80 ticks | 4 |

Es una reproducción de lógica, no una medición dentro de Minecraft. A velocidades mayores el límite pesa todavía más.

**Propuesta:** consumir energía, calcular el progreso completado y fabricar en la misma actualización; admitir los lotes que permita el presupuesto acumulado, respetando entradas y salidas. Verificar igualdad de producción para distintos intervalos. Permitir entregar una operación ya pagada aunque la reserva de energía haya llegado a cero.

### Processing Module penaliza demasiado

En `BP/scripts/DoriosCore/multiblock/multiblockMachine.js`, con P módulos:

- Tamaño del lote: `2 × P`.
- Multiplicador de coste: `1 + 2.25 × (P - 1)`.

Pasar de uno a dos módulos duplica el lote, pero multiplica el coste por 3.25. A igual alimentación y sin el límite del scheduler, el rendimiento baja **38.5%**, mientras que la energía por ítem sube **62.5%**. Procesar más entradas simultáneamente no justifica por sí solo esta pérdida.

**Propuesta:** hacer que el coste crezca más despacio que el tamaño del lote, o aumentar explícitamente la capacidad de procesamiento paralelo. Definir primero el beneficio esperado por módulo y ajustar una sola fórmula coherente.

### Efficiency Module también acelera

La eficiencia multiplica el coste pero no reduce de la misma forma la tasa de energía que el controlador convierte en progreso. Por ello, también acelera la fabricación. Con 32 módulos, el factor de eficiencia es aproximadamente 0.01815; con 64, 0.010067, casi un descuento del 99% antes de las penalizaciones de otros módulos.

Esto puede trivializar los costes nucleares deliberadamente altos y hace difícil comparar Speed con Efficiency. Conviene separar duración de receta y consumo, o reconocer y balancear expresamente ambos beneficios. Un suelo de consumo menos extremo merece evaluación; no se propone aquí un valor definitivo sin probar las estructuras completas.

## 2. Comparación con las máquinas de UC

Comparación nominal, antes de la pérdida por actualización: misma receta, lote completo de dos operaciones, un Processing Module, ningún Speed/Efficiency y UC sin upgrades. La energía indicada es por operación, no por lote.

| Máquina HM | Tasa base HM / UC, DE/t | Producción nominal frente a UC | DE por operación frente a UC |
|---|---:|---:|---:|
| Crusher Factory | 100 / 20 | 2.5× | 2× |
| Electro Press Factory | 100 / 20 | 2.5× | 2× |
| Incinerator Factory | 100 / 20 | 2.5× | 2× |
| Infuser Factory | 400 / 40 | 5× | 2× |
| Autosieve Factory | 800 / 40 | 10× | 2× |
| Magmatic Chamber Factory | 1600 / 40 | 20× | 2× |

Los lotes incompletos empeoran la energía por operación. Magmatic se compara con una receta idéntica, porque los costes predeterminados de ambos controladores difieren.

UC con ocho Speed Upgrades y ocho Energy Upgrades alcanza nominalmente 10× la velocidad básica con 0.5× energía por operación. Por tanto, una fábrica inicial de Crusher/Press/Incinerator queda por debajo de una UC mejorada, pese a exigir estructura, controlador y módulos. Su ventaja depende de invertir más en módulos y aprovechar sus entradas paralelas.

**Veredicto:** revisar especialmente Crusher, Electro Press e Incinerator una vez corregido el ciclo. Infuser necesita comparación con una estructura de coste equivalente. Autosieve y Magmatic ya ofrecen una ventaja nominal mayor; no aplicaría un buff general a todas.

Otros casos:

- **Reaction Chamber Factory:** frente a la básica de HM, 1600 contra 160 DE/t. No aplica la penalización ×4 de las fábricas anteriores: con lote completo de dos, ofrece nominalmente 20× producción y la mitad de energía por operación. Es una diferencia de diseño importante.
- **Reinforced Induction Anvil:** reparación base 3200 frente a 25, es decir, 128× nominal; además carga ítems energéticos y almacena 640 MDE. Ya tiene una función y mejora claras. La comparación es sin upgrades.
- **Combustion Chamber:** obtiene 25% más energía por combustible que Furnator y escala su combustión con el volumen. Tiene una ventaja real; no necesita un buff general sin medir alimentación y extracción.
- **Gas Turbine:** convierte vapor y Heated Saline; su papel es recuperar energía térmica. No es sustituto directo del generador de gases de UC. Tener visuales para otros gases no implica que sean combustibles admitidos.
- **Chemical Processor e Isotope Centrifuge:** desbloquean recetas propias; no existe una equivalencia directa que permita juzgarlas sólo por DE/t de una máquina UC.

## 3. Progresión nuclear: funciona, pero tiene esperas muy largas

Recetas en `BP/scripts/config/recipes/chemicalProcessor.js` y `reactionChamber.js`:

| Paso | Entradas principales | Salida | Coste base | Tiempo sin mejoras |
|---|---|---|---:|---:|
| Chemical Processor | 1000 mB waste + 1000 mB agua | 1 spent pellet | 32 MDE | 20 min 50 s |
| Reaction Chamber | 1 Nether Star + 1000 mB sulfuric | 125 mB esencia | 16 MDE | 1 h 23 min 20 s |
| Reaction Chamber | 2 spent pellets + 125 mB esencia | 1 stabilized matter | 128 MDE | 11 h 6 min 40 s |

Las ocho materias de un conjunto Exo requieren 16 pellets y ocho Nether Stars: 16 000 mB de waste, 16 000 mB de agua, 8000 mB de sulfuric y 1000 mB de esencia. La suma de esos pasos es **1.664 GDE** de costes base, sin contar combustible, ácido, otros materiales ni modificadores de fábrica.

En una Chemical Processor y una Reaction Chamber básicas son unas **105 h 33 min de trabajo de máquina acumulado**; no es necesariamente tiempo real de espera, porque se pueden mejorar y paralelizar. La Reaction Chamber concentra 100 horas de ese trabajo.

Una enriched rod contiene 1000 FU y produce 1000 mB de waste. A la eficiencia máxima configurada del 95%, puede generar hasta 190 MDE. Dieciséis rods ofrecen hasta 3.04 GDE: la ruta tiene sentido como consumidor de la producción nuclear. La energía efectiva depende de las condiciones del reactor.

**Propuesta:** mantener el gasto energético elevado solicitado, pero aumentar el caudal de procesamiento nuclear avanzado. Definir un tiempo objetivo por lote con una estructura razonable; no reducir costes indiscriminadamente ni acelerar todas las recetas baratas para resolver tres recetas caras.

## 4. Hazmat, radiación y accidentes

No se encontró un consumidor del tag `utilitycraft:hazmat_armor` ni un sistema de radiación en los scripts revisados de HM/UC. Hoy el traje aporta estadísticas de armadura y tiene recetas, pero no cumple una función de protección radiológica.

El reactor nuclear **sí explota**: aviso a 2800 K, meltdown a 3000 K y explosión programada cuatro segundos después, con daño a bloques y fuego. El radio depende del volumen y tiene mínimo 4. Thermo Reactor también tiene meltdown, con umbral de 1200 K. Referencias: `nuclearReactor.js` y `thermoReactor.js` en `BP/scripts/machinery/generators/`.

Falta una consecuencia radiológica persistente: contaminación, exposición y una forma de limpiar o esperar su desaparición. El waste almacenado actualmente es un recurso, no una amenaza ambiental. Llenar su depósito pausa el reactor; no provoca por sí solo una fuga.

**Progresión propuesta:** reactor sellado funcionando normalmente seguro; exposición en incidentes, residuos expuestos y zonas de meltdown; protección proporcional de Hazmat y protección completa con el conjunto. Definir expresamente si Exo también protege: actualmente reduce daño sin filtrar causas, por lo que un futuro daño de radiación podría ser absorbido automáticamente.

Para evitar carga innecesaria, registrar fuentes de contaminación cuando ocurren eventos y revisar sólo jugadores cercanos mientras existan fuentes activas. No recorrer todos los inventarios ni todas las máquinas continuamente.

**Prueba pendiente:** guardar/salir, descargar el chunk o romper el controlador durante los cuatro segundos de meltdown. La explosión depende de un callback temporal; hay que comprobar recuperación tras reinicio y que no quede un reactor marcado como pendiente sin ejecutar el accidente.

## 5. Exo: estado y límites

`BP/scripts/equipment/exoArmor.js` implementa 12.5/40/30/12.5% por pieza, exige energía, consume 100 000 DE por punto absorbido, cancela caídas con botas cargadas y muestra la partícula. No usa un intervalo para recorrer jugadores. La inicialización genérica corresponde a UC y la capacidad procede de ItemEnergyStorage.

Cada pieza almacena 1 GDE. El descuento se redondea hacia arriba a unidades de 100 000 DE por pieza y evento; por eso los golpes pequeños no cuestan exactamente el porcentaje continuo calculado sobre el daño.

Además existen los puntos de armadura nativos solicitados. Persisten cuando la batería está vacía. El 95% es la reducción del script; no debe presentarse como una medición final de todos los tipos de daño combinados con defensa nativa. Falta medirlo dentro de Minecraft.

Casos que merecen prueba antes de declarar la armadura completamente cerrada:

- Reparación/combinación vanilla: al representar energía con durabilidad, cualquier mecanismo que restaure ésta podría recargar gratis. Quitar encantamientos elimina Mending, pero no demuestra que todas las combinaciones nativas sean imposibles.
- Cambiar, quitar o soltar la pieza entre el evento y el descuento diferido: el script omite la escritura si la pieza ya no coincide. Puede quedar absorción sin cobro en ese caso; evitarlo debe sopesarse frente al requisito de simplicidad.
- Golpes simultáneos, batería casi vacía, caída sin energía, muerte y desconexión. Las pruebas unitarias cubren parte de la lógica, no toda la interacción del motor.

## Validación y orden recomendado

Pasaron las 158 pruebas de los 12 archivos de tests de HM, incluyendo Exo, ItemEnergyStorage, cargador, progresión nuclear y simulaciones de reactores. La reproducción adicional del Crusher detectó un caso que esos tests no cubren. No se hicieron pruebas dentro del juego ni una certificación exhaustiva de todos los assets del pack.

1. Corregir ciclos de fábricas y probar independencia del intervalo del scheduler.
2. Corregir Processing y decidir si Efficiency debe mejorar también velocidad.
3. Comparar estructuras completas contra UC mejorada; ajustar primero Crusher/Press/Incinerator y tiempos nucleares.
4. Añadir radiación y utilidad de Hazmat, definiendo compatibilidad con Exo.
5. Validar accidentes y armadura en Minecraft, incluyendo reparaciones y cambios de equipamiento.
