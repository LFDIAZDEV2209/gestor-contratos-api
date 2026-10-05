import { MemoryCacheService } from '../../cache/memory-cache.service';
import { InsuranceService } from './insurance.service';
import { GuaranteeEntity } from '../contracts/entities/guarantees.entity';
import { CupoEntity } from '../contracts/entities/quotas.entity';
import { ContractEntity } from '../contracts/entities/contract.entity';
import { Conflicto, NoEncontrado, Prohibido, Validacion, WarningRequiresConfirmation } from '../../common/exceptions/api-exception';
import {
  createMockRepo,
  mockAuditService,
  mockReqContext,
  mockRolesService,
} from '../../../test/mocks';

describe('InsuranceService', () => {
  let service: InsuranceService;
  let cache: MemoryCacheService;
  let garsRepo: ReturnType<typeof createMockRepo<GuaranteeEntity>>;
  let cuposRepo: ReturnType<typeof createMockRepo<CupoEntity>>;
  let contractsRepo: ReturnType<typeof createMockRepo<ContractEntity>>;
  let loader: any;
  let audit: ReturnType<typeof mockAuditService>;
  let roles: ReturnType<typeof mockRolesService>;

  const ctx = mockReqContext();

  const dummyCupo: CupoEntity = {
    id: 'CP-01',
    numero: 'CUP-SURA-2026',
    aseguradora: 'SURA',
    valor: 1_000_000_000,
    estado: 'Vigente',
    fechaInicio: '2026-01-01',
    fechaVenc: '2026-12-31',
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as CupoEntity;

  const dummyGarantia: GuaranteeEntity = {
    id: 'GR-01',
    contractId: 'CT-01',
    numero: '1',
    poliza: 'PL-999',
    aseguradora: 'SURA',
    modalidadPoliza: 'Póliza individual',
    tipo: 'Cumplimiento',
    valor: 50_000_000,
    estado: 'Pendiente',
    fechaInicio: '2026-01-01',
    fechaVenc: '2026-12-31',
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as GuaranteeEntity;

  beforeEach(() => {
    garsRepo = createMockRepo<GuaranteeEntity>();
    cuposRepo = createMockRepo<CupoEntity>();
    contractsRepo = createMockRepo<ContractEntity>();
    audit = mockAuditService();
    roles = mockRolesService();

    loader = {
      cargar: jest.fn().mockResolvedValue(new Map()),
      cargarUno: jest.fn().mockResolvedValue({}),
      idsConAseguradora: jest.fn().mockResolvedValue([]),
    };

    cache = new MemoryCacheService();
    jest.spyOn(cache, 'delByPattern');

    service = new InsuranceService(
      garsRepo as any,
      cuposRepo as any,
      contractsRepo as any,
      loader,
      audit as any,
      roles as any,
      cache,
    );
  });

  describe('cupoStats y listarCupos', () => {
    it('calcula utilizado, disponible y pctUso correctamente para los cupos', async () => {
      cuposRepo.find.mockResolvedValueOnce([dummyCupo]);
      // Pólizas que consumen cupo (Aprobada de contrato vivo)
      garsRepo.find.mockResolvedValueOnce([
        {
          cupoId: 'CP-01',
          estado: 'Aprobada',
          valor: 200_000_000,
          contractId: 'CT-01',
        } as any,
      ]);
      // Ningún contrato anulado
      contractsRepo.find.mockResolvedValueOnce([]);

      const resultado = await service.listarCupos();

      expect(resultado).toHaveLength(1);
      const cp = resultado[0];
      expect(cp.calculado).toBeDefined();
      expect(cp.calculado.utilizado).toBe(200_000_000);
      expect(cp.calculado.disponible).toBe(800_000_000);
      expect(cp.calculado.pctUso).toBe(20);
    });

    it('libera cupo si el contrato de la póliza fue anulado', async () => {
      cuposRepo.find.mockResolvedValueOnce([dummyCupo]);
      garsRepo.find.mockResolvedValueOnce([
        {
          cupoId: 'CP-01',
          estado: 'Aprobada',
          valor: 200_000_000,
          contractId: 'CT-ANULADO',
        } as any,
      ]);
      // El contrato de la póliza está anulado
      contractsRepo.find.mockResolvedValueOnce([{ id: 'CT-ANULADO', anulado: true } as any]);

      const resultado = await service.listarCupos();

      expect(resultado[0].calculado.utilizado).toBe(0);
      expect(resultado[0].calculado.disponible).toBe(1_000_000_000);
    });
  });

  describe('Garantías por cupo (reglasCupo)', () => {
    it('rechaza con Validacion si la aseguradora de la póliza no coincide con la del cupo', async () => {
      cuposRepo.findOne.mockResolvedValueOnce(dummyCupo); // Aseguradora: SURA
      garsRepo.find.mockResolvedValueOnce([]); // polizas del cupo
      contractsRepo.find.mockResolvedValueOnce([]);

      const dtoPoliza = {
        contractId: 'CT-01',
        modalidadPoliza: 'Póliza por cupo',
        cupoId: 'CP-01',
        aseguradora: 'Seguros del Estado', // Diferente a SURA
        valor: 50_000_000,
        poliza: 'PL-101',
      };

      await expect(service.crearGarantia(dtoPoliza, ctx, false)).rejects.toThrow(Validacion);
    });

    it('rechaza con Validacion si el cupo no está en estado Vigente', async () => {
      const cupoSuspendido = { ...dummyCupo, estado: 'Suspendido' };
      cuposRepo.findOne.mockResolvedValueOnce(cupoSuspendido);
      garsRepo.find.mockResolvedValueOnce([]);
      contractsRepo.find.mockResolvedValueOnce([]);

      const dtoPoliza = {
        contractId: 'CT-01',
        modalidadPoliza: 'Póliza por cupo',
        cupoId: 'CP-01',
        aseguradora: 'SURA',
        valor: 50_000_000,
        poliza: 'PL-101',
      };

      await expect(service.crearGarantia(dtoPoliza, ctx, false)).rejects.toThrow(Validacion);
    });

    it('lanza WarningRequiresConfirmation si la póliza excede el cupo disponible y force=false', async () => {
      cuposRepo.findOne.mockResolvedValueOnce(dummyCupo); // Cupo de 1_000M
      // Ya tiene 900M utilizados
      garsRepo.find.mockResolvedValueOnce([
        { cupoId: 'CP-01', estado: 'Aprobada', valor: 900_000_000, contractId: 'CT-01' } as any,
      ]);
      contractsRepo.find.mockResolvedValueOnce([]);

      const dtoPoliza = {
        contractId: 'CT-01',
        modalidadPoliza: 'Póliza por cupo',
        cupoId: 'CP-01',
        aseguradora: 'SURA',
        valor: 200_000_000, // 900M + 200M = 1.100M > 1.000M
        poliza: 'PL-102',
        fechaInicio: '2026-02-01',
        fechaVenc: '2026-11-30',
      };

      await expect(service.crearGarantia(dtoPoliza, ctx, false)).rejects.toThrow(
        WarningRequiresConfirmation,
      );
    });

    it('permite crear la póliza con sobrecupo si force=true', async () => {
      cuposRepo.findOne.mockResolvedValueOnce(dummyCupo);
      garsRepo.find.mockResolvedValueOnce([
        { cupoId: 'CP-01', estado: 'Aprobada', valor: 900_000_000, contractId: 'CT-01' } as any,
      ]);
      contractsRepo.find.mockResolvedValueOnce([]);
      garsRepo.create.mockImplementation((d) => d as any);
      garsRepo.save.mockImplementation((d) => Promise.resolve({ id: 'GR-NEW', ...d } as any));

      const dtoPoliza = {
        contractId: 'CT-01',
        modalidadPoliza: 'Póliza por cupo',
        cupoId: 'CP-01',
        aseguradora: 'SURA',
        valor: 200_000_000,
        poliza: 'PL-102',
        fechaInicio: '2026-02-01',
        fechaVenc: '2026-11-30',
      };

      const res = await service.crearGarantia(dtoPoliza, ctx, true);
      expect(cache.delByPattern).toHaveBeenCalledWith('geo:*');
      expect(cache.delByPattern).toHaveBeenCalledWith('reports:*');
      expect(res).toBeDefined();
      expect(garsRepo.save).toHaveBeenCalled();
      expect(audit.registrar).toHaveBeenCalled();
    });

    it('valida que la fecha de vencimiento no sea anterior al inicio', async () => {
      const dtoInvalido = {
        contractId: 'CT-01',
        modalidadPoliza: 'Póliza individual',
        aseguradora: 'SURA',
        valor: 10_000_000,
        poliza: 'PL-103',
        fechaInicio: '2026-12-31',
        fechaVenc: '2026-01-01',
      };

      await expect(service.crearGarantia(dtoInvalido, ctx, false)).rejects.toThrow(Validacion);
    });
  });

  describe('Aprobación y anulación de garantías', () => {
    it('aprobarGarantia exige que la póliza no esté previamente aprobada', async () => {
      garsRepo.findOne.mockResolvedValueOnce({ ...dummyGarantia, estado: 'Aprobada' } as any);

      await expect(service.aprobarGarantia('GR-01', ctx)).rejects.toThrow(Validacion);
    });

    it('aprobarGarantia actualiza estado a Aprobada e incrementa versión', async () => {
      garsRepo.findOne
        .mockResolvedValueOnce({ ...dummyGarantia, estado: 'Pendiente', version: 1 } as any);
      garsRepo.update.mockResolvedValueOnce({ affected: 1, raw: [], generatedMaps: [] });
      garsRepo.findOneOrFail.mockResolvedValueOnce({
        ...dummyGarantia,
        estado: 'Aprobada',
        version: 2,
      } as any);

      const res = await service.aprobarGarantia('GR-01', ctx);
      expect(cache.delByPattern).toHaveBeenCalledWith('geo:*');
      expect(cache.delByPattern).toHaveBeenCalledWith('reports:*');

      expect(garsRepo.update).toHaveBeenCalledWith(
        { id: 'GR-01', version: 1 },
        { estado: 'Aprobada', version: 2 },
      );
      expect(res.estado).toBe('Aprobada');
      expect(audit.registrar).toHaveBeenCalledWith(
        ctx,
        expect.arrayContaining([
          expect.objectContaining({ modulo: 'Garantías', accion: 'APROBAR' }),
        ]),
      );
    });

    it('anularGarantia marca estado=Anulada y guarda motivo', async () => {
      garsRepo.findOne.mockResolvedValueOnce({ ...dummyGarantia, estado: 'Pendiente', version: 1 } as any);
      garsRepo.update.mockResolvedValueOnce({ affected: 1, raw: [], generatedMaps: [] });
      garsRepo.findOneOrFail.mockResolvedValueOnce({
        ...dummyGarantia,
        estado: 'Anulada',
        motivoAnulacion: 'Póliza revocada',
        version: 2,
      } as any);

      const res = await service.anularGarantia('GR-01', 'Póliza revocada', ctx);
      expect(cache.delByPattern).toHaveBeenCalledWith('geo:*');
      expect(cache.delByPattern).toHaveBeenCalledWith('reports:*');

      expect(garsRepo.update).toHaveBeenCalledWith(
        { id: 'GR-01', version: 1 },
        { estado: 'Anulada', motivoAnulacion: 'Póliza revocada', version: 2 },
      );
      expect(res.estado).toBe('Anulada');
    });
  });

  describe('Gestión de cupos', () => {
    it('no permite cambiar aseguradora de un cupo si ya tiene pólizas vinculadas', async () => {
      cuposRepo.findOne.mockResolvedValueOnce(dummyCupo);
      garsRepo.count.mockResolvedValueOnce(3); // Ya tiene 3 pólizas

      const dto = {
        version: 1,
        aseguradora: 'Mapfre', // Intento de cambio
      };

      await expect(service.actualizarCupo('CP-01', dto, ctx, false)).rejects.toThrow(Validacion);
    });

    it('actualizarCupo lanza Conflicto (409) si affected=0', async () => {
      cuposRepo.findOne.mockResolvedValueOnce(dummyCupo);
      garsRepo.find.mockResolvedValueOnce([]);
      contractsRepo.find.mockResolvedValueOnce([]);
      cuposRepo.update.mockResolvedValueOnce({ affected: 0, raw: [], generatedMaps: [] });

      const dto = {
        version: 1,
        valor: 2_000_000_000,
      };

      await expect(service.actualizarCupo('CP-01', dto, ctx, false)).rejects.toThrow(Conflicto);
    });

    it('anularCupo cambia estado a Anulado con motivo', async () => {
      cuposRepo.findOne.mockResolvedValueOnce({ ...dummyCupo, estado: 'Vigente', version: 1 } as any);
      cuposRepo.update.mockResolvedValueOnce({ affected: 1, raw: [], generatedMaps: [] });
      cuposRepo.findOneOrFail.mockResolvedValueOnce({
        ...dummyCupo,
        estado: 'Anulado',
        motivoAnulacion: 'Cierre de línea',
        version: 2,
      } as any);

      const res = await service.anularCupo('CP-01', 'Cierre de línea', ctx);
      expect(cache.delByPattern).toHaveBeenCalledWith('geo:*');
      expect(cache.delByPattern).toHaveBeenCalledWith('reports:*');

      expect(cuposRepo.update).toHaveBeenCalled();
      expect(res.estado).toBe('Anulado');
    });
  });

  describe('resumenAseguradoras', () => {
    it('genera el resumen métrico por aseguradora agrupando pólizas y cupos', async () => {
      garsRepo.find.mockResolvedValueOnce([
        {
          id: 'GR-01',
          contractId: 'CT-01',
          aseguradora: 'SURA',
          estado: 'Aprobada',
          modalidadPoliza: 'Póliza individual',
          valor: 100_000_000,
          prima: 2_000_000,
          fechaVenc: '2026-10-15',
        } as any,
      ]);
      cuposRepo.find.mockResolvedValueOnce([dummyCupo]);
      contractsRepo.find.mockResolvedValueOnce([{ id: 'CT-01', anulado: false } as any]);

      const res = await service.resumenAseguradoras();

      expect(res.data).toBeDefined();
      const sura = res.data.find((x) => x.aseguradora === 'SURA');
      expect(sura).toBeDefined();
      expect(sura?.polizas).toBe(1);
      expect(sura?.cupos).toBe(1);
      expect(sura?.valorAsegurado).toBe(100_000_000);
      expect(sura?.primas).toBe(2_000_000);
    });
  });
});
