import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RolePermissionEntity } from './roles.entity';
import { Permiso } from '../../common/decorators';
import { ReqContext } from '../../common/req-context';
import { AuditService } from '../audit/audit.service';
import { EntradaAuditoria } from '../audit/audit.service';

export interface MatrizDto {
  roles: string[];
  permisos: Permiso[];
  matriz: Record<string, Record<Permiso, boolean>>;
}

export interface CambioPermiso {
  rol: string;
  permiso: Permiso;
  habilitado: boolean;
}

const TTL_CACHE_MS = 5_000;

/** Matriz rol × permiso de files/08, validada por el PermissionsGuard. */
@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);
  private cache: { matriz: Map<string, Set<Permiso>>; expira: number } | null = null;

  constructor(
    @InjectRepository(RolePermissionEntity)
    private readonly repo: Repository<RolePermissionEntity>,
    private readonly audit: AuditService,
  ) {}

  /** ADMINISTRADOR siempre tiene todo; el resto según la matriz. */
  async tienePermiso(rol: string, permiso: Permiso): Promise<boolean> {
    if (rol === 'ADMINISTRADOR') return true;
    return (await this.permisosDeRol(rol)).has(permiso);
  }

  async permisosDeRol(rol: string): Promise<Set<Permiso>> {
    return (await this.matriz()).get(rol) ?? new Set<Permiso>();
  }

  async permisosDe(roles: string[]): Promise<Record<string, Permiso[]>> {
    const matriz = await this.matriz();
    const out: Record<string, Permiso[]> = {};
    for (const r of roles) out[r] = [...(matriz.get(r) ?? [])];
    return out;
  }

  private async matriz(): Promise<Map<string, Set<Permiso>>> {
    if (this.cache && this.cache.expira > Date.now()) return this.cache.matriz;
    const filas = await this.repo.find({ where: { habilitado: true } });
    const matriz = new Map<string, Set<Permiso>>();
    for (const f of filas) {
      const set = matriz.get(f.rol) ?? new Set<Permiso>();
      set.add(f.permiso as Permiso);
      matriz.set(f.rol, set);
    }
    this.cache = { matriz, expira: Date.now() + TTL_CACHE_MS };
    return matriz;
  }

  invalidarCache(): void {
    this.cache = null;
  }

  async consultarMatriz(roles: string[]): Promise<MatrizDto> {
    const filas = await this.repo.find();
    const matriz: Record<string, Record<Permiso, boolean>> = {};
    const listaPermisos: Permiso[] = ['VER', 'CREAR', 'EDITAR', 'APROBAR', 'ANULAR', 'EXPORTAR', 'AUDITAR'];
    for (const rol of roles) {
      matriz[rol] = {} as Record<Permiso, boolean>;
      for (const p of listaPermisos) {
        if (rol === 'ADMINISTRADOR') {
          matriz[rol][p] = true;
          continue;
        }
        const fila = filas.find((f) => f.rol === rol && f.permiso === p);
        matriz[rol][p] = !!fila?.habilitado;
      }
    }
    return { roles, permisos: listaPermisos, matriz };
  }

  /** Actualiza la matriz; ADMINISTRADOR siempre queda con todo (files/08). */
  async actualizarMatriz(cambios: CambioPermiso[], ctx: ReqContext, roles: string[]): Promise<MatrizDto> {
    const entradas: EntradaAuditoria[] = [];
    for (const c of cambios) {
      const habilitado = c.rol === 'ADMINISTRADOR' ? true : c.habilitado;
      const existente = await this.repo.findOne({ where: { rol: c.rol, permiso: c.permiso } });
      if (existente) {
        if (existente.habilitado !== habilitado) {
          existente.habilitado = habilitado;
          await this.repo.save(existente);
        }
      } else {
        await this.repo.insert(this.repo.create({ rol: c.rol, permiso: c.permiso, habilitado }));
      }
      entradas.push({
        modulo: 'Sistema',
        accion: 'PERMISO',
        campo: `${c.rol}.${c.permiso}`,
        anterior: existente?.habilitado === true ? 'true' : existente ? 'false' : '(no definido)',
        nuevo: String(habilitado),
      });
    }
    this.invalidarCache();
    await this.audit.registrar(ctx, entradas);
    return this.consultarMatriz(roles);
  }
}
