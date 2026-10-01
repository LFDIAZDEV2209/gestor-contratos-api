import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity } from './audit.entity';
import { Perm } from '../../common/decorators';
import { paginar, leerPagina } from '../../common/pagination';

/**
 * Auditoría solo lectura (files/03): no existen rutas para modificar
 * ni eliminar registros; la BD además bloquea UPDATE/DELETE por trigger.
 */
@ApiTags('audit')
@Controller('audit')
export class AuditController {
  constructor(
    @InjectRepository(AuditLogEntity) private readonly repo: Repository<AuditLogEntity>,
  ) {}

  @Get()
  @Perm('AUDITAR')
  @ApiQuery({ name: 'usuario', required: false })
  @ApiQuery({ name: 'contractId', required: false })
  @ApiQuery({ name: 'desde', required: false, description: 'AAAA-MM-DD' })
  @ApiQuery({ name: 'hasta', required: false, description: 'AAAA-MM-DD' })
  @ApiQuery({ name: 'accion', required: false })
  @ApiQuery({ name: 'modulo', required: false })
  @ApiQuery({ name: 'campo', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiOperation({ summary: 'Consulta la bitácora inmutable (permiso AUDITAR)' })
  async consultar(@Query() q: Record<string, unknown>) {
    const { page, pageSize } = leerPagina(q, 50);
    const qb = this.repo.createQueryBuilder('a');
    if (q.usuario) qb.andWhere('a.usuario = :usuario', { usuario: q.usuario });
    if (q.contractId) qb.andWhere('a.contractId = :contractId', { contractId: q.contractId });
    if (q.accion) qb.andWhere('a.accion = :accion', { accion: q.accion });
    if (q.modulo) qb.andWhere('a.modulo = :modulo', { modulo: q.modulo });
    if (q.campo) qb.andWhere('a.campo = :campo', { campo: q.campo });
    if (q.desde && q.hasta) {
      qb.andWhere('a.fecha BETWEEN :desde AND :hasta', { desde: q.desde, hasta: q.hasta });
    } else if (q.desde) {
      qb.andWhere('a.fecha >= :desde', { desde: q.desde });
    } else if (q.hasta) {
      qb.andWhere('a.fecha <= :hasta', { hasta: q.hasta });
    }
    const total = await qb.getCount();
    const data = await qb.orderBy('a.id', 'DESC').skip((page - 1) * pageSize).take(pageSize).getMany();
    return paginar(data, total, page, pageSize);
  }
}
