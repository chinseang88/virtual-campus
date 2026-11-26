// Fast Face-Culled Voxel Mesher with Ambient Occlusion, Floor Slicing & DDA Raycaster
(function (global) {
  const { BLOCKS, BLOCK_INFO, ATLAS_COLS, ATLAS_ROWS } = global.VoxelTextures;

  const FACES = [
    { dir: [1, 0, 0],  corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: 0.86, faceType: 'side' },
    { dir: [-1, 0, 0], corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 0.86, faceType: 'side' },
    { dir: [0, 1, 0],  corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1.0,  faceType: 'top' },
    { dir: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.65, faceType: 'bottom' },
    { dir: [0, 0, 1],  corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.92, faceType: 'side' },
    { dir: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.92, faceType: 'side' },
  ];

  const QUAD_UV = [[0, 1], [1, 1], [1, 0], [0, 0]];

  function getTileIndex(block, faceType) {
    const info = BLOCK_INFO[block];
    if (!info) return 0;
    if (info.all !== undefined) return info.all;
    return info[faceType] !== undefined ? info[faceType] : 0;
  }

  function vertexAO(side1, side2, corner) {
    if (side1 && side2) return 0.58;
    const occ = (side1 ? 1 : 0) + (side2 ? 1 : 0) + (corner ? 1 : 0);
    return 1.0 - occ * 0.13;
  }

  function createBucket() {
    return { positions: [], normals: [], uvs: [], colors: [], indices: [] };
  }

  function pushQuad(bucket, p0, p1, p2, p3, normal, tileIdx, shades) {
    const base = bucket.positions.length / 3;
    const col = tileIdx % ATLAS_COLS;
    const row = Math.floor(tileIdx / ATLAS_COLS);
    const u0 = col / ATLAS_COLS;
    const v0 = row / ATLAS_ROWS;
    const du = 1 / ATLAS_COLS;
    const dv = 1 / ATLAS_ROWS;
    const pad = 0.0008;

    const pts = [p0, p1, p2, p3];
    for (let i = 0; i < 4; i++) {
      bucket.positions.push(pts[i][0], pts[i][1], pts[i][2]);
      bucket.normals.push(normal[0], normal[1], normal[2]);
      const [qu, qv] = QUAD_UV[i];
      bucket.uvs.push(u0 + pad + qu * (du - pad * 2), v0 + pad + qv * (dv - pad * 2));
      const s = shades[i];
      bucket.colors.push(s, s, s);
    }

    if (shades[0] + shades[2] > shades[1] + shades[3]) {
      bucket.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    } else {
      bucket.indices.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
    }
  }

  function buildGeometry(bucket) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(bucket.positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(bucket.normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(bucket.uvs, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(bucket.colors, 3));
    geo.setIndex(bucket.indices);
    geo.computeBoundingSphere();
    return geo;
  }

  function buildWorldMeshes(world, atlasTexture, sliceMaxY = null) {
    const opaque = createBucket();
    const cutout = createBucket();
    const trans = createBucket();

    const { w, h, d } = world;
    const maxY = sliceMaxY !== null ? Math.min(h - 1, sliceMaxY) : h - 1;

    const getVis = (x, y, z) => {
      if (y > maxY) return BLOCKS.AIR;
      return world.get(x, y, z);
    };
    const isOcc = (x, y, z) => {
      const b = getVis(x, y, z);
      const info = BLOCK_INFO[b];
      return !!(info && info.solid && !info.transparent);
    };

    for (let y = 0; y <= maxY; y++) {
      for (let z = 0; z < d; z++) {
        for (let x = 0; x < w; x++) {
          const b = getVis(x, y, z);
          if (b === BLOCKS.AIR) continue;
          const info = BLOCK_INFO[b];
          if (!info) continue;

          const bucket = info.transparent ? trans : opaque;

          for (let f = 0; f < 6; f++) {
            const face = FACES[f];
            const nx = x + face.dir[0];
            const ny = y + face.dir[1];
            const nz = z + face.dir[2];
            const neighbor = getVis(nx, ny, nz);
            const nInfo = BLOCK_INFO[neighbor];

            if (info.transparent) {
              if (neighbor === b) continue;
              if (nInfo && nInfo.solid && !nInfo.transparent) continue;
            } else {
              if (nInfo && nInfo.solid && !nInfo.transparent) continue;
            }

            const tile = getTileIndex(b, face.faceType);
            const pts = face.corners.map((c) => [x + c[0], y + c[1], z + c[2]]);
            const shades = [face.shade, face.shade, face.shade, face.shade];

            if (!info.transparent && !info.emissive) {
              for (let i = 0; i < 4; i++) {
                const c = face.corners[i];
                const sx = c[0] === 1 ? 1 : -1;
                const sy = c[1] === 1 ? 1 : -1;
                const sz = c[2] === 1 ? 1 : -1;
                let s1 = false, s2 = false, cn = false;
                if (face.dir[1] !== 0) {
                  s1 = isOcc(nx + sx, ny, nz);
                  s2 = isOcc(nx, ny, nz + sz);
                  cn = isOcc(nx + sx, ny, nz + sz);
                } else if (face.dir[0] !== 0) {
                  s1 = isOcc(nx, ny + sy, nz);
                  s2 = isOcc(nx, ny, nz + sz);
                  cn = isOcc(nx, ny + sy, nz + sz);
                } else {
                  s1 = isOcc(nx + sx, ny, nz);
                  s2 = isOcc(nx, ny + sy, nz);
                  cn = isOcc(nx + sx, ny + sy, nz);
                }
                shades[i] = face.shade * vertexAO(s1, s2, cn);
              }
            } else if (info.emissive) {
              shades[0] = shades[1] = shades[2] = shades[3] = 1.15;
            }

            pushQuad(bucket, pts[0], pts[1], pts[2], pts[3], face.dir, tile, shades);
          }
        }
      }
    }

    const opaqueMat = new THREE.MeshLambertMaterial({ map: atlasTexture, vertexColors: true });
    const cutoutMat = new THREE.MeshLambertMaterial({ map: atlasTexture, vertexColors: true, alphaTest: 0.4, side: THREE.DoubleSide });
    const transMat = new THREE.MeshLambertMaterial({ map: atlasTexture, vertexColors: true, transparent: true, opacity: 0.56, depthWrite: false, side: THREE.DoubleSide });

    const group = new THREE.Group();
    const opaqueMesh = new THREE.Mesh(buildGeometry(opaque), opaqueMat);
    opaqueMesh.receiveShadow = true;
    opaqueMesh.castShadow = true;
    group.add(opaqueMesh);

    const cutoutMesh = new THREE.Mesh(buildGeometry(cutout), cutoutMat);
    group.add(cutoutMesh);

    const transMesh = new THREE.Mesh(buildGeometry(trans), transMat);
    group.add(transMesh);

    return group;
  }

  function raycastVoxel(world, origin, dir, maxDist = 7) {
    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);

    const stepX = dir.x >= 0 ? 1 : -1;
    const stepY = dir.y >= 0 ? 1 : -1;
    const stepZ = dir.z >= 0 ? 1 : -1;

    const tDeltaX = dir.x !== 0 ? Math.abs(1 / dir.x) : 1e9;
    const tDeltaY = dir.y !== 0 ? Math.abs(1 / dir.y) : 1e9;
    const tDeltaZ = dir.z !== 0 ? Math.abs(1 / dir.z) : 1e9;

    let tMaxX = dir.x !== 0 ? ((dir.x > 0 ? x + 1 - origin.x : origin.x - x) * tDeltaX) : 1e9;
    let tMaxY = dir.y !== 0 ? ((dir.y > 0 ? y + 1 - origin.y : origin.y - y) * tDeltaY) : 1e9;
    let tMaxZ = dir.z !== 0 ? ((dir.z > 0 ? z + 1 - origin.z : origin.z - z) * tDeltaZ) : 1e9;

    let dist = 0;
    let nx = 0, ny = 0, nz = 0;

    for (let i = 0; i < 64; i++) {
      if (dist > maxDist) break;
      const b = world.get(x, y, z);
      const info = BLOCK_INFO[b];
      if (b !== BLOCKS.AIR && info) {
        return { x, y, z, nx, ny, nz, block: b, dist };
      }
      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          dist = tMaxX; x += stepX; tMaxX += tDeltaX; nx = -stepX; ny = 0; nz = 0;
        } else {
          dist = tMaxZ; z += stepZ; tMaxZ += tDeltaZ; nx = 0; ny = 0; nz = -stepZ;
        }
      } else {
        if (tMaxY < tMaxZ) {
          dist = tMaxY; y += stepY; tMaxY += tDeltaY; nx = 0; ny = -stepY; nz = 0;
        } else {
          dist = tMaxZ; z += stepZ; tMaxZ += tDeltaZ; nx = 0; ny = 0; nz = -stepZ;
        }
      }
    }
    return null;
  }

  global.VoxelMesher = { buildWorldMeshes, raycastVoxel };
})(window);
