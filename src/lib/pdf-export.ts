// Client-side PDF export utility
// Opens a print-ready window with Lanköping branding

const PRINT_STYLES = `
  @page { margin: 2cm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Georgia, 'Times New Roman', serif;
    color: #1a1a1a;
    background: #fff;
    font-size: 11pt;
    line-height: 1.6;
  }
  .page { max-width: 740px; margin: 0 auto; padding: 0; }
  .header {
    border-top: 6px solid #C04A2A;
    padding-top: 1.5rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid #e0d8cc;
    margin-bottom: 2rem;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .brand { font-family: Georgia, serif; }
  .brand-name {
    font-size: 1.8rem;
    font-weight: bold;
    color: #C04A2A;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .brand-tagline {
    font-size: 8pt;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #888;
    margin-top: 2px;
  }
  .doc-meta {
    text-align: right;
    font-size: 8.5pt;
    color: #666;
    line-height: 1.7;
  }
  .doc-meta strong { color: #1a1a1a; }
  .doc-type {
    font-size: 9pt;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #C04A2A;
    font-family: Arial, sans-serif;
    margin-bottom: 0.3rem;
    font-weight: normal;
  }
  .doc-title {
    font-size: 1.5rem;
    color: #1a1a1a;
    margin-bottom: 2rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #e0d8cc;
  }
  .section { margin-bottom: 1.8rem; }
  .section-label {
    font-size: 8pt;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #888;
    font-family: Arial, sans-serif;
    margin-bottom: 0.5rem;
    font-weight: normal;
  }
  .field-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.8rem 2rem;
  }
  .field { margin-bottom: 0.4rem; }
  .field-key { font-size: 8.5pt; color: #888; font-family: Arial, sans-serif; }
  .field-val { font-size: 11pt; }
  .divider {
    border: none;
    border-top: 1px solid #e0d8cc;
    margin: 1.5rem 0;
  }
  .sig-block { margin-bottom: 2.5rem; }
  .sig-name { font-weight: bold; margin-bottom: 0.3rem; }
  .sig-role { font-size: 9pt; color: #666; margin-bottom: 1rem; font-family: Arial, sans-serif; letter-spacing: 0.05em; }
  .sig-line {
    display: flex;
    gap: 3rem;
    align-items: flex-end;
  }
  .sig-field {
    flex: 1;
  }
  .sig-underline {
    border-bottom: 1px solid #333;
    height: 2rem;
    margin-bottom: 4px;
  }
  .sig-underline.prefilled {
    display: flex;
    align-items: flex-end;
    padding: 0 0.25rem 0.2rem 0.25rem;
    font-size: 10pt;
    color: #1a1a1a;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sig-label { font-size: 8pt; color: #888; font-family: Arial, sans-serif; }
  .digital-status {
    display: inline-block;
    font-size: 8.5pt;
    font-family: Arial, sans-serif;
    padding: 2px 8px;
    border: 1px solid;
    margin-top: 0.4rem;
  }
  .digital-signed { border-color: #2d7a2d; color: #2d7a2d; background: #f0fff0; }
  .digital-unsigned { border-color: #c04a2a; color: #c04a2a; background: #fff8f6; }
  .checklist-item {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 0.4rem;
    font-size: 10pt;
  }
  .checkbox {
    width: 14px;
    height: 14px;
    border: 1.5px solid #666;
    display: inline-block;
    flex-shrink: 0;
  }
  .content-body {
    white-space: pre-wrap;
    font-size: 10pt;
    line-height: 1.8;
    color: #1a1a1a;
  }
  .footer {
    margin-top: 3rem;
    padding-top: 1rem;
    border-top: 1px solid #e0d8cc;
    font-size: 8pt;
    color: #aaa;
    font-family: Arial, sans-serif;
    display: flex;
    justify-content: space-between;
  }
  .important-notice {
    background: #fff8f6;
    border: 1px solid #C04A2A;
    border-left: 4px solid #C04A2A;
    padding: 0.8rem 1rem;
    margin-bottom: 1.5rem;
    font-size: 9.5pt;
    font-family: Arial, sans-serif;
  }
  @media print {
    body { font-size: 10pt; }
    .no-print { display: none !important; }
  }
`

const PRINT_ACTIONS = `
  <style>
    .print-bar {
      position: fixed;
      top: 0; left: 0; right: 0;
      background: #1a1a1a;
      color: #fff;
      padding: 0.6rem 1.5rem;
      display: flex;
      gap: 1rem;
      align-items: center;
      font-family: Arial, sans-serif;
      font-size: 12px;
      z-index: 1000;
    }
    .print-bar button {
      padding: 6px 16px;
      border: 1px solid #C04A2A;
      background: #C04A2A;
      color: #fff;
      cursor: pointer;
      font-size: 11px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    .print-bar button.sec {
      background: transparent;
      color: #C04A2A;
    }
    .print-bar span { color: #999; font-size: 10px; }
    .page { margin-top: 3rem; }
    @media print { .print-bar { display: none; } .page { margin-top: 0; } }
  </style>
  <div class="print-bar no-print">
    <button onclick="window.print()">Skriv ut / Spara PDF</button>
    <button class="sec" onclick="window.close()">Stäng</button>
    <span>Att skrivas ut och signeras i person</span>
  </div>
`

function openPrintWindow() {
  const url = `${window.location.origin}/dokument/utskrift`
  return window.open(url, '_blank')
}

function formatDate(d: Date | string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' })
}

function formatDateTime(d: Date | string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleString('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function docFooter(docId: number | string, type: string) {
  return `<div class="footer">
    <span>Lanköping — Officiellt dokument</span>
    <span>${type} — Dok. ${docId} — Klassificering: Intern</span>
  </div>`
}

export interface AvgangPdfData {
  id: number
  namn: string
  pnr: string
  roll: string
  orsak: string
  datum: Date | string | null
  createdAt: Date | string | null
  generatedByName: string | null
  requiredSigners: Array<{ userId: number; name: string; email: string; signed: boolean }>
  status: string
  physicalSigned: boolean
  allSigned: boolean
}

export interface StadgarPdfData {
  content: string
  signers: Array<{ userId: number; name: string; email: string; signed: boolean }>
  updatedAt: Date | string | null
  generatedByName: string
}

export interface AgreementPdfData {
  id: number
  title: string
  description: string | null
  body: string
  createdAt: Date | string | null
  generatedAt: Date | string | null
  generatedByName: string | null
  requiredSigners: Array<{ userId: number; name: string; email: string; signed: boolean; nameClarification?: string | null; role?: string | null }>
  status: string
  recipientIsUnder18?: boolean
  adminPhysicalNameClarification?: string | null
  guardianNameClarification?: string | null
}

export function openAvgangPdf(data: AvgangPdfData, generatedByName: string) {
  const now = new Date()

  const signerRows = data.requiredSigners.map(s => `
    <div class="sig-block">
      <div class="sig-name">${s.name}</div>
      <div class="sig-role">${s.email}</div>
      <div class="sig-line">
        <div class="sig-field">
          <div class="sig-underline"></div>
          <div class="sig-label">Namnteckning</div>
        </div>
        <div class="sig-field">
          <div class="sig-underline"></div>
          <div class="sig-label">Datum</div>
        </div>
        <div class="sig-field">
          <div class="sig-underline"></div>
          <div class="sig-label">Namnförtydligande</div>
        </div>
      </div>
      <div class="digital-status ${s.signed ? 'digital-signed' : 'digital-unsigned'}">
        Digital förbekräftelse: ${s.signed ? 'Bekräftad' : 'Ej bekräftad'}
      </div>
    </div>
  `).join('<hr class="divider">')

  const avgangSignerRow = `
    <div class="sig-block">
      <div class="sig-name">${data.namn}</div>
      <div class="sig-role">Avgående person</div>
      <div class="sig-line">
        <div class="sig-field"><div class="sig-underline"></div><div class="sig-label">Namnteckning</div></div>
        <div class="sig-field"><div class="sig-underline"></div><div class="sig-label">Datum</div></div>
      </div>
    </div>
  `

  const html = `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="utf-8">
  <title>Avgångsbrev — Lanköping — Dok. ${data.id}</title>
  <style>${PRINT_STYLES}</style>
</head>
<body>
${PRINT_ACTIONS}
<div class="page">
  <div class="header">
    <div class="brand">
      <div class="brand-name">Lanköping</div>
      <div class="brand-tagline">Officiellt dokument</div>
    </div>
    <div class="doc-meta">
      <strong>Avgångsbrev</strong><br>
      Dok. nr: AVG-${String(data.id).padStart(4, '0')}<br>
      Genererat: ${formatDateTime(now)}<br>
      Genererat av: ${generatedByName}<br>
      Status: ${data.status.toUpperCase()}
    </div>
  </div>

  <div class="doc-type">Avgångsbrev</div>
  <h1 class="doc-title">Avgångsbegäran — ${data.namn}</h1>

  <div class="important-notice">
    Detta dokument ska skrivas ut och signeras fysiskt av samtliga parter. 
    Förvaras i Lanköpings officiella arkiv efter signering.
  </div>

  <div class="section">
    <div class="section-label">Personuppgifter</div>
    <div class="field-grid">
      <div class="field"><div class="field-key">Namn</div><div class="field-val">${data.namn}</div></div>
      <div class="field"><div class="field-key">Personnummer</div><div class="field-val">${data.pnr}</div></div>
      <div class="field"><div class="field-key">Roll</div><div class="field-val">${data.roll}</div></div>
      <div class="field"><div class="field-key">Avgångsdatum</div><div class="field-val">${formatDate(data.datum)}</div></div>
    </div>
  </div>

  <hr class="divider">

  <div class="section">
    <div class="section-label">Anledning till avgång</div>
    <div class="content-body">${data.orsak}</div>
  </div>

  <hr class="divider">

  <div class="section">
    <div class="section-label">Avgående persons underskrift</div>
    ${avgangSignerRow}
  </div>

  <hr class="divider">

  <div class="section">
    <div class="section-label">Föreningssignatärer</div>
    ${signerRows || '<p>Inga signatärer registrerade</p>'}
  </div>

  <hr class="divider">

  <div class="section">
    <div class="section-label">Checklista</div>
    <div class="checklist-item"><span class="checkbox"></span> Personlig överenskommelse upprättad</div>
    <div class="checklist-item"><span class="checkbox"></span> Övergångstid avtalad</div>
    <div class="checklist-item"><span class="checkbox"></span> Utrustning/åtkomst återlämnad</div>
    <div class="checklist-item"><span class="checkbox"></span> Arkiverat i Lanköpings system</div>
  </div>

  <hr class="divider">

  <div class="section">
    <div class="section-label">Dokumentinformation</div>
    <div class="field-grid">
      <div class="field"><div class="field-key">Registreringsdatum</div><div class="field-val">${formatDate(data.createdAt)}</div></div>
      <div class="field"><div class="field-key">Dokumentnummer</div><div class="field-val">AVG-${String(data.id).padStart(4, '0')}</div></div>
    </div>
  </div>

  ${docFooter(`AVG-${String(data.id).padStart(4, '0')}`, 'Avgångsbrev')}
</div>
</body>
</html>`

  const w = openPrintWindow()
  if (!w) { alert('Tillåt popup-fönster för att öppna dokumentet'); return }
  w.document.write(html)
  w.document.close()
  w.focus()
}

export function openStadgarPdf(data: StadgarPdfData, generatedByName: string) {
  const now = new Date()

  // Convert markdown headers to simple text
  const content = data.content.replace(/^#{1,3} /gm, '').replace(/\*\*/g, '')

  const signerRows = data.signers.map(s => `
    <div class="sig-block">
      <div class="sig-name">${s.name}</div>
      <div class="sig-role">${s.email}</div>
      <div class="sig-line">
        <div class="sig-field"><div class="sig-underline"></div><div class="sig-label">Namnteckning</div></div>
        <div class="sig-field"><div class="sig-underline"></div><div class="sig-label">Datum</div></div>
        <div class="sig-field"><div class="sig-underline"></div><div class="sig-label">Namnförtydligande</div></div>
      </div>
      <div class="digital-status ${s.signed ? 'digital-signed' : 'digital-unsigned'}">
        Digital förbekräftelse: ${s.signed ? 'Bekräftad' : 'Ej bekräftad'}
      </div>
    </div>
  `).join('<hr class="divider">')

  const html = `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="utf-8">
  <title>Stadgar — Lanköping</title>
  <style>${PRINT_STYLES}</style>
</head>
<body>
${PRINT_ACTIONS}
<div class="page">
  <div class="header">
    <div class="brand">
      <div class="brand-name">Lanköping</div>
      <div class="brand-tagline">Officiellt dokument</div>
    </div>
    <div class="doc-meta">
      <strong>Stadgar</strong><br>
      Genererat: ${formatDateTime(now)}<br>
      Genererat av: ${generatedByName}<br>
      Senast ändrad: ${formatDate(data.updatedAt)}
    </div>
  </div>

  <div class="doc-type">Stadgar</div>
  <h1 class="doc-title">Stadgar för Lanköping</h1>

  <div class="section">
    <div class="content-body">${content}</div>
  </div>

  <hr class="divider">

  <div class="section">
    <div class="section-label">Signatärer</div>
    ${signerRows || '<p>Inga signatärer registrerade</p>'}
  </div>

  ${docFooter('STADGAR-1', 'Stadgar')}
</div>
</body>
</html>`

  const w = openPrintWindow()
  if (!w) { alert('Tillåt popup-fönster för att öppna dokumentet'); return }
  w.document.write(html)
  w.document.close()
  w.focus()
}

export function openAgreementPdf(data: AgreementPdfData, generatedByName: string) {
  const adminSigner = data.requiredSigners.find((signer) => signer.role === 'organizer')
  const printableStatus = data.status.toLowerCase() === 'draft' ? 'FOR SIGNERING' : data.status.toUpperCase()
  const adminDatePrefill = formatDate(data.generatedAt || new Date())

  const signerRows = data.requiredSigners.map(s => `
    <div class="sig-block">
      <div class="sig-name">${s.name}</div>
      <div class="sig-role">${s.email}</div>
      <div class="sig-line">
        <div class="sig-field"><div class="sig-underline"></div><div class="sig-label">Namnteckning</div></div>
        <div class="sig-field">
          <div class="sig-underline${s.userId === adminSigner?.userId ? ' prefilled' : ''}">${s.userId === adminSigner?.userId ? adminDatePrefill : ''}</div>
          <div class="sig-label">Datum</div>
        </div>
        <div class="sig-field">
          <div class="sig-underline${s.userId === adminSigner?.userId && s.signed && (data.adminPhysicalNameClarification || s.nameClarification) ? ' prefilled' : ''}">${s.userId === adminSigner?.userId && s.signed ? (data.adminPhysicalNameClarification || s.nameClarification || '') : ''}</div>
          <div class="sig-label">Namnförtydligande</div>
        </div>
      </div>
      <div class="digital-status ${s.signed ? 'digital-signed' : 'digital-unsigned'}">
        Digital förbekräftelse: ${s.signed ? 'Bekräftad' : 'Ej bekräftad'}
      </div>
    </div>
  `).join('<hr class="divider">')

  const guardianSection = data.recipientIsUnder18
    ? `
  <hr class="divider">

  <div class="section">
    <div class="section-label">Målsman (mottagare under 18 år)</div>
    <div class="sig-block">
      <div class="sig-role">Målsman måste fylla i och signera manuellt på fysisk kopia</div>
      <div class="sig-line">
        <div class="sig-field"><div class="sig-underline"></div><div class="sig-label">Namnteckning (målsman)</div></div>
        <div class="sig-field"><div class="sig-underline"></div><div class="sig-label">Datum</div></div>
        <div class="sig-field">
          <div class="sig-underline${data.guardianNameClarification ? ' prefilled' : ''}">${data.guardianNameClarification || ''}</div>
          <div class="sig-label">Namnförtydligande (målsman)</div>
        </div>
      </div>
    </div>
  </div>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="utf-8">
  <title>${data.title} - Lanköping</title>
  <style>${PRINT_STYLES}</style>
</head>
<body>
${PRINT_ACTIONS}
<div class="page">
  <div class="header">
    <div class="brand">
      <div class="brand-name">Lanköping</div>
      <div class="brand-tagline">Officiellt dokument</div>
    </div>
    <div class="doc-meta">
      <strong>Anpassat avtal</strong><br>
      Dok. nr: AVT-${String(data.id).padStart(4, '0')}<br>
      Genererat: ${formatDateTime(data.generatedAt || new Date())}<br>
      Genererat av: ${generatedByName}<br>
      Status: ${printableStatus}
    </div>
  </div>

  <div class="doc-type">Avtal</div>
  <h1 class="doc-title">${data.title}</h1>

  ${data.description ? `<div class="important-notice">${data.description}</div>` : ''}

  <div class="section">
    <div class="section-label">Avtalstext</div>
    <div class="content-body">${data.body}</div>
  </div>

  <hr class="divider">

  <div class="section">
    <div class="section-label">Signatärer</div>
    ${signerRows || '<p>Inga signatärer registrerade</p>'}
  </div>

  ${guardianSection}

  <hr class="divider">

  <div class="section">
    <div class="section-label">Dokumentinformation</div>
    <div class="field-grid">
      <div class="field"><div class="field-key">Skapat</div><div class="field-val">${formatDate(data.createdAt)}</div></div>
      <div class="field"><div class="field-key">Dokumentnummer</div><div class="field-val">AVT-${String(data.id).padStart(4, '0')}</div></div>
    </div>
  </div>

  ${docFooter(`AVT-${String(data.id).padStart(4, '0')}`, 'Anpassat avtal')}
</div>
</body>
</html>`

  const w = openPrintWindow()
  if (!w) { alert('Tillåt popup-fönster för att öppna dokumentet'); return }
  w.document.write(html)
  w.document.close()
  w.focus()
}
