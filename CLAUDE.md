# Programación de Consultas Médicas — Instrucciones Claude

## Exportar rotativa a Excel y Google Sheets

### Objetivo

Al presionar **Exportar Excel** o **Exportar Sheet**, el sistema genera la rotativa en el mismo formato visual que la hoja de referencia "Rotativa MI Junio 2026".

**No aplica a exportación PDF.**

---

### Regla principal

El sistema debe:
1. Tomar los datos de la plataforma de entrada.
2. Adaptarlos al formato de rotativa semanal de la hoja de referencia.
3. Sustituir nombres, fechas, horarios, actividades, turnos y observaciones con los datos reales.
4. Mantener la misma distribución de tablas y colores de leyenda.
5. Exportar `.xlsx` con **Exportar Excel**.
6. Crear/actualizar Google Sheet con **Exportar Sheet**.

---

### Distribución de columnas (por pestaña/profesional)

```
Fila 1:    Nombre del profesional (merge A:T)

Semana 1:  A:F   (col A = HORARIO, B:F = Lun-Vie)
Sep:       G     (vacío)
Semana 2:  H:M
Sep:       N     (vacío)
Semana 3:  O:T
Sep:       U     (si aplica)
Leyenda:   V = celda de color | W = nombre concepto

Semana 4:  A:F   (debajo de los bloques superiores + 1 fila vacía)
Sep:       G     (vacío)
Semana 5:  H:M   (debajo)

Metas/obs: desde O, debajo de semana 3 o junto a bloques inferiores
```

Cada bloque semanal tiene:
- Fila encabezado: HORARIO | LUNES | MARTES | MIERCOLES | JUEVES | VIERNES
- Fila fechas: debajo del encabezado (color `#FEF2CB`)
- Filas de franjas horarias (color encabezado días: `#DEEAF6`)

---

### Turnos de fin de semana

**Nunca** agregar columnas SABADO/DOMINGO dentro de la tabla Lun-Vie.

Los turnos de fin de semana van **fuera del bloque**, en la zona lateral/separador:
- Semana 1 → junto a cols F:G
- Semana 2 → junto a cols M:N
- Semana 3 → junto a cols T:U
- Bloques inferiores → misma lógica

Textos válidos: `TURNO`, `SABADO`, `DOMINGO`, `POST TURNO`, `EXTRA`

---

### Colores de leyenda (fuente de verdad)

Si hay plantilla viva → leer HEX directamente de las celdas columna V.
Si no → usar esta configuración centralizada (no dispersar HEX en el código):

| Concepto | ARGB (ExcelJS) | HEX |
|----------|----------------|-----|
| UPC | `FFCC00FF` | `#CC00FF` |
| policlinico | `FFFFFF00` | `#FFFF00` |
| sala | `FF70AD47` | `#70AD47` |
| horario protegido | `FFFF0000` | `#FF0000` |
| Actividades adm | `FFC55A11` | `#C55A11` |
| feriado | `00000000` | sin relleno |
| permiso adm/feriado legal | `FF4472C4` | `#4472C4` |
| reunion de servicio | `FF00B0F0` | `#00B0F0` |
| libre 22x28 | `FF00FF00` | `#00FF00` |
| licencia | `FF666666` | `#666666` |
| capacitacion/comision de servicio | `FFFF00FF` | `#FF00FF` |

**No incluir en la leyenda:** INGRESOS nuevos, CONTROLES, TURNO 24h, POST TURNO.
Estos van en las celdas de la rotativa o como notas laterales, no en la leyenda.

Colores adicionales del formato (no en leyenda):
- Encabezados de días: `#DEEAF6` → ARGB `FFDEEAF6`
- Fila de fechas: `#FEF2CB` → ARGB `FFFEF2CB`
- Encabezado doctor: `#1F3864` → ARGB `FF1F3864`
- Fuente: Calibri

---

### Ingresos y controles (policlinico)

- Por defecto: **2 INGRESOS + 3 CONTROLES**
- Si la plataforma envía cantidad explícita → respetar exactamente
- Color de fondo: el de **policlinico** (tomado de la leyenda)
- El texto de cada celda es la actividad exacta (`INGRESO`, `CONTROL`), no el nombre del concepto

---

### Aplicación de colores en celdas de la rotativa

La celda se pinta con el color del concepto que le corresponda:
- UPC, sala, policlinico, permiso, licencia, capacitación → color de su entrada en la leyenda
- Si la entrada trae categoría explícita → usarla antes de inferir por texto
- Si no trae categoría → inferir solo cuando sea inequívoco
- Feriado → sin relleno (transparent), texto "FERIADO" en el primer slot

---

### Reglas de implementación en código

```typescript
// Colores centralizados en un único objeto C (en utils.ts)
// No hardcodear HEX en múltiples partes del código

// Feriado: ARGB '00000000' = sin relleno
// En applyStyle: if (bg !== C.NONE && bg !== C.FERIADO_BG) → aplicar fill

// WEEK_COL_STARTS = [1, 8, 15]  → top section (3 semanas)
// Bottom section usa [1, 8]
// LEGEND_COL = 22  → col V

// Nombre del archivo Excel:
// Rotativa_{period}_{YYYY-MM-DD}.xlsx
```

---

### Checklist de validación antes de dar por terminado

- [ ] Exportar Excel descarga un `.xlsx`
- [ ] Exportar Sheet crea/actualiza Google Sheet
- [ ] Una pestaña por profesional
- [ ] Semanas distribuidas en los bloques de columnas correctos (3 arriba / 2 abajo)
- [ ] Leyenda completa en cols V:W (11 conceptos)
- [ ] Colores de leyenda coinciden con la tabla de arriba
- [ ] Celdas de la rotativa pintadas con el color de su actividad
- [ ] Feriados sin relleno, texto "FERIADO"
- [ ] Ingresos/controles con color de policlinico
- [ ] Turnos de fin de semana fuera de la tabla Lun-Vie
- [ ] Sin exportación PDF en este flujo
