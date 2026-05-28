import { connect, NatsConnection, StringCodec } from "nats";

const sc = StringCodec();

export class SignVerseEventBus {
  private nc?: NatsConnection;

  async connect(servers = "nats://localhost:4222") {
    this.nc = await connect({ servers });
    console.log(`Connected to NATS at ${this.nc.getServer()}`);
  }

  publish(subject: string, data: any) {
    if (!this.nc) throw new Error("Not connected");
    this.nc.publish(subject, sc.encode(JSON.stringify(data)));
  }

  subscribe(subject: string, callback: (data: any) => void) {
    if (!this.nc) throw new Error("Not connected");
    const sub = this.nc.subscribe(subject);
    (async () => {
      for await (const m of sub) {
        callback(JSON.parse(sc.decode(m.data)));
      }
    })();
  }
}