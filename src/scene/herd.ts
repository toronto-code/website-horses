import type { HorseRenderer } from './horse-renderer'

export type Field = { x: number; top: number; w: number; h: number }
const depth = [
  { view:'far', size:.15, start:.58, ground:.38, speed:.54, ink:.58, stride:.62, cadence:.85, suspension:.013, breath:1.7 },
  { view:'mid', size:.21, start:.72, ground:.63, speed:.72, ink:.79, stride:.65, cadence:.97, suspension:-.010, breath:3.0 },
  { view:'near',size:.34, start:.20, ground:.95, speed:1, ink:1, stride:.70, cadence:1.03, suspension:.006, breath:.4 },
] as const

export function createHerd() {
  const gait = [.41,.74,.16]
  const walk = [0,0,0]
  let boost = 0
  return function draw(ctx:CanvasRenderingContext2D, model:HorseRenderer, lane:Field, dt:number,
    cameraStep:number, time:number, still:boolean) {
    // Ground speed eases for ~0.6s. Negative scrolling still accelerates the gallop.
    const scrollSpeed = dt > 0 ? Math.abs(cameraStep)/dt : 0
    const target = .85 * (1 - Math.exp(-scrollSpeed/Math.max(240, lane.w*.63)))
    boost += (target - boost) * (1-Math.exp(-dt/.20))
    ctx.save()
    ctx.beginPath()
    ctx.rect(lane.x,lane.top,lane.w,lane.h)
    ctx.clip()
    depth.forEach((d,i) => {
      const w = Math.min(lane.w*d.size, lane.h*(d.view==='near'? .89 : .55))
      const h = w*(d.view==='near' ? 396/592 : d.view==='mid' ? 240/344 : 192/256)
      // The planted hoof sweeps about 5.4 model units per cycle. The view spans ~8.2 units.
      const stride = w*d.stride
      const cadence = d.cadence*(1 + .032*Math.sin(time*(.52+i*.09)+d.breath))
      const speed = stride*(cadence + boost*d.speed)
      const delta = still ? 0 : speed*dt
      gait[i] += delta/Math.max(1,stride)
      walk[i] += delta
      const loop = lane.w + w
      const x = lane.x+(((d.start*lane.w+w+walk[i])%loop)+loop)%loop-w
      const ground = lane.top+lane.h*d.ground
      // Ease the timing only within the aerial part of the clip. The map and
      // its derivative join the original gait exactly at takeoff and landing.
      const phase = gait[i] % 1
      const flight = Math.max(0, Math.min(1, (phase - .14) / .29))
      const pose = phase + d.suspension * Math.sin(Math.PI*flight)**2
      const frame = model.frame(d.view,pose)
      ctx.globalAlpha = d.ink
      ctx.drawImage(frame,x,ground-h,w,h)
    })
    ctx.restore()
  }
}
