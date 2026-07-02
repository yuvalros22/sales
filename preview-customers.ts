import * as xlsx from 'xlsx';
const wb = xlsx.readFile('פורמט עדכון לקוחות.xls');
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });
console.log('First 20 rows:', rows.slice(0, 20));
