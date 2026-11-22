# <img src="docs/logo.png" width="96" alt=""> SRT Bridge 0.5.4

> **Idioma / Language:** [English (Oficial)](README.md) · **Español**

## ¿Qué hace SRT Bridge?

¿Alguna vez has querido enviar señales de video por internet a tu estudio, a otras locaciones de producción o a tus clientes sin requerir infraestructura costosa? Antes casi siempre se requería un equipo LiveU o servicios de suscripción mensual costosos.

Puedes probar SRT Bridge en tu red local sin tener que configurar tu router: solo instala, inicia el programa y da clic en "Añadir reglas de firewall" en la pestaña de configuración.

![El codificador y decodificador se conectan a SRT Bridge en el puerto UDP 21101. El video y audio fluyen del codificador al decodificador a través del puente.](docs/how-srt-bridge-works.png)

SRT Bridge es un punto de encuentro (rendezvous / hub) en internet para señales de video y audio bajo el protocolo **SRT (Secure Reliable Transport)**. El codificador en el lugar del evento y el decodificador en el estudio de producción actúan ambos en modo **Caller** (llamador) hacia el puente; ninguno de los dos extremos requiere puertos abiertos ni dirección IP fija. En el lado del transmisor o del receptor, funciona incluso a través de conexiones móviles 4G/5G, siempre que cuenten con el ancho de banda suficiente. Para streaming por internet, únicamente la computadora que aloja el puente necesita una dirección IP pública y un puerto UDP abierto. También puedes [controlar el puente de forma remota](#control-remoto-por-https) desde cualquier navegador web.

Instala este puente en tu estudio en una computadora de gama media (Windows 10/11 o Linux / Docker) con un procesador Intel Core i7-6700 o superior. Con este equipo puedes enrutar fácilmente 8 señales de video simultáneas y opcionalmente emitir 4 de ellas localmente como OMT, NDI o SDI.

Para las entradas SRT, el puente retransmite los paquetes sin modificarlos. No se decodifica ni recodifica nada, por lo que la calidad de imagen se mantiene idéntica a la fuente original y el retardo se limita a la latencia SRT configurada en cada tramo.

![SRT Bridge mostrando 8 canales SRT y entrada WHIP](https://raw.githubusercontent.com/peteraellig/srt-bridge/1e5805195d78ea5648d3f4d6b094a11109e74554/docs/main.png)

Durante la instalación se configuran 8 canales por defecto; puedes ajustar esta cantidad según tus necesidades en la pestaña de configuración.

---

## Nuevas características profesionales

### 1. Estándar de la Industria VSF TR-06-4
Soporta interoperabilidad con codificadores y decodificadores profesionales (Haivision, Makito, vMix, OBS) mediante identificadores VSF TR-06-4:
`#!::r=<canal>,m=publish|request,s=forward`
Manteniendo 100% de compatibilidad con identificadores tradicionales (`cam1` y `cam1*forward`).

### 2. Exportador de Métricas para Prometheus y Grafana
Ruta de métricas en tiempo real disponible en `GET /metrics` en el puerto HTTP (8790):
- Tasa de bits por canal (kbps/mbps)
- Conexiones activas de entrada y salida
- Paquetes transmitidos, perdidos y retransmitidos
- Uso de CPU y memoria del sistema y del proceso

### 3. Servidor de Control Blackmagic Videohub (TCP :9990)
Implementación nativa del protocolo Blackmagic Videohub:
- Permite conmutar la matriz de video en tiempo real desde **Bitfocus Companion**, **Elgato Stream Deck** o paneles físicos de control.
- Enrutamiento dinámico de retorno para cámaras en producción en vivo.

### 4. Soporte Multiplataforma para Linux y Docker
Listo para desplegar en servidores dedicados o VPS Linux mediante Docker:
```bash
docker compose up -d
```

### 5. Generador de Códigos QR para Celular (Larix Grove y Haivision)
El diálogo QR en la interfaz web ofrece formatos específicos para cada aplicación:
- **Larix App:** Esquema oficial Larix Grove (`larix://set/v1`) con importación automática de Stream ID, modo Caller y latencia.
- **Haivision Web:** Enlace `https://` compatible con Haivision Play Pro y la cámara nativa de smartphones.
- **Direct / Raw:** Enlace `srt://` puro para escáneres de aplicaciones SRT.

---

## Primeros pasos en Windows

1. Descarga el instalador desde la sección de [Releases](https://github.com/peteraellig/srt-bridge/releases/latest), ejecútalo y abre **SRT Bridge**.
2. En **Setup**, verifica el puerto SRT (por defecto **21101**). Asegúrate de permitir tráfico UDP entrante en dicho puerto. Si la computadora está detrás de un router, redirige el puerto UDP 21101 hacia la IP local de la computadora.
3. Configura tu cámara o codificador en modo **Caller** e introduce la dirección IP del puente, el puerto y el Stream ID (ej. `cam1`). Una vez conectado, la tarjeta correspondiente mostrará **LIVE**.
4. Haz clic en **Links** o en el botón de copia rápida en la tarjeta para obtener el enlace de retorno de estudio hacia tu decodificador (VLC, OBS, vMix).

## Compilación desde código fuente

Ejecuta estos comandos en PowerShell en Windows x64:

| Componente | Comando | Requisitos |
| --- | --- | --- |
| SRT Bridge | `.\srt_bridge\build.ps1` | Go 1.22+ o compatible |
| SRT Bridge Output | `.\srt_bridge_output\build.ps1` | Go, Visual Studio C++ x64, Blackmagic Desktop Video |
| Instalador combinado | `.\srt_bridge\installer\build-setup.ps1` | Inno Setup 6 o 7 |

## Licencia

SRT Bridge y SRT Bridge Output están licenciados bajo la licencia [BSD Zero Clause License (0BSD)](LICENSE). Copyright © 2026 Peter Aellig.
Los componentes de terceros incluidos conservan sus respectivas licencias.
