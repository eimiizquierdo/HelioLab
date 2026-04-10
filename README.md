# HelioLab

## Tech stack
Framework utilizada: NextJS
Base de datos: Firestore
Arquitectura: Cliente-servidor
Plataforma de Despliegue: Vercel

El proyecto expone una API mediante los route handlers de 
NextJS.

El acceso a Firestore se logra mediante la namespaced API
ofrecida por `firebase-admin`.

La interfaz gráfica se construye por medio componentes de 
`radix-ui`

## Convenciones para las rutas

1. Todas las funciones route handlers de la API (es decir, las funciones presentes en los 
archivos bajo la carpeta `lib/api/`) deben incluir un comentario documentacional que 
indique cuál es la ruta a la que corresponde dicha función. Por ejemplo:

```ts
// POST /api/prototype/[prototype]/get_latest_data
export async function POST(
  req: NextRequest,
  { params }: { params: { prototype: string } }
) {
```

2. Todas las funciones route handlers deben incluir un `try-catch` interno. El bloque 
   `catch` debe imprimir en la consola el nombre de la ruta que falló y retornar 
   un objeto `NextResponse` con código y mensaje de error correspondientes

