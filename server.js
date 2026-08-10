const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'datos.json');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/rrhh_db';

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ==========================================
// MONGOOSE SCHEMAS & MODELS
// ==========================================

const employeeSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  nombre: { type: String, default: '' },
  dni: { type: String, default: '' },
  correo: { type: String, default: '' },
  celular: { type: String, default: '' },
  puesto: { type: String, default: '' },
  departamento: { type: String, default: '' },
  ruta: { type: String, default: '' },
  genero: { type: String, default: '' },
  nacionalidad: { type: String, default: 'Peruana' },
  fechaNacimiento: { type: String, default: '' },
  direccion: { type: String, default: '' },
  distrito: { type: String, default: '' },
  provincia: { type: String, default: '' },
  departamentoResidencia: { type: String, default: '' },
  contactoEmergencia: { type: String, default: '' },
  foto: { type: String, default: null },
  estado: { type: String, default: 'Activo' },
  motivoCese: { type: String, default: '' },
  comentarioCese: { type: String, default: '' },
  fechaInicioContrato: { type: String, default: '' },
  fechaFinContrato: { type: String, default: '' },
  esIndeterminado: { type: Boolean, default: false },
  remuneracion: { type: Number, default: 0 },
  renovaciones: { type: Array, default: [] },
  historialRemuneraciones: { type: Array, default: [] }
}, { timestamps: true });

const vacationSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  employeeId: { type: Number, required: true },
  tipo: { type: String, default: '' },
  periodo: { type: String, default: '' },
  fechaInicio: { type: String, default: '' },
  fechaFin: { type: String, default: '' },
  dias: { type: Number, default: 0 },
  motivo: { type: String, default: '' },
  estado: { type: String, default: 'Aprobado' }
}, { timestamps: true });

const Employee = mongoose.model('Employee', employeeSchema);
const Vacation = mongoose.model('Vacation', vacationSchema);

// Connection Status Flag
let isMongoConnected = false;

// Fallback Helper Functions for JSON Database Persistence
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

// Initial Data Seeding from datos.json to MongoDB
async function seedInitialData() {
  try {
    const empCount = await Employee.countDocuments();
    if (empCount === 0 && fs.existsSync(DB_FILE)) {
      const initialData = readData();
      if (Array.isArray(initialData.employees) && initialData.employees.length > 0) {
        await Employee.insertMany(initialData.employees, { ordered: false });
        console.log(`📦 Datos migrados a MongoDB: ${initialData.employees.length} empleado(s).`);
      }
      if (Array.isArray(initialData.vacations) && initialData.vacations.length > 0) {
        await Vacation.insertMany(initialData.vacations, { ordered: false });
        console.log(`📦 Datos migrados a MongoDB: ${initialData.vacations.length} registro(s) de vacaciones.`);
      }
    }
  } catch (err) {
    console.warn('⚠️ Error durante la migración inicial de datos a MongoDB:', err.message);
  }
}

// MongoDB Connection Logic
async function initDatabase() {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    isMongoConnected = true;
    console.log(`✅ Conexión exitosa a MongoDB`);
    await seedInitialData();
  } catch (err) {
    isMongoConnected = false;
    console.warn(`⚠️ No se pudo conectar a MongoDB (${err.message}).`);
    console.warn(`⚠️ Modo Fallback activo: Utilizando datos.json local para operaciones.`);
    if (!process.env.MONGODB_URI) {
      console.log(`💡 Para conectar a MongoDB en la nube o local, configura MONGODB_URI.`);
    }
  }
}

// ==========================================
// API ENDPOINTS - EMPLEADOS
// ==========================================

// GET: Obtener todos los empleados
app.get('/api/empleados', async (req, res) => {
  try {
    if (isMongoConnected) {
      const employees = await Employee.find({}, { _id: 0, __v: 0 }).lean();
      return res.json(employees);
    }
    const data = readData();
    res.json(data.employees || []);
  } catch (err) {
    console.error('Error en GET /api/empleados:', err);
    res.status(500).json({ success: false, error: 'Error al obtener empleados' });
  }
});

// POST: Crear nuevo empleado o importar lista masiva
app.post('/api/empleados', async (req, res) => {
  try {
    const body = req.body;

    if (Array.isArray(body)) {
      // 1. Filtrar y limpiar filas vacías o inválidas
      const baseTime = Date.now();
      const validEmployees = body
        .filter(emp => emp && typeof emp === 'object' && (emp.nombre || emp.trabajador) && String(emp.nombre || emp.trabajador).trim().length > 0)
        .map((emp, idx) => {
          const cleanName = String(emp.nombre || emp.trabajador || '').trim();
          const empId = Number(emp.id) && !isNaN(Number(emp.id)) ? Number(emp.id) : (baseTime + idx);

          return {
            id: empId,
            nombre: cleanName,
            dni: emp.dni ? String(emp.dni).trim() : '',
            correo: emp.correo ? String(emp.correo).trim() : '',
            celular: emp.celular ? String(emp.celular).trim() : '',
            puesto: emp.puesto ? String(emp.puesto).trim() : 'Empleado',
            departamento: emp.departamento ? String(emp.departamento).trim() : 'OPERACIONES',
            ruta: emp.ruta ? String(emp.ruta).trim() : '',
            genero: emp.genero || 'Masculino',
            nacionalidad: emp.nacionalidad ? String(emp.nacionalidad).trim() : 'Peruana',
            fechaNacimiento: emp.fechaNacimiento || '',
            direccion: emp.direccion ? String(emp.direccion).trim() : '',
            distrito: emp.distrito ? String(emp.distrito).trim() : '',
            provincia: emp.provincia ? String(emp.provincia).trim() : '',
            departamentoResidencia: emp.departamentoResidencia ? String(emp.departamentoResidencia).trim() : '',
            contactoEmergencia: emp.contactoEmergencia ? String(emp.contactoEmergencia).trim() : '',
            foto: emp.foto || null,
            estado: emp.estado || 'Activo',
            motivoCese: emp.motivoCese || '',
            comentarioCese: emp.comentarioCese || '',
            fechaInicioContrato: emp.fechaInicioContrato || new Date().toISOString().split('T')[0],
            fechaFinContrato: emp.fechaFinContrato || '',
            esIndeterminado: emp.esIndeterminado !== undefined ? emp.esIndeterminado : true,
            remuneracion: Number(emp.remuneracion) || 2500,
            renovaciones: Array.isArray(emp.renovaciones) ? emp.renovaciones : [],
            historialRemuneraciones: Array.isArray(emp.historialRemuneraciones) ? emp.historialRemuneraciones : [
              {
                id: baseTime + idx + 50000,
                fecha: emp.fechaInicioContrato || new Date().toISOString().split('T')[0],
                monto: Number(emp.remuneracion) || 2500,
                motivo: "Remuneración inicial de contrato",
                renovacionId: 'INICIAL'
              }
            ]
          };
        });

      let insertedCount = 0;
      let errors = [];

      if (isMongoConnected) {
        await Employee.deleteMany({});

        if (validEmployees.length > 0) {
          try {
            const docs = await Employee.insertMany(validEmployees, { ordered: false });
            insertedCount = docs.length;
          } catch (bulkErr) {
            if (bulkErr.insertedDocs && Array.isArray(bulkErr.insertedDocs)) {
              insertedCount = bulkErr.insertedDocs.length;
            } else if (bulkErr.result && bulkErr.result.nInserted) {
              insertedCount = bulkErr.result.nInserted;
            }

            if (bulkErr.writeErrors && Array.isArray(bulkErr.writeErrors)) {
              errors = bulkErr.writeErrors.map(we => {
                const failedDoc = validEmployees[we.index];
                return `Fila ${we.index + 1} (${failedDoc ? failedDoc.nombre : 'Desconocido'}): ${we.errmsg || 'Error de duplicado/inserción'}`;
              });
            } else {
              errors.push(bulkErr.message);
            }
          }
        }

        const employees = await Employee.find({}, { _id: 0, __v: 0 }).lean();
        const msg = `Se procesó la carga masiva: ${insertedCount} de ${body.length} empleado(s) insertado(s) con éxito.` + (errors.length > 0 ? ` Ocurrieron errores en ${errors.length} fila(s).` : '');
        
        return res.status(201).json({
          success: true,
          message: msg,
          insertedCount,
          totalRecibidos: body.length,
          filasValidas: validEmployees.length,
          errors,
          employees
        });
      }

      // Fallback Local JSON
      const data = readData();
      data.employees = validEmployees;
      writeData(data);
      return res.status(201).json({
        success: true,
        message: `Se procesó la carga masiva local: ${validEmployees.length} de ${body.length} empleado(s) guardado(s) con éxito.`,
        insertedCount: validEmployees.length,
        totalRecibidos: body.length,
        filasValidas: validEmployees.length,
        errors: [],
        employees: data.employees
      });
    }

    // Guardar o actualizar empleado individual
    if (isMongoConnected) {
      if (!body.id) body.id = Date.now();
      await Employee.findOneAndUpdate(
        { id: body.id },
        body,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      const employees = await Employee.find({}, { _id: 0, __v: 0 }).lean();
      return res.status(201).json({ success: true, message: 'Empleado guardado con éxito', employees });
    }

    // Fallback Local JSON para empleado individual
    const data = readData();
    if (!body.id) body.id = Date.now();
    const index = data.employees.findIndex(e => e.id === body.id);
    if (index !== -1) {
      data.employees[index] = { ...data.employees[index], ...body };
    } else {
      data.employees.unshift(body);
    }

    if (writeData(data)) {
      res.status(201).json({ success: true, message: 'Empleado guardado con éxito', employees: data.employees });
    } else {
      res.status(500).json({ success: false, error: 'Error al persistir en base de datos' });
    }
  } catch (err) {
    console.error('Error en POST /api/empleados:', err);
    res.status(500).json({ success: false, error: 'Error al procesar empleado(s)' });
  }
});

// PUT: Actualizar datos de un empleado existente
app.put('/api/empleados/:id', async (req, res) => {
  try {
    const empId = Number(req.params.id);

    if (isMongoConnected) {
      const updated = await Employee.findOneAndUpdate(
        { id: empId },
        req.body,
        { new: true }
      ).select('-_id -__v').lean();

      if (!updated) {
        return res.status(404).json({ success: false, message: 'Empleado no encontrado' });
      }
      return res.json({ success: true, message: 'Empleado actualizado con éxito', employee: updated });
    }

    // Fallback Local JSON
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
  } catch (err) {
    console.error('Error en PUT /api/empleados/:id:', err);
    res.status(500).json({ success: false, error: 'Error al actualizar empleado' });
  }
});

// DELETE: Eliminar empleado y sus vacaciones asociadas
app.delete('/api/empleados/:id', async (req, res) => {
  try {
    const empId = Number(req.params.id);

    if (isMongoConnected) {
      await Employee.deleteOne({ id: empId });
      await Vacation.deleteMany({ employeeId: empId });
      return res.json({ success: true, message: 'Empleado eliminado con éxito' });
    }

    // Fallback Local JSON
    const data = readData();
    data.employees = data.employees.filter(e => e.id !== empId);
    data.vacations = data.vacations.filter(v => v.employeeId !== empId);

    if (writeData(data)) {
      res.json({ success: true, message: 'Empleado eliminado con éxito' });
    } else {
      res.status(500).json({ success: false, error: 'Error al eliminar en base de datos' });
    }
  } catch (err) {
    console.error('Error en DELETE /api/empleados/:id:', err);
    res.status(500).json({ success: false, error: 'Error al eliminar empleado' });
  }
});

// ==========================================
// API ENDPOINTS - VACACIONES
// ==========================================

// GET: Obtener todas las vacaciones
app.get('/api/vacaciones', async (req, res) => {
  try {
    if (isMongoConnected) {
      const vacations = await Vacation.find({}, { _id: 0, __v: 0 }).lean();
      return res.json(vacations);
    }
    const data = readData();
    res.json(data.vacations || []);
  } catch (err) {
    console.error('Error en GET /api/vacaciones:', err);
    res.status(500).json({ success: false, error: 'Error al obtener vacaciones' });
  }
});

// POST: Registrar nueva solicitud/historial de vacaciones
app.post('/api/vacaciones', async (req, res) => {
  try {
    const newVacation = req.body;
    if (!newVacation.id) {
      newVacation.id = Date.now();
    }

    if (isMongoConnected) {
      await Vacation.findOneAndUpdate(
        { id: newVacation.id },
        newVacation,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      return res.status(201).json({ success: true, message: 'Vacaciones registradas con éxito', vacation: newVacation });
    }

    // Fallback Local JSON
    const data = readData();
    data.vacations.unshift(newVacation);

    if (writeData(data)) {
      res.status(201).json({ success: true, message: 'Vacaciones registradas con éxito', vacation: newVacation });
    } else {
      res.status(500).json({ success: false, error: 'Error al guardar vacaciones' });
    }
  } catch (err) {
    console.error('Error en POST /api/vacaciones:', err);
    res.status(500).json({ success: false, error: 'Error al registrar vacaciones' });
  }
});

// DELETE: Eliminar registro de vacaciones
app.delete('/api/vacaciones/:id', async (req, res) => {
  try {
    const vacId = Number(req.params.id);

    if (isMongoConnected) {
      await Vacation.deleteOne({ id: vacId });
      return res.json({ success: true, message: 'Registro de vacaciones eliminado con éxito' });
    }

    // Fallback Local JSON
    const data = readData();
    data.vacations = data.vacations.filter(v => v.id !== vacId);

    if (writeData(data)) {
      res.json({ success: true, message: 'Registro de vacaciones eliminado con éxito' });
    } else {
      res.status(500).json({ success: false, error: 'Error al eliminar vacaciones' });
    }
  } catch (err) {
    console.error('Error en DELETE /api/vacaciones/:id:', err);
    res.status(500).json({ success: false, error: 'Error al eliminar registro de vacaciones' });
  }
});

// ==========================================
// FULL BACKUP IMPORT & RESET
// ==========================================
app.post('/api/backup/import', async (req, res) => {
  try {
    const { employees, vacations } = req.body;
    if (!Array.isArray(employees) || !Array.isArray(vacations)) {
      return res.status(400).json({ success: false, error: 'Estructura de respaldo inválida' });
    }

    if (isMongoConnected) {
      await Employee.deleteMany({});
      await Vacation.deleteMany({});
      if (employees.length > 0) await Employee.insertMany(employees);
      if (vacations.length > 0) await Vacation.insertMany(vacations);
      return res.json({ success: true, message: 'Respaldo importado correctamente', data: { employees, vacations } });
    }

    // Fallback Local JSON
    const data = { employees, vacations };
    if (writeData(data)) {
      res.json({ success: true, message: 'Respaldo importado correctamente', data });
    } else {
      res.status(500).json({ success: false, error: 'Error al restaurar respaldo' });
    }
  } catch (err) {
    console.error('Error en /api/backup/import:', err);
    res.status(500).json({ success: false, error: 'Error al importar respaldo' });
  }
});

// Serve Static Frontend Files
app.use(express.static(__dirname));

// Fallback to index.html for SPA/Direct route handling
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server & Connect to DB
app.listen(PORT, async () => {
  console.log(`================================================`);
  console.log(`🚀 Servidor RRHH Full-Stack iniciado con éxito`);
  console.log(`📡 Puerto: ${PORT}`);
  console.log(`🌐 Acceso Local: http://localhost:${PORT}`);
  console.log(`================================================`);
  await initDatabase();
});
