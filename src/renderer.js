const { ipcRenderer } = require('electron');
const fs = require('fs');

// Add Patient Form Submission
document.getElementById('patient-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const patient = {
    name: document.getElementById('name').value,
    age: parseInt(document.getElementById('age').value),
    gender: document.getElementById('gender').value,
    contact: document.getElementById('contact').value,
    medical_history: document.getElementById('medical_history').value,
  };

  ipcRenderer.send('add-patient', patient);
  document.getElementById('patient-form').reset();
});

// Handle Add Patient Response
ipcRenderer.on('add-patient-response', (event, response) => {
  if (response.success) {
    alert('Patient added successfully!');
    loadPatients();
  } else {
    alert('Error adding patient: ' + response.error);
  }
});

// Load Patients
function loadPatients(search = '', sortBy = 'name') {
  ipcRenderer.send('get-patients', { search, sortBy });
}

// Patients table में मरीज के नाम पर prescription दिखाने के लिए event delegation
const patientTableBody = document.getElementById('patient-table-body');
patientTableBody.addEventListener('click', function(e) {
  if (e.target.classList.contains('patient-name')) {
    const patientId = e.target.getAttribute('data-id');
    const patientName = e.target.textContent;
    showPrescriptionForm(patientId, patientName);
  }
});

// Prescription लिस्ट के edit/delete बटन event delegation से
const prescriptionList = document.getElementById('prescription-list');
prescriptionList.addEventListener('click', function(e) {
  if (e.target.classList.contains('edit-prescription')) {
    const id = e.target.getAttribute('data-id');
    const text = e.target.getAttribute('data-text');
    editPrescription(id, text);
  } else if (e.target.classList.contains('delete-prescription')) {
    const id = e.target.getAttribute('data-id');
    deletePrescription(id);
  }
});

// Patients table में मरीज के नाम को क्लिकेबल बनाना
ipcRenderer.on('get-patients-response', (event, response) => {
  if (response.success) {
    const tbody = document.getElementById('patient-table-body');
    tbody.innerHTML = '';
    response.patients.forEach(patient => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="patient-name" data-id="${patient.id}" style="cursor:pointer; color:blue; text-decoration:underline;">${patient.name}</td>
        <td>${patient.age}</td>
        <td>${patient.gender}</td>
        <td>${patient.contact}</td>
        <td>${patient.medical_history}</td>
        <td><button onclick="showPrescriptionForm(${patient.id}, '${patient.name}')">Add Prescription</button></td>
      `;
      tbody.appendChild(row);
    });
  } else {
    alert('Error loading patients: ' + response.error);
  }
});

// Search and Sort
document.getElementById('search').addEventListener('input', (e) => {
  const sortBy = document.getElementById('sort').value;
  loadPatients(e.target.value, sortBy);
});

document.getElementById('sort').addEventListener('change', (e) => {
  const search = document.getElementById('search').value;
  loadPatients(search, e.target.value);
});

// Prescription Form
let currentPatientId = null;

function showPrescriptionForm(patientId, patientName) {
  currentPatientId = patientId;
  document.getElementById('prescription-patient-name').textContent = patientName;
  document.getElementById('prescription-section').style.display = 'block';
  document.getElementById('prescription-text').value = '';
  loadPrescriptions(patientId);
}

document.getElementById('save-prescription').addEventListener('click', () => {
  const prescriptionText = document.getElementById('prescription-text').value;
  if (prescriptionText && currentPatientId) {
    ipcRenderer.send('add-prescription', {
      patient_id: currentPatientId,
      prescription_text: prescriptionText,
    });
  }
});

ipcRenderer.on('add-prescription-response', (event, response) => {
  if (response.success) {
    alert('Prescription saved successfully!');
    loadPrescriptions(currentPatientId);
    document.getElementById('prescription-text').value = '';
  } else {
    alert('Error saving prescription: ' + response.error);
  }
});

function renderPrescriptionList(prescriptions) {
  const list = document.getElementById('prescription-list');
  list.innerHTML = '';
  prescriptions.forEach(prescription => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${prescription.date_added}: ${prescription.prescription_text}</span>
      <button class="edit-prescription" data-id="${prescription.id}" data-text="${encodeURIComponent(prescription.prescription_text)}">Edit</button>
      <button class="delete-prescription" data-id="${prescription.id}">Delete</button>
    `;
    list.appendChild(li);
  });
}

function editPrescription(id, text) {
  const newText = prompt('नया प्रिस्क्रिप्शन लिखें:', text);
  if (newText !== null) {
    ipcRenderer.send('edit-prescription', { id, prescription_text: newText });
  }
}

ipcRenderer.on('edit-prescription-response', (event, response) => {
  if (response.success) {
    alert('प्रिस्क्रिप्शन अपडेट हो गया!');
    loadPrescriptions(currentPatientId);
  } else {
    alert('एडिट में समस्या: ' + response.error);
  }
});

function deletePrescription(id) {
  if (confirm('क्या आप वाकई डिलीट करना चाहते हैं?')) {
    ipcRenderer.send('delete-prescription', id);
  }
}

ipcRenderer.on('delete-prescription-response', (event, response) => {
  if (response.success) {
    alert('प्रिस्क्रिप्शन डिलीट हो गया!');
    loadPrescriptions(currentPatientId);
  } else {
    alert('डिलीट में समस्या: ' + response.error);
  }
});

function loadPrescriptions(patientId) {
  ipcRenderer.send('get-prescriptions', patientId);
}

ipcRenderer.on('get-prescriptions-response', (event, response) => {
  if (response.success) {
    renderPrescriptionList(response.prescriptions);
  } else {
    alert('Error loading prescriptions: ' + response.error);
  }
});

// Download Single Prescription as PDF
document.getElementById('download-prescription').addEventListener('click', () => {
  const prescriptionText = document.getElementById('prescription-text').value;
  if (prescriptionText && currentPatientId) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text('Prescription', 10, 10);
    doc.text(`Patient: ${document.getElementById('prescription-patient-name').textContent}`, 10, 20);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 10, 30);
    doc.text(prescriptionText, 10, 40);
    doc.save(`prescription_${currentPatientId}.pdf`);
  } else {
    alert('Please enter a prescription first.');
  }
});

// Download All Data as PDF (with filters)
document.getElementById('download-all-data').addEventListener('click', () => {
  const fromDate = document.getElementById('from-date')?.value || null;
  const toDate = document.getElementById('to-date')?.value || null;
  ipcRenderer.send('get-all-data', { fromDate, toDate });
});

ipcRenderer.on('get-all-data-response', (event, response) => {
  if (response.success) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let yOffset = 10;

    doc.setFontSize(16);
    doc.text('Doctor Desktop App - All Patient Data', 10, yOffset);
    yOffset += 10;
    doc.setFontSize(12);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 10, yOffset);
    yOffset += 10;

    response.patients.forEach((patient, index) => {
      if (yOffset > 270) {
        doc.addPage();
        yOffset = 10;
      }

      doc.setFontSize(14);
      doc.text(`Patient ${index + 1}: ${patient.name}`, 10, yOffset);
      yOffset += 10;
      doc.setFontSize(12);
      doc.text(`Age: ${patient.age}`, 10, yOffset);
      yOffset += 10;
      doc.text(`Gender: ${patient.gender}`, 10, yOffset);
      yOffset += 10;
      doc.text(`Contact: ${patient.contact}`, 10, yOffset);
      yOffset += 10;
      doc.text(`Medical History: ${patient.medical_history || 'None'}`, 10, yOffset);
      yOffset += 10;

      const patientPrescriptions = response.prescriptions.filter(p => p.patient_id === patient.id);
      if (patientPrescriptions.length > 0) {
        doc.text('Prescriptions:', 10, yOffset);
        yOffset += 10;
        patientPrescriptions.forEach((prescription, pIndex) => {
          if (yOffset > 270) {
            doc.addPage();
            yOffset = 10;
          }
          doc.text(`- ${prescription.date_added}: ${prescription.prescription_text}`, 15, yOffset);
          yOffset += 10;
        });
      } else {
        doc.text('Prescriptions: None', 10, yOffset);
        yOffset += 10;
      }
      yOffset += 10;
    });

    doc.save('all_patient_data.pdf');
  } else {
    alert('Error generating PDF: ' + response.error);
  }
});

// Initial Load
loadPatients();

if (!fs.existsSync(asarDbPath)) {
  console.error("DB file not found in resources:", asarDbPath);
  // आप चाहें तो यहाँ default DB बना सकते हैं या user को error दिखा सकते हैं
} else if (!fs.existsSync(dbPath)) {
  fs.copyFileSync(asarDbPath, dbPath);
}