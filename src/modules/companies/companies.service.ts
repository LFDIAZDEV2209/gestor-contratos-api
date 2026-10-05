import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CompanyEntity } from './companies.entity';
import { CrearEmpresaDto, ActualizarEmpresaDto } from './dto';
import { ContractEntity } from '../contracts/entities/contract.entity';
import { ExecEntity } from '../contracts/entities/execs.entity';
import { newId } from '../../common/ids';
import { Conflicto, NoEncontrado, Validacion } from '../../common/exceptions/api-exception';
import { ReqContext } from '../../common/req-context';
import { entradasPorCampos } from '../../common/audit-diff';
import { AuditService } from '../audit/audit.service';
import { valorActualDe } from '../../engines/metrics.engine';
import { diffDias } from '../../common/dates';
import { ESTADOS_CERRADOS } from '../../engines/types';
import { CACHE_SERVICE, CacheService, invalidateReadModels } from '../../cache/cache.service';

export interface IndicadoresEmpresa {
  contratos: number;
  activos: number;
  valorContratado: number;
  ejecutado: number;
  saldo: number;
  vencidos: number;
}

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(CompanyEntity) private readonly repo: Repository<CompanyEntity>,
    @InjectRepository(ContractEntity) private readonly contracts: Repository<ContractEntity>,
    @InjectRepository(ExecEntity) private readonly execs: Repository<ExecEntity>,
    private readonly audit: AuditService,
    @Inject(CACHE_SERVICE) private readonly cache: CacheService,
  ) {}

  async listar(query: Record<string, unknown>): Promise<{ data: CompanyEntity[]; total: number }> {
    const qb = this.repo.createQueryBuilder('e');
    if (query.estado) qb.andWhere('e.estado = :estado', { estado: query.estado });
    if (query.q) qb.andWhere('(e.razon ILIKE :q OR e.nit ILIKE :q)', { q: `%${query.q}%` });
    const data = await qb.orderBy('e.razon', 'ASC').getMany();
    return { data, total: data.length };
  }

  /** Detalle con indicadores (contratos, valor, ejecutado, saldo) — files/03. */
  async obtenerConIndicadores(id: string): Promise<{ company: CompanyEntity; indicadores: IndicadoresEmpresa }> {
    const company = await this.obtener(id);
    const contratos = await this.contracts.find({ where: { companyId: id } });
    const hoy = new Date().toISOString().slice(0, 10);
    const vivos = contratos.filter((c) => !c.anulado);
    const exs = vivos.length
      ? await this.execs.find({ where: { contractId: In(vivos.map((c) => c.id)) } })
      : [];
    let valorContratado = 0;
    let ejecutado = 0;
    let vencidos = 0;
    for (const c of vivos) {
      valorContratado += valorActualDe(c.valorBase, c.iva, c.otrosImp, c.adiciones, c.reducciones);
      if (c.fechaFin && diffDias(hoy, c.fechaFin) < 0 && !ESTADOS_CERRADOS.includes(c.estado)) vencidos += 1;
    }
    for (const e of exs) {
      if (e.motivoAnulacion) continue;
      ejecutado += e.valor;
    }
    return {
      company,
      indicadores: {
        contratos: vivos.length,
        activos: vivos.filter((c) => c.estado === 'Activo').length,
        valorContratado,
        ejecutado,
        saldo: valorContratado - ejecutado,
        vencidos,
      },
    };
  }

  async obtener(id: string): Promise<CompanyEntity> {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NoEncontrado(`La empresa ${id}`);
    return c;
  }

  async crear(dto: CrearEmpresaDto, ctx: ReqContext): Promise<CompanyEntity> {
    const nit = dto.nit.trim();
    if (await this.repo.findOne({ where: { nit } })) {
      throw new Conflicto(`Ya existe una empresa con el NIT ${nit}.`, ['nit']);
    }
    const c = await this.repo.save(this.repo.create({
      ...dto,
      id: newId('EMP'),
      nit,
      estado: 'Activa',
      fechaCreacion: new Date().toISOString().slice(0, 10),
      version: 1,
    }));
    await invalidateReadModels(this.cache);
    await this.audit.registrar(ctx, [{ modulo: 'Empresas', accion: 'CREAR', nuevo: `${c.razon} (NIT ${c.nit})` }]);
    return c;
  }

  async actualizar(id: string, dto: ActualizarEmpresaDto, version: number, ctx: ReqContext): Promise<CompanyEntity> {
    const c = await this.obtener(id);
    if (c.estado === 'Inactiva') throw new Validacion('La empresa está inactiva y no se puede editar.');
    const prev = { ...c };
    const nit = dto.nit?.trim();
    if (nit && nit !== c.nit) {
      const otro = await this.repo.findOne({ where: { nit } });
      if (otro) throw new Conflicto(`Ya existe una empresa con el NIT ${nit}.`, ['nit']);
    }
    c.version = version;
    const { version: _v, ...cambios } = dto;
    Object.assign(c, cambios);
    const res = await this.repo.update({ id: c.id, version }, { ...cambios, version: version + 1 });
    if (!res.affected) {
      throw new Conflicto('La versión del registro está desactualizada. Recargue el registro y vuelva a intentarlo.', ['version']);
    }
    await invalidateReadModels(this.cache);
    await this.audit.registrar(
      ctx,
      entradasPorCampos(prev as unknown as Record<string, unknown>, c as unknown as Record<string, unknown>, Object.keys(cambios), { modulo: 'Empresas', accion: 'EDITAR' }),
    );
    return this.obtener(id);
  }

  /** Anulación de empresa = estado Inactiva + motivo (files/08). */
  async anular(id: string, motivo: string, ctx: ReqContext): Promise<CompanyEntity> {
    const c = await this.obtener(id);
    if (c.estado === 'Inactiva') throw new Validacion('La empresa ya está inactiva.');
    c.estado = 'Inactiva';
    c.motivoAnulacion = motivo;
    const res = await this.repo.update(
      { id: c.id, version: c.version },
      { estado: 'Inactiva', motivoAnulacion: motivo, version: c.version + 1 },
    );
    if (!res.affected) {
      throw new Conflicto('La versión del registro está desactualizada. Recargue el registro y vuelva a intentarlo.', ['version']);
    }
    await invalidateReadModels(this.cache);
    await this.audit.registrar(ctx, [{
      modulo: 'Empresas', accion: 'ANULAR', campo: 'estado', anterior: 'Activa', nuevo: 'Inactiva', obs: motivo,
    }]);
    return c;
  }
}
