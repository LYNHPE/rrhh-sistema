const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'datos.json');

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Helper Functions for JSON Database Persistence
function readData() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const defaultData = { employees: [], vacations: [] };
      fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2), 'utf8');
      return defaultData;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error al leer datos.json:', err);
    return { employees: [], vacations: [] };
  }
}

function writeData(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error al escribir en datos.json:', err);
    return false;
  }
}

// ==========================================
// API ENDPOINTS - EMPLEADOS
// ==========================================

// GET: Obtener todos los empleados
app.get('/api/empleados', (req, res) => {
  const data = readData();
  res.json(data.employees || []);
});

// POST: Crear nuevo empleado o importar lista masiva
app.post('/api/empleados', (req, res) => {
  const data = readData();
  const body = req.body;

  if (Array.isArray(body)) {
    // Importación masiva desde Excel
    data.employees = body;
  } else {
    // Guardar nuevo empleado individual
    data.employees.unshift(body);
  }

  if (writeData(data)) {
    res.status(201).json({ success: true, message: 'Empleado(s) guardado(s) con éxito', employees: data.employees });
  } else {
    res.status(500).json({ success: false, error: 'Error al persistir en base de datos' });
  }
});

// PUT: Actualizar datos de un empleado existente
app.put('/api/empleados/:id', (req, res) => {
  const empId = parseInt(req.params.id);
  const data = readData();
  const index = data.employees.findIndex(e => e.id === empId);

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Empleado no encontrado' });
  }

  data.employees[index] = { ...data.employees[index], ...req.body };

  if (writeData(data)) {
    res.json({ success: true, message: 'Empleado actualizado con éxito', employee: data.employees[index] });
  } else {
    res.status(500).json({ success: false, error: 'Error al actualizar base de datos' });
  }
});

// DELETE: Eliminar empleado y sus vacaciones asociadas
app.delete('/api/empleados/:id', (req, res) => {
  const empId = parseInt(req.params.id);
  const data = readData();

  data.employees = data.employees.filter(e => e.id !== empId);
  data.vacations = data.vacations.filter(v => v.employeeId !== empId);

  if (writeData(data)) {
    res.json({ success: true, message: 'Empleado eliminado con éxito' });
  } else {
    res.status(500).json({ success: false, error: 'Error al eliminar en base de datos' });
  }
});

// ==========================================
// API ENDPOINTS - VACACIONES
// ==========================================

// GET: Obtener todas las vacaciones
app.get('/api/vacaciones', (req, res) => {
  const data = readData();
  res.json(data.vacations || []);
});

// POST: Registrar nueva solicitud/historial de vacaciones
app.post('/api/vacaciones', (req, res) => {
  const data = readData();
  const newVacation = req.body;
  
  if (!newVacation.id) {
    newVacation.id = Date.now();
  }

  data.vacations.unshift(newVacation);

  if (writeData(data)) {
    res.status(201).json({ success: true, message: 'Vacaciones registradas con éxito', vacation: newVacation });
  } else {
    res.status(500).json({ success: false, error: 'Error al guardar vacaciones' });
  }
});

// DELETE: Eliminar registro de vacaciones
app.delete('/api/vacaciones/:id', (req, res) => {
  const vacId = parseInt(req.params.id);
  const data = readData();

  data.vacations = data.vacations.filter(v => v.id !== vacId);

  if (writeData(data)) {
    res.json({ success: true, message: 'Registro de vacaciones eliminado con éxito' });
  } else {
    res.status(500).json({ success: false, error: 'Error al eliminar vacaciones' });
  }
});

// ==========================================
// FULL BACKUP IMPORT & RESET
// ==========================================
app.post('/api/backup/import', (req, res) => {
  const { employees, vacations } = req.body;
  if (!Array.isArray(employees) || !Array.isArray(vacations)) {
    return res.status(400).json({ success: false, error: 'Estructura de respaldo inválida' });
  }

  const data = { employees, vacations };
  if (writeData(data)) {
    res.json({ success: true, message: 'Respaldo importado correctamente', data });
  } else {
    res.status(500).json({ success: false, error: 'Error al restaurar respaldo' });
  }
});

// Serve Static Frontend Files
app.use(express.static(__dirname));

// Fallback to index.html for SPA/Direct route handling
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`================================================`);
  console.log(`🚀 Servidor RRHH Full-Stack iniciado con éxito`);
  console.log(`📡 Puerto: ${PORT}`);
  console.log(`🌐 Acceso Local: http://localhost:${PORT}`);
  console.log(`================================================`);
});
