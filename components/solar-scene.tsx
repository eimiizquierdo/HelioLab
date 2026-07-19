"use client"

import { useEffect, useRef, useState } from "react"
import { ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Settings, X, Save, RefreshCcw } from "lucide-react"

const AP_DEG  = 180
const D2R     = Math.PI / 180
const R       = 8
// GRENA constantes de refraccion atmosferica
const PRESSURE = 1.013   // atm
const TEMP     = 25.0    // Celsius
const DTAU     = 69.0    // Delta T [segundos] TT-UT1 (2026)

// Modulo de fmod para JS
function fmod(a: number, b: number): number {
  return a - Math.floor(a / b) * b
}

// GRENA algoritmo 3 — Grena, R. (2012) Solar Energy 82(3), 462-470
// Precision tipica ~0.01 grado, valido 2010-2110
// Mantiene la misma firma que la funcion anterior para no cambiar nada mas
function solarAngles(
  n: number,    // dia del año (se usa para obtener año/mes/dia junto con date)
  h: number,    // hora local decimal
  lat: number,
  lon: number,
  tz: number,
  beta: number,
  date?: Date
) {
  // Usamos date si viene, si no usamos fecha actual
  const ref   = date ?? new Date()
  const year  = ref.getFullYear()
  let   month = ref.getMonth() + 1
  const day   = ref.getDate()

  // Suprimir warning de n no usado
  void n

  // 1. Hora en UTC (h es hora local decimal)
  const hUTC = h - tz

  // 2. t — dias desde epoca J2000 (aprox)
  let mo = month, yr = year
  if (mo < 3) { mo += 12; yr -= 1 }
  const t = Math.floor(365.25 * (yr - 2000))
          + Math.floor(30.6001 * (mo + 1))
          - Math.floor(0.01 * yr)
          + day + hUTC / 24.0 - 21958.0

  // 3. te — tiempo terrestre
  const te = t + DTAU / 86400.0

  // 4. Longitud ecliptica (GRENA alg. 3)
  const wa    = 0.0172019715
  const lamda = -1.388803
              + 1.720279216e-2 * te
              + 3.3366e-2 * Math.sin(wa * te - 0.06172)
              + 3.53e-4   * Math.sin(2.0 * wa * te - 0.1163)
  const epsilon = 0.4089567 - 6.19e-9 * te

  // 5. Ascension recta y declinacion
  let alpha = Math.atan2(Math.sin(lamda) * Math.cos(epsilon), Math.cos(lamda))
  alpha = fmod(alpha, 2.0 * Math.PI)
  if (alpha < 0) alpha += 2.0 * Math.PI
  const delta = Math.asin(Math.sin(lamda) * Math.sin(epsilon))

  // 6. Angulo horario
  let H = 1.7528311 + 6.300388099 * t + lon * D2R - alpha
  H = fmod(H + Math.PI, 2.0 * Math.PI) - Math.PI
  if (H < -Math.PI) H += 2.0 * Math.PI

  // 7. Elevacion geometrica
  const latR = lat * D2R
  const sinE = Math.sin(latR) * Math.sin(delta) + Math.cos(latR) * Math.cos(delta) * Math.cos(H)
  const e0   = Math.asin(Math.max(-1, Math.min(1, sinE)))

  // 8. Refraccion atmosferica
  const ep = e0 - 4.26e-5 * Math.cos(e0)
  const er = ep > 0
    ? 0.08422 * PRESSURE / (273.0 + TEMP) / Math.tan(ep + 0.003138 / (ep + 0.08919))
    : 0.0
  const zenith = Math.PI / 2.0 - ep - er
  const elev   = Math.PI / 2.0 - zenith

  // 9. Azimut: 0=Norte, positivo al Este (mismo convenio que antes)
  let az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(latR) - Math.tan(delta) * Math.cos(latR))
  if (az < 0) az += 2.0 * Math.PI

  // 10. Angulo de incidencia sobre el panel (beta = inclinacion, Ap=180 = sur)
  // Vector solar ENU: sE, sN, sU
  const sE =  Math.cos(elev) * Math.sin(az)       // Este
  const sN = -Math.cos(elev) * Math.cos(az)       // Norte (az=0 es Norte, cos(0)=1 → Norte positivo)
  const sU =  Math.sin(elev)                      // Cenit
  // Normal del panel en ENU (Ap=180 sur, beta inclinacion)
  const bR  = beta * D2R
  const npE =  0.0
  const npN = -Math.sin(bR)
  const npU =  Math.cos(bR)
  const cosTheta = sE * npE + sN * npN + sU * npU
  const theta = Math.acos(Math.max(-1, Math.min(1, cosTheta)))

  return { elev, az, theta, aboveHorizon: elev > 0 }
}

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

function skyColor(elevDeg: number): string {
  if (elevDeg < -12) return "#020510"
  if (elevDeg < -6)  return "#060d1f"
  if (elevDeg < 0)   return "#0d1a3a"
  if (elevDeg < 4)   return "#1a2a5a"
  if (elevDeg < 10)  return "#b05a1a"
  if (elevDeg < 18)  return "#d4814a"
  if (elevDeg < 30)  return "#6090c8"
  return "#4a7abf"
}

type SolarConfig = { lat: number; lon: number; timezone: number; beta: number }
type SolarControls = {
  zoomIn: () => void; zoomOut: () => void
  rotateLeft: () => void; rotateRight: () => void
  rotateUp: () => void; rotateDown: () => void
  reset: () => void
  setDate: (date: Date) => void
  setConfig: (cfg: SolarConfig) => void
}

interface SolarSceneProps {
  selectedDate?: Date
  defaultConfig?: SolarConfig
  prototypeId: string
  currentUserId: string
  ownerId: string
}

export function SolarScene({ selectedDate, defaultConfig, prototypeId, currentUserId, ownerId }: SolarSceneProps) {
  const mountRef    = useRef<HTMLDivElement>(null)
  const controlsRef = useRef<SolarControls | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const disposeRef  = useRef<(() => void) | null>(null)

  // Panel de variables
  const [showPanel, setShowPanel]   = useState(false)
  const EMPTY_CONFIG: SolarConfig = { lat: 0, lon: 0, timezone: 0, beta: 0 }
  const [formValues, setFormValues] = useState<SolarConfig>(defaultConfig ?? EMPTY_CONFIG)
  const [saving, setSaving]         = useState(false)
  const [saveMsg, setSaveMsg]       = useState("")

  const isOwner = currentUserId === ownerId

  // Aplicar cambios temporales al grafico
  function handleApply() {
    controlsRef.current?.setConfig(formValues)
    setShowPanel(false)
  }

  // Restaurar valores del prototipo
  function handleRestore() {
    setFormValues(defaultConfig ?? EMPTY_CONFIG)
    controlsRef.current?.setConfig(defaultConfig ?? EMPTY_CONFIG)
    controlsRef.current?.reset()
    setShowPanel(false)
  }

  // Guardar en Firestore (solo dueno)
  async function handleSave() {
    setSaving(true)
    setSaveMsg("")
    try {
      const res = await fetch(`/api/prototype/${prototypeId}/update_solar_config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId, ...formValues }),
      })
      if (res.ok) {
        setSaveMsg("Guardado correctamente")
        controlsRef.current?.setConfig(formValues)
      } else {
        setSaveMsg("Error al guardar")
      }
    } catch {
      setSaveMsg("Error de conexion")
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (!mountRef.current) return
    const container = mountRef.current

    import("three").then((THREE) => {
      if (!container) return
      const W = container.clientWidth
      const H = container.clientHeight

      const renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setPixelRatio(window.devicePixelRatio)
      renderer.setSize(W, H)
      container.appendChild(renderer.domElement)

      const scene  = new THREE.Scene()
      scene.background = new THREE.Color(0x020510)
      const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 200)

      scene.add(new THREE.AmbientLight(0x203060, 1.4))
      const dirLight = new THREE.DirectionalLight(0xfff5e0, 1.6)
      dirLight.position.set(8, 12, 6)
      scene.add(dirLight)

      // Plano base
      const base = new THREE.Mesh(
        new THREE.CircleGeometry(R + 2, 64),
        new THREE.MeshStandardMaterial({ color: 0x0d1520, roughness: 0.9 })
      )
      base.rotation.x = -Math.PI / 2
      scene.add(base)

      // Cupulas
      scene.add(new THREE.Mesh(new THREE.SphereGeometry(R,48,24,0,Math.PI*2,0,Math.PI/2),
        new THREE.MeshBasicMaterial({ color:0x0a1830, transparent:true, opacity:0.15, side:THREE.DoubleSide })))
      scene.add(new THREE.Mesh(new THREE.SphereGeometry(R,24,12,0,Math.PI*2,0,Math.PI/2),
        new THREE.MeshBasicMaterial({ color:0x1a3060, wireframe:true, transparent:true, opacity:0.18 })))
      scene.add(new THREE.Mesh(new THREE.SphereGeometry(R,48,24,0,Math.PI*2,Math.PI/2,Math.PI/2),
        new THREE.MeshBasicMaterial({ color:0x0a1428, transparent:true, opacity:0.28, side:THREE.DoubleSide })))
      scene.add(new THREE.Mesh(new THREE.SphereGeometry(R,24,12,0,Math.PI*2,Math.PI/2,Math.PI/2),
        new THREE.MeshBasicMaterial({ color:0x1a3a70, wireframe:true, transparent:true, opacity:0.28 })))

      // Etiquetas
      function makeLabel(text: string, pos: {x:number;y:number;z:number}) {
        const canvas = document.createElement("canvas")
        canvas.width = 128; canvas.height = 64
        const ctx = canvas.getContext("2d")!
        ctx.font = "bold 40px Segoe UI"; ctx.fillStyle = "#6699ff"
        ctx.textAlign = "center"; ctx.textBaseline = "middle"
        ctx.fillText(text, 64, 32)
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent:true }))
        sprite.position.set(pos.x,pos.y,pos.z); sprite.scale.set(1.4,0.7,1)
        return sprite
      }
      scene.add(makeLabel("N",{x:0,      y:0.3,z:-(R+0.8)}))
      scene.add(makeLabel("S",{x:0,      y:0.3,z: (R+0.8)}))
      scene.add(makeLabel("E",{x: R+0.8, y:0.3,z:0}))
      scene.add(makeLabel("O",{x:-(R+0.8),y:0.3,z:0}))

      const cardMat = new THREE.LineBasicMaterial({ color:0x1a3060, transparent:true, opacity:0.5 });
      [[0,0,-R,0,0,R],[-R,0,0,R,0,0]].forEach(p => {
        scene.add(new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(p[0],p[1],p[2]),new THREE.Vector3(p[3],p[4],p[5])]),
          cardMat
        ))
      })

      // Modelo CPV
      const protoGroup = new THREE.Group()
      const darkMat  = new THREE.MeshStandardMaterial({ color:0x111318, roughness:0.7, metalness:0.3 })
      const metalMat = new THREE.MeshStandardMaterial({ color:0x556677, roughness:0.4, metalness:0.7 })
      const glassMat = new THREE.MeshStandardMaterial({ color:0x88aacc, transparent:true, opacity:0.22, roughness:0.05, side:THREE.DoubleSide })
      const panelMat = new THREE.MeshStandardMaterial({ color:0x1a2a44, roughness:0.5, metalness:0.3, emissive:new THREE.Color(0x050e1e) })
      const frameMat = new THREE.MeshStandardMaterial({ color:0x334455, roughness:0.5, metalness:0.6 })
      const W2=2.8, D2=2.4, H2=0.18, wallH=0.55, wallT=0.05

      const body = new THREE.Mesh(new THREE.BoxGeometry(W2,H2,D2), darkMat)
      body.position.y = H2/2; protoGroup.add(body)
      const topPlate = new THREE.Mesh(new THREE.BoxGeometry(W2,0.04,D2),
        new THREE.MeshStandardMaterial({ color:0x0d1018, roughness:0.6, metalness:0.4 }))
      topPlate.position.y = H2+0.02; protoGroup.add(topPlate)

      const wallY = H2+wallH/2;
      [-(D2/2-wallT/2), D2/2-wallT/2].forEach(zp => {
        const w = new THREE.Mesh(new THREE.BoxGeometry(W2,wallH,wallT),glassMat); w.position.set(0,wallY,zp); protoGroup.add(w)
      });
      [-(W2/2-wallT/2), W2/2-wallT/2].forEach(xp => {
        const w = new THREE.Mesh(new THREE.BoxGeometry(wallT,wallH,D2),glassMat); w.position.set(xp,wallY,0); protoGroup.add(w)
      });
      [[W2,wallT,0,-(D2/2)],[W2,wallT,0,D2/2],[wallT,D2,-(W2/2),0],[wallT,D2,W2/2,0]].forEach(([fw,fd,xp,zp]) => {
        const fm = new THREE.Mesh(new THREE.BoxGeometry(fw,0.05,fd),frameMat); fm.position.set(xp,H2+wallH+0.02,zp); protoGroup.add(fm)
      })

      function makeSolarPanel(width:number, height:number, nx:number, ny:number) {
        const g = new THREE.Group()
        g.add(new THREE.Mesh(new THREE.BoxGeometry(width+0.06,height+0.06,0.04),metalMat))
        g.add(new THREE.Mesh(new THREE.BoxGeometry(width,height,0.03),panelMat))
        const cw=(width-0.04)/nx, ch=(height-0.04)/ny
        const gm = new THREE.MeshStandardMaterial({ color:0x223366, roughness:0.4, metalness:0.2 })
        for(let i=0;i<nx;i++) for(let j=0;j<ny;j++) {
          const c = new THREE.Mesh(new THREE.BoxGeometry(cw-0.015,ch-0.015,0.025),gm)
          c.position.set(-width/2+0.02+cw*(i+0.5),-height/2+0.02+ch*(j+0.5),0.01); g.add(c)
        }
        return g
      }

      const pL = makeSolarPanel(0.55,0.75,3,4)
      pL.rotation.y = Math.PI/2; pL.position.set(-(W2/2+0.04),H2+wallH/2+0.02,0); protoGroup.add(pL)
      const pR = makeSolarPanel(0.55,0.75,3,4)
      pR.rotation.y = -Math.PI/2; pR.position.set(W2/2+0.04,H2+wallH/2+0.02,0); protoGroup.add(pR);
      [[-W2/2+0.12,-D2/2+0.12],[W2/2-0.12,-D2/2+0.12],[-W2/2+0.12,D2/2-0.12],[W2/2-0.12,D2/2-0.12]].forEach(([lx,lz]) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.22,8),metalMat)
        leg.position.set(lx,0.11,lz); protoGroup.add(leg)
      })

      // Config activa (mutable desde botones)
      let cfg: SolarConfig = { ...(defaultConfig ?? EMPTY_CONFIG) }

      const BETA = cfg.beta * D2R
      const AP   = AP_DEG  * D2R
      protoGroup.rotation.x = BETA
      protoGroup.position.set(0,1.4,0)
      scene.add(protoGroup)

      // Flecha normal (se recrea al cambiar beta)
      let normalArrow: THREE.ArrowHelper | null = null
      function updateNormalArrow() {
        if (normalArrow) scene.remove(normalArrow)
        const b = cfg.beta * D2R
        const NP = new THREE.Vector3(
          Math.sin(b)*Math.sin(AP), Math.cos(b), Math.sin(b)*Math.cos(AP)
        ).normalize()
        normalArrow = new THREE.ArrowHelper(NP, new THREE.Vector3(0,1.9,0), 2.0, 0x00ff88, 0.25, 0.12)
        scene.add(normalArrow)
      }
      updateNormalArrow()

      // Sol y luna
      const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(0.35,16,16),
        new THREE.MeshStandardMaterial({ color:0xffe066, emissive:new THREE.Color(0xffaa00), emissiveIntensity:1.8 }))
      const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(0.18,12,12),
        new THREE.MeshStandardMaterial({ color:0xc0c8ff, emissive:new THREE.Color(0x8899ff), emissiveIntensity:1.8 }))
      scene.add(sunMesh); scene.add(moonMesh)

      // Trayectoria
      let dayTube:    THREE.Mesh | null = null
      let nightLine:  THREE.Line | null = null
      let pickSpheres: THREE.Mesh[] = []
      let trajectoryPts:  THREE.Vector3[] = []
      let trajectoryData: (ReturnType<typeof solarAngles> & { h: number })[] = []

      function clearTrajectory() {
        if (dayTube)   { scene.remove(dayTube);   dayTube.geometry.dispose();   dayTube=null }
        if (nightLine) { scene.remove(nightLine); nightLine.geometry.dispose(); nightLine=null }
        pickSpheres.forEach(s => scene.remove(s)); pickSpheres=[]
      }

      function buildTrajectory(date: Date) {
        clearTrajectory()
        const n = dayOfYear(date)
        const pts: THREE.Vector3[] = []
        const data: (ReturnType<typeof solarAngles> & { h:number })[] = []
        for (let step=0; step<=288; step++) {
          const h = (step/288)*24
          const angles = solarAngles(n, h, cfg.lat, cfg.lon, cfg.timezone, cfg.beta)
          const {x,y,z} = solarToXYZ(angles.elev, angles.az)
          pts.push(new THREE.Vector3(x,y,z))
          data.push({...angles, h})
        }
        trajectoryPts=pts; trajectoryData=data

        const dayPts = pts.filter((_,i) => data[i].aboveHorizon)
        if (dayPts.length>3) {
          const curve = new THREE.CatmullRomCurve3(dayPts)
          dayTube = new THREE.Mesh(
            new THREE.TubeGeometry(curve, dayPts.length*2, 0.04, 8, false),
            new THREE.MeshStandardMaterial({ color:0xff8c00, emissive:new THREE.Color(0xcc4400), emissiveIntensity:0.4, roughness:0.4 })
          )
          scene.add(dayTube)
        }
        const nightPts = pts.filter((_,i) => !data[i].aboveHorizon)
        if (nightPts.length>1) {
          nightLine = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(nightPts),
            new THREE.LineBasicMaterial({ color:0x5588ff, transparent:true, opacity:0.85 })
          )
          scene.add(nightLine)
        }
        for (let i=0; i<pts.length; i++) {
          const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.10,6,6),
            new THREE.MeshBasicMaterial({ transparent:true, opacity:0 }))
          mesh.position.copy(pts[i]); mesh.userData=data[i]
          scene.add(mesh); pickSpheres.push(mesh)
        }
      }

      let activeDate = new Date()
      let incidentLine: THREE.Line | null = null

      function updateSunPosition() {
        const now  = new Date()
        const hNow = now.getHours() + now.getMinutes()/60 + now.getSeconds()/3600
        const todayN   = dayOfYear(now)
        const todayAng = solarAngles(todayN, hNow, cfg.lat, cfg.lon, cfg.timezone, cfg.beta)
        scene.background = new THREE.Color(skyColor(todayAng.elev * 180/Math.PI))

        let bestIdx=0, bestDiff=Infinity
        for (let i=0; i<trajectoryData.length; i++) {
          const diff = Math.abs(trajectoryData[i].h - hNow)
          if (diff<bestDiff) { bestDiff=diff; bestIdx=i }
        }
        const pt = trajectoryPts[bestIdx]
        const d  = trajectoryData[bestIdx]
        if (!pt||!d) return

        if (d.aboveHorizon) {
          sunMesh.position.copy(pt); sunMesh.visible=true; moonMesh.visible=false
          dirLight.position.copy(pt)
        } else {
          moonMesh.position.copy(pt); moonMesh.visible=true; sunMesh.visible=false
        }
        if (incidentLine) scene.remove(incidentLine)
        if (d.aboveHorizon) {
          incidentLine = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([pt.clone(), new THREE.Vector3(0,1.9,0)]),
            new THREE.LineBasicMaterial({ color:0xffee88, transparent:true, opacity:0.45 })
          )
          scene.add(incidentLine)
        }
      }

      buildTrajectory(new Date())
      updateSunPosition()

      // Orbit controls
      let isDragging=false, prevX=0, prevY=0
      let theta2=0.8, phi2=0.42, radius2=18
      const DT=0.8, DP=0.42, DR=18

      function updateCamera() {
        camera.position.set(
          radius2*Math.sin(phi2)*Math.sin(theta2),
          radius2*Math.cos(phi2),
          radius2*Math.sin(phi2)*Math.cos(theta2)
        )
        camera.lookAt(0,1.6,0)
      }
      updateCamera()

      renderer.domElement.addEventListener("mousedown", e => { isDragging=true; prevX=e.clientX; prevY=e.clientY })
      window.addEventListener("mouseup", () => { isDragging=false })
      renderer.domElement.addEventListener("mousemove", e => {
        if (isDragging) {
          theta2 -= (e.clientX-prevX)*0.008
          phi2 = Math.max(0.05, Math.min(Math.PI/2.1, phi2+(e.clientY-prevY)*0.008))
          prevX=e.clientX; prevY=e.clientY; updateCamera()
        }
        handleHover(e)
      })
      renderer.domElement.addEventListener("wheel", e => {
        e.preventDefault()
        radius2 = Math.max(6, Math.min(40, radius2+e.deltaY*0.03))
        updateCamera()
      }, { passive:false })

      controlsRef.current = {
        zoomIn:      () => { radius2=Math.max(6,  radius2-1.5); updateCamera() },
        zoomOut:     () => { radius2=Math.min(40, radius2+1.5); updateCamera() },
        rotateLeft:  () => { theta2-=0.2; updateCamera() },
        rotateRight: () => { theta2+=0.2; updateCamera() },
        rotateUp:    () => { phi2=Math.max(0.05, phi2-0.12); updateCamera() },
        rotateDown:  () => { phi2=Math.min(Math.PI/2.1, phi2+0.12); updateCamera() },
        reset:       () => { theta2=DT; phi2=DP; radius2=DR; updateCamera() },
        setDate:     (date:Date) => { activeDate=date; buildTrajectory(date); updateSunPosition() },
        setConfig:   (newCfg:SolarConfig) => {
          cfg = { ...newCfg }
          // Actualizar inclinacion del prototipo
          protoGroup.rotation.x = cfg.beta * D2R
          updateNormalArrow()
          buildTrajectory(activeDate)
          updateSunPosition()
        },
      }

      // Raycasting / Tooltip
      const raycaster = new THREE.Raycaster()
      const mouse     = new THREE.Vector2()

      function handleHover(e: MouseEvent) {
        const tooltipEl = container.parentElement?.querySelector<HTMLDivElement>("[data-solar-tooltip]")
        if (!tooltipEl) return
        const rect = renderer.domElement.getBoundingClientRect()
        mouse.x =  ((e.clientX-rect.left)/rect.width) *2-1
        mouse.y = -((e.clientY-rect.top) /rect.height)*2+1
        raycaster.setFromCamera(mouse, camera)
        const hits = raycaster.intersectObjects(pickSpheres)
        if (hits.length>0) {
          const d = hits[0].object.userData as ReturnType<typeof solarAngles> & { h:number }
          tooltipEl.querySelector<HTMLElement>("[data-tt-title]")!.textContent = d.aboveHorizon ? "Sol" : "Nocturno"
          tooltipEl.querySelector<HTMLElement>("[data-tt-hora]")!.textContent  = getHoraLabel(d.h)
          tooltipEl.querySelector<HTMLElement>("[data-tt-elev]")!.textContent  = (d.elev *180/Math.PI).toFixed(2)+"\u00b0"
          tooltipEl.querySelector<HTMLElement>("[data-tt-az]")!.textContent    = (d.az   *180/Math.PI).toFixed(2)+"\u00b0"
          tooltipEl.querySelector<HTMLElement>("[data-tt-theta]")!.textContent =
            d.aboveHorizon ? (d.theta*180/Math.PI).toFixed(2)+"\u00b0" : "\u2014"
          const ttW=tooltipEl.offsetWidth||180, ttH=tooltipEl.offsetHeight||110
          const relX=e.clientX-rect.left, relY=e.clientY-rect.top
          tooltipEl.style.left = (relX+ttW+20>rect.width ? relX-ttW-8 : relX+16)+"px"
          tooltipEl.style.top  = (relY-ttH-8<0           ? relY+16    : relY-ttH-8)+"px"
          tooltipEl.style.display = "block"
        } else {
          tooltipEl.style.display = "none"
        }
      }

      let animId: number
      function animate() { animId=requestAnimationFrame(animate); renderer.render(scene,camera) }
      animate()

      let lastDay = new Date().getDate()
      intervalRef.current = setInterval(() => {
        const now = new Date()
        if (now.getDate()!==lastDay) { lastDay=now.getDate(); buildTrajectory(now) }
        updateSunPosition()
      }, 30_000)

      function onResize() {
        if (!container) return
        const W=container.clientWidth, H=container.clientHeight
        camera.aspect=W/H; camera.updateProjectionMatrix(); renderer.setSize(W,H)
      }
      window.addEventListener("resize", onResize)

      disposeRef.current = () => {
        cancelAnimationFrame(animId)
        window.removeEventListener("resize", onResize)
        renderer.dispose()
        if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
      }
    })

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      disposeRef.current?.()
    }
  }, [])

  useEffect(() => {
    if (selectedDate && controlsRef.current) controlsRef.current.setDate(selectedDate)
  }, [selectedDate])

  if (!defaultConfig) return (
    <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
      Este prototipo no tiene configuracion solar. Contacta al administrador.</div>
  )

  const inputClass = "w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
  const btnClass   = "flex items-center justify-center w-8 h-8 rounded-md border border-border bg-card/80 text-muted-foreground hover:bg-muted hover:text-card-foreground transition-colors backdrop-blur-sm"

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-card-foreground">Posicion Solar 3D</span>
          <span className="text-xs text-muted-foreground">
            lat {defaultConfig?.lat ?? "—"} | lon {defaultConfig?.lon ?? "—"} | beta={defaultConfig?.beta ?? "—"} | TZ={defaultConfig?.timezone ?? "—"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="inline-block w-5 h-0.5 bg-orange-500 rounded" />Diurna</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-5 h-0.5 bg-blue-400 rounded opacity-80" />Nocturna</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-300" />Sol</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-green-400" />Normal</span>
          </div>
          {/* Boton modificar variables */}
          <button
            onClick={() => { setShowPanel(p => !p); setSaveMsg("") }}
            className="flex items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            Modificar variables
          </button>
        </div>
      </div>

      {/* Panel de variables */}
      {showPanel && (
        <div className="border-b border-border bg-muted/40 px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-foreground">Variables del modelo solar</span>
            <button onClick={() => setShowPanel(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Latitud (phi)</label>
              <input type="number" step="0.01" value={formValues.lat}
                onChange={e => setFormValues(v => ({ ...v, lat: parseFloat(e.target.value) }))}
                className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Longitud (lambda)</label>
              <input type="number" step="0.01" value={formValues.lon}
                onChange={e => setFormValues(v => ({ ...v, lon: parseFloat(e.target.value) }))}
                className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Zona horaria (TZ)</label>
              <input type="number" step="1" value={formValues.timezone}
                onChange={e => setFormValues(v => ({ ...v, timezone: parseInt(e.target.value) }))}
                className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Inclinacion beta (deg)</label>
              <input type="number" step="0.5" min="0" max="90" value={formValues.beta}
                onChange={e => setFormValues(v => ({ ...v, beta: parseFloat(e.target.value) }))}
                className={inputClass} />
            </div>
          </div>

          <div className="flex items-center gap-2 mt-3">
            <button onClick={handleApply}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              Aplicar
            </button>
            <button onClick={handleRestore}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <RefreshCcw className="w-3 h-3" />
              Restaurar
            </button>
          </div>
        </div>
      )}

      {/* Canvas */}
      <div className="relative" style={{ height: 420 }}>
        <div ref={mountRef} className="w-full h-full" />

        {/* Tooltip */}
        <div data-solar-tooltip
          className="absolute pointer-events-none z-10 rounded-lg border border-yellow-500/40 bg-card/95 px-3 py-2 text-xs shadow-lg min-w-[170px]"
          style={{ display:"none" }}>
          <div className="font-bold text-yellow-400 mb-1.5 flex items-center gap-1">
            <span>&#9728;</span><span data-tt-title />
          </div>
          <div className="flex justify-between gap-4 text-muted-foreground">
            <span>Hora</span><span data-tt-hora className="font-semibold text-card-foreground" />
          </div>
          <div className="flex justify-between gap-4 text-muted-foreground">
            <span>Elevacion</span><span data-tt-elev className="font-semibold text-card-foreground" />
          </div>
          <div className="flex justify-between gap-4 text-muted-foreground">
            <span>Azimut</span><span data-tt-az className="font-semibold text-card-foreground" />
          </div>
          <div className="flex justify-between gap-4 text-muted-foreground">
            <span>Angulo Ti</span><span data-tt-theta className="font-semibold text-card-foreground" />
          </div>
        </div>

        {/* Botones de control */}
        <div className="absolute bottom-8 right-3 flex flex-col gap-1 z-10">
          <button className={btnClass} onClick={() => controlsRef.current?.zoomIn()}><ZoomIn className="w-3.5 h-3.5" /></button>
          <button className={btnClass} onClick={() => controlsRef.current?.zoomOut()}><ZoomOut className="w-3.5 h-3.5" /></button>
          <div className="h-px bg-border my-0.5" />
          <button className={btnClass} onClick={() => controlsRef.current?.rotateUp()}><ChevronUp className="w-3.5 h-3.5" /></button>
          <div className="flex gap-1">
            <button className={btnClass} onClick={() => controlsRef.current?.rotateLeft()}><ChevronLeft className="w-3.5 h-3.5" /></button>
            <button className={btnClass} onClick={() => controlsRef.current?.rotateRight()}><ChevronRight className="w-3.5 h-3.5" /></button>
          </div>
          <button className={btnClass} onClick={() => controlsRef.current?.rotateDown()}><ChevronDown className="w-3.5 h-3.5" /></button>
          <div className="h-px bg-border my-0.5" />
          <button className={btnClass} onClick={() => { controlsRef.current?.reset(); handleRestore() }}><RotateCcw className="w-3.5 h-3.5" /></button>
        </div>

        <p className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-muted-foreground/50 pointer-events-none whitespace-nowrap">
          Arrastra para rotar | Scroll para zoom | Pasa el cursor sobre la trayectoria para ver datos
        </p>
      </div>
    </div>
  )
}