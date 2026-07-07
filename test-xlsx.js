const XLSX = require('xlsx');

const wb = XLSX.utils.book_new();
// Create a sheet where row 1 has 21 columns, but row 2 has only 2 columns
const ws = XLSX.utils.aoa_to_sheet([
  ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'],
  ['A', 'B'] // Row 2 only has data up to index 1
]);

const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
console.log(rows.map(r => r.length));
