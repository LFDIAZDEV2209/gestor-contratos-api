import { AlertsService } from './alerts.service';
import { ContractEntity } from '../contracts/entities/contract.entity';
import { CupoEntity } from '../contracts/entities/quotas.entity';
import { GuaranteeEntity } from '../contracts/entities/guarantees.entity';
import { AlertStateEntity, AlertKeyEntity, TaskEntity } from './alerts.entity';
import { Conflicto, NoEncontrado, Prohibido } from '../../common/exceptions/api-exception';
import {
  createMockRepo,
  mockAuditService,
  mockReqContext,
  mockRolesService,
  mockSettingsService,
} from '../../../test/mocks';
import { contratoSano, ctxDe } from '../../engines/test-helpers';

describe('AlertsService', () => {
  let service: AlertsService;
  let contractsRepo: ReturnType<typeof createMockRepo<ContractEntity>>;
  let cuposRepo: ReturnType<typeof createMockRepo<CupoEntity>>;
  let garsRepo: ReturnType<typeof createMockRepo<GuaranteeEntity>>;
  let estadosRepo: ReturnType<typeof createMockRepo<AlertStateEntity>>;
  let clavesRepo: ReturnType<typeof createMockRepo<AlertKeyEntity>>;
  let tareasRepo: ReturnType<typeof createMockRepo<TaskEntity>>;
  let loader: any;
  let settings: ReturnType<typeof mockSettingsService>;
  let audit: ReturnType<typeof mockAuditService>;
  let users: any;
  let roles: ReturnType<typeof mockRolesService>;

  const ctx = mockReqContext();

  const contratoConAlerta = {
    ...contratoSano({
      id: 'CT-01',
      numero: 'CT-2026-001',
      fechaFin: '2026-10-06', // Vence en 5 días desde 2026-10-01 (hoy)
      estado: 'Activo',
      anulado: false,
    }),
  } as unknown as ContractEntity;

  beforeEach(() => {
    contractsRepo = createMockRepo<ContractEntity>();
    cuposRepo = createMockRepo<CupoEntity>();
    garsRepo = createMockRepo<GuaranteeEntity>();
    estadosRepo = createMockRepo<AlertStateEntity>();
    clavesRepo = createMockRepo<AlertKeyEntity>();
    tareasRepo = createMockRepo<TaskEntity>();
    settings = mockSettingsService();
    audit = mockAuditService();
    roles = mockRolesService();

    loader = {
      cargar: jest.fn().mockImplementation(async (ids: string[]) => {
        const m = new Map();
        for (const id of ids) {
          m.set(
            id,
            ctxDe(contratoConAlerta as any, {
              guarantees: [
                {
                  id: 'GR-01',
                  tipo: 'Cumplimiento',
                  poliza: 'PL-100',
                  aseguradora: 'SURA',
                  estado: 'Aprobada',
                  valor: 10_000_000,
                  fechaVenc: '2026-10-16', // Vence en 15 días
                  anulado: false,
                } as any,
              ],
            }),
          );
        }
        return m;
      }),
    };

    users = {
      obtener: jest.fn().mockResolvedValue({ id: 'USR-02', nombre: 'Ana Gómez' }),
    };

    contractsRepo.find.mockResolvedValue([contratoConAlerta]);
    cuposRepo.find.mockResolvedValue([]);
    garsRepo.find.mockResolvedValue([]);

    service = new AlertsService(
      contractsRepo as any,
      cuposRepo as any,
      garsRepo as any,
      estadosRepo as any,
      clavesRepo as any,
      tareasRepo as any,
      loader,
      settings as any,
      audit as any,
      users,
      roles as any,
    );
  });

  describe('recalcular (cruce de umbral)', () => {
    it('detecta alertas nuevas por cruce de umbral y las registra en claves', async () => {
      // Claves existentes vacías: todas son nuevas
      clavesRepo.find.mockResolvedValueOnce([]);

      const res = await service.recalcular();

      expect(res.total).toBeGreaterThan(0);
      expect(res.nuevas).toBe(res.total);
      expect(clavesRepo.upsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            alertKey: expect.stringMatching(/^(contrato|gar|cupo)\|/),
          }),
        ]),
        ['alertKey'],
      );
    });

    it('no marca como nuevas las alertas cuyas claves ya fueron registradas previamente', async () => {
      // Supongamos que todas las claves ya están en la BD
      clavesRepo.find.mockImplementation(async () => {
        const { alertas } = await (service as any).computarTodas();
        return alertas.map((a: any) => ({ alertKey: a.key }));
      });

      const res = await service.recalcular();

      expect(res.total).toBeGreaterThan(0);
      expect(res.nuevas).toBe(0);
      expect(clavesRepo.upsert).not.toHaveBeenCalled();
    });
  });

  describe('claves estables y listar', () => {
    it('genera claves estables con separadores pipe y formato esperado', async () => {
      clavesRepo.find.mockResolvedValue([]);
      estadosRepo.find.mockResolvedValue([]);

      const { data } = await service.listar({});

      expect(data.length).toBeGreaterThan(0);
      for (const alerta of data) {
        expect(alerta.key).toMatch(/^(contrato|gar|cupo)\|/);
        expect(alerta.nivel).toBeDefined();
      }
    });

    it('marca nueva=true cuando la clave no existe en claves registradas', async () => {
      clavesRepo.find.mockResolvedValueOnce([]); // Ninguna vista
      estadosRepo.find.mockResolvedValueOnce([]);

      const { data } = await service.listar({});

      expect(data.every((a) => a.nueva === true)).toBe(true);
    });

    it('integra el estado de gestión persistido', async () => {
      clavesRepo.find.mockResolvedValueOnce([]);
      estadosRepo.find.mockResolvedValueOnce([
        { alertKey: 'contrato|CT-01|30', estado: 'Leída', usuario: 'lmendez' } as AlertStateEntity,
      ]);

      const { data } = await service.listar({});
      const conGestion = data.find((a) => a.key === 'contrato|CT-01|30');

      expect(conGestion).toBeDefined();
      expect(conGestion?.gestion?.estado).toBe('Leída');
    });

    it('filtra por nivel de alerta', async () => {
      clavesRepo.find.mockResolvedValue([]);
      estadosRepo.find.mockResolvedValue([]);

      const { data } = await service.listar({ nivel: 'critica' });
      expect(data.every((a) => a.nivel === 'critica')).toBe(true);
    });
  });

  describe('gestión de alertas', () => {
    it('marcarLeida guarda estado Leída y audita', async () => {
      estadosRepo.findOne.mockResolvedValueOnce(null);
      estadosRepo.create.mockImplementation((dto) => dto as any);
      estadosRepo.save.mockImplementation((dto) => Promise.resolve(dto as any));

      const res = await service.marcarLeida('contrato|CT-01|30', ctx);

      expect(res.estado).toBe('Leída');
      expect(estadosRepo.save).toHaveBeenCalled();
      expect(audit.registrar).toHaveBeenCalledWith(
        ctx,
        expect.arrayContaining([
          expect.objectContaining({ modulo: 'Alertas', accion: 'LEÍDA' }),
        ]),
      );
    });

    it('resolver exige permiso EDITAR (lanza Prohibido si no lo tiene)', async () => {
      roles.tienePermiso.mockResolvedValueOnce(false);

      await expect(service.resolver('contrato|CT-01|30', 'Resuelto', ctx)).rejects.toThrow(
        Prohibido,
      );
    });

    it('resolver guarda estado Resuelta y nota cuando se tiene permiso', async () => {
      roles.tienePermiso.mockResolvedValueOnce(true);
      estadosRepo.findOne.mockResolvedValueOnce(null);
      estadosRepo.create.mockImplementation((dto) => dto as any);
      estadosRepo.save.mockImplementation((dto) => Promise.resolve(dto as any));

      const res = await service.resolver('contrato|CT-01|30', 'Se firmó prórroga', ctx);

      expect(res.estado).toBe('Resuelta');
      expect(res.nota).toBe('Se firmó prórroga');
      expect(audit.registrar).toHaveBeenCalledWith(
        ctx,
        expect.arrayContaining([
          expect.objectContaining({ modulo: 'Alertas', accion: 'RESUELTA', obs: 'Se firmó prórroga' }),
        ]),
      );
    });

    it('delegar exige permiso EDITAR y resuelve el usuario delegado', async () => {
      roles.tienePermiso.mockResolvedValueOnce(true);
      estadosRepo.findOne.mockResolvedValueOnce(null);
      estadosRepo.create.mockImplementation((dto) => dto as any);
      estadosRepo.save.mockImplementation((dto) => Promise.resolve(dto as any));

      const res = await service.delegar('contrato|CT-01|30', 'USR-02', ctx);

      expect(res.estado).toBe('Delegada');
      expect(res.delegadoA).toBe('Ana Gómez');
    });
  });

  describe('tareas desde alertas', () => {
    it('crea tarea asociada a la alerta y al contrato', async () => {
      tareasRepo.create.mockImplementation((dto: any) => dto as any);
      tareasRepo.save.mockImplementation((dto: any) => Promise.resolve({ id: 'TA-01', ...dto } as any));

      const res = await service.crearTareaDesdeAlerta(
        'contrato|CT-01|30',
        { titulo: 'Gestionar renovación', asignado: 'USR-02', vence: '2026-10-10' },
        ctx,
      );

      expect(res.id).toMatch(/^TA-/);
      expect(res.contractId).toBe('CT-01');
      expect(res.alertKey).toBe('contrato|CT-01|30');
      expect(audit.registrar).toHaveBeenCalled();
    });

    it('actualizarTarea lanza Conflicto (409) por versión desactualizada', async () => {
      tareasRepo.findOne.mockResolvedValueOnce({
        id: 'TA-01',
        version: 2,
        estado: 'Abierta',
      } as any);

      await expect(
        service.actualizarTarea('TA-01', { estado: 'Cerrada' }, 1, ctx),
      ).rejects.toThrow(Conflicto);
    });

    it('actualizarTarea actualiza estado e incrementa versión', async () => {
      const tareaDb = { id: 'TA-01', version: 1, estado: 'Abierta', contractId: 'CT-01' };
      tareasRepo.findOne
        .mockResolvedValueOnce(tareaDb as any)
        .mockResolvedValueOnce({ ...tareaDb, estado: 'Cerrada', version: 2 } as any);
      tareasRepo.update.mockResolvedValueOnce({ affected: 1, raw: [], generatedMaps: [] });

      const res = await service.actualizarTarea('TA-01', { estado: 'Cerrada' }, 1, ctx);

      expect(tareasRepo.update).toHaveBeenCalledWith(
        { id: 'TA-01', version: 1 },
        { estado: 'Cerrada', version: 2 },
      );
      expect(res).toBeDefined();
    });
  });
});
