// pay-do/src/index.js — separate Worker that hosts the PaySession Durable Object.
// One object per session code. Strongly consistent: write on phone = instantly readable on display.
import { DurableObject } from "cloudflare:workers";

export class PaySession extends DurableObject {
  async fetch(request) {
    if (request.method === "POST") {
      let amount = 0;
      try { ({ amount } = await request.json()); } catch {}
      await this.ctx.storage.put("p", { paid: true, amount, at: Date.now() });
      await this.ctx.storage.setAlarm(Date.now() + 10 * 60 * 1000); // auto-delete after 10 min
      return Response.json({ ok: true });
    }
    const p = await this.ctx.storage.get("p");
    return Response.json(p ? { paid: true, amount: p.amount } : { paid: false });
  }

  async alarm() {
    await this.ctx.storage.deleteAll();
  }
}

export default {
  fetch() {
    return new Response("not found", { status: 404 });
  },
};
