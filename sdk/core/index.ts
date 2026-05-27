export * from './hooks/useRealtimeStream';

export class SignVerseAIClient {
  private url: string;
  constructor(url: string) {
    this.url = url;
  }
  
  async ping() {
    return fetch(`${this.url}/health`).then(res => res.json());
  }
}
