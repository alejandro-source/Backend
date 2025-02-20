const express = require('express');
const { Client } = require('pg'); // Importa el cliente de PostgreSQL
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer'); // Importar Nodemailer

// Cargar las variables de entorno
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;  // Usar el puerto proporcionado por Render 

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

// Configuración del transporter de Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail', // Si usas Gmail
  auth: {
    user: process.env.EMAIL_USER, // Tu correo de Gmail
    pass: process.env.EMAIL_PASS  // Contraseña o App Password de Gmail
  }
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

// Endpoint para crear una nueva noticia y enviar correos
app.post('/api/nueva-noticia', (req, res) => {
  const { titulo, contenido, fecha, imagen } = req.body;

  if (!titulo || !contenido || !fecha || !imagen) {
    return res.status(400).json({ mensaje: 'Todos los campos son obligatorios' });
  }

  // Insertar la noticia en la base de datos
  const insertarNoticia = 'INSERT INTO noticias (titulo, contenido, fecha, imagen) VALUES ($1, $2, $3, $4) RETURNING *';
  client.query(insertarNoticia, [titulo, contenido, fecha, imagen], (err, result) => {
    if (err) {
      console.error('Error al agregar la noticia:', err);
      return res.status(500).json({ mensaje: 'Error al agregar la noticia' });
    }

    // Una vez agregada la noticia, obtener los correos de los usuarios registrados
    const obtenerCorreos = 'SELECT email FROM usuarios';
    client.query(obtenerCorreos, (err, usuarios) => {
      if (err) {
        console.error('Error al obtener correos de usuarios:', err);
        return res.status(500).json({ mensaje: 'Error al obtener correos de usuarios' });
      }

      if (usuarios.rows.length === 0) {
        return res.status(404).json({ mensaje: 'No hay usuarios registrados' });
      }

      // Enviar correo a cada usuario registrado
      usuarios.rows.forEach(usuario => {
        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: usuario.email,  // Correo de Alejandro o de cualquier otro usuario
          subject: `Nueva Noticia: ${titulo}`,
          html: `
            <h1>${titulo}</h1>
            <img src="${imagen}" alt="${titulo}" style="width: 100%; max-width: 600px;" />
            <p>${contenido}</p>
            <small>Fecha de publicación: ${fecha}</small>
          `
        };

        // Enviar el correo
        transporter.sendMail(mailOptions, (err, info) => {
          if (err) {
            console.error('Error al enviar correo a ' + usuario.email, err);
          } else {
            console.log('Correo enviado a ' + usuario.email + ': ' + info.response);
          }
        });
      });

      res.status(200).json({ mensaje: 'Noticia agregada y correos enviados exitosamente' });
    });
  });
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor Backend corriendo en http://localhost:${port}`);
});
