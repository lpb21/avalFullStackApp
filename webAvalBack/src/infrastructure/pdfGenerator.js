const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

/**
 * Genera el PDF de evidencia de una solicitud completamente firmada:
 * datos de la solicitud + tabla de aprobadores con nombre, rol, estado
 * y timestamp de firma. Devuelve los bytes del PDF (Uint8Array).
 */
async function generarPdfEvidencia({ solicitud, aprobadores }) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // Carta (US Letter)
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margenIzq = 50;
  let y = 740;

  function escribir(texto, { size = 11, font = fontRegular, color = rgb(0, 0, 0) } = {}) {
    page.drawText(texto, { x: margenIzq, y, size, font, color });
    y -= size + 8;
  }

  // Encabezado
  escribir("Evidencia de Aprobación", { size: 18, font: fontBold });
  y -= 10;

  // Datos de la solicitud
  escribir(`Título: ${solicitud.titulo}`, { font: fontBold });
  escribir(`Descripción: ${solicitud.descripcion}`);
  escribir(`Monto: $${Number(solicitud.monto).toLocaleString("es-CO")}`);
  escribir(`Solicitante: ${solicitud.solicitante_nombre} (${solicitud.solicitante_email})`);
  escribir(`Fecha de creación: ${new Date(solicitud.fecha_creacion).toLocaleString("es-CO")}`);
  escribir(`ID de solicitud: ${solicitud.solicitud_id}`, { size: 9 });
  y -= 15;

  // Tabla de aprobadores
  escribir("Aprobadores", { size: 14, font: fontBold });
  y -= 5;

  const aprobadoresOrdenados = [...aprobadores].sort((a, b) => a.orden - b.orden);

  for (const aprobador of aprobadoresOrdenados) {
    escribir(`${aprobador.orden}. ${aprobador.nombre} — ${aprobador.rol}`, { font: fontBold });
    escribir(`   Estado: ${aprobador.estado_firma}`, { size: 10 });
    if (aprobador.fecha_firma) {
      escribir(`   Fecha: ${new Date(aprobador.fecha_firma).toLocaleString("es-CO")}`, { size: 10 });
    }
    if (aprobador.hash_firma) {
      escribir(`   Hash: ${aprobador.hash_firma}`, { size: 8, color: rgb(0.4, 0.4, 0.4) });
    }
    y -= 8;
  }

  y -= 10;
  escribir(
    "Documento generado automáticamente. Las firmas están encadenadas mediante hash SHA-256 (chain of custody).",
    { size: 9, color: rgb(0.4, 0.4, 0.4) }
  );

  return pdfDoc.save(); // devuelve Uint8Array
}

module.exports = { generarPdfEvidencia };