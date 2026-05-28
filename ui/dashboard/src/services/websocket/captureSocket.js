export class CaptureSocket {
  constructor(url, onMessage) {
    this.url = url;
    this.ws = null;
    this.onMessage = onMessage;
    this.isConnected = false;
  }

  connect() {
    this.ws = new WebSocket(this.url);
    this.ws.onopen = () => {
      this.isConnected = true;
      console.log('Capture WebSocket Connected');
    };
    this.ws.onmessage = (event) => {
      if (this.onMessage) {
        try {
          const data = JSON.parse(event.data);
          this.onMessage(data);
        } catch(e) {
          console.error("Capture WebSocket Parse Error", e);
        }
      }
    };
    this.ws.onclose = () => {
      this.isConnected = false;
      console.log('Capture WebSocket Disconnected');
    };
  }

  sendFrame(base64Data) {
    if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(base64Data);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}
