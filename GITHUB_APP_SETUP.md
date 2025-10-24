# 🤖 GitHub App Setup Guide

Esta guía te ayudará a configurar tu PR Code Reviewer como una GitHub App.

## 📋 Pasos de configuración

### 1. 🔑 Crear Personal Access Token

1. Ve a **GitHub Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. Click **"Generate new token (classic)"**
3. Selecciona estos scopes:
   - ✅ `repo` (Full control of private repositories)
   - ✅ `write:discussion` (Write access to discussions)
4. Copia el token generado

### 2. ⚙️ Configurar variables de entorno

```bash
# Copia el archivo de ejemplo
cp .env.example .env

# Edita .env con tus valores
nano .env
```

Completa:
```env
GITHUB_TOKEN=ghp_tu_token_aqui
WEBHOOK_SECRET=tu_secreto_webhook_seguro
PORT=3000
```

### 3. 🚀 Desplegar el servidor

#### Opción A: Desarrollo local (con ngrok)
```bash
# Instalar ngrok
npm install -g ngrok

# En terminal 1: Ejecutar servidor
npm start

# En terminal 2: Exponer con ngrok  
ngrok http 3000
```

#### Opción B: Despliegue en producción
- **Heroku**: `git push heroku main`
- **Railway**: Conecta tu repo de GitHub
- **Vercel**: `vercel --prod`
- **VPS**: Usar PM2 o Docker

### 4. 📱 Crear GitHub App (Opcional pero recomendado)

1. Ve a **GitHub Settings** → **Developer settings** → **GitHub Apps**
2. Click **"New GitHub App"**
3. Completa:
   - **App name**: `PR Code Reviewer`
   - **Homepage URL**: `https://github.com/sarboleda72/pr-code-reviewer`
   - **Webhook URL**: `https://tu-dominio.com/webhook`
   - **Webhook secret**: (el mismo de tu .env)

4. **Permissions**:
   - Repository permissions:
     - ✅ Contents: Read
     - ✅ Issues: Write
     - ✅ Pull requests: Write
     - ✅ Metadata: Read

5. **Subscribe to events**:
   - ✅ Pull request

6. **Where can this GitHub App be installed?**:
   - 🔘 Any account (para que otros lo puedan usar)

### 5. 🔧 Instalación en repositorios

#### Método A: Personal Access Token (más simple)
```bash
# Configurar webhook manualmente en cada repo
# Repo Settings → Webhooks → Add webhook
# Payload URL: https://tu-dominio.com/webhook  
# Content type: application/json
# Secret: tu_webhook_secret
# Events: Pull requests
```

#### Método B: GitHub App (más escalable)
1. Después de crear la App, instálala en tus repos
2. GitHub Apps → Tu App → Install App
3. Selecciona repos donde quieres revisiones automáticas

### 6. ✅ Probar la integración

1. **Crear un PR de prueba**:
   ```bash
   git checkout -b test-integration
   echo "console.log('test')" > test.js
   echo "SECRET_KEY=abc123" > .env  # ❌ Archivo problemático  
   git add .
   git commit -m "Test PR with issues"
   git push -u origin test-integration
   ```

2. **Crear Pull Request** en GitHub

3. **Verificar**:
   - ✅ Webhook recibido en logs del servidor
   - ✅ Comentario automático en el PR
   - ✅ Issues detectados (.env file)

## 🔍 Troubleshooting

### Problema: Webhook no se recibe
- Verificar que la URL del webhook sea accesible
- Revisar logs del servidor
- Comprobar que el secret coincida

### Problema: No puede comentar en PR  
- Verificar que el token tenga permisos de `repo`
- Comprobar que el token no haya expirado

### Problema: Error de autenticación
- Verificar que `GITHUB_TOKEN` esté configurado correctamente
- Comprobar que el token tenga los scopes necesarios

## 📊 Logs útiles

```bash
# Ver logs del servidor
tail -f logs/app.log

# Verificar webhooks recibidos
grep "Webhook received" logs/app.log

# Ver análisis completados  
grep "Analysis completed" logs/app.log
```

## 🎯 Próximos pasos

Una vez configurado, puedes:
1. **Agregar más analizadores** en `src/analyzers/`
2. **Personalizar reglas** en `rules/*.json`  
3. **Instalar en más repositorios**
4. **Compartir con tu equipo/empresa**

---

🚀 **¡Listo para revisar PRs automáticamente!**