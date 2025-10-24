# 🚀 Desplegar PR Code Reviewer en Azure

Esta guía te ayuda a desplegar tu PR Code Reviewer en Azure App Service y configurarlo como GitHub App.

## 📋 Pasos para Azure

### 1. 🔐 Preparar variables de entorno

Necesitarás estos valores:
- ✅ `GITHUB_TOKEN` - Ya lo tienes en tu `.env` local
- ✅ `WEBHOOK_SECRET` - Ya lo tienes en tu `.env` local
- ✅ `PORT` - Azure lo configurará automáticamente

### 2. 🌐 Crear Azure App Service

#### Opción A: Azure Portal (Visual)
1. Ve a [portal.azure.com](https://portal.azure.com)
2. **Create a resource** → **Web App**
3. **Configuración:**
   - **Name:** `pr-code-reviewer-[tu-nombre]` (debe ser único)
   - **Runtime:** Node 18 LTS
   - **Region:** La más cercana a ti
   - **Pricing:** Free F1 (para empezar)

#### Opción B: Azure CLI (Comando)
```bash
# Login a Azure
az login

# Crear resource group
az group create --name rg-pr-reviewer --location eastus

# Crear App Service plan
az appservice plan create --name plan-pr-reviewer --resource-group rg-pr-reviewer --sku F1

# Crear Web App
az webapp create --name pr-code-reviewer-[tu-nombre] --resource-group rg-pr-reviewer --plan plan-pr-reviewer --runtime "NODE:18-lts"
```

### 3. 🔗 Conectar con GitHub

#### En Azure Portal:
1. Ve a tu Web App → **Deployment Center**
2. **Source:** GitHub
3. **Authorize** con tu cuenta de GitHub
4. **Organization:** sarboleda72
5. **Repository:** pr-code-reviewer
6. **Branch:** main
7. **Build Provider:** GitHub Actions
8. **Save**

### 4. ⚙️ Configurar variables de entorno

#### En Azure Portal:
1. Tu Web App → **Configuration** → **Application settings**
2. **New application setting:**
   - **Name:** `GITHUB_TOKEN`
   - **Value:** `TU_GITHUB_TOKEN_AQUI` (el token de tu `.env` local)
3. **New application setting:**
   - **Name:** `WEBHOOK_SECRET`  
   - **Value:** `mi_secreto_webhook_super_seguro_123`
4. **Save**

### 5. 🚀 Desplegar

Azure automáticamente:
1. ✅ Detectará tu `package.json`
2. ✅ Ejecutará `npm install`
3. ✅ Iniciará con `npm start`
4. ✅ Te dará una URL como: `https://pr-code-reviewer-sarboleda.azurewebsites.net`

### 6. ✅ Verificar despliegue

1. **Logs:** Azure Portal → tu Web App → **Log stream**
2. **URL:** Visita `https://tu-app.azurewebsites.net`
3. **Debería mostrar:**
   ```json
   {
     "name": "🤖 PR Code Reviewer GitHub App",
     "version": "2.0.0", 
     "status": "active"
   }
   ```

## 🤖 Configurar GitHub App

### 1. Crear GitHub App
1. Ve a [GitHub Settings → Developer settings → GitHub Apps](https://github.com/settings/apps)
2. **New GitHub App**
3. **Configuración:**
   - **GitHub App name:** `PR Code Reviewer`
   - **Homepage URL:** `https://github.com/sarboleda72/pr-code-reviewer`
   - **Webhook URL:** `https://tu-app.azurewebsites.net/webhook` ⚠️ **Cambiar por tu URL real**
   - **Webhook secret:** `mi_secreto_webhook_super_seguro_123` (el mismo del .env)

### 2. Permisos de la GitHub App
**Repository permissions:**
- ✅ **Contents:** Read
- ✅ **Issues:** Write  
- ✅ **Pull requests:** Write
- ✅ **Metadata:** Read

**Subscribe to events:**
- ✅ **Pull request**

### 3. Instalación
**Where can this GitHub App be installed?**
- 🔘 **Any account** (para que otros puedan instalarla)

### 4. Instalar en tu repo
1. Después de crear la app → **Install App**
2. **Select repositories:** sarboleda72/pr-code-reviewer
3. **Install**

## 🧪 Probar la integración

### 1. Crear PR de prueba
```bash
git checkout -b test-azure-integration
echo "SECRET_KEY=test123" > .env.test  # ❌ Archivo problemático
echo "console.log('test')" > test-file.js
git add .
git commit -m "Test: Add problematic files for PR review"
git push -u origin test-azure-integration
```

### 2. Crear Pull Request
- Ve a GitHub → Create Pull Request
- **Resultado esperado:** Comentario automático detectando el archivo `.env.test`

### 3. Monitorear logs
- Azure Portal → tu Web App → **Log stream**
- Deberías ver: `📨 Webhook received: pull_request`

## 🔍 Troubleshooting

### Problema: App no responde
**Solución:** Ver logs en Azure Portal → Log stream

### Problema: Webhook no se recibe  
**Solución:** Verificar que la URL del webhook sea correcta y accesible

### Problema: No puede comentar en PR
**Solución:** Verificar permisos de la GitHub App

### Problema: Token inválido
**Solución:** Regenerar GitHub token y actualizar en Azure

## 🎯 Próximos pasos

Una vez funcionando:
1. ✅ **Compartir la GitHub App** - otros pueden instalarla
2. ✅ **Agregar más reglas** de validación
3. ✅ **Monitorear uso** en Azure metrics
4. ✅ **Escalar** si es necesario

---

🚀 **¡Tu revisor automático estará disponible 24/7 en Azure!**