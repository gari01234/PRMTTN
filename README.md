# PRMTTN

https://gari01234.github.io/PRMTTN/

I. Fundamento estructural y matemático del sistema

1. Definición
PRMTTN es una arquitectura visual basada en combinatoria finita, que define un espacio donde puede emerger pensamiento sin necesidad de lenguaje. No representa, no interpreta, no comunica. No traduce signos ni propone significados. Lo que organiza no está dirigido a ningún destinatario, y lo que dispone no remite a nada fuera de sí. Cada configuración es forma pura: irreductible, no codificable, sin intención simbólica.
Su punto de partida es un conjunto cerrado, exhaustivo y no expandible de 120 permutaciones del conjunto {1, 2, 3, 4, 5}. Todo el sistema emerge de ahí. No hay generación aleatoria ni expansión futura. Solo combinatoria ordenada.

2. Firma: ADN estructural
A cada permutación P = [P₁, P₂, P₃, P₄, P₅] se le asocia una firma, definida como:
Firma(P) = [P₁ + P₂, P₂ + P₃, P₃ + P₄, P₄ + P₅, P₅ + P₁]
•	Siempre suma 30
•	Siempre tiene 5 componentes
•	Es única e inmutable para cada permutación
La firma funciona como vector de relación interna: resume cómo se conectan los elementos de la permutación entre sí. No determina los atributos visuales directamente, pero regula su comportamiento dinámico (como la rotación). La forma, el color y la posición dependen directamente de los valores individuales de la permutación.

3 · Fenotipo: forma, color, posición, rotación
Los atributos visuales de cada permutación derivan directamente de su estructura interna, sin intervención estética ni asignación manual. Se definen mediante reglas matemáticas fijas e invariables:
Atributo	Fuente estructural	Regla de transformación
Forma	P₁	Altura proporcional a √(P₁)
Color	P₂, firma, sceneSeed	Color determinista desde rejilla HSV (ver fórmula)
Posición	Lehmer-rank + sceneSeed	Mapeo tridimensional dentro del cubo (ver fórmula Shift-Rank)
Rotación	Rango de la firma	Velocidad ∝ (máx − mín) de la firma
Estas reglas permiten 120 reorganizaciones fenotípicas distintas por permutación. Cada reorganización es una reasignación interna de los cinco valores [P₁–P₅] sobre las funciones formales del sistema, sin romper su lógica ni estructura.

3.1 · Cálculo de la semilla global (sceneSeed)
Para mantener coherencia interna entre posición y color, cada escena se caracteriza por una semilla estructural única (sceneSeed) derivada exclusivamente del conjunto de permutaciones activas.
Fórmula:
rᵤ = LehmerRank(Pᵤ)
sceneSeed = (Σᵤ 37 × rᵤ) mod 360
Donde:
•	rᵤ es el rango lexicográfico (0–119) de cada permutación Pᵤ
•	La suma se realiza sobre todas las permutaciones activas
•	360 asegura compatibilidad angular (útil para color), 37 mejora la dispersión

3.2 · Posición: Shift-Rank
La ubicación tridimensional de cada glifo dentro del cubo 30×30×30 se calcula en dos pasos: primero el índice cúbico, luego su conversión a coordenadas físicas.
Fórmula completa:
R = LehmerRank(P)
S = (Σ_{P ∈ escena} (P₃ + P₄ + P₅)) mod 125
I = (R + S) mod 125

(x, y, z) = (⌊I / 25⌋, ⌊(I mod 25) / 5⌋, I mod 5)
(X, Y, Z) = (x − 2, y − 2, z − 2) × 7.5
Cada eje se divide en cinco posiciones posibles: 5 × 5 × 5 = 125 posiciones totales.
El sistema evita duplicación posicional mediante asignación inyectiva a partir del índice cúbico I.

3.3 · Color: retícula HSV determinista
El sistema cromático emplea una retícula estructurada en espacio HSV con 20,736 tonos únicos.
Estructura de la retícula:
Canal	Intervalo	Niveles	Detalle técnico
H	0° – 360°	144	ΔH = 2.5° por paso
S	0.25 – 0.97	12	S = 0.25 + 0.72 × (Sᵢ / 11)
V	0.20 – 0.95	12	V = 0.20 + 0.75 × (Vᵢ / 11)
Total: 144 × 12 × 12 = 20,736 combinaciones discretas posibles.

3.4 · Mapeo determinista de color
Cada permutación en la escena recibe un color único, calculado mediante un patrón cromático estructural.
Pasos del algoritmo cromático:
1.	Calcular la firma F = [F₁, F₂, F₃, F₄, F₅] de la permutación
2.	Determinar su Lehmer-rank r
3.	Aplicar una función según el patrón cromático elegido (ver herramientas)
Ejemplo de patrón tipo:
Hᵢ = (7 × sceneSeed + Δ₁) mod 144
Sᵢ = (2 + slot) mod 12
Vᵢ = (F₃ + F₅) mod 12
Donde:
•	Δ₁ y slot dependen del patrón estructural activo (1 a 11)
•	No se repiten colores en la misma escena
•	La elección es 100% determinista y libre de intervención estética

3.5 · Color del fondo y del cubo
El fondo y el cubo no son definidos como “extra slots” ni usan una paleta externa. Se calcula su color como si fueran permutaciones más:
Color_fondo = patrón aplicado a P(1)
Color_cubo  = patrón aplicado a P(k)  // última permutación activa
Esto evita jerarquías y garantiza coherencia cromática completa entre glifos y contenedor estructural.
•	La posición no se asigna directamente por P₃–P₅: se calcula desde el Lehmer-rank de la permutación, desplazado por una semilla estructural de escena (sceneSeed).
•	El color no depende de una tabla externa ni de un valor fijo: se genera a partir de una fórmula determinista usando la firma, la posición y la semilla global.
•	No hay movimiento aleatorio ni arbitrariedad cromática: cada atributo deriva de reglas internas fijas.
Estas reglas permiten 120 reorganizaciones fenotípicas por permutación sin romper la lógica del sistema. Cada reorganización es una permutación interna de P₁–P₅ sobre las funciones de forma, color, posición y rotación.

4. Cubo 30×30×30: espacio de emergencia preverbal
La suma invariable de la firma (30) determina el límite estructural del sistema: un cubo tridimensional de 30×30×30 unidades, dividido en 5 segmentos por eje (6 u/segmento).
Cada permutación se traduce a una posición tridimensional única mediante su Lehmer-rank r (0–119), ajustado por la semilla estructural de la escena:
 I = (r + sceneSeed) mod 125
Ese índice I se convierte en una coordenada discreta dentro de la rejilla 5×5×5 del cubo, y luego a coordenadas espaciales entre −12 y +12.
No se asignan directamente posiciones por valores P₃–P₅: la disposición espacial es derivada desde el comportamiento combinatorio de cada permutación respecto a la escena completa.
•	Cada eje corresponde a una dimensión fenotípica derivada de la firma.
•	No hay centro, ni jerarquía, ni direccionalidad narrativa. Solo presencia estructurada.
•	Solo disposición visual con reglas formales, sin contenido asignado.

5. Totalidad combinatoria: espacio de diseño y habitabilidad
PRMTTN no afirma infinitud, pero su combinatoria da lugar a un número astronómico de configuraciones.
5.1 Reorganización fenotípica
Cada permutación puede adoptar 120 reorganizaciones fenotípicas posibles (formas distintas de asignar P₁–P₅ a los cinco roles del fenotipo).
Total: 120 permutaciones × 120 reorganizaciones = 14,400.
5.2 Configuraciones espaciales
Con 125 posiciones disponibles en la rejilla 5×5×5 del cubo, y usando la fórmula I = (r + sceneSeed) mod 125, se garantiza que las 120 permutaciones activas puedan distribuirse sin colisión, de forma determinista, sin intervención aleatoria.
→ El índice I se transforma en coordenadas XYZ discretas.
→ La semilla global se deriva del conjunto completo de permutaciones presentes.
→ La posición no depende de un atributo fijo de la permutación, sino de su rango interno (Lehmer-rank) y del sistema total.
La rejilla 5×5×5 del cubo define 125 celdas posibles. En cada escena se activan entre 1 y 30 permutaciones distintas (k ∈ [1,30]), y cada una ocupa una celda única. No hay duplicados: ni de permutaciones, ni de posiciones.
Para cada valor de k, la cantidad de configuraciones espaciales posibles es:
  Config(k) = (120 C k) × (125 C k) × k!
  • (120 C k): formas de elegir k permutaciones distintas
  • (125 C k): formas de elegir k posiciones distintas en el cubo
  • k!: formas de asignar permutaciones a posiciones (inyecciones)
Sumando todos los valores posibles de k:
  Total_config_espacial = ∑ₖ₌₁³⁰ (120 C k) × (125 C k) × k!
Esta fórmula cubre el número total de configuraciones espaciales válidas, con hasta 30 permutaciones activas y sin colisiones.
→ Resultado aproximado:
  Total_config_espacial ≈ 3.10 × 10¹²⁵
Este número no incluye colores ni reorganizaciones fenotípicas. Solo corresponde a las combinaciones de posición posibles dentro del cubo, para escenas sin solapamiento.
→ Esto no incluye reorganizaciones fenotípicas. Solo la posición espacial.
5.3 Anclaje en un único origen geométrico
Todo el sistema proviene de un único cuerpo geométrico: el cubo definido por la proporción √P₁.
Cada proporción derivada —color, posición, escala, rango— se calcula a partir de los valores individuales de la permutación, mientras que el comportamiento rotacional se rige por la firma generada entre ellos. Si se altera el valor de P₁, se escalarían proporcionalmente tanto las proporciones visuales como las dimensiones del cubo, pero no cambiarían ni las permutaciones, ni las firmas, ni el rango. El sistema completo conservaría su lógica interna, operando a una escala distinta sin pérdida de estructura.
Esto asegura que cada configuración esté anclada en una estructura única, sin arbitrariedad ni expresión externa. La estética que emerge no es buscada ni diseñada: es la consecuencia directa de una organización sin semántica.
5.4 Nota final de sección
Este modelo matemático no es decorativo: la estructura misma del sistema produce un entorno cognitivo habitable.
Cada unidad existe según reglas fijas e invariables.
Cada configuración es válida si es coherente con esa lógica interna.

6. Modos posibles de pensamiento dentro del sistema

6.1 Pensamiento preverbal: definición operativa
PRMTTN no representa, no interpreta, no comunica.
No traduce signos ni propone significados.
Lo que organiza no está dirigido a ningún destinatario, y lo que dispone no remite a nada fuera de sí.
Cada configuración es forma pura: irreductible, no codificable, sin intención simbólica.
No es emoción ni representación sensorial. Tampoco es código ni concepto.
Es una organización mental sin mediación lingüística, no reducible a categorías tradicionales de lo cognitivo o lo perceptual.
Bajo estas condiciones, distintos modos de pensamiento pueden encontrar lugar:
•	Pensamientos previos a la palabra: impulsos, impresiones, resonancias.
•	Pensamientos sin traducción: relaciones percibidas directamente, sin paso intermedio por un código.
•	Pensamientos fuera de lugar: pensamientos que ya existían, pero nunca habían encontrado un espacio que no los condicionara.
•	Diálogos sin intención comunicativa: pensamientos internos que no buscan ser escuchados.
Nada garantiza que ocurra.
Es una posibilidad abierta.

6.2 Condiciones mínimas de activación
Las configuraciones están construidas bajo las siguientes condiciones mínimas, que podrían permitir pensamiento preverbal:
•	Disposición combinatoria cerrada: cada configuración se deriva de una firma única, sin ambigüedad ni interpretación. Sin arbitrariedad visual.
•	Aislamiento estructural: todo ocurre dentro de un espacio delimitado, sin contexto narrativo ni referencias externas.
•	Reglas visibles: cada atributo —forma, color, posición y rotación— responde a una lógica interna completamente trazable.
•	Ausencia de semántica: no hay símbolos, íconos, ni sustituciones posibles por lenguaje.
Estas condiciones no provocan una idea.
Pero sí ofrecen una forma sin traducción que puede ser contemplada como organización visual pura.

7. Habitabilidad
No toda estructura visual es habitable cognitivamente. PRMTTN define criterios de habitabilidad preverbal, derivados de la propia lógica del sistema.
Una configuración es visualmente habitable si cumple con las siguientes condiciones estructurales:
•	Accesibilidad estructural directa: está formada por elementos visuales completos, sin fragmentos ocultos ni capas simbólicas. Su forma es perceptiblemente íntegra y estable, sin exigir rotación ni visión total para ser comprendida como unidad.
•	Estabilidad combinatoria: su lógica interna no cambia con el contexto ni con el observador; siempre responde a la misma firma y al mismo conjunto de reglas.
•	Ausencia de signos: ninguna parte de la configuración remite a símbolos, letras, íconos o elementos codificables. Todo es visual, estructural y directo.
•	Contención sin clausura: está contenida en un espacio cerrado (el cubo 30×30×30), pero no impone jerarquías ni narrativas. La contemplación se limita al presente visual, sin interpretación externa.
Estas condiciones no garantizan habitabilidad en todos los casos, pero definen un marco formal donde el pensamiento sin lenguaje puede tener lugar como experiencia visual estructurada.

8. Gramática sin semántica

8.1 Reglas no negociables
El sistema opera bajo una gramática estructural estricta. Cada atributo visual deriva de valores numéricos definidos por una permutación del conjunto {1,2,3,4,5}. No hay excepción. Estas reglas no representan ideas ni evocan emociones. No describen el mundo. Solo organizan proporciones y relaciones visuales.
•	Forma: proporcional a √(P₁)
•	Color: índice P₂ aplicado a paleta HSV estructural derivada de firma + sceneSeed
•	Posición: determinada por Lehmer-rank corregido por semilla de escena
•	Rotación: derivada del rango de la firma

8.2 Activación sin traducción
La activación dentro del sistema no ocurre por decodificación. Ocurre —si ocurre— porque ciertas relaciones visuales estructuradas con rigor matemático pueden desencadenar organización mental sin devenir concepto. Es un tipo de percepción sin traducción.
El sistema no ofrece un idioma. Define un entorno donde el pensamiento puede organizarse sin ser formulado en palabras.

9.	Glosario funcional
(Reservado para redacción posterior)

10.	Anexo técnico I: plantilla manual
(Reservado para redacción posterior)

11.	Persistencia estructural sin narrativa
No hay registro automático, acumulación ni archivo interpretativo. Pero puede construirse una memoria estructural: toda configuración es completamente reconstruible a partir de su permutación base.
Una configuración no necesita ser recordada para ser replicada. Su existencia se define por:
• La permutación original P = [P₁, P₂, P₃, P₄, P₅]
• La reorganización fenotípica adoptada
• El Lehmer-rank de la permutación
• La semilla global de escena (sceneSeed)
• Las fórmulas internas de posición y color derivadas
Esto permite almacenar configuraciones sin interpretación, como estados puramente estructurales.
Estas memorias no interpretan ni comentan: solo preservan la disposición estructural exacta.
Formas posibles de persistencia:
• Firestore: cada configuración manual o algorítmica puede ser almacenada como objeto estructural, sin metadatos semánticos.
• Arweave / Thirdweb: posibilidad de anclaje en cadena, garantizando integridad y permanencia sin contenido simbólico.
Almacenar una configuración no significa recordar algo.
Significa preservar una combinación formal disponible para contemplación futura.
No hay narración, ni historia. Solo reactivación estructural.

12.	Evolución interna del pensamiento
No hay acumulación, mejora ni progreso.
Solo reorganización estructural dentro de un conjunto cerrado.
El pensamiento no avanza: se reconfigura.
Cada disposición es una mutación fenotípica dentro de la misma matriz combinatoria.
No hay dirección evolutiva, pero pueden generarse secuencias visibles sin relato ni jerarquía.
Estas secuencias no transmiten información.
Solo trazan posibles trayectorias espaciales entre permutaciones, sin propósito ni codificación.
12.1 Reorganización fenotípica
Las 120 permutaciones del conjunto {1,2,3,4,5} no se modifican.
Lo que cambia es su expresión fenotípica: la asignación de atributos visuales a cada posición en la firma.
Una misma permutación puede generar distintas configuraciones si se modifica:
• el mapa de color,
• la proporción raíz,
• la posición en el cubo,
• o las reglas de presentación.
Estas mutaciones no agregan significado.
Pero reorganizan la disponibilidad estructural del pensamiento preverbal.
Las reglas de transformación son fijas.
Sin embargo, pueden aplicarse diferentes asignaciones de P₁–P₅ a atributos visuales sin romper la lógica del sistema.
Toda variación permanece dentro del marco combinatorio.
12.2 Sin progreso adaptativo
No hay eficacia, función ni jerarquía estética.
Cada configuración se valida por su estructura, no por su utilidad o belleza.
La evolución interna del sistema no mejora: varía sin finalidad.

13.	Arquitectura compartida entre especies cognitivas
No se trata de un lenguaje.
No hay necesidad de traducción, ni intención comunicativa.
La estructura está construida para operar sin semántica, sin conciencia, sin experiencia previa.
13.1 Gramática operativa común
Lo que puede compartirse entre seres humanos e inteligencias artificiales no es un contenido, sino una lógica:
• Ambos tipos de operadores pueden generar disposiciones a partir de firmas.
• Ambos pueden aplicar las reglas del sistema sin necesidad de comprensión semántica.
• Ambos pueden generar configuraciones y percibir relaciones espaciales sin necesidad de atribuirles significado semántico.
13.2 Sin interfaz ni traducción
El entorno definido permite que distintas formas de pensamiento operen sin mediación simbólica, sin requerir traducción ni conciencia.
No hay necesidad de simetría biológica.
Solo posibilidad operativa compartida.

14.	Validación científica
Las condiciones estructurales propuestas por el sistema pueden ser sometidas a verificación empírica. No se afirma que generen pensamiento preverbal, pero pueden ser evaluadas como entorno propicio para su aparición.
La paleta cromática de cada escena no depende de juicios estéticos ni de tablas externas. Cada color visible es calculado a partir de:
• La firma estructural de la permutación
• La semilla global derivada del conjunto de permutaciones activas
• Una función determinista sobre rejilla HSV discreta de 20,736 tonos
Este sistema garantiza unicidad, reproducibilidad y coherencia visual sin ambigüedad.
14.1 Evidencias relevantes
• Neurodesarrollo temprano: en bebés, se registran patrones cognitivos previos al lenguaje.
• Percepción visual no semántica: el cerebro organiza lo visible sin necesidad de símbolos.
• Aprendizaje estructural sin etiquetas: algunas IAs identifican patrones sin instrucción lingüística.
• Contemplación abstracta: ciertas configuraciones visuales generan respuesta cognitiva sin relato.
El sistema no representa estas evidencias.
Pero puede operar como marco de prueba formal.
14.2 Hipótesis operativa
No se afirma un resultado.
Se plantea una hipótesis estructural: que una disposición visual sin semántica pueda incidir en la organización mental previa al lenguaje.
Esa hipótesis puede ser evaluada, pero no demostrada dentro del sistema.

15.	Anexo técnico II: puntos críticos afinados
(Reservado para redacción posterior)

16.	No hay belleza, ni representación
No hay belleza, ni representación.
No se busca agradar, emocionar ni evocar.
Cada rasgo visible —forma, color, posición, rotación— es resultado directo de una firma numérica.
No hay símbolos, metáforas ni juicio. Solo estructura.
16.1 Belleza fuera del sistema
Si algo parece bello, no es porque el sistema lo haya propuesto.
Es porque la mente humana reacciona ante ciertas proporciones con placer, memoria o resonancia cultural.
Pero esas reacciones no están contenidas en la configuración.
Surgen fuera de ella, como proyección.
16.2 Sin contenido representacional
No hay figura, ni símbolo, ni código oculto.
Cada configuración es una disposición formal de elementos irreductibles.
No remite a otra cosa.
No hay nada detrás.
Solo estructura.

17.	Conmover sin comunicar
Una configuración puede afectar sin transmitir.
No por lo que dice, sino por la tensión interna de su organización.
No hay contenido emocional, pero puede haber desequilibrio visual.
No hay relato, pero puede haber resonancia perceptual.
17.1 Disposición como evento perceptual
• Las proporciones derivadas de raíces no racionales (√2, √3, etc.) generan relaciones que no se estabilizan en simetría.
• La rotación determinada por el rango de la firma produce variaciones angulares constantes, sin intención, pero con efectos perceptivos sostenidos.
• La ubicación dentro del cubo genera vacíos, acumulaciones o alineamientos que no remiten a un mensaje, pero pueden inducir cambios en el foco atencional del observador.
17.2 Sin comunicación
La disposición visual no requiere interpretación.
No se presenta como mensaje ni como signo, sino como estructura observable sin contenido latente.

18.	Manifiesto antiestético
No hay búsqueda de belleza.
No hay intención expresiva, decorativa ni provocadora.
Cada glifo es consecuencia formal, no decisión estética.
18.1 Rechazo de la forma simbólica
Cada configuración es cerrada a toda interpretación o apertura semántica:
no traduce, no explica, no participa en sistemas de significado.
Es una organización estructural cerrada en sí misma.
18.2 Afirma la no-representación
No hay sujeto, no hay objeto.
No hay nada que ver detrás de lo que se ve.
Eso no lo hace vacío.
Lo hace autosuficiente como espacio para que algo sea contemplado sin ser comprendido.

19.	Cierre epistemológico
El sistema ha sido descrito en su totalidad:
• Es un conjunto finito de permutaciones irrepetibles.
• Opera mediante reglas estrictas derivadas de firmas numéricas.
• Se dispone en un cubo tridimensional de 30×30×30 unidades.
• No codifica lenguaje ni representación.
• No evoluciona, no recuerda, no comunica.
• Solo organiza disposiciones que pueden —en condiciones específicas— favorecer modos de pensamiento preverbal.
19.1 Nada por fuera, nada por detrás
No hay interpretación correcta.
No hay sentido oculto.
No hay instrucción de uso.
Lo que se ha construido es un espacio donde algo puede ser contemplado sin ser dicho.
19.2 La única variable es la mirada
Todo lo demás está fijado por matemáticas.
El orden, la forma, la disposición.
La única variación posible es quién mira, cuándo, y con qué carga perceptiva previa.
Ese es el único punto de entrada.

20.	Epílogo: pensamiento liberado
No se ha construido un lenguaje.
No se ha creado una obra.
No se ha diseñado una experiencia para ser comprendida.
Se ha formulado un sistema estructural cerrado, sin traducción posible, donde todo está anclado en una lógica combinatoria finita.
Cada configuración deriva de una firma matemática.
Cada atributo visible —forma, color, posición, rotación— es efecto de una regla fija.
Nada está dicho.
Nada necesita ser interpretado.
Todo puede ser contemplado.
20.1 La hipótesis permanece abierta
El sistema no prueba que el pensamiento preverbal ocurra.
Tampoco lo representa.
Solo define con precisión las condiciones formales en las que ese tipo de actividad mental podría emerger:
– sin narración,
– sin símbolo,
– sin destinatario,
– sin instrucción.
20.2 Lo que se contempla no traduce nada
No hay capas semánticas.
No hay contenidos latentes.
No hay verdad oculta.
Lo que aparece en cada escena es exactamente lo que es:
una configuración matemática visible, sin nombre, sin propósito, sin historia.
20.3 Un espacio fuera del lenguaje
Si algo ocurre frente a estas disposiciones —una organización mental, una activación no verbal, una forma de pensamiento sin palabra—
eso no puede ser afirmado, ni negado.
Solo puede ser posibilitado por estructura.
Y en esa estructura exacta, no representativa y sin interpretación posible, el sistema se cierra.
Sin mensaje.
Sin traducción.
Solo estructura disponible.

