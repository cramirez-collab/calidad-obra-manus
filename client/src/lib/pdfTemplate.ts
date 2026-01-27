/**
 * Plantilla estándar de PDF para todos los reportes de ObjetivaOQC
 * - Logo Objetiva a la izquierda
 * - Nombre del proyecto a la derecha
 * - Fecha de impresión
 * - Numeración de páginas "1 de X"
 */

export interface PDFTemplateOptions {
  title: string;
  proyectoNombre: string;
  content: string;
  totalPages?: number;
  currentPage?: number;
}

export const getPDFStyles = () => `
  @page {
    size: letter portrait;
    margin: 15mm;
  }
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  body {
    font-family: Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.4;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    padding-bottom: 50px;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #002C63;
    padding-bottom: 10px;
    margin-bottom: 20px;
  }
  .logo {
    font-size: 18pt;
    font-weight: bold;
    color: #002C63;
  }
  .logo span {
    color: #02B381;
  }
  .header-right {
    text-align: right;
    font-size: 10pt;
    color: #333;
  }
  .header-right .proyecto {
    font-weight: bold;
    font-size: 12pt;
    color: #002C63;
  }
  h1 {
    font-size: 16pt;
    color: #002C63;
    margin-bottom: 15px;
  }
  h2 {
    font-size: 14pt;
    color: #002C63;
    margin: 20px 0 10px 0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 20px;
  }
  th {
    background-color: #002C63;
    color: white;
    padding: 8px 10px;
    text-align: left;
    font-size: 10pt;
  }
  td {
    padding: 8px 10px;
    border-bottom: 1px solid #ddd;
    font-size: 10pt;
  }
  tr:nth-child(even) {
    background-color: #f9f9f9;
  }
  .summary-card {
    display: inline-block;
    background: #f5f5f5;
    border-radius: 8px;
    padding: 15px 25px;
    margin: 5px;
    text-align: center;
  }
  .summary-card .value {
    font-size: 24pt;
    font-weight: bold;
    color: #002C63;
  }
  .summary-card .label {
    font-size: 9pt;
    color: #666;
  }
  .footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    text-align: center;
    font-size: 9pt;
    color: #666;
    padding: 10px 15mm;
    border-top: 1px solid #ddd;
    background: white;
  }
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 9pt;
    font-weight: 500;
  }
  .badge-success { background: #dcfce7; color: #166534; }
  .badge-warning { background: #fef3c7; color: #92400e; }
  .badge-danger { background: #fee2e2; color: #991b1b; }
  .badge-info { background: #dbeafe; color: #1e40af; }
  .badge-gray { background: #f3f4f6; color: #374151; }
  .text-right { text-align: right; }
  .text-center { text-align: center; }
  .text-muted { color: #666; }
  .text-bold { font-weight: bold; }
  .mb-4 { margin-bottom: 16px; }
  .mt-4 { margin-top: 16px; }
  @media print {
    .footer {
      position: fixed;
    }
    .page-break {
      page-break-before: always;
    }
  }
`;

export const getFechaImpresion = () => {
  return new Date().toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const generatePDFHeader = (proyectoNombre: string) => `
  <div class="header">
    <div class="logo">OBJETIV<span>A</span></div>
    <div class="header-right">
      <div class="proyecto">${proyectoNombre}</div>
      <div>${getFechaImpresion()}</div>
    </div>
  </div>
`;

export const generatePDFFooter = (currentPage: number, totalPages: number) => `
  <div class="footer">
    Página ${currentPage} de ${totalPages} | Generado por ObjetivaOQC
  </div>
`;

export const openPrintWindow = (options: PDFTemplateOptions): Window | null => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return null;

  const { title, proyectoNombre, content, totalPages = 1, currentPage = 1 } = options;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title} - ${proyectoNombre}</title>
        <style>${getPDFStyles()}</style>
      </head>
      <body>
        ${generatePDFHeader(proyectoNombre)}
        ${content}
        ${generatePDFFooter(currentPage, totalPages)}
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() {
              window.close();
            };
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();

  return printWindow;
};

// Función para generar tabla HTML estándar
export const generateTable = (
  headers: string[],
  rows: (string | number | null | undefined)[][],
  options?: { alignRight?: number[] }
) => {
  const alignRight = options?.alignRight || [];
  
  return `
    <table>
      <thead>
        <tr>
          ${headers.map((h, i) => `<th${alignRight.includes(i) ? ' class="text-right"' : ''}>${h}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rows.map(row => `
          <tr>
            ${row.map((cell, i) => `<td${alignRight.includes(i) ? ' class="text-right"' : ''}>${cell ?? '-'}</td>`).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
};

// Función para generar tarjetas de resumen
export const generateSummaryCards = (cards: { value: string | number; label: string }[]) => {
  return `
    <div class="mb-4">
      ${cards.map(card => `
        <div class="summary-card">
          <div class="value">${card.value}</div>
          <div class="label">${card.label}</div>
        </div>
      `).join('')}
    </div>
  `;
};

// Función para generar badge de estado
export const generateBadge = (text: string, type: 'success' | 'warning' | 'danger' | 'info' | 'gray' = 'gray') => {
  return `<span class="badge badge-${type}">${text}</span>`;
};
