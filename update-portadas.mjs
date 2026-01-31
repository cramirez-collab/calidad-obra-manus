import { getDb } from './server/db.ts';
import { proyectos } from './drizzle/schema.ts';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function updatePortadas() {
  const db = await getDb();
  
  // Imagen para Hidalma (ID: 1)
  const hidalmaPath = path.join(process.cwd(), 'hidalma-portada.jpg');
  if (fs.existsSync(hidalmaPath)) {
    const hidalmaBuffer = fs.readFileSync(hidalmaPath);
    const hidalmaBase64 = 'data:image/jpeg;base64,' + hidalmaBuffer.toString('base64');
    
    await db.update(proyectos)
      .set({ imagenPortadaBase64: hidalmaBase64 })
      .where(eq(proyectos.id, 1));
    
    console.log('✅ Hidalma actualizado con imagen de portada (' + Math.round(hidalmaBase64.length / 1024) + ' KB)');
  }
  
  // Imagen para Mayas Habitat (ID: 150001)
  const mayasPath = path.join(process.cwd(), 'mayas-portada.jpg');
  if (fs.existsSync(mayasPath)) {
    const mayasBuffer = fs.readFileSync(mayasPath);
    const mayasBase64 = 'data:image/jpeg;base64,' + mayasBuffer.toString('base64');
    
    await db.update(proyectos)
      .set({ imagenPortadaBase64: mayasBase64 })
      .where(eq(proyectos.id, 150001));
    
    console.log('✅ Mayas Habitat actualizado con imagen de portada (' + Math.round(mayasBase64.length / 1024) + ' KB)');
  }
  
  console.log('\\n✅ Portadas de proyectos actualizadas correctamente');
  process.exit(0);
}

updatePortadas().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
