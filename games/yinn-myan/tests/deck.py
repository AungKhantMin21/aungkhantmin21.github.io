"""Hledan flyover checks: take the ramp, stay under it, and hit the ramp wall from the side.

    python3 tests/deck.py

A tiny path-following driver (test only — the game has no steering assists) holds a lateral
offset d from the road centre at a target speed, stepping the sim at 240 Hz.
"""
import asyncio, json
from playwright.async_api import async_playwright
from sim import serve

DRIVE = """(([s0, s1, lane, kmh, laneChangeAt, newLane]) => {
  const P = window.__pyay; P.impacts.length = 0; P.selectCar(0); P.setEasy(true); P.start(); P.teleport(s0, 0);
  const c = P.car, inp = P.input, dt = 1 / 240;
  const tgt = (s, ln) => Math.max(P.medAt(s), P.medAt(s + 12)) + 1.9 + ln * 3.5; // look ahead where the median widens
  { const f = P.frameAt(s0), d = tgt(s0, lane); c.x = f.x + f.nx * d; c.z = f.z + f.nz * d; c.h = Math.atan2(f.tx, f.tz); c.vx = kmh / 3.6; c.gear = 3; }
  const log = []; let maxY = 0, maxGrade = 0, firstDeck = null, lastDeck = null, minUnderY = 99;
  for (let i = 0; i < 240 * 200; i++) {
    const p = P.project(c.x, c.z, c.hint); c.hint = p.i;
    if (p.s > s1) break;
    const ln = laneChangeAt != null && p.s > laneChangeAt ? newLane : lane;
    const dk = c.layer === 1 ? c.deck : null; // on the deck, aim for its centre
    const f = P.frameAt(p.s); let e = Math.atan2(f.tx, f.tz) - c.h; e = Math.atan2(Math.sin(e), Math.cos(e));
    inp.steer = Math.max(-1, Math.min(1, 0.12 * (p.d - (dk ? dk.centre(p.s + 12) : tgt(p.s, ln))) + 2.2 * e));
    const v = c.vx * 3.6; inp.throttle = v < kmh ? Math.min(1, (kmh - v) * 0.15) : 0; inp.brake = v > kmh + 5 ? 0.3 : 0;
    P.step(dt);
    if (c.layer === 1) { if (firstDeck == null) firstDeck = p.s; lastDeck = p.s; }
    maxY = Math.max(maxY, c.y); maxGrade = Math.max(maxGrade, Math.abs(c.grade));
    if (i % 240 === 0) log.push([Math.round(p.s), c.layer, +c.y.toFixed(2), Math.round(c.vx * 3.6)]);
  }
  return { firstDeck: firstDeck && Math.round(firstDeck), lastDeck: lastDeck && Math.round(lastDeck), maxY: +maxY.toFixed(2),
           maxGradePct: +(maxGrade * 100).toFixed(1), crashes: c.crashes, damage: +c.damage.toFixed(3), fines: c.fines, impacts: P.impacts.slice(), log };
})"""

async def main():
    srv = serve()
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        pg = await (await b.new_context(viewport={"width": 640, "height": 360})).new_page()
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.route("https://fonts.**", lambda r: r.abort())
        await pg.goto(f"http://127.0.0.1:{srv.server_port}/index.html")
        await pg.wait_for_function("!document.getElementById('startBtn').disabled", timeout=180000)
        decks = await pg.evaluate("window.__pyay.decks.map(k=>({name:k.name,s0:k.s0,s1:k.s1,H:k.H}))")
        print("decks:", decks)
        cases = [("inner lane -> takes the flyover", [2650, 3900, 0, 60, None, None]),
                 ("middle lane -> stays under it",   [2650, 3900, 1, 60, None, None]),
                 ("lane change into the ramp side",  [2650, 2950, 2, 50, 2800, 0])]
        for name, args in cases:
            r = await pg.evaluate(DRIVE, args)
            log = r.pop("log")
            print(f"{name}: {json.dumps(r)}")
            print("   s/layer/y/kmh:", log[::6])
        print("page errors:", errs or "none")
        await b.close()

if __name__ == "__main__":
    asyncio.run(main())
