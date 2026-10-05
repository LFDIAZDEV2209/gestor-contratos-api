import { GeoService } from './geo.service';
import { MemoryCacheService } from '../../cache/memory-cache.service';

describe('GeoService cache keys', () => {
  it('ignores arbitrary query parameters and canonicalizes recognized fields', async () => {
    const contracts = { find: jest.fn().mockResolvedValue([]) };
    const guarantees = { find: jest.fn().mockResolvedValue([]) };
    const cache = new MemoryCacheService();
    const service = new GeoService(contracts as any, guarantees as any, {} as any, {} as any, {} as any, cache);
    await service.departamentos({ ignored: 'one' } as any);
    await service.departamentos({ metric: 'contratos', measure: 'n', estado: 'unknown', ignored: 'two' } as any);
    expect(contracts.find).toHaveBeenCalledTimes(1);
    await service.departamentos({ companyId: 'EMP-01' });
    await service.departamentos({ metric: 'polizas' });
    await service.departamentos({ measure: 'v' });
    expect(contracts.find).toHaveBeenCalledTimes(4);
  });

  it('uses only region calculation filters, independent of query ordering', async () => {
    const contracts = { find: jest.fn().mockResolvedValue([]) };
    const guarantees = { find: jest.fn().mockResolvedValue([]) };
    const cache = new MemoryCacheService();
    const service = new GeoService(contracts as any, guarantees as any, {} as any, {} as any, {} as any, cache);
    await service.regiones({ companyId: 'EMP-01', estado: 'ejecucion', arbitrary: 'one' } as any);
    await service.regiones({ arbitrary: 'two', metric: 'x', estado: 'ejecucion', companyId: 'EMP-01' } as any);
    expect(contracts.find).toHaveBeenCalledTimes(1);
    await service.regiones({ companyId: 'EMP-02', estado: 'ejecucion' });
    expect(contracts.find).toHaveBeenCalledTimes(2);
  });
});
