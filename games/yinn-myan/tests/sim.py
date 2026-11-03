"""Headless checks for Yinn Myan / Pyay Road (physics + handling + a hands-off drive).

Setup once:
    pip install playwright && python -m playwright install chromium-headless-shell

Run (serves the game folder on a local port; Three.js loads from the CDN in the import map):
    python3 tests/sim.py

Notes:
- The game exposes test hooks on window.__pyay (car, input, physics, collide, project,
  teleport(s), selectCar(i), setEasy(bool), simulateAccel(), renderInfo(), ...).
- Headless Chromium renders with SwiftShader (CPU), so frame rate is meaningless here;
  these tests step physics directly instead of waiting for frames.
"""
import asyncio, functools, http.server, pathlib, threading
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent

def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    h = functools.partial(Quiet, directory=str(ROOT))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv

HANDLING = """(([car,easy,kmh,steer])=>{const P=window.__pyay;P.selectCar(car);P.setEasy(easy);P.start();const c=P.car;
c.x=0;c.z=0;c.h=0;c.vx=kmh/3.6;c.vy=0;c.r=0;c.gear=P.SPEC.ev?1:Math.min(P.SPEC.gears.length,3);c.rpm=4000;
const dt=1/240;let maxB=0,lat=0,n=0;
for(let i=0;i<240*4;i++){P.input.steer=Math.min(steer,(i/240)/0.3*steer);P.input.throttle=c.vx*3.6<kmh?0.6:0.1;P.input.brake=0;P.physics(dt);
  const b=Math.abs(Math.atan2(c.vy,Math.abs(c.vx)));maxB=Math.max(maxB,b);if(i>480){lat+=Math.abs(c.vx*c.r);n++;}}
return {latG:+(lat/n/9.81).toFixed(2),maxSlipDeg:+(maxB*57.3).toFixed(1),endKmh:Math.round(c.vx*3.6)};})"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        pg = await (await b.new_context(viewport={"width": 640, "height": 360})).new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.route("https://fonts.**", lambda r: r.abort())
        pg.on("console", lambda m: m.type == "error" and errs.append(m.text))
        srv = serve()
        await pg.goto(f"http://127.0.0.1:{srv.server_port}/index.html")
        await pg.wait_for_function("!document.getElementById('startBtn').disabled", timeout=120000)
        print("0-100 / top speed per car:")
        for i in range(5):
            print(" ", await pg.evaluate(f"(()=>{{const P=window.__pyay;P.selectCar({i});const r=P.simulateAccel();return [P.SPEC.short,r.t100&&+r.t100.toFixed(1),Math.round(r.vmax)]}})()"))
        print("cornering (assists on): expect ~0.85-0.95 g at full lock, slip < 5 deg")
        for kmh in (40, 80, 120):
            print(" ", kmh, "km/h full lock", await pg.evaluate(HANDLING, [0, True, kmh, 1.0]))
        print("page errors:", errs or "none")
        await b.close()

if __name__ == "__main__":
    asyncio.run(main())
