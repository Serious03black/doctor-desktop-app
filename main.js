const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');


let mainWindow;
let dbPath;
if (app.isPackaged) {
  dbPath = path.join(app.getPath('userData'), 'doctor.db');
  const asarDbPath = path.join(process.resourcesPath, 'db', 'doctor.db');
  if (!fs.existsSync(dbPath)) {
    fs.copyFileSync(asarDbPath, dbPath);
  }
} else {
  dbPath = path.join(__dirname, 'db', 'doctor.db');
}
const db = new sqlite3.Database(dbPath);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'src/index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function initializeDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      age INTEGER,
      gender TEXT,
      contact TEXT,
      medical_history TEXT,
      date_added DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS prescriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER,
      prescription_text TEXT,
      date_added DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id)
    )
  `);
}

app.on('ready', () => {
  initializeDatabase();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC Handlers
ipcMain.on('add-patient', (event, patient) => {
  db.run(
    'INSERT INTO patients (name, age, gender, contact, medical_history) VALUES (?, ?, ?, ?, ?)',
    [patient.name, patient.age, patient.gender, patient.contact, patient.medical_history],
    function (err) {
      if (err) {
        event.reply('add-patient-response', { success: false, error: err.message });
      } else {
        event.reply('add-patient-response', { success: true, id: this.lastID });
      }
    }
  );
});

ipcMain.on('get-patients', (event, { search, sortBy }) => {
  let query = `SELECT * FROM patients`;
  const params = [];
  if (search) {
    query += ` WHERE name LIKE ?`;
    params.push(`%${search}%`);
  }
  query += ` ORDER BY ${sortBy || 'name'} ASC`;
  db.all(query, params, (err, rows) => {
    if (err) {
      event.reply('get-patients-response', { success: false, error: err.message });
    } else {
      event.reply('get-patients-response', { success: true, patients: rows });
    }
  });
});

ipcMain.on('add-prescription', (event, { patient_id, prescription_text }) => {
  db.run(
    `INSERT INTO prescriptions (patient_id, prescription_text) VALUES (?, ?)`,
    [patient_id, prescription_text],
    function (err) {
      if (err) {
        event.reply('add-prescription-response', { success: false, error: err.message });
      } else {
        event.reply('add-prescription-response', { success: true, id: this.lastID });
      }
    }
  );
});

ipcMain.on('get-prescriptions', (event, patient_id) => {
  db.all(
    `SELECT * FROM prescriptions WHERE patient_id = ?`,
    [patient_id],
    (err, rows) => {
      if (err) {
        event.reply('get-prescriptions-response', { success: false, error: err.message });
      } else {
        event.reply('get-prescriptions-response', { success: true, prescriptions: rows });
      }
    }
  );
});

// Prescription Edit
ipcMain.on('edit-prescription', (event, { id, prescription_text }) => {
  db.run(
    `UPDATE prescriptions SET prescription_text = ? WHERE id = ?`,
    [prescription_text, id],
    function (err) {
      if (err) {
        event.reply('edit-prescription-response', { success: false, error: err.message });
      } else {
        event.reply('edit-prescription-response', { success: true });
      }
    }
  );
});

// Prescription Delete
ipcMain.on('delete-prescription', (event, id) => {
  db.run(
    `DELETE FROM prescriptions WHERE id = ?`,
    [id],
    function (err) {
      if (err) {
        event.reply('delete-prescription-response', { success: false, error: err.message });
      } else {
        event.reply('delete-prescription-response', { success: true });
      }
    }
  );
});

// Get All Data (with optional date filters)
ipcMain.on('get-all-data', (event, { fromDate, toDate }) => {
  let patientQuery = `SELECT * FROM patients`;
  let prescriptionQuery = `SELECT * FROM prescriptions`;
  const params = [];
  if (fromDate && toDate) {
    prescriptionQuery += ` WHERE date(date_added) BETWEEN date(?) AND date(?)`;
    params.push(fromDate, toDate);
  }
  db.all(patientQuery, [], (err, patients) => {
    if (err) {
      event.reply('get-all-data-response', { success: false, error: err.message });
    } else {
      db.all(prescriptionQuery, params, (err2, prescriptions) => {
        if (err2) {
          event.reply('get-all-data-response', { success: false, error: err2.message });
        } else {
          event.reply('get-all-data-response', { success: true, patients, prescriptions });
        }
      });
    }
  });
});

