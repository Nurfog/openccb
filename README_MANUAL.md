# Manual de Usuario - OpenCCB Studio
## Complementos y Guías de Instalación

### 📋 Archivos Incluidos

1. **Manual_Usuario_OpenCCB_Studio.docx** (43 KB)
   - Manual profesional completo en formato Microsoft Word
   - Contiene ~40-50 páginas de contenido
   - Estructura lista para agregar screenshots
   - Totalmente editable

### 🖼️ Cómo Agregar Screenshots al Manual

El manual incluye marcadores indicados con comentarios donde debe insertarse contenido visual. Para agregar screenshots:

#### Opción 1: Manualmente en Microsoft Word

1. **Abra el documento** en Microsoft Word o LibreOffice Writer
2. **Acceda a la aplicación** en `studio.norteamericano.com`
3. **Tome screenshots** de cada sección (Pantalla Completa = Windows + Shift + S)
4. **En el Manual**, ubique las secciones indicadas:
   - Sección 3: Panel Principal
   - Sección 5: Plantillas de Prueba  
   - Sección 6: Plantillas de Curso
   - Sección 7: Creación de Cursos
   - Sección 8: Gestión de Lecciones
   - Sección 9: IA - Generación de Preguntas
   - Sección 10: Ejercicios y Evaluaciones
   - Sección 11: Configuración
   - Sección 12: Panel de Administrador
   - Sección 13: Análisis y Reportes

5. **Inserte imagen**: 
   - Menú → Insertar → Imagen/Imagen desde archivo
   - Seleccione el screenshot
   - Ajuste tamaño a 6 pulgadas de ancho × 4 pulgadas de alto
   - Agregue título descriptivo debajo de la imagen

#### Opción 2: Script Automático (Avanzado)

Se proporciona `add_screenshots_to_manual.py` que puede:
- Importar screenshots desde carpeta
- Insertarlos automáticamente en lugares marcados
- Ajustar tamaños y resolución
- Agregar captions

Uso:
```bash
python3 add_screenshots_to_manual.py \
  --manual Manual_Usuario_OpenCCB_Studio.docx \
  --screenshots /ruta/a/capturas/ \
  --output Manual_Completo.docx
```

### 📸 Screenshots Recomendados

#### Sección 3: Panel Principal
- Captura de pantalla completa después del login
- Mostrar: Navegación, lista de cursos, estadísticas

#### Sección 5: Plantillas de Prueba
1. Lista de plantillas existentes
2. Formulario de crear nueva plantilla
3. Editor de preguntas
4. Vista con IA habilitada

#### Sección 6: Plantillas de Curso
1. Lista de plantillas
2. Formulario de creación
3. Editor de módulos
4. Vista de estructura completa

#### Sección 7: Creación de Curso
1. Diálogo de seleccionar plantilla
2. Formulario básico del curso
3. Configuración de acceso/fecha
4. Confirmación de creación exitosa

#### Sección 8: Gestión de Lecciones
1. Vista de lecciones en un curso
2. Editor de lección con bloques de contenido
3. Insertar video
4. Insertar archivo/recurso

#### Sección 9: IA
1. Botón "Generar con IA" en pantalla
2. Formulario de generación de preguntas
3. Preguntas generadas por IA
4. Opción de mejorar contenido

#### Sección 10: Ejercicios
1. Crear evaluación - formulario
2. Vista de quiz
3. Página de calificación
4. Rúbrica de evaluación

#### Sección 11: Configuración
1. Configuración de Branding (logo, colores)
2. Servicios de Email SMTP
3. Plantillas de Email personalizadas

#### Sección 12: Panel Admin
1. Dashboard de administración
2. Gestión de Usuarios
3. Reportes disponibles

#### Sección 13: Análisis
1. Dashboard de instructor
2. Gráficas de calificaciones
3. Progreso estudiantil
4. Exportación de reportes

### 🎨 Consejos para Screenshots

**Calidad:**
- Resolución mínima: 1920x1080
- Formato: PNG (mejor compresión) o JPG
- Contraste adecuado y legibilidad

**Contenido:**
- Oculte datos sensibles (emails, nombres reales)
- Use datos de demostración obvios
- Priorice interfaz sobre contenido

**Redacción:**
- Agregue captions descriptivos bajo cada imagen
- Ejemplo: "Fig. 1: Panel Principal mostrando cursos activos"

### 📝 Personalización 

El documento puede personalizarse fácilmente:

1. **Portada**: 
   - Cambiar nombre de organización
   - Agregar logo personalizado
   - Modificar fecha

2. **Contacto**:
   - Sección 14: Reemplazar email y teléfono
   - Agregar URL de help center

3. **Branding**:
   - Colores corporativos
   - Logo en encabezado
   - Temas personalizados

### 🔄 Traducción

Para traducir a otro idioma:
1. Abra el DOCX en Word
2. Menú → Revisar → Traducir
3. Seleccione idioma destino
4. Revise las traducciones automáticas

O use: `python3 translate_manual.py --lang es --output Manual_ES.docx`

### 📤 Distribución

El manual puede distribuirse como:

**Formato Final:**
- PDF (más profesional para distribución)
  - File → Export as PDF en Word
  - Mantiene formato, ideal para impresión

- DOCX (editable por usuarios)
  - Permite anotaciones
  - Actualizaciones fáciles

- HTML (para portales web)
  - Convertir con: `python3 convert_to_html.py input.docx output.html`

### 🛠️ Edición de Futuro

Para futuras ediciones:
1. Abra el .docx en Word
2. Actualice contenido según cambios de interfaz
3. Reemplace screenshots antiguas con nuevas
4. Aumente número de versión en portada
5. Re-exporte como PDF

### 📞 Soporte

Si encuentra problemas con:
- **Generación de documento**: Ejecute `python3 generate_manual.py` nuevamente
- **Screenshots**: Use herramienta captura nativa del SO
- **Inserción de imágenes**: Use script automático proporcionado

---

**Versión**: 1.0  
**Fecha**: 15 de Abril de 2026  
**Formato**: OpenCCB Studio - Manual de Usuario
