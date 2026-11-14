// Each row keeps the width of the original marks. At joints the two adjacent
// row displacements meet continuously, so the ink never tears at the knees.
function smooth(t) {
  const u = Math.min(1, Math.max(0, t))
  return u*u*(3-2*u)
}
export function layerOf(x,y) {
  if (x<337 && y>215 && y<371) return 'tail'
  if (y<=302) return 'body'
  if (x<345) return 'body'
  const divide = y<405 ? 495 : Math.min(620, 517 + .78*(y-405))
  if (x<divide) return 'hind'
  const edge = y<352 ? 744 : Math.max(694, 744-1.1*(y-352))
  if (x>edge) return 'fold'
  // Transition into the front roots along the underside of the chest.
  return 'fore'
}
// Joint offsets from the original folded pose, in source pixels. Hooves
// reach, load, drive backwards and then gather. The far leg leads the near.
const keys=[
  //       hind knee, hoof      fore elbow, hoof        far elbow, hoof
  [          0,  0,  0,  0,       0, 0,   0, 0,        0, 0,   0, 0 ],
  [         13,  4, 23, -9,      15, 1,  55, 8,        5, 5,  37, 9 ],
  [         26,  8, 27,-11,      43,12, 152,43,       14,15,  88,76 ],
  [         22, 11,  5, -5,      54,19, 204,72,       10,20, 104,135],
  [          3,  9,-51,  7,      43,22, 160,77,      -11,16,  49,137],
  [        -28,  8,-122,12,      17,17,  99,78,      -26,13, -12,108],
  [        -54,  0,-181, 0,     -17,13,  33,64,      -47,11, -46, 57],
  [        -58, -6,-199,-31,    -43, 4, -15,27,       -49, 1, -79, 18],
  [        -37, -7,-146,-50,    -40,-2, -36, 2,       -38,-6, -70, -5],
  [        -16, -6, -60,-38,    -18,-4, -25,-9,       -15,-4, -36, -9],
]
export function poseAt(phase) {
  const n=keys.length
  const pos=((phase%1+1)%1)*n
  const k=Math.floor(pos), u=pos-k
  const a=keys[(k+n-1)%n], b=keys[k], c=keys[(k+1)%n], d=keys[(k+2)%n]
  const values=b.map((v,i) => .5*((2*v)+(-a[i]+c[i])*u+
    (2*a[i]-5*v+4*c[i]-d[i])*u*u+(-a[i]+3*v-3*c[i]+d[i])*u*u*u))
  return { hind:values.slice(0,4),fore:values.slice(4,8),fold:values.slice(8,12) }
}
export function displacement(name,x,y,pose) {
  if (name==='body' || name==='tail') return [0,0]
  const [kx,ky,hx,hy]=pose[name]
  const knee=name==='hind'?406:name==='fore'?395:352
  const tip=name==='hind'?526:name==='fore'?465:391
  const root = name==='hind' ? 334 : name==='fold' ? 344 : 340
  if (y<=knee) {
    const s=smooth((y-root)/(knee-root))
    return [kx*s,ky*s]
  }
  const s=smooth((y-knee)/(tip-knee))
  const toe = name==='fore' ? smooth((643-x)/137) * smooth((y-403)/19) : 0
  const ankle = smooth((y-knee)/(tip-knee) + toe*.64)
  return [kx+(hx-kx)*ankle, ky+(hy-ky)*ankle + toe*54*smooth(Math.max(0,hx)/174)]
}
