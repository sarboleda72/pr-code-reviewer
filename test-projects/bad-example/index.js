const express = require('express');

// Todo el código mezclado en un solo archivo (malo)
// Sin estructura de carpetas

const app = express();

// Controller logic mezclado con routes (malo)
app.get('/', (req, res) => {
  // Business logic directamente en la ruta (malo)
  const users = [
    { id: 1, name: 'John' },
    { id: 2, name: 'Jane' }
  ];
  
  res.json(users);
});

// Más routes sin organizar
app.post('/users', (req, res) => {
  // Lógica de base de datos directamente aquí (malo)
  console.log('Creating user...');
  res.json({ success: true });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});