import * as xlsx from 'xlsx';

const filePath = 'עציצים מעושכן.xls';
const workbook = xlsx.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

const rows: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1 });

console.log("Headers:");
console.log(rows[0]);
console.log("First row data:");
console.log(rows[1]);
