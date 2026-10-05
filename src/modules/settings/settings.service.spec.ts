import { SettingsService, CATALOGOS_DEFECTO } from './settings.service';
import { SettingEntity, CatalogEntity, CatalogItemEntity } from './settings.entity';
import { PARAMETROS_DEFECTO } from '../../engines/types';
import { createMockRepo, mockAuditService, mockReqContext } from '../../../test/mocks';
import { CacheService } from '../../cache/cache.service';

describe('SettingsService', () => {
  let service: SettingsService;
  let settingRepo: ReturnType<typeof createMockRepo<SettingEntity>>;
  let catRepo: ReturnType<typeof createMockRepo<CatalogEntity>>;
  let itemRepo: ReturnType<typeof createMockRepo<CatalogItemEntity>>;
  let audit: ReturnType<typeof mockAuditService>;
  let cache: jest.Mocked<CacheService>;

  const ctx = mockReqContext();

  const dummySetting: SettingEntity = {
    id: 1,
    alertDays: [30, 15, 10, 5, 3, 1],
    criticalDays: 5,
    budgetPct: 90,
    gapPct: 15,
    updatedAt: new Date(),
  } as SettingEntity;

  beforeEach(() => {
    settingRepo = createMockRepo<SettingEntity>();
    catRepo = createMockRepo<CatalogEntity>();
    itemRepo = createMockRepo<CatalogItemEntity>();
    audit = mockAuditService();

    cache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      delByPattern: jest.fn().mockResolvedValue(1),
      wrap: jest.fn().mockImplementation((_key: string, factory: () => any) => factory()) as any,
      ping: jest.fn().mockResolvedValue(true),
    };

    service = new SettingsService(
      settingRepo as any,
      catRepo as any,
      itemRepo as any,
      audit as any,
      cache,
    );
  });

  describe('parametros', () => {
    it('devuelve los parámetros configurados en BD', async () => {
      settingRepo.findOne.mockResolvedValueOnce(dummySetting);

      const params = await service.parametros();

      expect(cache.wrap).toHaveBeenCalledWith('settings:parametros', expect.any(Function), expect.any(Number));
      expect(params.alertDays).toEqual([30, 15, 10, 5, 3, 1]);
      expect(params.criticalDays).toBe(5);
      expect(params.budgetPct).toBe(90);
    });

    it('devuelve PARAMETROS_DEFECTO si no existe registro en BD', async () => {
      settingRepo.findOne.mockResolvedValueOnce(null);

      const params = await service.parametros();

      expect(params).toEqual(PARAMETROS_DEFECTO);
    });
  });

  describe('obtener y actualizar', () => {
    it('obtener crea registro por defecto si no existe', async () => {
      settingRepo.findOne.mockResolvedValueOnce(null);
      settingRepo.create.mockImplementation((d) => d as any);
      settingRepo.insert.mockResolvedValueOnce({ identifiers: [{ id: 1 }] } as any);

      const res = await service.obtener();

      expect(settingRepo.insert).toHaveBeenCalled();
      expect(res.id).toBe(1);
    });

    it('actualizar modifica parámetros, audita y limpia caché', async () => {
      settingRepo.findOne.mockResolvedValueOnce({ ...dummySetting });
      settingRepo.save.mockImplementation((d) => Promise.resolve(d as any));

      const cambios = { criticalDays: 7, budgetPct: 95 };
      const res = await service.actualizar(cambios, ctx);

      expect(settingRepo.save).toHaveBeenCalled();
      expect(audit.registrar).toHaveBeenCalledWith(
        ctx,
        expect.arrayContaining([
          expect.objectContaining({ modulo: 'Sistema', accion: 'PARAMETRO', campo: 'criticalDays' }),
          expect.objectContaining({ modulo: 'Sistema', accion: 'PARAMETRO', campo: 'budgetPct' }),
        ]),
      );
      expect(cache.delByPattern).toHaveBeenCalledWith('settings:*');
      expect(res.criticalDays).toBe(7);
      expect(res.budgetPct).toBe(95);
    });
  });

  describe('catálogos', () => {
    it('nombresCatalogos devuelve lista ordenada de catálogos', async () => {
      catRepo.find.mockResolvedValueOnce([
        { nombre: 'tiposContrato' } as CatalogEntity,
        { nombre: 'areas' } as CatalogEntity,
      ]);

      const nombres = await service.nombresCatalogos();

      expect(nombres).toEqual(['areas', 'tiposContrato']);
    });

    it('catalogo devuelve nombre y valores ordenados por orden', async () => {
      catRepo.findOne.mockResolvedValueOnce({ nombre: 'areas' } as CatalogEntity);
      itemRepo.find.mockResolvedValueOnce([
        { catalogNombre: 'areas', valor: 'Jurídica', orden: 0 } as CatalogItemEntity,
        { catalogNombre: 'areas', valor: 'Compras', orden: 1 } as CatalogItemEntity,
      ]);

      const cat = await service.catalogo('areas');

      expect(cat.nombre).toBe('areas');
      expect(cat.valores).toEqual(['Jurídica', 'Compras']);
    });

    it('catalogo devuelve valores vacíos si el catálogo no existe', async () => {
      catRepo.findOne.mockResolvedValueOnce(null);

      const cat = await service.catalogo('inexistente');

      expect(cat.valores).toEqual([]);
    });

    it('actualizarCatalogo reemplaza valores, audita e invalida caché', async () => {
      // Estado anterior
      catRepo.findOne
        .mockResolvedValueOnce({ nombre: 'modalidades' } as CatalogEntity) // en catalogo(nombre)
        .mockResolvedValueOnce({ nombre: 'modalidades' } as CatalogEntity); // en actualizarCatalogo
      itemRepo.find.mockResolvedValueOnce([
        { catalogNombre: 'modalidades', valor: 'Directa', orden: 0 } as CatalogItemEntity,
      ]);

      const nuevosValores = ['Contratación directa', 'Invitación privada'];
      const res = await service.actualizarCatalogo('modalidades', nuevosValores, ctx);

      expect(itemRepo.delete).toHaveBeenCalledWith({ catalogNombre: 'modalidades' });
      expect(itemRepo.insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ catalogNombre: 'modalidades', valor: 'Contratación directa', orden: 0 }),
          expect.objectContaining({ catalogNombre: 'modalidades', valor: 'Invitación privada', orden: 1 }),
        ]),
      );
      expect(audit.registrar).toHaveBeenCalledWith(
        ctx,
        expect.arrayContaining([
          expect.objectContaining({ modulo: 'Sistema', accion: 'CATALOGO', campo: 'modalidades' }),
        ]),
      );
      expect(cache.delByPattern).toHaveBeenCalledWith('settings:catalogos:*');
      expect(res.valores).toEqual(nuevosValores);
    });

    it('sembrarCatalogos inserta los catálogos faltantes por defecto', async () => {
      // Supongamos que no existe ninguno sembrado
      catRepo.find.mockResolvedValueOnce([]);

      await service.sembrarCatalogos();

      const totalDefecto = Object.keys(CATALOGOS_DEFECTO).length;
      expect(catRepo.insert).toHaveBeenCalledTimes(totalDefecto);
      expect(itemRepo.insert).toHaveBeenCalledTimes(totalDefecto);
      expect(cache.delByPattern).toHaveBeenCalledWith('settings:catalogos:*');
    });
  });
});
