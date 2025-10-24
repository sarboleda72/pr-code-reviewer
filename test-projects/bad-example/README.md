# Test Project for PR Reviewer

Este es un proyecto de ejemplo que tiene **varios problemas** que el revisor automático debería detectar:

## ❌ Problemas incluidos:

1. **Archivo .env committeado** (❌ Malo)
2. **No tiene .gitignore** (❌ Malo)
3. **Estructura desordenada** (❌ Malo)

## 🔧 Para probarlo:

1. Crea un PR con este proyecto
2. El GitHub Action debería detectar automáticamente los problemas
3. Comentará en el PR con sugerencias

## 📁 Estructura correcta debería ser:

```
src/
├── controllers/
├── services/ 
├── routes/
└── utils/
```

Pero este proyecto no la tiene.