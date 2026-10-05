import { ChildCollectionsService } from './child-collections.service';
import { ContractEntity } from './entities/contract.entity';
import { SubcontractEntity } from './entities/subcontracts.entity';
import { ObligationEntity } from './entities/obligations.entity';
import { DeliverableEntity } from './entities/deliverables.entity';
import { ExecEntity } from './entities/execs.entity';
import { PaymentEntity } from './entities/payments.entity';
import { ActaEntity } from './entities/actas.entity';
import { ModificationEntity } from './entities/modifications.entity';
import { RiskEntity } from './entities/risks.entity';
import { BreachEntity } from './entities/breaches.entity';
import { PlanEntity } from './entities/plans.entity';
import {
  Conflicto,
  NoEncontrado,
  Prohibido,
  Validacion,
  WarningRequiresConfirmation,
} from '../../common/exceptions/api-exception';
import {
  createMockRepo,
  mockAuditService,
  mockDataSource,
  mockReqContext,
  mockRolesService,
  mockSettingsService,
} from '../../../test/mocks';

describe('ChildCollectionsService', () => {
  let service: ChildCollectionsService;
  let contractsRepo: ReturnType<typeof createMockRepo<ContractEntity>>;
  let subsRepo: ReturnType<typeof createMockRepo<SubcontractEntity>>;
  let oblsRepo: ReturnType<typeof createMockRepo<ObligationEntity>>;
  let delsRepo: ReturnType<typeof createMockRepo<DeliverableEntity>>;
  let execsRepo: ReturnType<typeof createMockRepo<ExecEntity>>;
  let paysRepo: ReturnType<typeof createMockRepo<PaymentEntity>>;
  let actasRepo: ReturnType<typeof createMockRepo<ActaEntity>>;
  let modsRepo: ReturnType<typeof createMockRepo<ModificationEntity>>;
  let risksRepo: ReturnType<typeof createMockRepo<RiskEntity>>;
  let breachesRepo: ReturnType<typeof createMockRepo<BreachEntity>>;
  let plansRepo: ReturnType<typeof createMockRepo<PlanEntity>>;
  let audit: ReturnType<typeof mockAuditService>;
  let settings: ReturnType<typeof mockSettingsService>;
  let roles: ReturnType<typeof mockRolesService>;
  let ds: ReturnType<typeof mockDataSource>;

  const ctx = mockReqContext();

  const contratoPadreValido: ContractEntity = {
    id: 'CT-01',
    numero: 'CT-2026-001',
    anulado: false,
    estado: 'Activo',
    fechaInicio: '2026-01-01',
    fechaFin: '2026-12-31',
    valorBase: 100_000_000,
    iva: 19_000_000,
    otrosImp: 0,
    adiciones: 0,
    reducciones: 0,
    contratista: 'ACME',
    supervisor: 'Supervisor',
    version: 1,
    companyId: 'EMP-01',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as ContractEntity;

  beforeEach(() => {
    contractsRepo = createMockRepo<ContractEntity>();
    subsRepo = createMockRepo<SubcontractEntity>();
    oblsRepo = createMockRepo<ObligationEntity>();
    delsRepo = createMockRepo<DeliverableEntity>();
    execsRepo = createMockRepo<ExecEntity>();
    paysRepo = createMockRepo<PaymentEntity>();
    actasRepo = createMockRepo<ActaEntity>();
    modsRepo = createMockRepo<ModificationEntity>();
    risksRepo = createMockRepo<RiskEntity>();
    breachesRepo = createMockRepo<BreachEntity>();
    plansRepo = createMockRepo<PlanEntity>();
    audit = mockAuditService();
    settings = mockSettingsService();
    roles = mockRolesService();
    ds = mockDataSource();

    contractsRepo.findOne.mockResolvedValue(contratoPadreValido);

    service = new ChildCollectionsService(
      ds as any,
      contractsRepo as any,
      subsRepo as any,
      oblsRepo as any,
      delsRepo as any,
      execsRepo as any,
      paysRepo as any,
      actasRepo as any,
      modsRepo as any,
      risksRepo as any,
      breachesRepo as any,
      plansRepo as any,
      audit as any,
      settings as any,
      roles as any,
    );
  });

  describe('Subcontratos: regla de negocio de suma vs contrato principal', () => {
    it('rechaza con Validacion si la suma de subcontratos supera el valor del contrato principal', async () => {
      // Valor del contrato: 119_000_000 (100M base + 19M iva)
      subsRepo.find.mockResolvedValueOnce([
        { id: 'SC-01', contractId: 'CT-01', valor: 80_000_000, estado: 'Activo' } as SubcontractEntity,
      ]);

      const nuevoSubcontrato = {
        contractId: 'CT-01',
        numero: 'SUB-02',
        contratista: 'Subco Ltda',
        nit: '901000000-1',
        objeto: 'Excavaciones',
        valor: 50_000_000, // 80M + 50M = 130M > 119M
        fechaInicio: '2026-02-01',
        fechaFin: '2026-06-30',
      };

      await expect(service.crear('subcontracts', nuevoSubcontrato, ctx, false)).rejects.toThrow(
        Validacion,
      );
      expect(subsRepo.save).not.toHaveBeenCalled();
    });

    it('permite crear subcontrato si la suma no supera el valor del contrato principal', async () => {
      subsRepo.find.mockResolvedValueOnce([
        { id: 'SC-01', contractId: 'CT-01', valor: 40_000_000, estado: 'Activo' } as SubcontractEntity,
      ]);
      const guardado = { id: 'SC-02', contractId: 'CT-01', valor: 30_000_000, version: 1 };
      subsRepo.save.mockResolvedValueOnce(guardado as any);

      const nuevoSubcontrato = {
        contractId: 'CT-01',
        numero: 'SUB-02',
        contratista: 'Subco Ltda',
        nit: '901000000-1',
        objeto: 'Excavaciones',
        valor: 30_000_000,
        fechaInicio: '2026-02-01',
        fechaFin: '2026-06-30',
      };

      const res = await service.crear('subcontracts', nuevoSubcontrato, ctx, false);

      expect(res).toBeDefined();
      expect(subsRepo.save).toHaveBeenCalled();
      expect(audit.registrar).toHaveBeenCalledWith(
        ctx,
        expect.arrayContaining([
          expect.objectContaining({ modulo: 'Subcontratos', accion: 'CREAR' }),
        ]),
      );
    });

    it('ignora subcontratos anulados al calcular la suma acumulada', async () => {
      subsRepo.find.mockResolvedValueOnce([
        { id: 'SC-01', contractId: 'CT-01', valor: 100_000_000, estado: 'Anulado' } as SubcontractEntity,
      ]);
      subsRepo.save.mockResolvedValueOnce({ id: 'SC-02', valor: 30_000_000 } as any);

      const nuevoSubcontrato = {
        contractId: 'CT-01',
        numero: 'SUB-02',
        contratista: 'Subco',
        nit: '901',
        objeto: 'Obj',
        valor: 30_000_000,
        fechaInicio: '2026-02-01',
        fechaFin: '2026-06-30',
      };

      const res = await service.crear('subcontracts', nuevoSubcontrato, ctx, false);
      expect(res).toBeDefined();
    });
  });

  describe('Pagos: cálculo de neto en servidor y permisos', () => {
    it('calcula neto = bruto + iva - retenciones automáticamente antes de guardar', async () => {
      let entidadGuardada: any;
      paysRepo.save.mockImplementationOnce((dto: any) => {
        entidadGuardada = dto;
        return Promise.resolve({ id: 'PG-01', ...dto });
      });

      const nuevoPago = {
        contractId: 'CT-01',
        numero: '1',
        fecha: '2026-03-01',
        factura: 'FAC-001',
        bruto: 10_000_000,
        iva: 1_900_000,
        retenciones: 400_000,
        estado: 'Pendiente',
      };

      await service.crear('payments', nuevoPago, ctx, false);

      expect(entidadGuardada).toBeDefined();
      expect(entidadGuardada.neto).toBe(11_500_000); // 10M + 1.9M - 0.4M = 11.5M
    });

    it('asigna fechaAprob hoy al aprobar o fechaPago hoy al pagar si no venían definidas', async () => {
      let entidadGuardada: any;
      paysRepo.save.mockImplementationOnce((dto: any) => {
        entidadGuardada = dto;
        return Promise.resolve({ id: 'PG-02', ...dto });
      });

      const pagoAprobado = {
        contractId: 'CT-01',
        numero: '2',
        fecha: '2026-04-01',
        factura: 'FAC-002',
        bruto: 5_000_000,
        iva: 950_000,
        retenciones: 200_000,
        estado: 'Aprobado',
      };

      await service.crear('payments', pagoAprobado, ctx, false);

      expect(entidadGuardada.fechaAprob).toBeDefined();
    });

    it('exige permiso APROBAR al transicionar un pago a Aprobado o Pagado en actualización', async () => {
      const pagoExistente = {
        id: 'PG-01',
        contractId: 'CT-01',
        numero: '1',
        estado: 'Pendiente',
        version: 1,
      };
      paysRepo.findOne.mockResolvedValue(pagoExistente as any);

      // Simula que el usuario NO tiene permiso APROBAR
      roles.tienePermiso.mockResolvedValueOnce(false);

      const dtoActualizar = {
        version: 1,
        estado: 'Aprobado',
      };

      await expect(
        service.actualizar('payments', 'PG-01', dtoActualizar, ctx, false),
      ).rejects.toThrow(Prohibido);
    });

    it('permite actualizar a Aprobado si el rol tiene permiso APROBAR', async () => {
      const pagoExistente = {
        id: 'PG-01',
        contractId: 'CT-01',
        numero: '1',
        estado: 'Pendiente',
        version: 1,
      };
      paysRepo.findOne
        .mockResolvedValueOnce(pagoExistente as any)
        .mockResolvedValueOnce({ ...pagoExistente, estado: 'Aprobado', version: 2 } as any);
      paysRepo.update.mockResolvedValueOnce({ affected: 1, raw: [], generatedMaps: [] });
      roles.tienePermiso.mockResolvedValueOnce(true);

      const dtoActualizar = {
        version: 1,
        estado: 'Aprobado',
      };

      const res = await service.actualizar('payments', 'PG-01', dtoActualizar, ctx, false);

      expect(res).toBeDefined();
      expect(paysRepo.update).toHaveBeenCalled();
    });
  });

  describe('Ejecución mensual (execs)', () => {
    it('rechaza con Validacion si el avance físico supera el 100 %', async () => {
      const execInvalida = {
        contractId: 'CT-01',
        periodo: '2026-03',
        valor: 10_000_000,
        avanceFisico: 101, // > 100%
      };

      await expect(service.crear('execs', execInvalida, ctx, false)).rejects.toThrow(Validacion);
    });

    it('lanza WarningRequiresConfirmation si el acumulado de ejecución supera el valor del contrato y force=false', async () => {
      execsRepo.find.mockResolvedValueOnce([
        { id: 'EX-01', contractId: 'CT-01', valor: 100_000_000, motivoAnulacion: null } as ExecEntity,
      ]);

      const nuevaExec = {
        contractId: 'CT-01',
        periodo: '2026-04',
        valor: 30_000_000, // 100M + 30M = 130M > 119M
        avanceFisico: 90,
      };

      await expect(service.crear('execs', nuevaExec, ctx, false)).rejects.toThrow(
        WarningRequiresConfirmation,
      );
    });

    it('permite guardar con advertencia si force=true', async () => {
      execsRepo.find.mockResolvedValueOnce([
        { id: 'EX-01', contractId: 'CT-01', valor: 100_000_000, motivoAnulacion: null } as ExecEntity,
      ]);
      execsRepo.save.mockResolvedValueOnce({ id: 'EX-02', valor: 30_000_000, version: 1 } as any);

      const nuevaExec = {
        contractId: 'CT-01',
        periodo: '2026-04',
        valor: 30_000_000,
        avanceFisico: 90,
      };

      const res = await service.crear('execs', nuevaExec, ctx, true);
      expect(res).toBeDefined();
      expect(execsRepo.save).toHaveBeenCalled();
    });
  });

  describe('Modificaciones: inmutabilidad y efecto transaccional', () => {
    it('no permite editar modificaciones (actualizar lanza Validacion)', async () => {
      await expect(
        service.actualizar('modifications', 'MD-01', { version: 1, valorNuevo: 200 }, ctx, false),
      ).rejects.toThrow(Validacion);
    });

    it('crea modificación y aplica su efecto sobre el contrato padre en transacción', async () => {
      const mockEmContractRepo = createMockRepo();
      const mockEmModsRepo = createMockRepo();

      mockEmContractRepo.findOneOrFail.mockResolvedValue({ ...contratoPadreValido });
      mockEmModsRepo.create.mockImplementation((dto) => dto);
      mockEmModsRepo.save.mockImplementation((dto) => Promise.resolve({ id: 'MD-01', ...dto }));

      ds.transaction.mockImplementation(async (cb: any) => {
        const em = {
          getRepository: (entity: any) => {
            if (entity === ModificationEntity) return mockEmModsRepo;
            if (entity === ContractEntity) return mockEmContractRepo;
            return createMockRepo();
          },
        };
        return cb(em);
      });

      const dtoMod = {
        contractId: 'CT-01',
        numero: 'OT-01',
        tipo: 'Adición',
        fecha: '2026-06-01',
        justificacion: 'Mayores cantidades de obra',
        valorNuevo: 20_000_000,
      };

      const res = await service.crear('modifications', dtoMod, ctx, false);

      expect(res).toBeDefined();
      expect(ds.transaction).toHaveBeenCalled();
      expect(mockEmModsRepo.save).toHaveBeenCalled();
      expect(mockEmContractRepo.save).toHaveBeenCalled();
      expect(audit.registrarEn).toHaveBeenCalled();
    });
  });

  describe('Concurrencia (409 por versión desactualizada)', () => {
    it('lanza Conflicto (409) si la versión no coincide con el registro en BD', async () => {
      const entDb = { id: 'OB-01', contractId: 'CT-01', version: 3, estado: 'Pendiente' };
      oblsRepo.findOne.mockResolvedValueOnce(entDb as any);

      const dto = { version: 2, descripcion: 'Nueva desc' };

      await expect(service.actualizar('obligations', 'OB-01', dto, ctx, false)).rejects.toThrow(
        Conflicto,
      );
    });

    it('lanza Conflicto (409) si el update no afectó filas', async () => {
      const entDb = { id: 'OB-01', contractId: 'CT-01', version: 1, estado: 'Pendiente' };
      oblsRepo.findOne.mockResolvedValueOnce(entDb as any);
      oblsRepo.update.mockResolvedValueOnce({ affected: 0, raw: [], generatedMaps: [] });

      const dto = { version: 1, descripcion: 'Nueva desc' };

      await expect(service.actualizar('obligations', 'OB-01', dto, ctx, false)).rejects.toThrow(
        Conflicto,
      );
    });
  });

  describe('Anulación con motivo (nunca DELETE)', () => {
    it('anula el registro guardando el motivo e incrementando versión', async () => {
      const entDb = { id: 'EX-01', contractId: 'CT-01', version: 1, motivoAnulacion: null };
      execsRepo.findOne
        .mockResolvedValueOnce(entDb as any)
        .mockResolvedValueOnce({ ...entDb, motivoAnulacion: 'No requerida', version: 2 } as any);
      execsRepo.update.mockResolvedValueOnce({ affected: 1, raw: [], generatedMaps: [] });

      const res = await service.anular('execs', 'EX-01', 'No requerida', ctx);

      expect(execsRepo.update).toHaveBeenCalledWith(
        { id: 'EX-01' },
        expect.objectContaining({
          motivoAnulacion: 'No requerida',
          version: 2,
        }),
      );
      expect(audit.registrar).toHaveBeenCalledWith(
        ctx,
        expect.arrayContaining([
          expect.objectContaining({
            contractId: 'CT-01',
            modulo: 'Ejecución',
            accion: 'ANULAR',
            obs: 'No requerida',
          }),
        ]),
      );
      expect(res).toBeDefined();
    });

    it('rechaza anulación si el registro ya estaba anulado', async () => {
      const entYaAnulada = { id: 'EX-01', contractId: 'CT-01', version: 2, motivoAnulacion: 'Ya anulado' };
      execsRepo.findOne.mockResolvedValueOnce(entYaAnulada as any);

      await expect(service.anular('execs', 'EX-01', 'Re-anular', ctx)).rejects.toThrow(
        Validacion,
      );
      expect(execsRepo.update).not.toHaveBeenCalled();
    });

    it('rechaza operaciones si el contrato padre está anulado', async () => {
      contractsRepo.findOne.mockResolvedValueOnce({ ...contratoPadreValido, anulado: true });

      const dto = { contractId: 'CT-01', descripcion: 'Obligacion nueva' };

      await expect(service.crear('obligations', dto, ctx, false)).rejects.toThrow(Validacion);
    });
  });
});
