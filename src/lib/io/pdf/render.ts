import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/**
 * Render an HTML string offscreen, capture it with html2canvas, and paginate the
 * bitmap into an A4 jsPDF document. This guarantees correct Arabic shaping and
 * RTL layout across every PDF viewer.
 */
export async function renderHtmlToPdf(html: string, fileName: string) {
  const host = document.createElement("div");
  host.style.cssText =
    "position:fixed;inset:auto auto 0 -10000px;width:794px;z-index:-1;pointer-events:none;opacity:0;";
  host.innerHTML = html;
  document.body.appendChild(host);

  try {
    // Wait one paint so fonts + images apply.
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    await new Promise((r) => setTimeout(r, 50));

    const node = host.firstElementChild as HTMLElement;
    const canvas = await html2canvas(node, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      windowWidth: 794,
    });

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;

    if (imgH <= pageH) {
      pdf.addImage(
        canvas.toDataURL("image/jpeg", 0.95),
        "JPEG",
        0,
        0,
        imgW,
        imgH,
        undefined,
        "FAST",
      );
    } else {
      paginateCanvas(pdf, canvas, pageW, pageH);
    }

    addPageNumbers(pdf, pageW, pageH);
    pdf.save(fileName);
  } finally {
    document.body.removeChild(host);
  }
}

/** Slice the bitmap per page to avoid huge negative-offset rendering blur. */
function paginateCanvas(pdf: jsPDF, canvas: HTMLCanvasElement, pageW: number, pageH: number) {
  const pxPerMm = canvas.width / pageW;
  const pageHpx = Math.floor(pageH * pxPerMm);
  let y = 0;
  let first = true;

  while (y < canvas.height) {
    const sliceH = Math.min(pageHpx, canvas.height - y);
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = sliceH;
    const ctx = slice.getContext("2d");
    if (!ctx) break;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
    const sliceImgH = (sliceH * pageW) / canvas.width;
    if (!first) pdf.addPage();
    pdf.addImage(
      slice.toDataURL("image/jpeg", 0.95),
      "JPEG",
      0,
      0,
      pageW,
      sliceImgH,
      undefined,
      "FAST",
    );
    first = false;
    y += sliceH;
  }
}

function addPageNumbers(pdf: jsPDF, pageW: number, pageH: number) {
  const pageCount = (pdf as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    pdf.setPage(p);
    pdf.setFontSize(8);
    pdf.setTextColor(120);
    pdf.text(`Page ${p} / ${pageCount}`, pageW - 10, pageH - 5, { align: "right" });
  }
}
