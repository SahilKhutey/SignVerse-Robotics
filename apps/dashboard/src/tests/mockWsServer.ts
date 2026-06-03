import { WebSocketServer, WebSocket } from 'ws';

let wss: WebSocketServer | null = null;
let intervalId: NodeJS.Timeout | null = null;

export function startMockWsServer(port: number = 3000) {
  wss = new WebSocketServer({ port });
  console.log(`[Mock WS] Server listening on ws://localhost:${port}`);

  wss.on('connection', (ws: WebSocket) => {
    console.log('[Mock WS] Client connected');
    let angle = 0;

    // Send telemetry frames (1000Hz simulated as 1ms interval)
    intervalId = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        // Generate a smooth joint configuration wave for testing
        const j0 = Math.sin(angle) * 45;
        const j1 = Math.cos(angle) * 30;
        const j2 = Math.sin(angle * 2) * 15;
        angle += 0.02;

        ws.send(JSON.stringify({
          type: 'telemetry',
          joints: {
            J0: j0,
            J1: j1,
            J2: j2
          }
        }));
      }
    }, 1);

    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message);
        if (data.action === 'PONG') {
          // pong
        }
      } catch (e) {
        // ignore
      }
    });

    ws.on('close', () => {
      console.log('[Mock WS] Client disconnected');
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    });
  });

  return wss;
}

export function stopMockWsServer() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  if (wss) {
    // Forcefully terminate all active connections immediately
    for (const client of wss.clients) {
      try {
        client.terminate();
      } catch (e) {
        // ignore
      }
    }
    wss.close();
    wss = null;
  }
}
