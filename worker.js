// FilePal relay on Cloudflare Workers + Durable Objects (WebSocket Hibernation).
// One Durable Object per device code. Roles:
//   listen  - the receiving app keeps one control socket open (needs the owner key)
//   connect - a sender; the DO tells the listener "NEW <sid>"
//   serve   - the receiver opens a second socket for that session; the DO pipes sender <-> serve
export class Hub {
  constructor(ctx, env) { this.ctx = ctx; }

  async fetch(req) {
    if (req.headers.get("Upgrade") !== "websocket") return new Response("Expected WebSocket", { status: 426 });
    const u = new URL(req.url);
    const role = u.searchParams.get("role");
    const sid = (u.searchParams.get("sid") || crypto.randomUUID().replace(/-/g, "").slice(0, 12)).replace(/[^A-Za-z0-9]/g, "");

    if (role === "listen" || role === "serve") {
      const key = u.searchParams.get("key") || "";
      const owner = await this.ctx.storage.get("owner");
      if (!owner) {
        if (key.length < 16) return new Response("bad key", { status: 400 });
        await this.ctx.storage.put("owner", key);       // first listener owns this code
      } else if (owner !== key) {
        return new Response("forbidden", { status: 403 });
      }
    }

    if (role === "connect" && this.ctx.getWebSockets("listener").length === 0)
      return new Response("offline", { status: 404 });
    if (!["listen", "connect", "serve"].includes(role)) return new Response("bad role", { status: 400 });

    const [client, server] = Object.values(new WebSocketPair());
    if (role === "listen") {
      for (const w of this.ctx.getWebSockets("listener")) { try { w.close(1000, "replaced"); } catch (e) {} }
      this.ctx.acceptWebSocket(server, ["listener"]);
    } else if (role === "connect") {
      this.ctx.acceptWebSocket(server, ["s:" + sid]);
      this.ctx.getWebSockets("listener")[0].send("NEW " + sid);
    } else {
      this.ctx.acceptWebSocket(server, ["v:" + sid]);
      for (const s of this.ctx.getWebSockets("s:" + sid)) s.send("READY");
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  peerTag(ws) {
    let tag = "";
    try { tag = this.ctx.getTags(ws)[0] || ""; } catch (e) {}
    if (tag.startsWith("s:")) return "v:" + tag.slice(2);
    if (tag.startsWith("v:")) return "s:" + tag.slice(2);
    return null;   // listener or unknown
  }

  webSocketMessage(ws, msg) {
    const t = this.peerTag(ws);
    if (t) for (const p of this.ctx.getWebSockets(t)) p.send(msg);
  }

  webSocketClose(ws) {
    const t = this.peerTag(ws);
    if (t) for (const p of this.ctx.getWebSockets(t)) { try { p.close(1000, "peer closed"); } catch (e) {} }
    try { ws.close(1000, "bye"); } catch (e) {}
  }

  webSocketError(ws) { this.webSocketClose(ws); }
}

export default {
  async fetch(req, env) {
    const m = new URL(req.url).pathname.match(/^\/ws\/([A-Za-z0-9]{4,32})$/);
    if (!m) return new Response("FilePal relay OK", { status: 200 });
    return env.HUB.get(env.HUB.idFromName(m[1])).fetch(req);
  },
};
