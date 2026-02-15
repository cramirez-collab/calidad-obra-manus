                {analisisResultado && (
                  <div>
                    <div className="flex justify-end gap-2 mb-3">
                      <Button size="sm" variant="outline" onClick={() => handleDescargarPDFIA(analisisResultado, 'Análisis Profundo')} disabled={generandoPDFIA}>
                        {generandoPDFIA ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileText className="h-4 w-4 mr-1" />}
                        Abrir PDF
                      </Button>
                      <Button size="sm" className="bg-[#002C63] hover:bg-[#001d42] text-white" onClick={handleGenerarAnalisis}>Regenerar</Button>
                    </div>

                    {/* 5 Gráficas Relevantes */}
                    {chartDataIA && (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 mb-4">
                        {/* 1. Pie: Estado */}
                        <div className="bg-gray-50 rounded-lg p-2 text-center border">
                          <p className="text-[10px] font-bold text-[#002C63] mb-1">Estado</p>
                          <ResponsiveContainer width="100%" height={90}>
                            <PieChart>
                              <Pie data={chartDataIA.porStatus} dataKey="value" cx="50%" cy="50%" outerRadius={32} innerRadius={16} strokeWidth={1}>
                                {chartDataIA.porStatus.map((d: any, i: number) => <Cell key={i} fill={d.color} />)}
                              </Pie>
                              <RTooltip formatter={(v: any, n: any) => [v, n]} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        {/* 2. Bar: Empresas */}
                        <div className="bg-gray-50 rounded-lg p-2 text-center border">
                          <p className="text-[10px] font-bold text-[#002C63] mb-1">Empresas</p>
                          <ResponsiveContainer width="100%" height={90}>
                            <BarChart data={chartDataIA.porEmpresa} margin={{ top: 2, right: 2, left: -20, bottom: 0 }}>
                              <XAxis dataKey="name" tick={{ fontSize: 7 }} />
                              <YAxis tick={{ fontSize: 7 }} />
                              <Bar dataKey="total" fill="#002C63" radius={[2,2,0,0]} />
                              <Bar dataKey="rechazados" fill="#ef4444" radius={[2,2,0,0]} />
                              <RTooltip />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        {/* 3. Bar: Especialidades */}
                        <div className="bg-gray-50 rounded-lg p-2 text-center border">
                          <p className="text-[10px] font-bold text-[#002C63] mb-1">Especialidades</p>
                          <ResponsiveContainer width="100%" height={90}>
                            <BarChart data={chartDataIA.porEspecialidad} margin={{ top: 2, right: 2, left: -20, bottom: 0 }}>
                              <XAxis dataKey="name" tick={{ fontSize: 7 }} />
                              <YAxis tick={{ fontSize: 7 }} />
                              <Bar dataKey="total" fill="#6366f1" radius={[2,2,0,0]} />
                              <Bar dataKey="rechazados" fill="#ef4444" radius={[2,2,0,0]} />
                              <RTooltip />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        {/* 4. Line: Tendencia Semanal */}
                        <div className="bg-gray-50 rounded-lg p-2 text-center border">
                          <p className="text-[10px] font-bold text-[#002C63] mb-1">Tendencia</p>
                          <ResponsiveContainer width="100%" height={90}>
                            <LineChart data={chartDataIA.tendencia} margin={{ top: 2, right: 8, left: -20, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                              <XAxis dataKey="name" tick={{ fontSize: 7 }} />
                              <YAxis tick={{ fontSize: 7 }} />
                              <Line type="monotone" dataKey="creados" stroke="#002C63" strokeWidth={2} dot={{ r: 2 }} />
                              <Line type="monotone" dataKey="aprobados" stroke="#02B381" strokeWidth={2} dot={{ r: 2 }} />
                              <RTooltip />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                        {/* 5. Bar: Defectos */}
                        <div className="bg-gray-50 rounded-lg p-2 text-center border">
                          <p className="text-[10px] font-bold text-[#002C63] mb-1">Defectos</p>
                          <ResponsiveContainer width="100%" height={90}>
                            <BarChart data={chartDataIA.defectos} layout="vertical" margin={{ top: 2, right: 8, left: 0, bottom: 0 }}>
                              <XAxis type="number" tick={{ fontSize: 7 }} />
                              <YAxis type="category" dataKey="name" tick={{ fontSize: 6 }} width={50} />
                              <Bar dataKey="frecuencia" fill="#f59e0b" radius={[0,2,2,0]} />
                              <RTooltip />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {/* 3 Fotos de Evidencia */}
                    {fotosEvidenciaIA.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs font-bold text-[#002C63] mb-2">Evidencia Fotográfica</p>
                        <div className="grid grid-cols-3 gap-2">
                          {fotosEvidenciaIA.map((foto: any) => (
                            <div key={foto.id} className="rounded-lg overflow-hidden border bg-gray-50">
                              <img src={getImageUrl(foto.fotoUrl)} alt={foto.codigo} className="w-full h-24 object-cover" />
                              <div className="p-1.5">
                                <p className="text-[9px] font-bold text-[#002C63] truncate">{foto.codigo}</p>
                                <p className="text-[8px] text-gray-500 truncate">{foto.empresa} - {foto.especialidad}</p>
                                <span className={`text-[8px] px-1 rounded ${foto.status === 'rechazado' ? 'bg-red-100 text-red-700' : foto.status === 'aprobado' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{foto.status}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Contenido del análisis con interlineado mejorado */}
                    <div className="prose prose-sm max-w-none bg-white rounded-lg border p-4" style={{ lineHeight: '1.7' }}>
                      {analisisResultado
                        .replace(/\\u[0-9a-fA-F]{4}/g, '')
                        .replace(/\\u\d{4}/g, '')
                        .replace(/[•·‣◦⁃∙–—―''""]/g, '')
                        .split('\n').map((line, i) => {
                        const t = line.replace(/\\u[0-9a-fA-F]{4}/g, '').replace(/\\u\d{4}/g, '').trim();
                        if (t.startsWith('### ')) return <h3 key={i} className="text-base font-semibold text-[#004080] mt-3 mb-1.5">{t.replace(/^#+\s*/, '')}</h3>;
                        if (t.startsWith('## ')) return <h2 key={i} className="text-lg font-bold text-[#002C63] mt-4 mb-1.5 border-b pb-1">{t.replace(/^#+\s*/, '')}</h2>;
                        if (t.startsWith('# ')) return <h1 key={i} className="text-xl font-bold text-[#002C63] mt-5 mb-2">{t.replace(/^#+\s*/, '')}</h1>;
                        if (t.startsWith('- ') || t.startsWith('* ')) {
                          const bullet = t.replace(/^[-*]\s*/, '').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
                          return <div key={i} className="flex gap-2 ml-4 text-sm text-gray-700 mb-1.5 leading-relaxed"><span className="text-[#02B381] font-bold mt-0.5">•</span><span dangerouslySetInnerHTML={{ __html: bullet }} /></div>;
                        }
                        if (t.match(/^\d+\.\d+\.\d+\./)) {
                          const num = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
                          return <div key={i} className="ml-8 text-sm text-gray-700 mb-1.5 leading-relaxed" dangerouslySetInnerHTML={{ __html: num }} />;
                        }
                        if (t.match(/^\d+\.\d+\./)) {
                          const num = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
                          return <div key={i} className="ml-4 text-sm font-medium text-gray-800 mb-1.5 leading-relaxed" dangerouslySetInnerHTML={{ __html: num }} />;
                        }
                        if (t.match(/^\d+\./)) {
                          const num = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
                          return <div key={i} className="text-sm font-medium text-gray-800 mb-1.5 leading-relaxed" dangerouslySetInnerHTML={{ __html: num }} />;
                        }
                        if (t.length === 0) return <div key={i} className="h-3" />;
                        const para = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
                        return <p key={i} className="text-sm text-gray-700 mb-1.5 leading-relaxed" dangerouslySetInnerHTML={{ __html: para }} />;
                      })}
                    </div>
                  </div>
                )}
