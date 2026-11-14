import * as T from 'three'

// Tapered ribbons move with the model's neck and tail bones, then bend with
// the gallop phase. They share the model lighting and the same pixel-to-glyph pass.
export function addHair(scene: T.Scene, horse: T.Object3D) {
  const material = new T.MeshLambertMaterial({ color: 0x292929, side: T.DoubleSide })
  const locks = [
    ...Array.from({length: 12}, (_, i) => ({ bone: ['Neck1','Neck2','Neck3','Head'][Math.floor(i/3)], tail:false, index:i })),
    ...Array.from({length: 8}, (_, i) => ({ bone: ['Tail3','Tail4','Tail5','Tail6'][i%4], tail:true, index:i })),
  ].map(lock => {
    const geometry = new T.BufferGeometry()
    const pos = new T.Float32BufferAttribute(new Float32Array(18),3)
    geometry.setAttribute('position',pos)
    geometry.setIndex([0,1,2, 2,1,3, 2,3,4, 4,3,5])
    const mesh = new T.Mesh(geometry,material)
    mesh.frustumCulled = false
    scene.add(mesh)
    return { ...lock, bone:horse.getObjectByName(lock.bone)!, geometry, pos }
  })
  const anchor = new T.Vector3()
  return {
    update(phase: number) {
      for (const { bone, tail, index, pos, geometry } of locks) {
        bone.getWorldPosition(anchor)
        const spread = (index % 4) / 3
        const x = anchor.x - (tail ? .05 : .11) - .035 * spread
        const y = anchor.y + (tail ? .09 - .15*spread : .25 + .11*(index%3))
        const z = anchor.z + (tail ? 0 : -.14 + .12*(index%3))
        const wave = Math.sin(phase*2*Math.PI - .5*index)
        for (let j=0; j<3; j++) {
          const u = j*.5
          const lift = tail ? .09*Math.sin(u*Math.PI) -.48*u*u*spread : .34*Math.sin(u*Math.PI) + .10*u
          const middle = y + lift + (tail ? .16 : .09)*wave*u
          const reach = (tail ? 1.08+spread*.43 : .49+.19*spread)*u
          const half = (tail ? .07 : .09)*(1-u)+.008
          pos.setXYZ(j*2,x,middle+half,z-reach)
          pos.setXYZ(j*2+1,x+.025,middle-half,z-reach)
        }
        pos.needsUpdate = true
        geometry.computeVertexNormals()
      }
    },
    dispose() { locks.forEach(l=>l.geometry.dispose()); material.dispose() },
  }
}
