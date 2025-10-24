console.log('Este archivo tiene mala estructura');

// Todo el código mezclado sin organización
function getUserData() {
  // Lógica de base de datos mezclada con lógica de negocio (malo)
  const users = [
    { id: 1, name: 'Test User' },
    { id: 2, name: 'Another User' }
  ];
  
  return users;
}

// Configuración mezclada con lógica (malo)
const config = {
  port: 3000,
  database: 'test'
};

// Sin estructura de carpetas src/, controllers/, etc.
module.exports = { getUserData, config };