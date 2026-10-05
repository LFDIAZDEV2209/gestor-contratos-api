import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContractEntity } from '../contracts/entities/contract.entity';
import { GuaranteeEntity } from '../contracts/entities/guarantees.entity';
import { CupoEntity } from '../contracts/entities/quotas.entity';
import { ContractContextLoader } from '../contracts/contract-context.loader';
import { SettingsService } from '../settings/settings.service';
import {
  agregarPorDepto, agregarPorRegion, totalesNacionales,
  ContratoMapa, GarantiaMapa,
} from '../../engines/map.engine';
import { CACHE_SERVICE, CacheService, CACHE_TTLS } from '../../cache/cache.service';

/** Agregados del mapa de Colombia calculados en el servidor (files/07). */
@Injectable()
export class GeoService {
  constructor(
    @InjectRepository(ContractEntity) private readonly contracts: Repository<ContractEntity>,
    @InjectRepository(GuaranteeEntity) private readonly gars: Repository<GuaranteeEntity>,
    @InjectRepository(CupoEntity) private readonly cupos: Repository<CupoEntity>,
    private readonly loader: ContractContextLoader,
    private readonly settings: SettingsService,
    @Inject(CACHE_SERVICE) private readonly cache: CacheService,
  ) {}

  private async insumos(filtros: { aseguradora?: string; estado?: string; companyId?: string }) {
    const [contratos, gars] = await Promise.all([
      this.contracts.find(),
      this.gars.find(),
    ]);
    const anulados = new Set(contratos.filter((c) => c.anulado).map((c) => c.id));
    const contratosMapa: ContratoMapa[] = contratos.map((c) => ({
      id: c.id,
      companyId: c.companyId,
      deptos: c.deptos ?? [],
      valorActual: c.valorBase + c.iva + c.otrosImp + c.adiciones - c.reducciones,
      nitContratista: c.nitContratista,
      estado: c.estado,
      anulado: c.anulado,
    }));
    const garantiasMapa: GarantiaMapa[] = gars
      .filter((g) => g.estado !== 'Anulada' && !anulados.has(g.contractId))
      .map((g) => ({
        contractId: g.contractId,
        valor: g.valor,
        aseguradora: g.aseguradora,
        estado: g.estado,
        anulado: g.estado === 'Anulada',
      }));
    const estadoGrupo = this.grupoDeEstado(filtros.estado);
    const f = { aseguradora: filtros.aseguradora, estadoGrupo, companyId: filtros.companyId };
    void this.loader;
    void this.cupos;
    void this.settings;
    return { contratosMapa, garantiasMapa, f };
  }

  private grupoDeEstado(estado?: string): string {
    switch (estado) {
      case 'ejecucion': return 'ejecucion';
      case 'suspendido': return 'suspendido';
      case 'liquidacion': return 'liquidacion';
      case 'liquidado': return 'liquidado';
      case 'terminado': return 'terminado';
      default: return 'todos';
    }
  }

  async departamentos(filtros: { metric?: string; measure?: string; aseguradora?: string; estado?: string; companyId?: string }) {
    const key = JSON.stringify({
      metric: filtros.metric ?? 'contratos', measure: filtros.measure ?? 'n',
      aseguradora: filtros.aseguradora ?? null, estado: this.grupoDeEstado(filtros.estado),
      companyId: filtros.companyId ?? null,
    });
    return this.cache.wrap(`geo:departamentos:${key}`, async () => {
      const { contratosMapa, garantiasMapa, f } = await this.insumos(filtros);
      const data = agregarPorDepto(contratosMapa, garantiasMapa, f);
      const totales = totalesNacionales(contratosMapa, garantiasMapa, f);
      return { metric: filtros.metric ?? 'contratos', measure: filtros.measure ?? 'n', totales, data };
    }, CACHE_TTLS.geo);
  }

  async regiones(filtros: { aseguradora?: string; estado?: string; companyId?: string }) {
    const key = JSON.stringify({
      aseguradora: filtros.aseguradora ?? null, estado: this.grupoDeEstado(filtros.estado),
      companyId: filtros.companyId ?? null,
    });
    return this.cache.wrap(`geo:regiones:${key}`, async () => {
      const { contratosMapa, garantiasMapa, f } = await this.insumos(filtros);
      const data = agregarPorRegion(contratosMapa, garantiasMapa, f);
      const totales = totalesNacionales(contratosMapa, garantiasMapa, f);
      return { totales, data };
    }, CACHE_TTLS.geo);
  }
}
