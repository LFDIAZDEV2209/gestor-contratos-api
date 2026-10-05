import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CrearSubcontratoDto,
  ActualizarSubcontratoDto,
  CrearObligacionDto,
  ItemChecklistDto,
  ToggleChecklistDto,
  VerificarObligacionDto,
  CrearEntregableDto,
  CrearEjecucionDto,
  CrearPagoDto,
  CrearActaDto,
  CrearModificacionDto,
  CrearRiesgoDto,
  CrearIncumplimientoDto,
  CrearPlanDto,
  CrearDocumentoDto,
  CrearTareaDto,
  DelegarAlertaDto,
  ResolverAlertaDto,
} from './children.dto';

describe('Children DTOs (class-validator)', () => {
  describe('Subcontratos', () => {
    const subValido = {
      contractId: 'CT-01',
      numero: 'SUB-01',
      contratista: 'Subcontratista S.A.S.',
      nit: '900.111.222-3',
      objeto: 'Excavaciones',
      valor: 50_000_000,
      fechaInicio: '2026-02-01',
      fechaFin: '2026-06-30',
      estado: 'Activo',
    };

    it('valida exitosamente CrearSubcontratoDto completo', async () => {
      const dto = plainToInstance(CrearSubcontratoDto, subValido);
      expect(await validate(dto)).toHaveLength(0);
    });

    it('falla si los campos tienen valores inválidos (cadenas vacías, valor negativo, fecha inválida)', async () => {
      const dto = plainToInstance(CrearSubcontratoDto, {
        contractId: '',
        numero: '',
        contratista: '',
        valor: -1,
        fechaInicio: 'invalida',
      });
      const errors = await validate(dto);
      const props = errors.map((e) => e.property);

      expect(props).toContain('contractId');
      expect(props).toContain('numero');
      expect(props).toContain('contratista');
      expect(props).toContain('valor');
      expect(props).toContain('fechaInicio');
    });

    it('falla si el estado no pertenece a los permitidos', async () => {
      const dto = plainToInstance(CrearSubcontratoDto, {
        ...subValido,
        estado: 'EstadoInexistente',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'estado')).toBe(true);
    });

    it('valida ActualizarSubcontratoDto exigiendo version >= 1', async () => {
      const dtoValido = plainToInstance(ActualizarSubcontratoDto, { version: 1, valor: 60_000_000 });
      expect(await validate(dtoValido)).toHaveLength(0);

      const dtoSinVersion = plainToInstance(ActualizarSubcontratoDto, { valor: 60_000_000 });
      const errors = await validate(dtoSinVersion);
      expect(errors.some((e) => e.property === 'version')).toBe(true);
    });
  });

  describe('Obligaciones y Checklist', () => {
    it('valida CrearObligacionDto', async () => {
      const dto = plainToInstance(CrearObligacionDto, {
        contractId: 'CT-01',
        descripcion: 'Entregar informe mensual de avance',
        responsable: 'Carlos Gómez',
        fechaLimite: '2026-03-31',
        periodicidad: 'Mensual',
        estado: 'Pendiente',
      });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('ItemChecklistDto valida texto y orden opcional', async () => {
      const dto = plainToInstance(ItemChecklistDto, { texto: 'Item 1', orden: 0 });
      expect(await validate(dto)).toHaveLength(0);

      const dtoInvalido = plainToInstance(ItemChecklistDto, { texto: '' });
      expect((await validate(dtoInvalido)).length).toBeGreaterThan(0);
    });

    it('ToggleChecklistDto valida que hecho sea booleano', async () => {
      const dto = plainToInstance(ToggleChecklistDto, { hecho: true });
      expect(await validate(dto)).toHaveLength(0);

      const dtoInvalido = plainToInstance(ToggleChecklistDto, { hecho: 'si' });
      expect((await validate(dtoInvalido)).length).toBeGreaterThan(0);
    });

    it('VerificarObligacionDto solo permite Cumplida o Cumplida parcialmente', async () => {
      const dtoOk = plainToInstance(VerificarObligacionDto, { estado: 'Cumplida', obs: 'Todo ok' });
      expect(await validate(dtoOk)).toHaveLength(0);

      const dtoInvalido = plainToInstance(VerificarObligacionDto, { estado: 'Pendiente' });
      expect((await validate(dtoInvalido)).some((e) => e.property === 'estado')).toBe(true);
    });
  });

  describe('Entregables y Ejecución mensual', () => {
    it('valida CrearEntregableDto', async () => {
      const dto = plainToInstance(CrearEntregableDto, {
        contractId: 'CT-01',
        nombre: 'Diseño estructural',
        fechaInicio: '2026-01-15',
        fechaProg: '2026-04-15',
        avance: 50,
      });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('CrearEjecucionDto exige formato de periodo YYYY-MM (longitud 7) y avance <= 100', async () => {
      const dtoOk = plainToInstance(CrearEjecucionDto, {
        contractId: 'CT-01',
        periodo: '2026-03',
        valor: 15_000_000,
        avanceFisico: 30,
      });
      expect(await validate(dtoOk)).toHaveLength(0);

      const dtoPeriodoInvalido = plainToInstance(CrearEjecucionDto, {
        contractId: 'CT-01',
        periodo: '2026-3', // longitud 6
        valor: 15_000_000,
        avanceFisico: 30,
      });
      expect((await validate(dtoPeriodoInvalido)).some((e) => e.property === 'periodo')).toBe(true);

      const dtoAvanceExcedido = plainToInstance(CrearEjecucionDto, {
        contractId: 'CT-01',
        periodo: '2026-03',
        valor: 15_000_000,
        avanceFisico: 105,
      });
      expect((await validate(dtoAvanceExcedido)).some((e) => e.property === 'avanceFisico')).toBe(true);
    });
  });

  describe('Pagos y Actas', () => {
    it('CrearPagoDto exige campos requeridos y valores positivos', async () => {
      const dto = plainToInstance(CrearPagoDto, {
        contractId: 'CT-01',
        numero: '1',
        fecha: '2026-03-01',
        factura: 'FAC-001',
        bruto: 10_000_000,
      });
      expect(await validate(dto)).toHaveLength(0);

      const dtoNegativo = plainToInstance(CrearPagoDto, {
        contractId: 'CT-01',
        numero: '1',
        fecha: '2026-03-01',
        factura: 'FAC-001',
        bruto: -500,
      });
      expect((await validate(dtoNegativo)).some((e) => e.property === 'bruto')).toBe(true);
    });

    it('CrearActaDto valida campos obligatorios y fechas', async () => {
      const dto = plainToInstance(CrearActaDto, {
        contractId: 'CT-01',
        numero: 'AC-01',
        tipo: 'Acta de inicio',
        fecha: '2026-01-10',
        descripcion: 'Inicio formal de actividades',
      });
      expect(await validate(dto)).toHaveLength(0);
    });
  });

  describe('Modificaciones (inmutables)', () => {
    it('valida CrearModificacionDto con tipo permitido de TIPOS_MOD', async () => {
      const dto = plainToInstance(CrearModificacionDto, {
        contractId: 'CT-01',
        numero: 'MOD-01',
        tipo: 'Adición',
        fecha: '2026-05-01',
        justificacion: 'Ampliación de metas físicas',
        valorNuevo: 120_000_000,
      });
      expect(await validate(dto)).toHaveLength(0);

      const dtoTipoInvalido = plainToInstance(CrearModificacionDto, {
        contractId: 'CT-01',
        numero: 'MOD-01',
        tipo: 'TipoInvalido',
        fecha: '2026-05-01',
        justificacion: 'Test',
      });
      expect((await validate(dtoTipoInvalido)).some((e) => e.property === 'tipo')).toBe(true);
    });
  });

  describe('Riesgos, Incumplimientos y Planes', () => {
    it('CrearRiesgoDto valida probabilidad e impacto en rango 1 a 5', async () => {
      const dtoOk = plainToInstance(CrearRiesgoDto, {
        contractId: 'CT-01',
        riesgo: 'Aumento de precios de insumos',
        prob: 3,
        impacto: 4,
        tratamiento: 'Mitigar',
      });
      expect(await validate(dtoOk)).toHaveLength(0);

      const dtoRango = plainToInstance(CrearRiesgoDto, {
        contractId: 'CT-01',
        riesgo: 'Test',
        prob: 6, // > 5
        impacto: 0, // < 1
      });
      const errors = await validate(dtoRango);
      expect(errors.some((e) => e.property === 'prob')).toBe(true);
      expect(errors.some((e) => e.property === 'impacto')).toBe(true);
    });

    it('CrearIncumplimientoDto valida campos obligatorios', async () => {
      const dto = plainToInstance(CrearIncumplimientoDto, {
        contractId: 'CT-01',
        fecha: '2026-04-01',
        tipo: 'Mora en entrega',
        descripcion: 'Retraso de 15 días en hito 1',
        impacto: 'Medio',
      });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('CrearPlanDto valida hallazgo y acción requeridos', async () => {
      const dto = plainToInstance(CrearPlanDto, {
        contractId: 'CT-01',
        fecha: '2026-04-05',
        hallazgo: 'Retraso en cronograma',
        accion: 'Duplicar cuadrilla de obra',
      });
      expect(await validate(dto)).toHaveLength(0);
    });
  });

  describe('Documentos y Tareas', () => {
    it('CrearDocumentoDto valida contractId, nombre y categoria', async () => {
      const dto = plainToInstance(CrearDocumentoDto, {
        contractId: 'CT-01',
        nombre: 'Contrato firmado.pdf',
        categoria: 'Contrato',
      });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('CrearTareaDto, DelegarAlertaDto y ResolverAlertaDto validan longitud', async () => {
      const tarea = plainToInstance(CrearTareaDto, {
        titulo: 'Revisar pólizas',
        asignado: 'USR-01',
      });
      expect(await validate(tarea)).toHaveLength(0);

      const delegar = plainToInstance(DelegarAlertaDto, { usuarioId: 'USR-02' });
      expect(await validate(delegar)).toHaveLength(0);

      const resolver = plainToInstance(ResolverAlertaDto, { nota: 'Alerta gestionada' });
      expect(await validate(resolver)).toHaveLength(0);

      const resolverVacio = plainToInstance(ResolverAlertaDto, { nota: '' });
      expect((await validate(resolverVacio)).length).toBeGreaterThan(0);
    });
  });
});
