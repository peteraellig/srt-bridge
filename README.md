# <img src="docs/logo.png" width="96" alt=""> SRT Bridge 0.54

> **Language / Idioma:** **English** · [Español](README.es.md)

## What SRT Bridge does

Have you always wanted to send video signals over internet to your studio, to other production locations or to your client with (almost) no additional infrastructure? To do that, you almost always needed either a LiveU or some other service that costs money.

You can try SRT Bridge on your internal network without having to do anything to the router; you just need to run the setup, start the program, and click the “Add Firewall Rules” button in the setup.

![The encoder and decoder both connect to SRT Bridge on UDP port 21101. Video and audio flow from the encoder through the bridge to the decoder.](docs/how-srt-bridge-works.png)

SRT Bridge is a meeting point on the internet for SRT signals. The encoder at the venue and the decoder in the studio both **call** the bridge; neither of them needs an open port or a fixed address. On the transmitter and/or receiver side, it also works with any mobile phone Internet connection, as long as it has the necessary bandwidth. For SRT streaming over the internet, only the bridge PC needs a public IP address and an open UDP port. You can also [operate the bridge remotely](#remote-control-over-https) from a web browser.

Install this Bridge in your studio on a mid-range computer (Windows 10/11) with an Intel Core i7-6700. Of course, a newer computer will work as well. With this setup, you can easily transmit 8 video signals and optional output 4 of them locally as OMT. If you want to output more signals from the bridge computer, you’ll need a more modern machine: recommended; Intel Core Ultra 200S series desktop CPUs (Arrow Lake) with at least six performance cores and integrated Intel Graphics with hardware AV1 encoding support can be used. Suitable models include the Intel Core Ultra 5 245K, Intel Core Ultra 7 265K, and Intel Core Ultra 9 285K.

For SRT inputs, the bridge passes the packets on unchanged. Nothing is decoded or encoded again, so the picture quality stays as it was sent and the delay is only the SRT latency on each leg.

![SRT Bridge 0.5.2 showing eight SRT channels and a live WHIP input on channel 9](https://raw.githubusercontent.com/peteraellig/srt-bridge/1e5805195d78ea5648d3f4d6b094a11109e74554/docs/main.png)

During installation, 8 channels are configured; you can adjust this number as desired in the setup.

For internet ingest behind a router, forward both TCP and UDP on the configured WHIP port to the bridge PC. SRT receivers still call the usual SRT address. They can receive the WHIP input by its stream ID or use an existing forward output assigned to **WHIP** in **Matrix**.

The channel tiles now group the controls for each signal. Choose **Off** to disconnect the channel and block reconnections. Choose **Switch on** to accept connections again.

## WHIP input and channel controls in 0.5.2

Enable **WHIP input** in **Setup** to add one input after the configured SRT channels. With eight channels, WHIP appears as the ninth tile. Enter the bridge's WHIP URL and bearer token in the sender.

| Connection | Default port | Purpose |
| --- | --- | --- |
| WHIP sender to bridge | 21102/TCP | WHIP signaling |
| WHIP sender to bridge | 21102/UDP | Incoming WebRTC media |
| Bridge to SRT receiver | 21101/UDP | SRT playback on the usual SRT port |

Physical limits
The number of channels is not the limit; the total data rate is. In single-port mode, all receivers together share one UDP port. On the development laptop, this port delivered about 800 Mbit/s of outgoing data in total. Every receiver counts separately: a 10 Mbit/s signal fetched by 5 receivers uses 50 Mbit/s.

In practice, the network usually sets the limit first:

Internet upload: the sum of all signals going out to the internet must fit into your upload bandwidth, with some headroom for SRT retransmissions (plan for about 25 % on top).
Network card: a 1 Gbit/s link carries about 940 Mbit/s at most.
Computer: CPU and network driver affect the result; the 800 Mbit/s figure is a measurement, not a guarantee.

Example: 8 channels at 10 Mbit/s, each sent to 2 receivers over the internet, need about 160 Mbit/s of upload, plus about 25 %, so roughly 200 Mbit/s. 

## Getting started on Windows

1. Download the Windows installer from the [latest release](https://github.com/peteraellig/srt-bridge/releases/latest), run it and open **SRT Bridge**.
2. In **Setup**, check the SRT port (default **21101**). Allow inbound UDP traffic on that port. If the bridge PC is behind a router, forward the same UDP port to the PC.
3. Set the encoder to **Caller** and enter the bridgeâ€™s public address, port and sender stream ID. Once connected, its tile on **Main** shows **LIVE**.
4. Click **Links** on the tile and copy the forward receiver URL to the decoder. Set the decoder to **Caller**. Use **Matrix** to choose which input it receives.

The **Help** tab explains stream IDs, routing and remote access.

## Bridge Output

The Windows installer includes Bridge Output. Open **Outputs**, start Bridge Output and choose a destination for each input signal. Bridge Output decodes the video and audio on the bridge PC.

- **OMT** publishes the signal on the local network under the output name you choose. Open Media Transport support is built in.
- **NDI** publishes a named NDI source on the local network. Install the NDI runtime on the bridge PC with NDI Tools.
- **SDI** sends the signal through a physical output on a supported Blackmagic Design DeckLink card. Select the SDI port for that signal. Each port carries one signal and follows its video format.

## Remote control over HTTPS

Use the bridge interface from a browser to monitor signals, switch channels on or off, change matrix routing and manage outputs. SRT streams use **UDP**. The HTTPS interface uses **TCP on the same configured SRT port** (default **21101**).

1. On the bridge PC, open **Setup → Remote access**, set a password and switch remote access on.
2. In **Setup**, click **Set firewall rule** again and approve the Windows administrator prompt. Repeat this step even if SRT streaming already works, so Windows also allows incoming TCP connections.
3. For access over the internet, forward **TCP** on that same port to the bridge PC alongside the existing **UDP** forwarding. On the local network, use the bridge PC's LAN address.
4. Open `https://<bridge-address>:21101/` in your browser and sign in. If you changed the SRT port, use that number in the URL. On first connection, verify the certificate fingerprint against the one shown on the bridge PC.

Remote-access settings, the SRT port and Windows firewall rules are managed on the bridge PC.

## Building from source

Run these PowerShell commands from the repository root on Windows x64.

| Component | Command | Requirements |
| --- | --- | --- |
| SRT Bridge | `.\srt_bridge\build.ps1` | Go 1.27.2 or compatible |
| SRT Bridge Output | `.\srt_bridge_output\build.ps1` | Go, Visual Studio 18 Community with the x64 C++ tools, Blackmagic Desktop Video |
| SRT Bridge WHIP | `.\srt_bridge_whip\build.ps1` | Go, Visual Studio 18 Community with the x64 C++ tools and CMake |
| Combined installer | `.\srt_bridge\installer\build-setup.ps1` | Requirements for all three components, plus Inno Setup 6 or 7 |

The installer script builds all three components and writes the setup executable and its SHA-256 checksum to `srt_bridge/dist/`.

## License

SRT Bridge and SRT Bridge Output are licensed under the [BSD Zero Clause License (0BSD)](LICENSE). Copyright © 2026 Peter Aellig.

Bundled third-party components retain their own licenses. See the [Fraunhofer FDK AAC license](srt_bridge_output/engine/third_party/fdk-aac/NOTICE) and the [OMT MIT license](srt_bridge_output/engine/third_party/omt/LICENSE.txt).

Written by Peter Aellig and Claude Fable 5.2 (Anthropic).
