import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SettingEntity, CatalogEntity, CatalogItemEntity } from './settings.entity';
import { ParametrosAlerta, PARAMETROS_DEFECTO } from '../../engines/types';
import { ReqContext } from '../../common/req-context';
import { AuditService } from '../audit/audit.service';
import { In } from 'typeorm';
import { CACHE_SERVICE, CacheService, CACHE_TTLS } from '../../cache/cache.service';

/** Catálogos por defecto (files/02): 11 configurables. */
export const CATALOGOS_DEFECTO: Record<string, string[]> = {
  tiposContrato: [
    'Prestación de servicios', 'Prestación de servicios de salud', 'Obra civil', 'Suministro',
    'Consultoría', 'Interventoría', 'Mantenimiento', 'Arrendamiento', 'Transporte',
    'Tecnología y licenciamiento', 'Compraventa', 'Otro',
  ],
  modalidades: [
    'Contratación directa', 'Invitación privada', 'Invitación pública', 'Convocatoria abierta',
    'Orden de compra', 'Otra',
  ],
  estados: ['Borrador', 'Activo', 'Suspendido', 'Terminado', 'En liquidación', 'Liquidado', 'Anulado'],
  tiposGarantia: [
    'Cumplimiento', 'Calidad', 'Responsabilidad civil', 'Salarios y prestaciones', 'Manejo de anticipo',
    'Estabilidad', 'Seriedad de la oferta', 'Todo riesgo', 'Responsabilidad civil profesional', 'Otros',
  ],
  aseguradoras: [
    'Seguros del Estado S.A.', 'Seguros Generales Suramericana (SURA)', 'Seguros Bolívar S.A.',
    'Mundial de Seguros S.A.', 'Liberty Seguros S.A.', 'Mapfre Seguros Generales',
    'Allianz Seguros S.A.', 'AXA Colpatria Seguros', 'La Previsora S.A.', 'Chubb Seguros Colombia',
    'Aseguradora Solidaria de Colombia', 'SBS Seguros Colombia', 'HDI Seguros',
    'Zurich Colombia Seguros', 'Confianza (Compañía Aseguradora de Fianzas)',
  ],
  tiposActa: [
    'Acta de inicio', 'Acta parcial', 'Acta de suspensión', 'Acta de reinicio', 'Acta de modificación',
    'Acta de recibo', 'Acta de terminación', 'Acta de liquidación',
  ],
  tiposObligacion: [
    'General', 'Específica', 'Financiera', 'Técnica', 'Legal', 'Reporte / informe',
    'Seguridad social', 'Calidad',
  ],
  categoriasRiesgo: [
    'Financiero', 'Operativo', 'Legal / regulatorio', 'Técnico', 'Cumplimiento',
    'Reputacional', 'Seguridad de la información', 'Proveedor',
  ],
  categoriasDoc: [
    'Contrato', 'Estudios previos', 'Propuesta', 'Garantías', 'Actas', 'Facturas', 'Informes',
    'Evidencias', 'Modificaciones', 'Prórrogas', 'Suspensiones', 'Liquidación', 'Otros',
  ],
  docsRequeridos: ['Contrato', 'Propuesta', 'Garantías', 'Actas'],
  areas: [
    'Jurídica', 'Financiera', 'Compras', 'Operaciones', 'Tecnología', 'Salud', 'Gerencia', 'Talento humano',
  ],
};

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(SettingEntity) private readonly repo: Repository<SettingEntity>,
    @InjectRepository(CatalogEntity) private readonly catRepo: Repository<CatalogEntity>,
    @InjectRepository(CatalogItemEntity) private readonly itemRepo: Repository<CatalogItemEntity>,
    private readonly audit: AuditService,
    @Inject(CACHE_SERVICE) private readonly cache: CacheService,
  ) {}

  /** Parámetros de alertas para los motores (fila única, con valores por defecto). */
  async parametros(): Promise<ParametrosAlerta> {
    return this.cache.wrap('settings:parametros', async () => {
      const s = await this.repo.findOne({ where: { id: 1 } });
      if (!s) return PARAMETROS_DEFECTO;
      return { alertDays: s.alertDays, criticalDays: s.criticalDays, budgetPct: s.budgetPct, gapPct: s.gapPct };
    }, CACHE_TTLS.settings);
  }

  async obtener(): Promise<SettingEntity> {
    return this.cache.wrap('settings:obtener', async () => {
      let s = await this.repo.findOne({ where: { id: 1 } });
      if (!s) {
        s = this.repo.create({
          id: 1,
          alertDays: PARAMETROS_DEFECTO.alertDays,
          criticalDays: PARAMETROS_DEFECTO.criticalDays,
          budgetPct: PARAMETROS_DEFECTO.budgetPct,
          gapPct: PARAMETROS_DEFECTO.gapPct,
        });
        await this.repo.insert(s);
      }
      return s;
    }, CACHE_TTLS.settings);
  }

  async actualizar(
    cambios: Partial<Pick<SettingEntity, 'alertDays' | 'criticalDays' | 'budgetPct' | 'gapPct'>>,
    ctx: ReqContext,
  ): Promise<SettingEntity> {
    const antes = await this.obtener();
    const prev: Record<string, unknown> = {
      alertDays: [...antes.alertDays],
      criticalDays: antes.criticalDays,
      budgetPct: antes.budgetPct,
      gapPct: antes.gapPct,
    };
    Object.assign(antes, cambios);
    await this.repo.save(antes);
    const entradas = Object.entries(cambios)
      .filter(([k, v]) => JSON.stringify(prev[k]) !== JSON.stringify(v))
      .map(([k, v]) => ({
        modulo: 'Sistema',
        accion: 'PARAMETRO',
        campo: k,
        anterior: JSON.stringify(prev[k]),
        nuevo: JSON.stringify(v),
      }));
    await this.audit.registrar(ctx, entradas);
    await this.cache.delByPattern('settings:*');
    return antes;
  }

  async nombresCatalogos(): Promise<string[]> {
    return this.cache.wrap('settings:catalogos:nombres', async () => {
      const cats = await this.catRepo.find();
      return cats.map((c) => c.nombre).sort();
    }, CACHE_TTLS.settings);
  }

  async catalogo(nombre: string): Promise<{ nombre: string; valores: string[] }> {
    return this.cache.wrap(`settings:catalogos:${nombre}`, async () => {
      const cat = await this.catRepo.findOne({ where: { nombre } });
      if (!cat) return { nombre, valores: [] };
      const items = await this.itemRepo.find({ where: { catalogNombre: nombre }, order: { orden: 'ASC', id: 'ASC' } });
      return { nombre, valores: items.map((i) => i.valor) };
    }, CACHE_TTLS.settings);
  }

  /** Reemplaza los valores de un catálogo (solo ADMINISTRADOR). */
  async actualizarCatalogo(nombre: string, valores: string[], ctx: ReqContext): Promise<{ nombre: string; valores: string[] }> {
    const anterior = await this.catalogo(nombre);
    let cat = await this.catRepo.findOne({ where: { nombre } });
    if (!cat) {
      cat = await this.catRepo.insert(this.catRepo.create({ nombre })).then(() =>
        this.catRepo.findOneOrFail({ where: { nombre } }),
      );
    }
    await this.itemRepo.delete({ catalogNombre: nombre });
    if (valores.length) {
      await this.itemRepo.insert(
        valores.map((valor, i) => this.itemRepo.create({ catalogNombre: nombre, valor, orden: i })),
      );
    }
    await this.audit.registrar(ctx, [
      {
        modulo: 'Sistema',
        accion: 'CATALOGO',
        campo: nombre,
        anterior: anterior.valores.join(' | '),
        nuevo: valores.join(' | '),
      },
    ]);
    await this.cache.delByPattern('settings:catalogos:*');
    return { nombre, valores };
  }

  /** Crea los 11 catálogos por defecto si no existen (lo usa el seed). */
  async sembrarCatalogos(): Promise<void> {
    const nombres = Object.keys(CATALOGOS_DEFECTO);
    const existentes = await this.catRepo.find({ where: { nombre: In(nombres) } });
    const faltan = nombres.filter((n) => !existentes.some((c) => c.nombre === n));
    for (const nombre of faltan) {
      await this.catRepo.insert(this.catRepo.create({ nombre }));
      const valores = CATALOGOS_DEFECTO[nombre];
      await this.itemRepo.insert(
        valores.map((valor, i) => this.itemRepo.create({ catalogNombre: nombre, valor, orden: i })),
      );
    }
    if (faltan.length) await this.cache.delByPattern('settings:catalogos:*');
  }
}
