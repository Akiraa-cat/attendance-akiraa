/**
 * Konfigurasi Global untuk Google Apps Script
 */
const CONFIG = {
  SPREADSHEET_ID: "", // Kosongkan jika terikat langsung (bound) ke spreadsheet
  MIN_DATE: "2026-07-01",
  MAX_DATE: "2027-04-17",
  ID_MONTH_NAMES: [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ]
};

/**
 * Daftar Hari Libur Nasional (Format: YYYY-MM-DD)
 */
const NATIONAL_HOLIDAYS = {
  "2026-08-17": "Hari Kemerdekaan Republik Indonesia",
  "2026-08-25": "Maulid Nabi Muhammad SAW",
  "2026-12-25": "Hari Raya Natal",
  "2027-01-01": "Tahun Baru Masehi",
  "2027-01-05": "Isra Mikraj Nabi Muhammad SAW",
  "2027-02-06": "Tahun Baru Imlek 2578 Kongzili",
  "2027-03-09": "Hari Suci Nyepi (Tahun Baru Saka 1949)",
  "2027-03-10": "Hari Raya Idulfitri 1448 H",
  "2027-03-11": "Hari Raya Idulfitri 1448 H",
  "2027-03-26": "Wafat Yesus Kristus",
  "2027-03-28": "Hari Raya Paskah"
};

function doGet(e) {
  try {
    if (e && e.parameter) {
      if (e.parameter.action === "getStatus") {
        return response(true, "API Ready", { status: "OK" });
      }
      if (e.parameter.action === "getMonthData") {
        const year = parseInt(e.parameter.year, 10);
        const month = parseInt(e.parameter.month, 10);
        return getMonthAttendanceData(year, month);
      }
    }

    const template = HtmlService.createTemplateFromFile('index');
    template.scriptUrl = PropertiesService.getScriptProperties().getProperty('DEPLOY_URL') || "";

    return template.evaluate()
      .setTitle('Form Absensi Harian')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
  } catch (error) {
    return response(false, error.toString());
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(10000)) {
      return response(false, "Server sedang sibuk, silakan coba beberapa saat lagi.");
    }

    const data = JSON.parse(e.postData.contents);
    const dateStr = data.date; 
    const action = data.action; // Tangkap parameter action

    const dateValidation = validateDate(dateStr);
    if (!dateValidation.success) {
      return response(false, dateValidation.message);
    }

    // Jika action adalah delete, arahkan ke fungsi penghapusan
    if (action === "delete") {
      const resObj = deleteAttendance(dateStr);
      return response(resObj.success, resObj.message, resObj.data || {});
    }

    // Alur normal untuk simpan / ubah data
    const description = data.description;
    const overwrite = data.overwrite === true;

    const resObj = submitAttendance(dateStr, description, overwrite);
    
    return response(
      resObj.success, 
      resObj.message, 
      resObj.data || {}, 
      resObj.overwrite || false, 
      resObj.oldDescription || "", 
      resObj.newDescription || ""
    );

  } catch (error) {
    return response(false, "Terjadi kesalahan pada server: " + error.toString());
  } finally {
    lock.releaseLock();
  }
}

function getMonthAttendanceData(year, month) {
  try {
    const ss = CONFIG.SPREADSHEET_ID ? SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = CONFIG.ID_MONTH_NAMES[month];
    const sheet = ss.getSheetByName(sheetName);

    const attendanceMap = {};

    if (sheet) {
      const lastRow = Math.max(sheet.getLastRow(), 3);
      const range = sheet.getRange(3, 2, lastRow - 2 + 1, 2); // Kolom B & C
      const values = range.getValues();

      for (let i = 0; i < values.length; i++) {
        const cellDate = values[i][0];
        const cellDesc = values[i][1];

        if (cellDate instanceof Date) {
          const y = cellDate.getFullYear();
          const m = String(cellDate.getMonth() + 1).padStart(2, '0');
          const d = String(cellDate.getDate()).padStart(2, '0');
          const dateString = `${y}-${m}-${d}`;

          if (y === year && cellDate.getMonth() === month) {
            const descStr = cellDesc !== null && cellDesc !== undefined ? cellDesc.toString().trim() : "";
            attendanceMap[dateString] = {
              hasData: descStr !== "",
              description: descStr
            };
          }
        }
      }
    }

    const holidays = {};
    for (const [dateStr, desc] of Object.entries(NATIONAL_HOLIDAYS)) {
      const [hy, hm, hd] = dateStr.split('-').map(Number);
      if (hy === year && (hm - 1) === month) {
        holidays[dateStr] = desc;
      }
    }

    return response(true, "Data bulan berhasil dimuat", {
      attendance: attendanceMap,
      holidays: holidays
    });

  } catch (error) {
    return response(false, error.toString());
  }
}

function validateDate(dateStr) {
  try {
    if (!dateStr) {
      return { success: false, message: "Tanggal wajib diisi." };
    }
    
    const minDate = new Date(CONFIG.MIN_DATE);
    const maxDate = new Date(CONFIG.MAX_DATE);
    const targetDate = new Date(dateStr);

    if (isNaN(targetDate.getTime())) {
      return { success: false, message: "Format tanggal tidak valid." };
    }

    if (targetDate < minDate || targetDate > maxDate) {
      return { success: false, message: "Tanggal harus berada dalam rentang 1 Juli 2026 s.d. 17 April 2027." };
    }

    return { success: true, message: "Validasi berhasil." };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function submitAttendance(dateStr, description, overwrite) {
  try {
    const ss = CONFIG.SPREADSHEET_ID ? SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
    const targetDate = new Date(dateStr);
    
    const monthIndex = targetDate.getMonth(); 
    const sheetName = CONFIG.ID_MONTH_NAMES[monthIndex];

    const sheet = getOrCreateMonthSheet(ss, sheetName, targetDate);
    if (!sheet) {
      return { success: false, message: "Gagal mengakses atau membuat sheet untuk bulan " + sheetName };
    }

    const rowIndex = findDateRow(sheet, targetDate);
    if (rowIndex === -1) {
      return { success: false, message: "Tanggal " + dateStr + " tidak ditemukan pada kolom B di sheet " + sheetName };
    }

    const descCell = sheet.getRange(rowIndex, 3); 
    const existingValue = descCell.getValue();
    const stringExisting = existingValue !== null && existingValue !== undefined ? existingValue.toString().trim() : "";

    if (stringExisting !== "" && !overwrite) {
      return { 
        success: false, 
        message: "Data pada tanggal tersebut sudah terisi.", 
        oldDescription: stringExisting,
        newDescription: description,
        overwrite: true 
      };
    }

    descCell.setValue(description);

    return { 
      success: true, 
      message: "Data absensi berhasil disimpan.",
      data: { sheetName: sheetName, date: dateStr }
    };

  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function deleteAttendance(dateStr) {
  try {
    const ss = CONFIG.SPREADSHEET_ID ? SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
    const targetDate = new Date(dateStr);
    
    const monthIndex = targetDate.getMonth(); 
    const sheetName = CONFIG.ID_MONTH_NAMES[monthIndex];

    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      return { success: false, message: "Sheet untuk bulan " + sheetName + " tidak ditemukan." };
    }

    const rowIndex = findDateRow(sheet, targetDate);
    if (rowIndex === -1) {
      return { success: false, message: "Tanggal " + dateStr + " tidak ditemukan pada sheet " + sheetName };
    }

    // Kosongkan kolom C (Keterangan) pada baris tersebut
    const descCell = sheet.getRange(rowIndex, 3);
    descCell.setValue("");

    return { 
      success: true, 
      message: "Keterangan absensi berhasil dihapus.",
      data: { sheetName: sheetName, date: dateStr }
    };

  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function getOrCreateMonthSheet(ss, sheetName, targetDate) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    let templateSheet = ss.getSheetByName("Juli") || ss.getSheets()[0];
    if (!templateSheet) {
      throw new Error("Tidak ditemukan sheet acuan (Juli atau sheet pertama) untuk pembuatan sheet baru.");
    }
    sheet = createMonthSheet(ss, templateSheet, sheetName, targetDate);
  }
  return sheet;
}

function createMonthSheet(ss, templateSheet, newSheetName, targetDate) {
  const newSheet = templateSheet.copyTo(ss);
  newSheet.setName(newSheetName);
  clearAttendanceData(newSheet);
  generateDates(newSheet, targetDate);
  return newSheet;
}

function generateDates(sheet, targetDate) {
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  
  const datesArray = [];
  for (let day = 1; day <= 31; day++) {
    if (day <= lastDay) {
      const d = new Date(year, month, day);
      datesArray.push([d]);
    } else {
      datesArray.push([""]);
    }
  }

  const range = sheet.getRange(3, 2, 31, 1);
  range.setValue("");
  range.setValues(datesArray);
  range.setNumberFormat("dd/MM/yyyy");
}

function clearAttendanceData(sheet) {
  const lastRow = Math.max(sheet.getLastRow(), 3);
  const lastCol = sheet.getLastColumn();

  if (lastCol >= 3) {
    const numRows = lastRow - 2 + 1;
    const numCols = lastCol - 3 + 1;
    if (numRows > 0 && numCols > 0) {
      const range = sheet.getRange(3, 3, numRows, numCols);
      range.clearContent();
    }
  }
}

function findDateRow(sheet, targetDate) {
  const lastRow = Math.max(sheet.getLastRow(), 3);
  const range = sheet.getRange(3, 2, lastRow - 2 + 1, 1);
  const values = range.getValues();

  const targetTime = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime();

  for (let i = 0; i < values.length; i++) {
    const cellVal = values[i][0];
    if (cellVal instanceof Date) {
      const cellTime = new Date(cellVal.getFullYear(), cellVal.getMonth(), cellVal.getDate()).getTime();
      if (cellTime === targetTime) {
        return i + 3;
      }
    }
  }
  return -1;
}

function response(success, message, data = {}, overwrite = false, oldDesc = "", newDesc = "") {
  const output = {
    success: success,
    message: message,
    data: data
  };
  if (overwrite) {
    output.overwrite = true;
    output.oldDescription = oldDesc;
    output.newDescription = newDesc;
  }
  return ContentService.createTextOutput(JSON.stringify(output))
    .setMimeType(ContentService.MimeType.JSON);
}
