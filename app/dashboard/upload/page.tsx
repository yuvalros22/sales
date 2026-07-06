'use client';
import { useSession } from 'next-auth/react';
import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';

interface ParsedItem {
  itemCode: string;
  itemName: string;
  modelCode: string;
  modelName: string;
  quality: string;
  bloomPct: string;
  quantity: number;
}

export default function UploadPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<ParsedItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function parseExcel(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      // Skip header row (row 0), process from row 1
      const map: Record<string, ParsedItem> = {};

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 21) continue;

        const bloomPct = String(row[7] ?? '').trim();  // H - עמודה 8 (index 7)
        const quality = String(row[8] ?? '').trim();   // I - עמודה 9 (index 8)
        const modelCode = String(row[15] ?? '').trim(); // P - עמודה 16 (index 15)
        const modelName = String(row[14] ?? '').trim(); // O - עמודה 15 (index 14)
        const itemCode = String(row[20] ?? '').trim();  // U - עמודה 21 (index 20)
        const itemName = String(row[19] ?? '').trim();  // T - עמודה 20 (index 19)
        const quantityStr = String(row[1] ?? '0').replace(/,/g, '').trim();
        const quantity = parseFloat(quantityStr) || 0; // B - עמודה 2 (index 1)

        if (!itemCode || !modelCode) continue;

        const key = `${itemCode}|${modelCode}|${quality}|${bloomPct}`;
        if (map[key]) {
          map[key].quantity += quantity;
        } else {
          map[key] = { itemCode, itemName, modelCode, modelName, quality, bloomPct, quantity };
        }
      }

      setPreview(Object.values(map));
      setFileName(file.name);
      setResult(null);
    };
    reader.readAsArrayBuffer(file);
  }

  function handleFile(file: File) {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      alert('אנא העלה קובץ Excel בלבד (.xlsx, .xls)');
      return;
    }
    parseExcel(file);
  }

  async function uploadInventory() {
    setUploading(true);
    const res = await fetch('/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: preview })
    });
    const data = await res.json();
    if (res.ok) {
      setResult({ ok: true, message: `המלאי עודכן בהצלחה! ${data.count} שורות נטענו.` });
      setPreview([]);
      setFileName('');
    } else {
      setResult({ ok: false, message: data.error || 'שגיאה בהעלאה' });
    }
    setUploading(false);
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 800 }}>העלאת קובץ מלאי</h1>
        <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '6px' }}>
          העלאת קובץ חדש תחליף לחלוטין את המלאי הקיים. הזמנות קודמות נשמרות.
        </div>
      </div>

      {/* Instructions */}
      <div className="card" style={{ marginBottom: '20px', background: 'rgba(96,165,250,0.05)', borderColor: 'rgba(96,165,250,0.2)' }}>
        <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--blue)', marginBottom: '10px' }}>📋 פורמט קובץ נדרש</div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
          <div>• <strong>עמודה B</strong> — יתרה בפקע (כמות)</div>
          <div>• <strong>עמודה H</strong> — % פריחה</div>
          <div>• <strong>עמודה I</strong> — איכות</div>
          <div>• <strong>עמודה O</strong> — שם דגם</div>
          <div>• <strong>עמודה P</strong> — קוד דגם</div>
          <div>• <strong>עמודה T</strong> — שם פריט</div>
          <div>• <strong>עמודה U</strong> — קוד פריט</div>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? 'var(--accent-light)' : 'var(--border)'}`,
          borderRadius: '12px',
          padding: '48px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s',
          background: dragging ? 'rgba(251,191,36,0.05)' : 'var(--bg-surface)',
          marginBottom: '20px'
        }}
      >
        <div style={{ fontSize: '36px', marginBottom: '12px' }}>📄</div>
        <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '6px' }}>
          {fileName || 'גרור קובץ Excel לכאן'}
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
          או לחץ לבחירת קובץ (.xlsx, .xls)
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>

      {/* Result message */}
      {result && (
        <div style={{
          padding: '14px 18px',
          borderRadius: '10px',
          marginBottom: '20px',
          background: result.ok ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
          border: `1px solid ${result.ok ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
          color: result.ok ? 'var(--green)' : 'var(--red)',
          fontWeight: 700,
          fontSize: '13px'
        }}>
          {result.ok ? '✓ ' : '✗ '}{result.message}
        </div>
      )}

      {/* Preview */}
      {preview.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>תצוגה מקדימה — {preview.length} שורות</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                הכמויות סוכמו לפי שילוב קוד פריט + קוד דגם + איכות + פריחה
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn-secondary" onClick={() => { setPreview([]); setFileName(''); }}>
                ביטול
              </button>
              <button className="btn-primary" onClick={uploadInventory} disabled={uploading}>
                {uploading ? 'מעלה...' : `⬆️ עדכן מלאי (${preview.length} שורות)`}
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto', maxHeight: '400px' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>שם פריט</th>
                  <th>קוד פריט</th>
                  <th>שם דגם</th>
                  <th>קוד דגם</th>
                  <th>איכות</th>
                  <th>% פריחה</th>
                  <th>כמות</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 200).map((item, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 700 }}>{item.itemName}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{item.itemCode}</td>
                    <td>{item.modelName}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{item.modelCode}</td>
                    <td><span className="badge badge-purple">{item.quality}</span></td>
                    <td>{item.bloomPct}%</td>
                    <td style={{ color: 'var(--green)', fontWeight: 700 }}>{Math.round(item.quantity).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 200 && (
              <div style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)', fontSize: '12px' }}>
                מוצגות 200 שורות ראשונות מתוך {preview.length}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
