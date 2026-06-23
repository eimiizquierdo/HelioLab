"use client"

import { useEffect, useRef } from "react"
import { ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from "lucide-react"

// Parametros HelioLab (Berrios)
const LAT_DEG  = 20.39
const LON_DEG  = -99.99
const TZ       = -6
const BETA_DEG = 21
const AP_DEG   = 180
const R        = 8

const D2R = Math.PI / 180
const LAT  = LAT_DEG  * D2R
const BETA = BETA_DEG * D2R
const AP   = AP_DEG   * D2R

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1)
  return Math.floor((date.getTime() - start.getTime()) / 86400000) + 1
}

function solarAngles(n: number, h: number) {
  // Declinacion (diap. 7)
  const decl = 23.45 * D2R * Math.sin((360 / 365) * (284 + n) * D2R)
  // Ecuacion del tiempo (diap. 8)
  const B = ((360 / 365) * (n - 81)) * D2R
  const Et = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B)
  // Hora solar (diap. 8)
  const TC   = 4 * (15 * TZ - LON_DEG) + Et
  const tSol = h + TC / 60
  // Angulo horario (diap. 9)
  const omega = 15 * (tSol - 12) * D2R
  // Vector solar ENU (diap. 10)
  const sE =  -Math.cos(decl) * Math.sin(omega)
  const sN =   Math.cos(LAT)  * Math.sin(decl) - Math.sin(LAT) * Math.cos(decl) * Math.cos(omega)
  const sU =   Math.sin(LAT)  * Math.sin(decl) + Math.cos(LAT) * Math.cos(decl) * Math.cos(omega)
  // Elevacion y azimut (diap. 10)
  const elev = Math.asin(Math.max(-1, Math.min(1, sU)))
  let az = Math.atan2(sE, sN)
  if (az < 0) az += 2 * Math.PI
  // Normal del panel (diap. 12)
  const npE = Math.sin(BETA) * Math.sin(AP)
  const npN = Math.sin(BETA) * Math.cos(AP)
  const npU = Math.cos(BETA)
  // Angulo de incidencia (diap. 13)
  const cosTheta = sE * npE + sN * npN + sU * npU
  const theta = Math.acos(Math.max(-1, Math.min(1, cosTheta)))
  return { elev, az, theta, aboveHorizon: sU > 0 }
}

// Coordenadas Three.js (diap. 29): x=Este, y=Arriba, z=Norte
function solarToXYZ(elev: number, az: number) {
  return {
    x: R * Math.cos(elev) * Math.sin(az),
    y: R * Math.sin(elev),
    z: R * Math.cos(elev) * Math.cos(az),
  }
}

function getHoraLabel(h: number): string {
  const hh = Math.floor(h)
  const mm  = Math.round((h - hh) * 60)
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
}

type SolarControls = {
  zoomIn: () => void
  zoomOut: () => void
  rotateLeft: () => void
  rotateRight: () => void
  rotateUp: () => void
  rotateDown: () => void
  reset: () => void
}

export function SolarScene() {
  const mountRef    = useRef<HTMLDivElement>(null)
  const controlsRef = useRef<SolarControls | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const disposeRef  = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!mountRef.current) return
    const container = mountRef.current

    import("three").then((THREE) => {
      if (!container) return
      const W = container.clientWidth
      const H = container.clientHeight

      // Renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setPixelRatio(window.devicePixelRatio)
      renderer.setSize(W, H)
      renderer.shadowMap.enabled = true
      container.appendChild(renderer.domElement)

      // Escena
      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x060a14)
      scene.fog = new THREE.FogExp2(0x060a14, 0.016)

      // Camara
      const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 200)

      // Luces
      scene.add(new THREE.AmbientLight(0x203060, 1.4))
      const dirLight = new THREE.DirectionalLight(0xfff5e0, 1.6)
      dirLight.position.set(8, 12, 6)
      scene.add(dirLight)

      // Plano base
      const baseMesh = new THREE.Mesh(
        new THREE.CircleGeometry(R + 2, 64),
        new THREE.MeshStandardMaterial({ color: 0x0d1520, roughness: 0.9 })
      )
      baseMesh.rotation.x = -Math.PI / 2
      scene.add(baseMesh)

      // Cupula superior
      scene.add(new THREE.Mesh(
        new THREE.SphereGeometry(R, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x0a1830, transparent: true, opacity: 0.15, side: THREE.DoubleSide })
      ))
      scene.add(new THREE.Mesh(
        new THREE.SphereGeometry(R, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x1a3060, wireframe: true, transparent: true, opacity: 0.18 })
      ))
      // Cupula inferior (nocturna)
      scene.add(new THREE.Mesh(
        new THREE.SphereGeometry(R, 48, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x0a1428, transparent: true, opacity: 0.28, side: THREE.DoubleSide })
      ))
      scene.add(new THREE.Mesh(
        new THREE.SphereGeometry(R, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x1a3a70, wireframe: true, transparent: true, opacity: 0.28 })
      ))

      // Etiquetas cardinales
      function makeLabel(text: string, pos: { x: number; y: number; z: number }) {
        const canvas = document.createElement("canvas")
        canvas.width = 128; canvas.height = 64
        const ctx = canvas.getContext("2d")!
        ctx.font = "bold 40px Segoe UI"
        ctx.fillStyle = "#6699ff"
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(text, 64, 32)
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true })
        )
        sprite.position.set(pos.x, pos.y, pos.z)
        sprite.scale.set(1.4, 0.7, 1)
        return sprite
      }
      scene.add(makeLabel("N", { x: 0,        y: 0.3, z: -(R + 0.8) }))
      scene.add(makeLabel("S", { x: 0,        y: 0.3, z:  (R + 0.8) }))
      scene.add(makeLabel("E", { x:  R + 0.8, y: 0.3, z: 0 }))
      scene.add(makeLabel("O", { x: -(R + 0.8), y: 0.3, z: 0 }))

      const cardMat = new THREE.LineBasicMaterial({ color: 0x1a3060, transparent: true, opacity: 0.5 });
      [[0,0,-R,0,0,R],[-R,0,0,R,0,0]].forEach((p) => {
        scene.add(new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(p[0],p[1],p[2]),
            new THREE.Vector3(p[3],p[4],p[5])
          ]),
          cardMat
        ))
      })

      // Modelo CPV
      const protoGroup = new THREE.Group()
      const darkMat  = new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.7, metalness: 0.3 })
      const metalMat = new THREE.MeshStandardMaterial({ color: 0x556677, roughness: 0.4, metalness: 0.7 })
      const glassMat = new THREE.MeshStandardMaterial({ color: 0x88aacc, transparent: true, opacity: 0.22, roughness: 0.05, side: THREE.DoubleSide })
      const panelMat = new THREE.MeshStandardMaterial({ color: 0x1a2a44, roughness: 0.5, metalness: 0.3, emissive: new THREE.Color(0x050e1e) })
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x334455, roughness: 0.5, metalness: 0.6 })

      const W2 = 2.8, D2 = 2.4, H2 = 0.18, wallH = 0.55, wallT = 0.05

      const body = new THREE.Mesh(new THREE.BoxGeometry(W2, H2, D2), darkMat)
      body.position.y = H2 / 2
      protoGroup.add(body)

      const topPlate = new THREE.Mesh(
        new THREE.BoxGeometry(W2, 0.04, D2),
        new THREE.MeshStandardMaterial({ color: 0x0d1018, roughness: 0.6, metalness: 0.4 })
      )
      topPlate.position.y = H2 + 0.02
      protoGroup.add(topPlate)

      const wallY = H2 + wallH / 2;
      [-(D2/2 - wallT/2), D2/2 - wallT/2].forEach((zp) => {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(W2, wallH, wallT), glassMat)
        wall.position.set(0, wallY, zp)
        protoGroup.add(wall)
      });
      [-(W2/2 - wallT/2), W2/2 - wallT/2].forEach((xp) => {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, D2), glassMat)
        wall.position.set(xp, wallY, 0)
        protoGroup.add(wall)
      });
      [[W2, wallT, 0, -(D2/2)],[W2, wallT, 0, D2/2],
       [wallT, D2, -(W2/2), 0],[wallT, D2, W2/2, 0]
      ].forEach(([fw, fd, xp, zp]) => {
        const fm = new THREE.Mesh(new THREE.BoxGeometry(fw, 0.05, fd), frameMat)
        fm.position.set(xp, H2 + wallH + 0.02, zp)
        protoGroup.add(fm)
      })

      function makeSolarPanel(width: number, height: number, nx: number, ny: number) {
        const group = new THREE.Group()
        group.add(new THREE.Mesh(new THREE.BoxGeometry(width + 0.06, height + 0.06, 0.04), metalMat))
        group.add(new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.03), panelMat))
        const cw = (width - 0.04) / nx
        const ch = (height - 0.04) / ny
        const gridMat = new THREE.MeshStandardMaterial({ color: 0x223366, roughness: 0.4, metalness: 0.2 })
        for (let i = 0; i < nx; i++) {
          for (let j = 0; j < ny; j++) {
            const cell = new THREE.Mesh(new THREE.BoxGeometry(cw - 0.015, ch - 0.015, 0.025), gridMat)
            cell.position.set(-width/2 + 0.02 + cw*(i+0.5), -height/2 + 0.02 + ch*(j+0.5), 0.01)
            group.add(cell)
          }
        }
        return group
      }

      const panelL = makeSolarPanel(0.55, 0.75, 3, 4)
      panelL.rotation.y = Math.PI / 2
      panelL.position.set(-(W2/2 + 0.04), H2 + wallH/2 + 0.02, 0)
      protoGroup.add(panelL)

      const panelR = makeSolarPanel(0.55, 0.75, 3, 4)
      panelR.rotation.y = -Math.PI / 2
      panelR.position.set(W2/2 + 0.04, H2 + wallH/2 + 0.02, 0)
      protoGroup.add(panelR);

      [[-W2/2+0.12,-D2/2+0.12],[W2/2-0.12,-D2/2+0.12],
       [-W2/2+0.12, D2/2-0.12],[W2/2-0.12, D2/2-0.12]
      ].forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 8), metalMat)
        leg.position.set(lx, 0.11, lz)
        protoGroup.add(leg)
      })

      protoGroup.rotation.x = BETA
      protoGroup.position.set(0, 1.4, 0)
      scene.add(protoGroup)

      // Normal del panel (diap. 12)
      const NP = new THREE.Vector3(
        Math.sin(BETA) * Math.sin(AP),
        Math.cos(BETA),
        Math.sin(BETA) * Math.cos(AP)
      ).normalize()
      scene.add(new THREE.ArrowHelper(NP, new THREE.Vector3(0, 1.9, 0), 2.0, 0x00ff88, 0.25, 0.12))

      // Sol / indicador nocturno
      const sunMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 16, 16),
        new THREE.MeshStandardMaterial({ color: 0xffe066, emissive: new THREE.Color(0xffaa00), emissiveIntensity: 1.5 })
      )
      const moonMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0xc0c8ff, emissive: new THREE.Color(0x8899ff), emissiveIntensity: 1.8 })
      )
      scene.add(sunMesh)
      scene.add(moonMesh)

      // Trayectoria
      let dayTube:   THREE.Mesh | null = null
      let nightLine: THREE.Line | null = null
      let pickSpheres: THREE.Mesh[] = []
      let trajectoryPts:  THREE.Vector3[] = []
      let trajectoryData: (ReturnType<typeof solarAngles> & { h: number })[] = []

      function clearTrajectory() {
        if (dayTube)   { scene.remove(dayTube);   dayTube.geometry.dispose();   dayTube = null }
        if (nightLine) { scene.remove(nightLine); nightLine.geometry.dispose(); nightLine = null }
        pickSpheres.forEach((s) => scene.remove(s))
        pickSpheres = []
      }

      function buildTrajectory(date: Date) {
        clearTrajectory()
        const n = dayOfYear(date)
        const pts: THREE.Vector3[] = []
        const data: (ReturnType<typeof solarAngles> & { h: number })[] = []

        for (let step = 0; step <= 288; step++) {
          const h = (step / 288) * 24
          const angles = solarAngles(n, h)
          const { x, y, z } = solarToXYZ(angles.elev, angles.az)
          pts.push(new THREE.Vector3(x, y, z))
          data.push({ ...angles, h })
        }
        trajectoryPts  = pts
        trajectoryData = data

        const dayPts = pts.filter((_, i) => data[i].aboveHorizon)
        if (dayPts.length > 3) {
          const curve = new THREE.CatmullRomCurve3(dayPts)
          dayTube = new THREE.Mesh(
            new THREE.TubeGeometry(curve, dayPts.length * 2, 0.04, 8, false),
            new THREE.MeshStandardMaterial({ color: 0xff8c00, emissive: new THREE.Color(0xcc4400), emissiveIntensity: 0.4, roughness: 0.4 })
          )
          scene.add(dayTube)
        }

        const nightPts = pts.filter((_, i) => !data[i].aboveHorizon)
        if (nightPts.length > 1) {
          nightLine = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(nightPts),
            new THREE.LineBasicMaterial({ color: 0x5588ff, transparent: true, opacity: 0.85 })
          )
          scene.add(nightLine)
        }

        for (let i = 0; i < pts.length; i += 1) {
          const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.18, 8, 8),
            new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })
          )
          mesh.position.copy(pts[i])
          mesh.userData = data[i]
          scene.add(mesh)
          pickSpheres.push(mesh)
        }
      }

      // Posicion del sol actual
      let incidentLine: THREE.Line | null = null

      function updateSunPosition() {
        const now  = new Date()
        const hNow = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600
        let bestIdx = 0, bestDiff = Infinity
        for (let i = 0; i < trajectoryData.length; i++) {
          const diff = Math.abs(trajectoryData[i].h - hNow)
          if (diff < bestDiff) { bestDiff = diff; bestIdx = i }
        }
        const pt = trajectoryPts[bestIdx]
        const d  = trajectoryData[bestIdx]
        if (!pt || !d) return

        if (d.aboveHorizon) {
          sunMesh.position.copy(pt); sunMesh.visible = true; moonMesh.visible = false
          dirLight.position.copy(pt)
        } else {
          moonMesh.position.copy(pt); moonMesh.visible = true; sunMesh.visible = false
        }

        if (incidentLine) scene.remove(incidentLine)
        if (d.aboveHorizon) {
          incidentLine = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([pt.clone(), new THREE.Vector3(0, 1.9, 0)]),
            new THREE.LineBasicMaterial({ color: 0xffee88, transparent: true, opacity: 0.45 })
          )
          scene.add(incidentLine)
        }
      }

      buildTrajectory(new Date())
      updateSunPosition()

      // Orbit controls
      let isDragging = false, prevX = 0, prevY = 0
      let theta2 = 0.8, phi2 = 0.42, radius2 = 18
      const DEFAULT_THETA = 0.8, DEFAULT_PHI = 0.42, DEFAULT_RADIUS = 18

      function updateCamera() {
        camera.position.set(
          radius2 * Math.sin(phi2) * Math.sin(theta2),
          radius2 * Math.cos(phi2),
          radius2 * Math.sin(phi2) * Math.cos(theta2)
        )
        camera.lookAt(0, 1.6, 0)
      }
      updateCamera()

      renderer.domElement.addEventListener("mousedown", (e) => {
        isDragging = true; prevX = e.clientX; prevY = e.clientY
      })
      window.addEventListener("mouseup", () => { isDragging = false })
      renderer.domElement.addEventListener("mousemove", (e) => {
        if (isDragging) {
          theta2 -= (e.clientX - prevX) * 0.008
          phi2 = Math.max(0.05, Math.min(Math.PI / 2.1, phi2 + (e.clientY - prevY) * 0.008))
          prevX = e.clientX; prevY = e.clientY
          updateCamera()
        }
        handleHover(e)
      })
      // Prevenir scroll de pagina al hacer zoom en el canvas
      renderer.domElement.addEventListener("wheel", (e) => {
        e.preventDefault()
        radius2 = Math.max(6, Math.min(40, radius2 + e.deltaY * 0.03))
        updateCamera()
      }, { passive: false })

      // Exponer controles para botones React
      controlsRef.current = {
        zoomIn:      () => { radius2 = Math.max(6,  radius2 - 1.5); updateCamera() },
        zoomOut:     () => { radius2 = Math.min(40, radius2 + 1.5); updateCamera() },
        rotateLeft:  () => { theta2 -= 0.2; updateCamera() },
        rotateRight: () => { theta2 += 0.2; updateCamera() },
        rotateUp:    () => { phi2 = Math.max(0.05, phi2 - 0.12); updateCamera() },
        rotateDown:  () => { phi2 = Math.min(Math.PI / 2.1, phi2 + 0.12); updateCamera() },
        reset:       () => { theta2 = DEFAULT_THETA; phi2 = DEFAULT_PHI; radius2 = DEFAULT_RADIUS; updateCamera() },
      }

      // Raycasting / Tooltip
      const raycaster = new THREE.Raycaster()
      const mouse     = new THREE.Vector2()

      function handleHover(e: MouseEvent) {
        const tooltipEl = container.parentElement?.querySelector<HTMLDivElement>("[data-solar-tooltip]")
        if (!tooltipEl) return

        const rect = renderer.domElement.getBoundingClientRect()
        mouse.x =  ((e.clientX - rect.left)  / rect.width)  * 2 - 1
        mouse.y = -((e.clientY - rect.top)   / rect.height) * 2 + 1
        raycaster.setFromCamera(mouse, camera)
        const hits = raycaster.intersectObjects(pickSpheres)

        if (hits.length > 0) {
          const d = hits[0].object.userData as ReturnType<typeof solarAngles> & { h: number }
          tooltipEl.querySelector<HTMLElement>("[data-tt-title]")!.textContent =
            d.aboveHorizon ? "Sol" : "Nocturno"
          tooltipEl.querySelector<HTMLElement>("[data-tt-hora]")!.textContent  = getHoraLabel(d.h)
          tooltipEl.querySelector<HTMLElement>("[data-tt-elev]")!.textContent  = (d.elev  * 180 / Math.PI).toFixed(2) + "\u00b0"
          tooltipEl.querySelector<HTMLElement>("[data-tt-az]")!.textContent    = (d.az    * 180 / Math.PI).toFixed(2) + "\u00b0"
          tooltipEl.querySelector<HTMLElement>("[data-tt-theta]")!.textContent =
            d.aboveHorizon ? (d.theta * 180 / Math.PI).toFixed(2) + "\u00b0" : "\u2014"
          tooltipEl.style.display = "block"
          const ttW = tooltipEl.offsetWidth  || 180
          const ttH = tooltipEl.offsetHeight || 110
          const relX = e.clientX - rect.left
          const relY = e.clientY - rect.top
          tooltipEl.style.left = (relX + ttW + 20 > rect.width  ? relX - ttW - 8 : relX + 16) + "px"
          tooltipEl.style.top  = (relY - ttH - 8 < 0            ? relY + 16      : relY - ttH - 8) + "px"
        } else {
          tooltipEl.style.display = "none"
        }
      }

      // Render loop
      let animId: number
      function animate() {
        animId = requestAnimationFrame(animate)
        renderer.render(scene, camera)
      }
      animate()

      let lastDay = new Date().getDate()
      intervalRef.current = setInterval(() => {
        const now = new Date()
        if (now.getDate() !== lastDay) {
          lastDay = now.getDate()
          buildTrajectory(now)
        }
        updateSunPosition()
      }, 30_000)

      function onResize() {
        if (!container) return
        const W = container.clientWidth
        const H = container.clientHeight
        camera.aspect = W / H
        camera.updateProjectionMatrix()
        renderer.setSize(W, H)
      }
      window.addEventListener("resize", onResize)

      disposeRef.current = () => {
        cancelAnimationFrame(animId)
        window.removeEventListener("resize", onResize)
        window.removeEventListener("mouseup", () => { isDragging = false })
        renderer.dispose()
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement)
        }
      }
    })

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      disposeRef.current?.()
    }
  }, [])

  const btnClass =
    "flex items-center justify-center w-8 h-8 rounded-md border border-border bg-card/80 text-muted-foreground hover:bg-muted hover:text-card-foreground transition-colors backdrop-blur-sm"

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-card-foreground">Posicion Solar 3D</span>
          <span className="text-xs text-muted-foreground">San Juan del Rio | beta=21 | Az=180</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-5 h-0.5 bg-orange-500 rounded" />
            Diurna
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-5 h-0.5 bg-blue-400 rounded opacity-80" />
            Nocturna
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-300" />
            Sol actual
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
            Normal panel
          </span>
        </div>
      </div>

      {/* Canvas container */}
      <div className="relative" style={{ height: 420 }}>
        <div ref={mountRef} className="w-full h-full" />

        {/* Tooltip */}
        <div
          data-solar-tooltip
          className="absolute pointer-events-none z-10 rounded-lg border border-yellow-500/40 bg-card/95 px-3 py-2 text-xs shadow-lg min-w-[170px]"
          style={{ display: "none" }}
        >
          <div className="font-bold text-yellow-400 mb-1.5 flex items-center gap-1">
            <span>&#9728;</span>
            <span data-tt-title />
          </div>
          <div className="flex justify-between gap-4 text-muted-foreground">
            <span>Hora</span>
            <span data-tt-hora className="font-semibold text-card-foreground" />
          </div>
          <div className="flex justify-between gap-4 text-muted-foreground">
            <span>Elevacion</span>
            <span data-tt-elev className="font-semibold text-card-foreground" />
          </div>
          <div className="flex justify-between gap-4 text-muted-foreground">
            <span>Azimut</span>
            <span data-tt-az className="font-semibold text-card-foreground" />
          </div>
          <div className="flex justify-between gap-4 text-muted-foreground">
            <span>Angulo Ti</span>
            <span data-tt-theta className="font-semibold text-card-foreground" />
          </div>
        </div>

        {/* Botones de control */}
        <div className="absolute bottom-8 right-3 flex flex-col gap-1 z-10">
          {/* Zoom */}
          <button className={btnClass} onClick={() => controlsRef.current?.zoomIn()} title="Acercar">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button className={btnClass} onClick={() => controlsRef.current?.zoomOut()} title="Alejar">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          {/* Separador */}
          <div className="h-px bg-border my-0.5" />

          {/* Rotacion vertical */}
          <button className={btnClass} onClick={() => controlsRef.current?.rotateUp()} title="Rotar arriba">
            <ChevronUp className="w-3.5 h-3.5" />
          </button>

          {/* Rotacion horizontal */}
          <div className="flex gap-1">
            <button className={btnClass} onClick={() => controlsRef.current?.rotateLeft()} title="Rotar izquierda">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button className={btnClass} onClick={() => controlsRef.current?.rotateRight()} title="Rotar derecha">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <button className={btnClass} onClick={() => controlsRef.current?.rotateDown()} title="Rotar abajo">
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {/* Reset */}
          <div className="h-px bg-border my-0.5" />
          <button className={btnClass} onClick={() => controlsRef.current?.reset()} title="Restablecer vista">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Hint */}
        <p className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-muted-foreground/50 pointer-events-none whitespace-nowrap">
          Arrastra para rotar | Scroll para zoom | Pasa el cursor sobre la trayectoria para ver datos
        </p>
      </div>
    </div>
  )
}