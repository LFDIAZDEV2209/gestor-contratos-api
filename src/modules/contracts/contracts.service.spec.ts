import { ContractsService } from './contracts.service';
import { ContractEntity } from './entities/contract.entity';
import { PaymentEntity } from './entities/payments.entity';
import { ActaEntity } from './entities/actas.entity';
import { DocumentEntity } from './entities/documents.entity';
import { Conflicto, NoEncontrado, Validacion, WarningRequiresConfirmation } from '../../common/exceptions/api-exception';
import { createMockRepo, mockAuditService, mockReqContext, mockSettingsService } from '../../../test/mocks';
import { contratoSano, ctxDe } from '../../engines/test-helpers';
import { ConfigService } from '@nestjs/config';

describe('ContractsService', () => {
  let service: ContractsService;
  let contractRepo: ReturnType<typeof createMockRepo<ContractEntity>>;
  let pagosRepo: ReturnType<typeof createMockRepo<PaymentEntity>>;
  let actasRepo: ReturnType<typeof createMockRepo<ActaEntity>>;
  let docsRepo: ReturnType<typeof createMockRepo<DocumentEntity>>;
  let audit: ReturnType<typeof mockAuditService>;
  let settings: ReturnType<typeof mockSettingsService>;
  let loader: any;
  let config: any;

  const ctx = mockReqContext();

  const dummyContract: ContractEntity = {
    ...contratoSano({
      id: 'CT-01',
      numero: 'CT-2026-001',
      anulado: false,
      estado: 'Activo',
      fechaFirma: '2026-01-01',
      fechaInicio: '2026-01-01',
      fechaFin: '2026-12-31',
      valorBase: 1_000_000,
    }),
    version: 1,
    companyId: 'EMP-01',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as ContractEntity;

  beforeEach(() => {
    contractRepo = createMockRepo<ContractEntity>();
    pagosRepo = createMockRepo<PaymentEntity>();
    actasRepo = createMockRepo<ActaEntity>();
    docsRepo = createMockRepo<DocumentEntity>();
    audit = mockAuditService();
    settings = mockSettingsService();

    loader = {
      cargar: jest.fn().mockImplementation(async (ids: string[]) => {
        const m = new Map();
        for (const id of ids) {
          m.set(id, ctxDe(contratoSano({ id })));
        }
        return m;
      }),
      cargarUno: jest.fn().mockImplementation(async (c: any) => ctxDe(c)),
      idsConAseguradora: jest.fn().mockResolvedValue([]),
    };

    config = {
      get: jest.fn().mockReturnValue(25),
    } as unknown as ConfigService;

    service = new ContractsService(
      contractRepo as any,
      pagosRepo as any,
      actasRepo as any,
      docsRepo as any,
      loader,
      settings as any,
      audit as any,
      config,
    );
  });

  describe('crear', () => {
    it('crea un contrato exitosamente con versión inicial 1 y auditoría', async () => {
      const dto = {
        numero: 'CT-2026-NEW',
        tipo: 'Obra civil',
        companyId: 'EMP-01',
        contratista: 'Constructora S.A.',
        nitContratista: '900123456-1',
        objeto: 'Construcción vía principal',
        responsable: 'Carlos Gómez',
        supervisor: 'María Rodríguez',
        fechaInicio: '2026-02-01',
        fechaFin: '2026-11-30',
        valorBase: 500_000_000,
      };

      contractRepo.findOne.mockResolvedValueOnce(null); // No duplicado
      const savedContract = { id: 'CT-999', ...dto, version: 1, anulado: false, estado: 'Borrador' } as ContractEntity;
      contractRepo.save.mockResolvedValueOnce(savedContract);
      contractRepo.findOne.mockResolvedValueOnce(savedContract); // Para el obtener(id)

      const resultado = await service.crear(dto as any, ctx, false);

      expect(contractRepo.findOne).toHaveBeenCalledWith({ where: { numero: dto.numero } });
      expect(contractRepo.save).toHaveBeenCalled();
      expect(audit.registrar).toHaveBeenCalledWith(
        ctx,
        expect.arrayContaining([
          expect.objectContaining({
            contractId: 'CT-999',
            modulo: 'Contratos',
            accion: 'CREAR',
          }),
        ]),
      );
      expect(resultado).toBeDefined();
      expect(resultado.id).toBe('CT-999');
      expect(resultado.metricas).toBeDefined();
    });

    it('rechaza con Conflicto (409) si el número de contrato ya está registrado', async () => {
      const dto = {
        numero: 'CT-DUPLICADO',
        tipo: 'Obra',
        companyId: 'EMP-01',
        contratista: 'Consorcio X',
        nitContratista: '900000000-1',
        objeto: 'Objeto de prueba',
        responsable: 'Resp',
        supervisor: 'Sup',
        fechaInicio: '2026-01-01',
        fechaFin: '2026-12-31',
        valorBase: 100_000_000,
      };

      contractRepo.findOne.mockResolvedValueOnce({ id: 'CT-EXISTENTE', numero: 'CT-DUPLICADO' } as ContractEntity);

      await expect(service.crear(dto as any, ctx, false)).rejects.toThrow(Conflicto);
      expect(contractRepo.save).not.toHaveBeenCalled();
    });

    it('rechaza con Validacion (400) si hay errores de severidad Alta en borrador', async () => {
      const dtoInvalido = {
        numero: 'CT-INVALID',
        tipo: 'Obra',
        companyId: 'EMP-01',
        contratista: 'X',
        nitContratista: '123',
        objeto: 'Obj',
        responsable: 'R',
        supervisor: 'S',
        fechaInicio: '2026-12-31',
        fechaFin: '2026-01-01', // fechaFin < fechaInicio -> severidad Alta
        valorBase: 1000,
      };

      await expect(service.crear(dtoInvalido as any, ctx, false)).rejects.toThrow(Validacion);
    });

    it('lanza WarningRequiresConfirmation (422) si hay advertencias y force=false', async () => {
      const dtoConAdvertencia = {
        numero: 'CT-WARN',
        tipo: 'Obra',
        companyId: 'EMP-01',
        contratista: 'X',
        nitContratista: '123',
        objeto: 'Obj',
        responsable: 'R',
        supervisor: 'S',
        fechaFirma: '2026-05-01',
        fechaInicio: '2026-04-01', // fechaInicio < fechaFirma produce advertencia Media
        fechaFin: '2026-12-31',
        valorBase: 1000,
      };

      await expect(service.crear(dtoConAdvertencia as any, ctx, false)).rejects.toThrow(
        WarningRequiresConfirmation,
      );
    });
  });

  describe('actualizar', () => {
    it('lanza Conflicto (409) si la versión está desactualizada en el DTO', async () => {
      const contractEnDb = { ...dummyContract, version: 3 };
      contractRepo.findOne.mockResolvedValueOnce(contractEnDb);

      const dto = {
        version: 2, // Desactualizada vs 3
        objeto: 'Nuevo objeto',
      };

      await expect(service.actualizar('CT-01', dto as any, ctx, false)).rejects.toThrow(Conflicto);
    });

    it('lanza Conflicto (409) si el update no afectó ninguna fila (concurrencia en BD)', async () => {
      const contractEnDb = { ...dummyContract, version: 1 };
      contractRepo.findOne.mockResolvedValueOnce(contractEnDb);
      contractRepo.update.mockResolvedValueOnce({ affected: 0, raw: [], generatedMaps: [] });

      const dto = {
        version: 1,
        objeto: 'Nuevo objeto',
      };

      await expect(service.actualizar('CT-01', dto as any, ctx, false)).rejects.toThrow(Conflicto);
    });

    it('lanza Validacion si el contrato está anulado', async () => {
      const contractAnulado = { ...dummyContract, anulado: true, version: 1 };
      contractRepo.findOne.mockResolvedValueOnce(contractAnulado);

      const dto = { version: 1, objeto: 'Modificar anulado' };
      await expect(service.actualizar('CT-01', dto as any, ctx, false)).rejects.toThrow(Validacion);
    });

    it('actualiza exitosamente e incrementa versión', async () => {
      const contractEnDb = { ...dummyContract, version: 2 };
      contractRepo.findOne.mockResolvedValueOnce(contractEnDb);
      contractRepo.update.mockResolvedValueOnce({ affected: 1, raw: [], generatedMaps: [] });
      contractRepo.findOne.mockResolvedValueOnce({ ...contractEnDb, version: 3, objeto: 'Actualizado' });

      const dto = {
        version: 2,
        objeto: 'Actualizado',
      };

      const res = await service.actualizar('CT-01', dto as any, ctx, false);

      expect(contractRepo.update).toHaveBeenCalledWith(
        { id: 'CT-01', version: 2 },
        expect.objectContaining({ version: 3, objeto: 'Actualizado' }),
      );
      expect(audit.registrar).toHaveBeenCalled();
      expect(res).toBeDefined();
    });
  });

  describe('anular (void con motivo)', () => {
    it('anula el contrato marcando anulado=true, estado=Anulado y guardando el motivo', async () => {
      const contractActivo = { ...dummyContract, anulado: false, estado: 'Activo' };
      contractRepo.findOne.mockResolvedValueOnce(contractActivo);
      contractRepo.save.mockResolvedValueOnce({
        ...contractActivo,
        anulado: true,
        estado: 'Anulado',
        motivoAnulacion: 'Terminación anticipada bilateral',
      });
      contractRepo.findOne.mockResolvedValueOnce({
        ...contractActivo,
        anulado: true,
        estado: 'Anulado',
        motivoAnulacion: 'Terminación anticipada bilateral',
      });

      const res = await service.anular('CT-01', 'Terminación anticipada bilateral', ctx);

      expect(contractRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          anulado: true,
          estado: 'Anulado',
          motivoAnulacion: 'Terminación anticipada bilateral',
        }),
      );
      expect(audit.registrar).toHaveBeenCalledWith(
        ctx,
        expect.arrayContaining([
          expect.objectContaining({
            contractId: 'CT-01',
            modulo: 'Contratos',
            accion: 'ANULAR',
            obs: 'Terminación anticipada bilateral',
          }),
        ]),
      );
      expect(res.estado).toBe('Anulado');
    });

    it('lanza Validacion si el contrato ya está anulado', async () => {
      const contractYaAnulado = { ...dummyContract, anulado: true, estado: 'Anulado' };
      contractRepo.findOne.mockResolvedValueOnce(contractYaAnulado);

      await expect(service.anular('CT-01', 'Re-anular', ctx)).rejects.toThrow(Validacion);
      expect(contractRepo.save).not.toHaveBeenCalled();
    });

    it('lanza NoEncontrado si el contrato no existe', async () => {
      contractRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.anular('CT-INEXISTENTE', 'Motivo', ctx)).rejects.toThrow(NoEncontrado);
    });
  });

  describe('obtener', () => {
    it('obtiene el contrato con métricas y semáforo calculados', async () => {
      contractRepo.findOne.mockResolvedValueOnce(dummyContract);

      const fila = await service.obtener('CT-01');

      expect(fila).toBeDefined();
      expect(fila.id).toBe('CT-01');
      expect(fila.metricas).toBeDefined();
      expect(fila.metricas.nivel).toBeDefined();
      expect(fila.metricas.control).toBeDefined();
      expect(fila.aseguradoras).toBeDefined();
    });
  });

  describe('timeline', () => {
    it('construye la línea de tiempo ordenada por fecha', async () => {
      contractRepo.findOne.mockResolvedValueOnce(dummyContract);
      pagosRepo.find.mockResolvedValueOnce([
        { id: 'PG-01', numero: '1', fecha: '2026-03-01', estado: 'Pagado', factura: 'FAC-1' } as PaymentEntity,
      ]);
      actasRepo.find.mockResolvedValueOnce([
        { id: 'AC-01', tipo: 'Acta de inicio', fecha: '2026-01-10', estado: 'Firmada' } as ActaEntity,
      ]);

      const tl = await service.timeline('CT-01');

      expect(tl.contractId).toBe('CT-01');
      expect(tl.data.length).toBeGreaterThanOrEqual(2);
      expect(tl.data[0].fecha >= tl.data[1].fecha).toBe(true); // Orden descendente
    });
  });
});
