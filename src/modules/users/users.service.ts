import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from './users.entity';
import { UsuarioInfo, ROLES } from '../../common/decorators';
import { newId } from '../../common/ids';
import { ApiError, Conflicto, NoEncontrado, Validacion } from '../../common/exceptions/api-exception';
import { ReqContext } from '../../common/req-context';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity) private readonly repo: Repository<UserEntity>,
    private readonly audit: AuditService,
  ) {}

  listar(): Promise<UserEntity[]> {
    return this.repo.find({ order: { nombre: 'ASC' } });
  }

  async obtener(id: string): Promise<UserEntity> {
    const u = await this.repo.findOne({ where: { id } });
    if (!u) throw new NoEncontrado(`El usuario ${id}`);
    return u;
  }

  async obtenerPorEmail(email: string): Promise<UserEntity | null> {
    return this.repo.findOne({ where: { email: email.trim().toLowerCase() } });
  }

  /** Para el guard: usuario activo (rol y estado vigentes). */
  async obtenerActivo(id: string): Promise<UsuarioInfo> {
    const u = await this.repo.findOne({ where: { id } });
    if (!u || u.estado !== 'Activo') {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Token ausente o vencido.');
    }
    return { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol };
  }

  async crear(dto: { nombre: string; email: string; rol: string }, ctx: ReqContext): Promise<UserEntity> {
    this.validarRol(dto.rol);
    const email = dto.email.trim().toLowerCase();
    if (await this.repo.findOne({ where: { email } })) {
      throw new Conflicto(`Ya existe un usuario con el correo ${email}.`, ['email']);
    }
    const u = await this.repo.save(
      this.repo.create({
        id: newId('U'),
        nombre: dto.nombre.trim(),
        email,
        rol: dto.rol,
        estado: 'Activo',
      }),
    );
    await this.audit.registrar(ctx, [{ modulo: 'Sistema', accion: 'USUARIO', nuevo: `${u.nombre} (${u.email}, ${u.rol})` }]);
    return u;
  }

  /** Actualiza nombre/email/rol con bloqueo optimista (version). */
  async actualizar(id: string, cambios: Partial<Pick<UserEntity, 'nombre' | 'email' | 'rol'>>, version: number, ctx: ReqContext): Promise<UserEntity> {
    const u = await this.obtener(id);
    if (cambios.rol) this.validarRol(cambios.rol);
    if (cambios.email) {
      const email = cambios.email.trim().toLowerCase();
      const otro = await this.repo.findOne({ where: { email } });
      if (otro && otro.id !== id) throw new Conflicto(`Ya existe un usuario con el correo ${email}.`, ['email']);
    }
    if (version !== u.version) {
      throw new Conflicto('La versión del registro está desactualizada. Recargue el registro y vuelva a intentarlo.', ['version']);
    }
    const prev = { nombre: u.nombre, email: u.email, rol: u.rol };
    Object.assign(u, cambios);
    const res = await this.repo.update({ id: u.id, version }, { ...cambios, version: version + 1 } as never);
    if (!res.affected) {
      throw new Conflicto('La versión del registro está desactualizada. Recargue el registro y vuelva a intentarlo.', ['version']);
    }
    const entradas = (['nombre', 'email', 'rol'] as const)
      .filter((k) => cambios[k] !== undefined && String(prev[k]) !== String(cambios[k]))
      .map((k) => ({
        modulo: 'Sistema',
        accion: 'USUARIO',
        campo: k,
        anterior: String(prev[k]),
        nuevo: String(cambios[k]),
      }));
    await this.audit.registrar(ctx, entradas);
    return this.obtener(id);
  }

  /** Anulación de usuario = estado Inactivo (files/08); el historial se conserva. */
  async anular(id: string, motivo: string, ctx: ReqContext): Promise<UserEntity> {
    const u = await this.obtener(id);
    const res = await this.repo.update(
      { id: u.id, version: u.version },
      { estado: 'Inactivo', motivoAnulacion: motivo, version: u.version + 1 },
    );
    if (!res.affected) {
      throw new Conflicto('La versión del registro está desactualizada. Recargue el registro y vuelva a intentarlo.', ['version']);
    }
    await this.audit.registrar(ctx, [
      { modulo: 'Sistema', accion: 'USUARIO', campo: 'estado', anterior: 'Activo', nuevo: 'Inactivo', obs: motivo },
    ]);
    return this.obtener(id);
  }

  private validarRol(rol: string): void {
    if (!ROLES.includes(rol as (typeof ROLES)[number])) {
      throw new Validacion(`Rol inválido: ${rol}.`, ['rol']);
    }
  }
}
