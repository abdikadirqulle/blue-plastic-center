import type { FinancialLine } from "./financial-report-model"
import { money } from "./financial-report-model"

interface ExportReport {
  company: string
  title: string
  period: string
  basis: string
  lines: FinancialLine[]
}

async function createPdf(report: ExportReport) {
  const { jsPDF } = await import("jspdf")
  const pdf = new jsPDF({ unit: "pt", format: "a4" })
  const width = pdf.internal.pageSize.getWidth()
  let y = 48
  pdf.setTextColor(24, 49, 62)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(11)
  pdf.text(report.company, width / 2, y, { align: "center" })
  y += 20
  pdf.setFontSize(18)
  pdf.text(report.title, width / 2, y, { align: "center" })
  y += 16
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(9)
  pdf.setTextColor(95, 116, 126)
  pdf.text(`${report.period} · ${report.basis} basis`, width / 2, y, { align: "center" })
  y += 30
  const addHeader = () => {
    pdf.setFillColor(240, 246, 249)
    pdf.rect(42, y - 13, width - 84, 22, "F")
    pdf.setFont("helvetica", "bold")
    pdf.setTextColor(45, 69, 80)
    pdf.text("ACCOUNT", 50, y)
    pdf.text("TOTAL", width - 50, y, { align: "right" })
    y += 19
  }
  addHeader()
  for (const line of report.lines) {
    if (y > 770) {
      pdf.addPage()
      y = 48
      addHeader()
    }
    if (line.style === "section") {
      y += 8
      pdf.setFont("helvetica", "bold")
      pdf.setTextColor(0, 125, 204)
    } else {
      pdf.setFont("helvetica", line.style === "account" ? "normal" : "bold")
      pdf.setTextColor(35, 57, 68)
    }
    if (line.style === "total") {
      pdf.setDrawColor(65, 83, 92)
      pdf.line(42, y - 12, width - 42, y - 12)
    }
    pdf.setFontSize(9)
    pdf.text(line.label, 50 + line.level * 16, y)
    if (line.amount !== undefined) pdf.text(money(line.amount), width - 50, y, { align: "right" })
    y += 18
  }
  pdf.setFontSize(7)
  pdf.setTextColor(125, 141, 149)
  pdf.text(`Generated ${new Date().toLocaleString()} · BLUE PLASTIC CENTER`, width / 2, 812, { align: "center" })
  return pdf
}

export async function exportReportPdf(report: ExportReport) {
  const pdf = await createPdf(report)
  pdf.save(`${report.title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}.pdf`)
}

export async function printReportPdf(report: ExportReport, printWindow: Window | null) {
  const pdf = await createPdf(report)
  pdf.autoPrint()
  const url = URL.createObjectURL(pdf.output("blob"))
  if (printWindow) printWindow.location.href = url
  else window.location.href = url
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export function exportReportExcel(report: ExportReport) {
  const rows = report.lines.map((line) =>
    `<tr class="${line.style}"><td style="padding-left:${line.level * 18}px">${line.label}</td><td>${line.amount === undefined ? "" : line.amount.toFixed(2)}</td></tr>`,
  ).join("")
  const html = `<html><head><meta charset="UTF-8"><style>
    body{font-family:Arial;color:#18313e} h1,h2,p{text-align:center;margin:4px}
    table{border-collapse:collapse;width:100%;margin-top:24px} th{background:#eaf5fc;border-bottom:2px solid #50636d}
    td,th{padding:8px;border-bottom:1px solid #dce5ea}.section td{font-weight:bold;color:#007dcc;padding-top:15px}
    .subtotal td{font-weight:bold}.total td{font-weight:bold;border-top:2px solid #50636d;border-bottom:3px double #50636d}
    td:last-child{text-align:right}
  </style></head><body><h2>${report.company}</h2><h1>${report.title}</h1><p>${report.period} · ${report.basis} basis</p>
  <table><thead><tr><th>Account</th><th>Total (USD)</th></tr></thead><tbody>${rows}</tbody></table></body></html>`
  const link = document.createElement("a")
  const url = URL.createObjectURL(new Blob([`\uFEFF${html}`], { type: "application/vnd.ms-excel;charset=utf-8" }))
  link.href = url
  link.download = `${report.title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}.xls`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}
