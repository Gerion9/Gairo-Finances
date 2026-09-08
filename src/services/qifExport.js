// src/services/qifExport.js
// Exportador en formato bancario universal QIF (Quicken Interchange Format)

export function generateQIF(transactions = []) {
  let qif = '!Type:Bank\n';

  transactions.forEach(t => {
    // Format date MM/DD/YYYY
    const d = new Date(t.fecha || Date.now());
    const dateStr = `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}/${d.getFullYear()}`;
    
    const amount = t.tipo === 'ingreso' ? Math.abs(Number(t.monto)) : -Math.abs(Number(t.monto));
    const payee = (t.concepto || 'Transacción').replace(/\n/g, ' ');
    const category = t.categoria || 'Varios';
    const memo = t.notas || '';

    qif += `D${dateStr}\n`;
    qif += `T${amount.toFixed(2)}\n`;
    qif += `P${payee}\n`;
    qif += `L${category}\n`;
    if (memo) qif += `M${memo}\n`;
    qif += '^\n';
  });

  return qif;
}

export function downloadQIFFile(transactions, filename = 'sifran_movimientos.qif') {
  const content = generateQIF(transactions);
  const blob = new Blob([content], { type: 'application/x-qif' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
