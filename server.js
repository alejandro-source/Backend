const express = require('express');
const { Client } = require('pg'); // Importa el cliente de PostgreSQL
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

// Cargar las variables de entorno
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;  // Usar el puerto proporcionado por Render si existe

app.use(cors());
app.use(bodyParser.json());

// Conexión a la base de datos PostgreSQL usando las variables de entorno
const client = new Client({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 5432
});

client.connect((err) => {
  if (err) {
    console.log('Error al conectar a la base de datos: ' + err.stack);
    return;
  }
  console.log('Conectado a la base de datos');
});

// Endpoint de login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ mensaje: 'Correo y contraseña son obligatorios' });
  }

  const query = 'SELECT * FROM usuarios WHERE email = $1'; // Usamos $1 en lugar de ? para PostgreSQL
  client.query(query, [email], (err, results) => {
    if (err) {
      console.error('Error al obtener el usuario:', err);
      return res.status(500).json({ mensaje: 'Error interno del servidor' });
    }

    if (results.rows.length === 0) {
      return res.status(401).json({ mensaje: 'Credenciales incorrectas' });
    }

    const usuario = results.rows[0];

    if (password === usuario.password) {
      const token = jwt.sign({ id: usuario.id, email: usuario.email }, 'secrettoken', { expiresIn: '1h' });
      return res.status(200).json({ token });
    } else {
      return res.status(401).json({ mensaje: 'Credenciales incorrectas' });
    }
  });
});

// Endpoint para registrar un nuevo usuario
app.post('/api/registro', (req, res) => {
  const { nombre, email, password } = req.body;

  if (!nombre || !email || !password) {
    return res.status(400).json({ mensaje: 'Todos los campos son obligatorios' });
  }

  const verificarUsuario = 'SELECT * FROM usuarios WHERE email = $1'; // Usamos $1 en lugar de ?
  client.query(verificarUsuario, [email], (err, results) => {
    if (err) {
      console.error('Error al verificar usuario:', err);
      return res.status(500).json({ mensaje: 'Error interno del servidor' });
    }

    if (results.rows.length > 0) {
      return res.status(400).json({ mensaje: 'El correo ya está registrado' });
    }

    const insertarUsuario = 'INSERT INTO usuarios (nombre, email, password) VALUES ($1, $2, $3)';
    client.query(insertarUsuario, [nombre, email, password], (err, result) => {
      if (err) {
        console.error('Error al registrar usuario:', err);
        return res.status(500).json({ mensaje: 'Error al registrar usuario' });
      }

      res.status(201).json({ mensaje: 'Usuario registrado exitosamente' });
    });
  });
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor Backend corriendo en http://localhost:${port}`);
});
