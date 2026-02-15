              ) : (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-[#002C63]">{reporteIATitulo}</h3>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" className="text-xs h-7" onClick={async () => {
                        try {
                          const { default: jsPDF } = await import("jspdf");
                          const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
                          const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight(), m = 20, mw = pw - m * 2;
                          let y = m;
                          doc.setFillColor(0, 44, 99); doc.rect(0, 0, pw, 30, "F");
                          try {
                            const logoImg = new Image(); logoImg.crossOrigin = 'anonymous';
                            await new Promise<void>((resolve) => { logoImg.onload = () => resolve(); logoImg.onerror = () => resolve(); logoImg.src = '/logo-objetiva.jpg'; });
                            if (logoImg.complete && logoImg.naturalWidth > 0) {
                              const canvas = document.createElement('canvas'); canvas.width = logoImg.naturalWidth; canvas.height = logoImg.naturalHeight;
                              const ctx = canvas.getContext('2d'); ctx?.drawImage(logoImg, 0, 0);
                              doc.addImage(canvas.toDataURL('image/jpeg'), 'JPEG', m, 3, 22, 22);
                            }
                          } catch (e) {}
                          doc.setTextColor(255, 255, 255); doc.setFontSize(10); doc.text("OBJETIVA QUALITY CONTROL", m + 25, 12);
                          doc.setFontSize(12); doc.text(reporteIATitulo, m + 25, 21); y = 38;
                          doc.setTextColor(100, 100, 100); doc.setFontSize(8);
                          doc.text(`Generado: ${new Date().toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" })}`, m, y); y += 8;
                          doc.setDrawColor(0, 44, 99); doc.setLineWidth(0.5); doc.line(m, y, pw - m, y); y += 6;
                          for (const line of reporteIAContent.split("\n")) {
                            if (y > ph - 25) { doc.addPage(); y = m; }
                            const t = line.trim(); if (!t) { y += 4; continue; }
                            if (t.startsWith("### ")) { y += 3; doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(0, 44, 99); const s = doc.splitTextToSize(t.replace(/^### /, "").replace(/\*\*/g, ""), mw); doc.text(s, m, y); y += s.length * 5.5 + 2; continue; }
                            if (t.startsWith("## ")) { y += 5; doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(0, 44, 99); const s = doc.splitTextToSize(t.replace(/^## /, "").replace(/\*\*/g, ""), mw); doc.text(s, m, y); y += s.length * 6 + 2; doc.setDrawColor(2, 179, 129); doc.setLineWidth(0.3); doc.line(m, y, pw - m, y); y += 3; continue; }
                            if (t.startsWith("- ") || t.startsWith("* ")) { doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(50, 50, 50); const s = doc.splitTextToSize(t.replace(/^[-*] /, "").replace(/\*\*(.*?)\*\*/g, "$1"), mw - 8); doc.setFillColor(2, 179, 129); doc.circle(m + 2, y - 1, 0.8, "F"); doc.text(s, m + 6, y); y += s.length * 4.5 + 2; continue; }
                            doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(50, 50, 50); const s = doc.splitTextToSize(t.replace(/\*\*(.*?)\*\*/g, "$1"), mw); doc.text(s, m, y); y += s.length * 4.5 + 2;
                          }
                          const tp = doc.getNumberOfPages(); for (let i = 1; i <= tp; i++) { doc.setPage(i); doc.setFontSize(7); doc.setTextColor(150, 150, 150); doc.text(`Objetiva QC — ${reporteIATitulo}`, m, ph - 8); doc.text(`Página ${i}/${tp}`, pw - m - 20, ph - 8); }
                          const blob = doc.output("blob"); const blobUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' })); window.open(blobUrl, '_blank'); setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
                          toast.success("PDF generado");
                        } catch { toast.error("Error al generar PDF"); }
                      }}>
                        <Download className="w-3 h-3 mr-1" />Abrir PDF
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => { setReporteIAContent(""); setReporteIATitulo(""); }}>
                        Nuevo
                      </Button>
                    </div>
                  </div>

                  {/* 5 Gráficas Relevantes */}
                  {chartDataIA && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
                      <div className="bg-gray-50 rounded-lg p-2 text-center border">
                        <p className="text-[9px] font-bold text-[#002C63] mb-1">Estado</p>
                        <ResponsiveContainer width="100%" height={75}>
                          <PieChart><Pie data={chartDataIA.porStatus} dataKey="value" cx="50%" cy="50%" outerRadius={26} innerRadius={13} strokeWidth={1}>{chartDataIA.porStatus.map((d: any, i: number) => <Cell key={i} fill={d.color} />)}</Pie><RTooltip formatter={(v: any, n: any) => [v, n]} /></PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center border">
                        <p className="text-[9px] font-bold text-[#002C63] mb-1">Empresas</p>
                        <ResponsiveContainer width="100%" height={75}>
                          <BarChart data={chartDataIA.porEmpresa} margin={{ top: 2, right: 2, left: -20, bottom: 0 }}><XAxis dataKey="name" tick={{ fontSize: 6 }} /><YAxis tick={{ fontSize: 6 }} /><Bar dataKey="total" fill="#002C63" radius={[2,2,0,0]} /><Bar dataKey="rechazados" fill="#ef4444" radius={[2,2,0,0]} /><RTooltip /></BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center border">
                        <p className="text-[9px] font-bold text-[#002C63] mb-1">Especialidades</p>
                        <ResponsiveContainer width="100%" height={75}>
                          <BarChart data={chartDataIA.porEspecialidad} margin={{ top: 2, right: 2, left: -20, bottom: 0 }}><XAxis dataKey="name" tick={{ fontSize: 6 }} /><YAxis tick={{ fontSize: 6 }} /><Bar dataKey="total" fill="#6366f1" radius={[2,2,0,0]} /><Bar dataKey="rechazados" fill="#ef4444" radius={[2,2,0,0]} /><RTooltip /></BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center border">
                        <p className="text-[9px] font-bold text-[#002C63] mb-1">Tendencia</p>
                        <ResponsiveContainer width="100%" height={75}>
                          <LineChart data={chartDataIA.tendencia} margin={{ top: 2, right: 8, left: -20, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /><XAxis dataKey="name" tick={{ fontSize: 6 }} /><YAxis tick={{ fontSize: 6 }} /><Line type="monotone" dataKey="creados" stroke="#002C63" strokeWidth={1.5} dot={{ r: 1.5 }} /><Line type="monotone" dataKey="aprobados" stroke="#02B381" strokeWidth={1.5} dot={{ r: 1.5 }} /><RTooltip /></LineChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center border">
                        <p className="text-[9px] font-bold text-[#002C63] mb-1">Defectos</p>
                        <ResponsiveContainer width="100%" height={75}>
                          <BarChart data={chartDataIA.defectos} layout="vertical" margin={{ top: 2, right: 8, left: 0, bottom: 0 }}><XAxis type="number" tick={{ fontSize: 6 }} /><YAxis type="category" dataKey="name" tick={{ fontSize: 5 }} width={40} /><Bar dataKey="frecuencia" fill="#f59e0b" radius={[0,2,2,0]} /><RTooltip /></BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* 3 Fotos de Evidencia */}
                  {fotosEvidenciaIA.length > 0 && (
                    <div className="mb-3">
                      <p className="text-[10px] font-bold text-[#002C63] mb-1">Evidencia Fotográfica</p>
                      <div className="grid grid-cols-3 gap-2">
                        {fotosEvidenciaIA.map((foto: any) => (
                          <div key={foto.id} className="rounded-lg overflow-hidden border bg-gray-50">
                            <img src={getImageUrl(foto.fotoUrl)} alt={foto.codigo} className="w-full h-16 object-cover" />
                            <div className="p-1">
                              <p className="text-[8px] font-bold text-[#002C63] truncate">{foto.codigo}</p>
                              <span className={`text-[7px] px-1 rounded ${foto.status === 'rechazado' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{foto.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="prose prose-slate max-w-none text-sm [&_li]:list-none [&_li]:pl-0" style={{ lineHeight: '1.7' }} dangerouslySetInnerHTML={{ __html: reporteIAContent
