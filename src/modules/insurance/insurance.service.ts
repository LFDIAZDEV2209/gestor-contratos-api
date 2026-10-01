import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { GuaranteeEntity } from '../contracts/entities/guarantees.entity';
import { CupoEntity } from '../contracts/entities/quotas.entity';
import { ContractEntity } from '../contracts/entities/contract.entity';
import { newId } from '../../common/ids';
import { hoyISO, diffDias } from '../../common/dates';
import { NoEncontrado, Prohibido, Validacion, WarningRequiresConfirmation, Conflicto } from '../../common/exceptions/api-exception';
import { ReqContext } from '../../common/req-context';
import { entradasPorCampos } from '../../common/audit-diff';
import { AuditService } from '../audit/audit.service';
import { RolesService } from '../roles/roles.service';
import { ContractContextLoader } from '../contracts/contract-context.loader';
import { cupoStats, CupoStats } from '../../engines/cupo.engine';
import { reglasDeCupo } from '../../engines/seguros.engine';
import { redondear1 } from '../../common/dates';

export interface CupoConStats extends CupoEntity {
  calculado: CupoStats;
}

export interface ResumenAseguradora {
  aseguradora: string;
  polizas: number;
  contratos: number;
  valorAsegurado: number;
  primas: number;
  porCupo: number;
  individuales: number;
  cupos: number;
  cupoTotal: number;
  cupoUtilizado: number;
  vencen30: number;
  vencidas: number;
}

/** Garantías (pólizas), aseguradoras y cupos — files/03 y files/06. */
@Injectable()
export class InsuranceService {
  constructor(
    @InjectRepository(GuaranteeEntity) private readonly gars: Repository<GuaranteeEntity>,
    @InjectRepository(CupoEntity) private readonly cupos: Repository<CupoEntity>,
    @InjectRepository(ContractEntity) private readonly contracts: Repository<ContractEntity>,
    private readonly loader: ContractContextLoader,
    private readonly audit: AuditService,
    private readonly roles: RolesService,
  ) {}

  /** GET /guarantees con filtros. */
  async listarGarantias(q: Record<string, unknown>): Promise<{ data: GuaranteeEntity[]; total: number }> {
    const qb = this.gars.createQueryBuilder('g');
    if (q.contractId) qb.andWhere('g.contractId = :contractId', { contractId: q.contractId });
    if (q.aseguradora) qb.andWhere('g.aseguradora = :aseguradora', { aseguradora: q.aseguradora });
    if (q.modalidadPoliza) qb.andWhere('g.modalidadPoliza = :mp', { mp: q.modalidadPoliza });
    if (q.cupoId) qb.andWhere('g.cupoId = :cupoId', { cupoId: q.cupoId });
    if (q.estado) qb.andWhere('g.estado = :estado', { estado: q.estado });
    if (q.vencenEnDias) {
      const hoy = hoyISO();
      const hasta = new Date(Date.parse(`${hoy}T00:00:00Z`) + Number(q.vencenEnDias) * 86_400_000).toISOString().slice(0, 10);
      qb.andWhere('g.fechaVenc BETWEEN :hoy AND :hasta', { hoy, hasta });
    }
    const data = await qb.orderBy('g.fechaVenc', 'ASC').getMany();
    return { data, total: data.length };
  }

  async crearGarantia(dto: Record<string, unknown>, ctx: ReqContext, force: boolean): Promise<GuaranteeEntity> {
    const { errores, advertencias } = await this.reglasCupo(dto);
    if (errores.length) throw new Validacion(errores[0], []);
    if (advertencias.length && !force) {
      throw new WarningRequiresConfirmation('Advertencia: la póliza por cupo tiene inconsistencias aceptables.', advertencias);
    }
    await this.exigeAprobacionSiAplica(dto.estado as string | undefined, null, ctx);
    if (dto.fechaInicio && dto.fechaVenc && diffDias(dto.fechaInicio as string, dto.fechaVenc as string) < 0) {
      throw new Validacion('El vencimiento de la póliza no puede ser anterior a su inicio.', ['fechaVenc']);
    }
    const g = await this.gars.save(this.gars.create({ ...dto, id: newId('GR'), version: 1 }));
    await this.audit.registrar(ctx, [{
      contractId: g.contractId, modulo: 'Garantías', accion: 'CREAR', nuevo: `${g.tipo} ${g.poliza} (${g.aseguradora})`,
    }]);
    return g;
  }

  async actualizarGarantia(id: string, dto: Record<string, unknown>, ctx: ReqContext, force: boolean): Promise<GuaranteeEntity> {
    const g = await this.gars.findOne({ where: { id } });
    if (!g) throw new NoEncontrado(`La póliza ${id}`);
    if (g.estado === 'Anulada') throw new Validacion('La póliza está anulada y no se puede editar.');
    const prev = { ...g };
    const fusion = { ...g, ...dto } as unknown as {
      modalidadPoliza: string; cupoId: string; aseguradora: string; valor: number; fechaVenc: string; fechaInicio: string; poliza: string;
    };
    const { errores, advertencias } = await this.reglasCupo(fusion as unknown as Record<string, unknown>);
    if (errores.length) throw new Validacion(errores[0], []);
    if (advertencias.length && !force) {
      throw new WarningRequiresConfirmation('Advertencia: la póliza tiene inconsistencias aceptables.', advertencias);
    }
    if (fusion.fechaInicio && fusion.fechaVenc && diffDias(fusion.fechaInicio, fusion.fechaVenc) < 0) {
      throw new Validacion('El vencimiento de la póliza no puede ser anterior a su inicio.', ['fechaVenc']);
    }
    await this.exigeAprobacionSiAplica(dto.estado as string | undefined, g.estado, ctx);
    g.version = Number(dto.version);
    const { version: _v, ...cambios } = dto;
    if (fusion.modalidadPoliza !== 'Póliza por cupo') {
      // Si se cambia a individual, se le quita el cupo (files/06).
      (cambios as Record<string, unknown>).cupoId = null;
    }
    Object.assign(g, cambios);
    const res = await this.gars.update({ id: g.id, version: Number(dto.version) }, { ...cambios, version: Number(dto.version) + 1 } as never);
    if (!res.affected) {
      throw new Conflicto('La versión del registro está desactualizada. Recargue el registro y vuelva a intentarlo.', ['version']);
    }
    await this.audit.registrar(
      ctx,
      entradasPorCampos(prev as unknown as Record<string, unknown>, g as unknown as Record<string, unknown>, Object.keys(cambios), { contractId: g.contractId, modulo: 'Garantías', accion: 'EDITAR' }),
    );
    return this.gars.findOneOrFail({ where: { id } });
  }

  /** Aprobar póliza: permiso APROBAR (files/05 §9). */
  async aprobarGarantia(id: string, ctx: ReqContext): Promise<GuaranteeEntity> {
    const g = await this.gars.findOne({ where: { id } });
    if (!g) throw new NoEncontrado(`La póliza ${id}`);
    if (g.estado === 'Anulada') throw new Validacion('La póliza está anulada.');
    if (g.estado === 'Aprobada') throw new Validacion('La póliza ya está aprobada.');
    await this.gars.update(
      { id: g.id, version: g.version },
      { estado: 'Aprobada', version: g.version + 1 } as never,
    );
    await this.audit.registrar(ctx, [{
      contractId: g.contractId, modulo: 'Garantías', accion: 'APROBAR', campo: 'estado',
      anterior: g.estado, nuevo: 'Aprobada',
    }]);
    return this.gars.findOneOrFail({ where: { id } });
  }

  async anularGarantia(id: string, motivo: string, ctx: ReqContext): Promise<GuaranteeEntity> {
    const g = await this.gars.findOne({ where: { id } });
    if (!g) throw new NoEncontrado(`La póliza ${id}`);
    if (g.estado === 'Anulada') throw new Validacion('La póliza ya está anulada.');
    await this.gars.update(
      { id: g.id, version: g.version },
      { estado: 'Anulada', motivoAnulacion: motivo, version: g.version + 1 } as never,
    );
    await this.audit.registrar(ctx, [{
      contractId: g.contractId, modulo: 'Garantías', accion: 'ANULAR', obs: motivo,
    }]);
    return this.gars.findOneOrFail({ where: { id } });
  }

  /** GET /quotas — cupos con utilizado/disponible/pctUso calculados en servidor. */
  async listarCupos(): Promise<CupoConStats[]> {
    const cupos = await this.cupos.find({ order: { aseguradora: 'ASC', numero: 'ASC' } });
    return this.conCalculado(cupos);
  }

  async crearCupo(dto: Record<string, unknown>, ctx: ReqContext): Promise<CupoEntity> {
    if (dto.fechaInicio && dto.fechaVenc && diffDias(dto.fechaInicio as string, dto.fechaVenc as string) < 0) {
      throw new Validacion('La vigencia final del cupo no puede ser anterior a la inicial.', ['fechaVenc']);
    }
    const cp = await this.cupos.save(this.cupos.create({ ...dto, id: newId('CP'), version: 1 }));
    await this.audit.registrar(ctx, [{ modulo: 'Cupos', accion: 'CREAR', nuevo: `${cp.numero} (${cp.aseguradora})` }]);
    return cp;
  }

  async actualizarCupo(id: string, dto: Record<string, unknown>, ctx: ReqContext, force: boolean): Promise<CupoEntity> {
    const cp = await this.cupos.findOne({ where: { id } });
    if (!cp) throw new NoEncontrado(`El cupo ${id}`);
    if (cp.estado === 'Anulado') throw new Validacion('El cupo está anulado y no se puede editar.');
    if (dto.fechaInicio && dto.fechaVenc && diffDias(dto.fechaInicio as string, dto.fechaVenc as string) < 0) {
      throw new Validacion('La vigencia final del cupo no puede ser anterior a la inicial.', ['fechaVenc']);
    }
    // Si ya tiene pólizas, no se puede cambiar la aseguradora (files/06).
    if (dto.aseguradora && dto.aseguradora !== cp.aseguradora) {
      const conPolizas = await this.gars.count({ where: { cupoId: id } });
      if (conPolizas > 0) {
        throw new Validacion(`El cupo ya tiene ${conPolizas} póliza(s); no se puede cambiar la aseguradora.`, ['aseguradora']);
      }
    }
    // Si el nuevo valor es menor que lo utilizado → advertencia aceptable (422 + force).
    const polizas = await this.polizasDelCupo(id);
    const stats = cupoStats({ id, valor: Number(dto.valor ?? cp.valor) }, polizas);
    const advertencias: string[] = [];
    if (dto.valor != null && stats.disponible < 0) {
      advertencias.push(`El nuevo valor del cupo es menor que lo ya utilizado (${stats.utilizado}); quedaría en negativo.`);
    }
    if (advertencias.length && !force) {
      throw new WarningRequiresConfirmation('Advertencia: el cupo quedaría por debajo de lo utilizado.', advertencias);
    }
    cp.version = Number(dto.version);
    const { version: _v, ...cambios } = dto;
    Object.assign(cp, cambios);
    const res = await this.cupos.update({ id: cp.id, version: Number(dto.version) }, { ...cambios, version: Number(dto.version) + 1 } as never);
    if (!res.affected) {
      throw new Conflicto('La versión del registro está desactualizada. Recargue el registro y vuelva a intentarlo.', ['version']);
    }
    await this.audit.registrar(
      ctx,
      entradasPorCampos(cp as unknown as Record<string, unknown>, cp as unknown as Record<string, unknown>, Object.keys(cambios), { modulo: 'Cupos', accion: 'EDITAR' }),
    );
    return this.cupos.findOneOrFail({ where: { id } });
  }

  async anularCupo(id: string, motivo: string, ctx: ReqContext): Promise<CupoEntity> {
    const cp = await this.cupos.findOne({ where: { id } });
    if (!cp) throw new NoEncontrado(`El cupo ${id}`);
    if (cp.estado === 'Anulado') throw new Validacion('El cupo ya está anulado.');
    cp.estado = 'Anulado';
    cp.motivoAnulacion = motivo;
    await this.cupos.update(
      { id: cp.id, version: cp.version },
      { estado: 'Anulado', motivoAnulacion: motivo, version: cp.version + 1 } as never,
    );
    await this.audit.registrar(ctx, [{ modulo: 'Cupos', accion: 'ANULAR', obs: motivo }]);
    return this.cupos.findOneOrFail({ where: { id } });
  }

  /** GET /insurers — resumen por aseguradora (files/06 módulo). */
  async resumenAseguradoras(): Promise<{ data: ResumenAseguradora[] }> {
    const [gars, cupos, contratos] = await Promise.all([
      this.gars.find({ where: { estado: In(['Pendiente', 'Aprobada']) } }),
      this.cupos.find(),
      this.contracts.find({ select: ['id', 'anulado'] }),
    ]);
    const anulados = new Set(contratos.filter((c) => c.anulado).map((c) => c.id));
    const vivas = gars.filter((g) => !anulados.has(g.contractId));
    const nombres = [...new Set([...vivas.map((g) => g.aseguradora), ...cupos.filter((c) => c.estado === 'Vigente').map((c) => c.aseguradora)])];
    const hoy = hoyISO();
    const data: ResumenAseguradora[] = nombres.sort().map((nombre) => {
      const polizas = vivas.filter((g) => g.aseguradora === nombre);
      const cuposA = cupos.filter((c) => c.aseguradora === nombre);
      const st = polizas.filter((g) => g.fechaVenc && g.fechaVenc < hoy).length;
      const en30 = polizas.filter((g) => g.fechaVenc && diffDias(hoy, g.fechaVenc) >= 0 && diffDias(hoy, g.fechaVenc) <= 30).length;
      return {
        aseguradora: nombre,
        polizas: polizas.length,
        contratos: new Set(polizas.map((g) => g.contractId)).size,
        valorAsegurado: Math.round(polizas.reduce((s, g) => s + g.valor, 0)),
        primas: Math.round(polizas.reduce((s, g) => s + (g.prima ?? 0), 0)),
        porCupo: polizas.filter((g) => g.modalidadPoliza === 'Póliza por cupo').length,
        individuales: polizas.filter((g) => g.modalidadPoliza === 'Póliza individual').length,
        cupos: cuposA.length,
        cupoTotal: cuposA.reduce((s, c) => s + c.valor, 0),
        cupoUtilizado: cuposA.reduce((s, c) => s + cupoStats({ id: c.id, valor: c.valor }, vivas.map((g) => ({ cupoId: g.cupoId, estado: g.estado, valor: g.valor }))).utilizado, 0),
        vencen30: en30,
        vencidas: st,
      };
    });
    return { data };
  }

  /** GET /insurers/:nombre/policies */
  async polizasDe(nombre: string): Promise<GuaranteeEntity[]> {
    return this.gars.find({ where: { aseguradora: nombre }, order: { fechaVenc: 'ASC' } });
  }

  private async conCalculado(cupos: CupoEntity[]): Promise<CupoConStats[]> {
    if (!cupos.length) return [];
    const gars = await this.gars.find({ select: ['cupoId', 'estado', 'valor', 'contractId'] });
    const anulados = await this.contracts.find({ select: ['id', 'anulado'], where: { anulado: true } });
    const anuladosSet = new Set(anulados.map((c) => c.id));
    return cupos.map((c) => ({
      ...c,
      calculado: cupoStats(
        { id: c.id, valor: c.valor },
        gars.map((g) => ({ cupoId: g.cupoId, estado: g.estado, valor: g.valor, contractAnulado: anuladosSet.has(g.contractId) })),
      ),
    }));
  }

  private async polizasDelCupo(cupoId: string) {
    const gars = await this.gars.find({ where: { cupoId } });
    const anulados = await this.contracts.find({ select: ['id', 'anulado'], where: { anulado: true } });
    const anuladosSet = new Set(anulados.map((c) => c.id));
    return gars.map((g) => ({
      cupoId: g.cupoId, estado: g.estado, valor: g.valor, anulado: g.estado === 'Anulada',
      contractAnulado: anuladosSet.has(g.contractId),
    }));
  }

  private async reglasCupo(dto: Record<string, unknown>): Promise<{ errores: string[]; advertencias: string[] }> {
    const errores: string[] = [];
    const advertencias: string[] = [];
    if (dto.modalidadPoliza === 'Póliza por cupo') {
      let cupo: { id: string; aseguradora: string; valor: number; estado: string; fechaVenc?: string | null } | null = null;
      if (dto.cupoId) {
        const cp = await this.cupos.findOne({ where: { id: dto.cupoId as string } });
        cupo = cp ? { id: cp.id, aseguradora: cp.aseguradora, valor: cp.valor, estado: cp.estado, fechaVenc: cp.fechaVenc } : null;
      }
      const polizas = cupo ? await this.polizasDelCupo(cupo.id) : [];
      const reglas = reglasDeCupo(
        {
          modalidadPoliza: dto.modalidadPoliza as string,
          cupoId: (dto.cupoId as string) ?? null,
          aseguradora: dto.aseguradora as string,
          valor: Number(dto.valor ?? 0),
          fechaVenc: (dto.fechaVenc as string) ?? null,
          poliza: (dto.poliza as string) ?? '',
        },
        { cupo, polizasDelCupo: polizas, hoy: hoyISO() },
      );
      for (const r of reglas) {
        if (r.tipo === 'error') errores.push(r.mensaje);
        else advertencias.push(r.mensaje);
      }
    }
    return { errores, advertencias };
  }

  private async exigeAprobacionSiAplica(nuevoEstado: string | undefined, actual: string | null, ctx: ReqContext): Promise<void> {
    if (nuevoEstado === 'Aprobada' && actual !== 'Aprobada') {
      if (!(await this.roles.tienePermiso(ctx.rol, 'APROBAR'))) {
        throw new Prohibido('Aprobar una póliza requiere el permiso APROBAR.');
      }
    }
  }
}

export { redondear1 };
