import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentEntity } from './entities/payments.entity';
import { NoEncontrado, Prohibido, Validacion } from '../../common/exceptions/api-exception';
import { ReqContext } from '../../common/req-context';
import { AuditService } from '../audit/audit.service';
import { RolesService } from '../roles/roles.service';
import { hoyISO } from '../../common/dates';

/** Aprobar pagos y marcarlos como pagados: exige el permiso APROBAR (files/05 §9). */
@Injectable()
export class PagosService {
  constructor(
    @InjectRepository(PaymentEntity) private readonly pays: Repository<PaymentEntity>,
    private readonly audit: AuditService,
    private readonly roles: RolesService,
  ) {}

  async aprobar(id: string, ctx: ReqContext): Promise<PaymentEntity> {
    const p = await this.obtener(id);
    if (!(await this.roles.tienePermiso(ctx.rol, 'APROBAR'))) {
      throw new Prohibido('Aprobar un pago requiere el permiso APROBAR.');
    }
    if (p.estado === 'Pagado') throw new Validacion('El pago ya está pagado.');
    if (p.estado === 'Anulado') throw new Validacion('El pago está anulado.');
    const prev = p.estado;
    const res = await this.pays.update(
      { id: p.id, version: p.version },
      { estado: 'Aprobado', fechaAprob: p.fechaAprob ?? hoyISO(), version: p.version + 1 },
    );
    if (!res.affected) throw new Prohibido('No se pudo aprobar (registro modificado por otro usuario).');
    await this.audit.registrar(ctx, [{
      contractId: p.contractId, modulo: 'Pagos', accion: 'APROBAR', campo: 'estado',
      anterior: prev, nuevo: 'Aprobado',
    }]);
    return this.obtener(id);
  }

  async pagar(id: string, ctx: ReqContext): Promise<PaymentEntity> {
    const p = await this.obtener(id);
    if (!(await this.roles.tienePermiso(ctx.rol, 'APROBAR'))) {
      throw new Prohibido('Marcar un pago como pagado requiere el permiso APROBAR.');
    }
    if (p.estado === 'Pagado') throw new Validacion('El pago ya está pagado.');
    if (p.estado === 'Anulado') throw new Validacion('El pago está anulado.');
    const prev = p.estado;
    const res = await this.pays.update(
      { id: p.id, version: p.version },
      {
        estado: 'Pagado',
        fechaAprob: p.fechaAprob ?? hoyISO(),
        fechaPago: hoyISO(),
        version: p.version + 1,
      },
    );
    if (!res.affected) throw new Prohibido('No se pudo pagar (registro modificado por otro usuario).');
    await this.audit.registrar(ctx, [{
      contractId: p.contractId, modulo: 'Pagos', accion: 'PAGAR', campo: 'estado',
      anterior: prev, nuevo: 'Pagado',
    }]);
    return this.obtener(id);
  }

  private async obtener(id: string): Promise<PaymentEntity> {
    const p = await this.pays.findOne({ where: { id } });
    if (!p) throw new NoEncontrado(`El pago ${id}`);
    return p;
  }
}
