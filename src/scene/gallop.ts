import { AnimationClip } from 'three'

// The model was baked on a regular grid. Some last keys continue past the
// opening pose. A periodic Catmull–Rom curve joins the stride with a shared
// tangent at contact, including when the playhead crosses the loop boundary.
export function smoothGallop(source: AnimationClip) {
  const tracks = source.tracks.map(track => {
    const count = track.times.length - 1
    if (count < 3) return track.clone()
    const size = track.getValueSize()
    const rotation = track.ValueTypeName === 'quaternion'
    const samples = count * 8
    const times = new Float32Array(samples + 1)
    const values = new Float32Array((samples + 1) * size)

    for (let sample = 0; sample <= samples; sample++) {
      const position = sample * count / samples
      const key = Math.floor(position) % count
      const u = position - Math.floor(position)
      const offsets = [-1, 0, 1, 2].map(k => ((key + k + count) % count) * size)
      // q and -q represent the same rotation. Choose the local hemisphere
      // before interpolating so a bone never spins through a full turn.
      const signs = offsets.map(offset => {
        if (!rotation) return 1
        let dot = 0
        for (let c = 0; c < size; c++) dot += track.values[offset + c] * track.values[key * size + c]
        return dot < 0 ? -1 : 1
      })
      let norm = 0
      for (let c = 0; c < size; c++) {
        const [a, b, d, e] = offsets.map((offset, j) => signs[j] * track.values[offset + c])
        const value = b + .5 * u * (d - a + u * (2*a - 5*b + 4*d - e + u * (3*(b-d) + e-a)))
        values[sample * size + c] = value
        norm += value * value
      }
      if (rotation) {
        const length = Math.sqrt(norm)
        for (let c = 0; c < size; c++) values[sample * size + c] /= length
      }
      times[sample] = sample / samples * source.duration
    }
    const result = track.clone()
    result.times = times
    result.values = values
    return result
  })
  return new AnimationClip(source.name, source.duration, tracks)
}
