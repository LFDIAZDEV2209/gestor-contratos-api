import { CompaniesService } from './companies.service';
import { CompanyEntity } from './companies.entity';
import { ContractEntity } from '../contracts/entities/contract.entity';
import { ExecEntity } from '../contracts/entities/execs.entity';
import { Conflicto, NoEncontrado, Validacion } from '../../common/exceptions/api-exception';
import { createMockRepo, mockAuditService, mockReqContext } from '../../../test/mocks';

describe('CompaniesService', () => {
  let service: CompaniesService;
  let companyRepo: ReturnType<typeof createMockRepo<CompanyEntity>>;
  let contractsRepo: ReturnType<typeof createMockRepo<ContractEntity>>;
  let execsRepo: ReturnType<typeof createMockRepo<ExecEntity>>;
  let audit: ReturnType<typeof mockAuditService>;

  const ctx = mockReqContext();

  const dummyCompany: CompanyEntity = {
    id: 'EMP-01',
    nit: '900.123.456-7',
    razon: 'Empresa Demo S.A.S.',
    sigla: 'EMPDEMO',
    estado: 'Activa',
    version: 1,
    fechaCreacion: '2026-01-01',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as CompanyEntity;

  beforeEach(() => {
    companyRepo = createMockRepo<CompanyEntity>();
    contractsRepo = createMockRepo<ContractEntity>();
    execsRepo = createMockRepo<ExecEntity>();
    audit = mockAuditService();

    service = new CompaniesService(
      companyRepo as any,
      contractsRepo as any,
      execsRepo as any,
      audit as any,
    );
  });

  describe('obtenerConIndicadores', () => {
    it('calcula los indicadores de la empresa correctamente a partir de sus contratos y ejecuciones', async () => {
      companyRepo.findOne.mockResolvedValueOnce(dummyCompany);

      const hoy = new Date().toISOString().slice(0, 10);
      const ayer = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
      const manana = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

      // 3 contratos: 1 activo futuro, 1 activo vencido ayer, 1 anulado
      contractsRepo.find.mockResolvedValueOnce([
        {
          id: 'CT-01',
          companyId: 'EMP-01',
          anulado: false,
          estado: 'Activo',
          valorBase: 100_000_000,
          iva: 19_000_000,
          otrosImp: 0,
          adiciones: 10_000_000,
          reducciones: 0,
          fechaFin: manana,
        } as any,
        {
          id: 'CT-02',
          companyId: 'EMP-01',
          anulado: false,
          estado: 'Activo',
          valorBase: 50_000_000,
          iva: 0,
          otrosImp: 0,
          adiciones: 0,
          reducciones: 0,
          fechaFin: ayer, // Vencido
        } as any,
        {
          id: 'CT-03',
          companyId: 'EMP-01',
          anulado: true, // Ignorado
          estado: 'Anulado',
          valorBase: 200_000_000,
          iva: 0,
          otrosImp: 0,
          adiciones: 0,
          reducciones: 0,
        } as any,
      ]);

      // Ejecuciones: 30M en CT-01, 10M en CT-02, y una anulada
      execsRepo.find.mockResolvedValueOnce([
        { id: 'EX-01', contractId: 'CT-01', valor: 30_000_000, motivoAnulacion: null } as any,
        { id: 'EX-02', contractId: 'CT-02', valor: 10_000_000, motivoAnulacion: null } as any,
        { id: 'EX-03', contractId: 'CT-01', valor: 5_000_000, motivoAnulacion: 'Error de digitación' } as any,
      ]);

      const res = await service.obtenerConIndicadores('EMP-01');

      expect(res.company).toEqual(dummyCompany);
      expect(res.indicadores.contratos).toBe(2); // Vivos: CT-01 y CT-02
      expect(res.indicadores.activos).toBe(2);
      // valorContratado: CT-01 (100M+19M+10M = 129M) + CT-02 (50M) = 179M
      expect(res.indicadores.valorContratado).toBe(179_000_000);
      // ejecutado: EX-01 (30M) + EX-02 (10M) = 40M (EX-03 anulada se omite)
      expect(res.indicadores.ejecutado).toBe(40_000_000);
      expect(res.indicadores.saldo).toBe(139_000_000); // 179M - 40M
      expect(res.indicadores.vencidos).toBe(1); // CT-02
    });

    it('devuelve indicadores en cero cuando la empresa no tiene contratos', async () => {
      companyRepo.findOne.mockResolvedValueOnce(dummyCompany);
      contractsRepo.find.mockResolvedValueOnce([]);

      const res = await service.obtenerConIndicadores('EMP-01');

      expect(res.indicadores.contratos).toBe(0);
      expect(res.indicadores.activos).toBe(0);
      expect(res.indicadores.valorContratado).toBe(0);
      expect(res.indicadores.ejecutado).toBe(0);
      expect(res.indicadores.saldo).toBe(0);
      expect(res.indicadores.vencidos).toBe(0);
    });
  });

  describe('crear', () => {
    it('crea empresa con estado Activa, version=1 y auditoría', async () => {
      companyRepo.findOne.mockResolvedValueOnce(null); // No duplicada
      companyRepo.create.mockImplementation((d) => d as any);
      companyRepo.save.mockImplementation((d) => Promise.resolve({ id: 'EMP-99', ...d } as any));

      const dto = {
        nit: '901.999.888-1',
        razon: 'Nueva Empresa S.A.',
        sigla: 'NE',
      };

      const res = await service.crear(dto, ctx);

      expect(res.id).toBeDefined();
      expect(res.nit).toBe('901.999.888-1');
      expect(res.estado).toBe('Activa');
      expect(res.version).toBe(1);
      expect(audit.registrar).toHaveBeenCalledWith(
        ctx,
        expect.arrayContaining([
          expect.objectContaining({ modulo: 'Empresas', accion: 'CREAR' }),
        ]),
      );
    });

    it('rechaza con Conflicto (409) si el NIT ya existe', async () => {
      companyRepo.findOne.mockResolvedValueOnce(dummyCompany);

      const dto = {
        nit: '900.123.456-7',
        razon: 'Empresa Clon',
      };

      await expect(service.crear(dto, ctx)).rejects.toThrow(Conflicto);
      expect(companyRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('actualizar', () => {
    it('actualiza exitosamente e incrementa versión', async () => {
      companyRepo.findOne.mockResolvedValue(dummyCompany);
      companyRepo.update.mockResolvedValueOnce({ affected: 1, raw: [], generatedMaps: [] });

      const dto = { version: 1, razon: 'Razón Modificada' };
      const res = await service.actualizar('EMP-01', dto, 1, ctx);

      expect(companyRepo.update).toHaveBeenCalledWith(
        { id: 'EMP-01', version: 1 },
        { razon: 'Razón Modificada', version: 2 },
      );
      expect(audit.registrar).toHaveBeenCalled();
      expect(res).toBeDefined();
    });

    it('rechaza con Validacion si la empresa está inactiva', async () => {
      companyRepo.findOne.mockResolvedValueOnce({ ...dummyCompany, estado: 'Inactiva' } as any);

      await expect(service.actualizar('EMP-01', { version: 1, razon: 'Test' }, 1, ctx)).rejects.toThrow(
        Validacion,
      );
    });

    it('rechaza con Conflicto (409) si la concurrencia en BD falla (affected=0)', async () => {
      companyRepo.findOne.mockResolvedValueOnce(dummyCompany);
      companyRepo.update.mockResolvedValueOnce({ affected: 0, raw: [], generatedMaps: [] });

      await expect(service.actualizar('EMP-01', { version: 1, razon: 'Test' }, 1, ctx)).rejects.toThrow(
        Conflicto,
      );
    });
  });

  describe('anular (inactivar con motivo)', () => {
    it('inactiva la empresa y guarda motivoAnulacion', async () => {
      companyRepo.findOne.mockResolvedValueOnce(dummyCompany);
      companyRepo.update.mockResolvedValueOnce({ affected: 1, raw: [], generatedMaps: [] });

      const res = await service.anular('EMP-01', 'Fusión por absorción', ctx);

      expect(res.estado).toBe('Inactiva');
      expect(res.motivoAnulacion).toBe('Fusión por absorción');
      expect(companyRepo.update).toHaveBeenCalledWith(
        { id: 'EMP-01', version: 1 },
        { estado: 'Inactiva', motivoAnulacion: 'Fusión por absorción', version: 2 },
      );
      expect(audit.registrar).toHaveBeenCalledWith(
        ctx,
        expect.arrayContaining([
          expect.objectContaining({ modulo: 'Empresas', accion: 'ANULAR', obs: 'Fusión por absorción' }),
        ]),
      );
    });

    it('rechaza anulación si la empresa ya estaba inactiva', async () => {
      companyRepo.findOne.mockResolvedValueOnce({ ...dummyCompany, estado: 'Inactiva' } as any);

      await expect(service.anular('EMP-01', 'Motivo', ctx)).rejects.toThrow(Validacion);
    });
  });
});
